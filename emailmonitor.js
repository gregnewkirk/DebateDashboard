/**
 * Email Donation Monitor
 *
 * Monitors an IMAP inbox for donation notification emails from
 * Venmo, Stripe, PayPal, and Patreon. Parses out donor name,
 * amount, and message, then pushes to the dashboard via the
 * existing payment webhook.
 *
 * Why email instead of APIs: One integration covers all four
 * services. All of them send notification emails immediately
 * when a payment comes in.
 */

const imapSimple = require('imap-simple');
const { simpleParser } = require('mailparser');

// How often to check for new emails (ms)
const POLL_INTERVAL = 5000; // 5 seconds — fast enough for live stream

// Dashboard webhook endpoint
const WEBHOOK_URL = 'http://localhost:8080/api/payment';

// Track processed email UIDs so we don't double-fire
const processedUIDs = new Set();

// ============================================================
// EMAIL PARSERS — one per donation service
// ============================================================

const PARSERS = [
  {
    source: 'venmo',
    // Venmo sends from venmo@venmo.com or various @venmo.com addresses
    matchSender: (from) => /venmo/i.test(from),
    // Broadened: "paid you", "sent you", "received", "payment", "transfer"
    matchSubject: (subj) => /paid you|sent you|received|payment|transfer|completed/i.test(subj),
    parse: (subject, textBody, htmlBody) => {
      const text = textBody || htmlBody || '';

      let name = 'Someone';
      let amount = '$0';
      let message = '';

      // Pattern 1: "Greg, John Smith paid you $5.00"
      const subjMatch1 = subject.match(/,\s*(.+?)\s+paid you\s+(\$[\d,.]+)/i);
      // Pattern 2: "John Smith sent you $5.00"
      const subjMatch2 = subject.match(/(.+?)\s+sent you\s+(\$[\d,.]+)/i);
      // Pattern 3: "You received $5.00 from John Smith"
      const subjMatch3 = subject.match(/received\s+(\$[\d,.]+)\s+from\s+(.+)/i);
      // Pattern 4: "$5.00 payment from John Smith"
      const subjMatch4 = subject.match(/(\$[\d,.]+)\s+(?:payment|transfer)\s+from\s+(.+)/i);

      if (subjMatch1) { name = subjMatch1[1].trim(); amount = subjMatch1[2]; }
      else if (subjMatch2) { name = subjMatch2[1].trim(); amount = subjMatch2[2]; }
      else if (subjMatch3) { amount = subjMatch3[1]; name = subjMatch3[2].trim(); }
      else if (subjMatch4) { amount = subjMatch4[1]; name = subjMatch4[2].trim(); }

      // Fallback: extract any dollar amount from subject or body
      if (amount === '$0') {
        const amtMatch = subject.match(/\$[\d,.]+/) || text.match(/\$[\d,.]+/);
        if (amtMatch) amount = amtMatch[0];
      }

      // Fallback: extract name from body if not in subject
      if (name === 'Someone') {
        const bodyNameMatch = text.match(/(?:from|paid by|sent by)\s+([A-Z][a-z]+ [A-Z][a-z]+)/);
        if (bodyNameMatch) name = bodyNameMatch[1].trim();
      }

      // Try to get the note/message from body
      const noteMatch = text.match(/(?:note|message)[:\s]*[""]?([^"""\n]{1,200})/i);
      if (noteMatch) message = noteMatch[1].trim();
      if (!message) {
        const altNote = text.match(/paid you[\s\S]{0,100}?["""](.+?)["""]/);
        if (altNote) message = altNote[1].trim();
      }

      return { source: 'venmo', name, amount, message };
    },
  },

  {
    source: 'paypal',
    // PayPal sends from service@paypal.com or member@paypal.com
    matchSender: (from) => /paypal/i.test(from),
    matchSubject: (subj) => /sent you|received|payment/i.test(subj),
    parse: (subject, textBody, htmlBody) => {
      const text = textBody || htmlBody || '';

      let name = 'Someone';
      let amount = '$0';
      let message = '';

      // Subject: "You received a payment of $10.00 from John Smith"
      // or "John Smith sent you $10.00"
      const recvMatch = subject.match(/(?:received.*?)\s+(\$[\d,.]+)\s+from\s+(.+)/i);
      const sentMatch = subject.match(/(.+?)\s+sent you\s+(\$[\d,.]+)/i);

      if (recvMatch) {
        amount = recvMatch[1];
        name = recvMatch[2].trim();
      } else if (sentMatch) {
        name = sentMatch[1].trim();
        amount = sentMatch[2];
      }

      // Fallback: extract amount from body
      if (amount === '$0') {
        const amtMatch = text.match(/\$[\d,.]+/);
        if (amtMatch) amount = amtMatch[0];
      }

      // Try to find note in body
      const noteMatch = text.match(/(?:note|message|memo)[:\s]*(.{1,200}?)(?:\n|$)/i);
      if (noteMatch) message = noteMatch[1].trim();

      return { source: 'paypal', name, amount, message };
    },
  },

  {
    source: 'stripe',
    // Stripe sends from receipts@stripe.com or notifications@stripe.com
    matchSender: (from) => /stripe/i.test(from),
    matchSubject: (subj) => /payment|charge|receipt|succeeded/i.test(subj),
    parse: (subject, textBody, htmlBody) => {
      const text = textBody || htmlBody || '';

      let name = 'A Supporter';
      let amount = '$0';
      let message = '';

      // Stripe receipts: "Receipt for your payment of $25.00"
      // or custom: "You received a $25.00 payment"
      const amtMatch = text.match(/\$[\d,.]+/) || subject.match(/\$[\d,.]+/);
      if (amtMatch) amount = amtMatch[0];

      // Try to get customer name from body
      const nameMatch = text.match(/(?:from|customer|name)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/);
      if (nameMatch) name = nameMatch[1].trim();

      // Note/description
      const noteMatch = text.match(/(?:description|note|message)[:\s]*(.{1,200}?)(?:\n|$)/i);
      if (noteMatch) message = noteMatch[1].trim();

      return { source: 'stripe', name, amount, message };
    },
  },

  {
    source: 'patreon',
    // Patreon sends from various @patreon.com addresses
    matchSender: (from) => /patreon/i.test(from),
    matchSubject: (subj) => /pledge|patron|new member|payment|joined/i.test(subj),
    parse: (subject, textBody, htmlBody) => {
      const text = textBody || htmlBody || '';

      let name = 'A Patron';
      let amount = '$0';
      let message = '';

      // "You have a new patron!" or "John joined your membership"
      const nameMatch = text.match(/(\w[\w\s]{0,30})\s+(?:joined|pledged|is now|became)/i)
        || subject.match(/(\w[\w\s]{0,30})\s+(?:joined|pledged|is now|became)/i);
      if (nameMatch) name = nameMatch[1].trim();

      // Amount
      const amtMatch = text.match(/\$[\d,.]+/) || subject.match(/\$[\d,.]+/);
      if (amtMatch) amount = amtMatch[0];

      // Message from patron
      const noteMatch = text.match(/(?:message|note)[:\s]*(.{1,200}?)(?:\n|$)/i);
      if (noteMatch) message = noteMatch[1].trim();

      return { source: 'patreon', name, amount, message };
    },
  },
];

// ============================================================
// IMAP MONITORING
// ============================================================

let connection = null;
let pollTimer = null;
let startedAt = null; // Only process emails arriving AFTER startup

/**
 * Connect to the IMAP server and start polling for donation emails.
 */
async function startEmailMonitor(config) {
  const imapConfig = {
    imap: {
      user: config.email,
      password: config.password,
      host: config.host || 'imap.gmail.com',
      port: config.port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  };

  try {
    connection = await imapSimple.connect(imapConfig);
    console.log(`[EmailMonitor] Connected to ${imapConfig.imap.host} as ${config.email}`);

    // Open inbox
    await connection.openBox('INBOX');

    // Mark startup time — ignore all existing emails, only watch for new ones
    startedAt = new Date();
    console.log(`[EmailMonitor] Ignoring emails before ${startedAt.toISOString()}`);

    // Seed processedUIDs with all existing donation emails so we never fire on old ones
    await seedExistingEmails();

    // Start polling
    pollTimer = setInterval(checkForDonations, POLL_INTERVAL);

    console.log(`[EmailMonitor] Polling every ${POLL_INTERVAL / 1000}s for donations from: Venmo, PayPal, Stripe, Patreon`);
  } catch (err) {
    console.error('[EmailMonitor] Connection failed:', err.message);
    console.error('[EmailMonitor] Make sure your email/password are set in .env');

    // Retry after 30 seconds
    setTimeout(() => startEmailMonitor(config), 30000);
  }
}

/**
 * On startup, mark all existing donation emails as "already processed"
 * so we don't spam alerts for old emails.
 */
async function seedExistingEmails() {
  if (!connection) return;
  try {
    const searchCriteria = [
      ['OR',
        ['OR', ['FROM', 'venmo'], ['FROM', 'paypal']],
        ['OR', ['FROM', 'stripe'], ['FROM', 'patreon']],
      ],
    ];
    const messages = await connection.search(searchCriteria, { bodies: [], markSeen: false });
    for (const msg of messages) {
      processedUIDs.add(msg.attributes.uid);
    }
    console.log(`[EmailMonitor] Skipping ${processedUIDs.size} existing donation emails`);
  } catch (err) {
    console.warn('[EmailMonitor] Could not seed existing emails:', err.message);
  }
}

/**
 * Check for new donation emails since last check.
 */
async function checkForDonations() {
  if (!connection) return;

  try {
    // Search for unread emails from donation services
    const searchCriteria = [
      'UNSEEN',
      ['OR',
        ['OR',
          ['FROM', 'venmo'],
          ['FROM', 'paypal'],
        ],
        ['OR',
          ['FROM', 'stripe'],
          ['FROM', 'patreon'],
        ],
      ],
    ];

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false, // Don't mark as read — let the user do that
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const msg of messages) {
      const uid = msg.attributes.uid;
      if (processedUIDs.has(uid)) continue;

      processedUIDs.add(uid);

      // Parse the full email
      const rawEmail = msg.parts.find(p => p.which === '')?.body || '';
      let parsed;
      try {
        parsed = await simpleParser(rawEmail);
      } catch {
        // Fallback: extract from parts
        const header = msg.parts.find(p => p.which === 'HEADER')?.body || {};
        parsed = {
          from: { text: (header.from || [''])[0] },
          subject: (header.subject || [''])[0],
          text: msg.parts.find(p => p.which === 'TEXT')?.body || '',
          html: '',
        };
      }

      const from = parsed.from?.text || '';
      const subject = parsed.subject || '';
      const textBody = parsed.text || '';
      const htmlBody = parsed.html || '';

      // Log EVERY donation-service email we see (for debugging missed donations)
      console.log(`[EmailMonitor] New email — From: "${from.substring(0, 40)}" Subject: "${subject.substring(0, 60)}"`);

      // Try each parser
      let matched = false;
      for (const parser of PARSERS) {
        if (parser.matchSender(from)) {
          if (parser.matchSubject(subject)) {
            matched = true;
            const donation = parser.parse(subject, textBody, htmlBody);

            console.log(`[EmailMonitor] 💰 MATCHED ${donation.source.toUpperCase()}: ${donation.name} — ${donation.amount}`);
            if (donation.message) {
              console.log(`[EmailMonitor] Message: "${donation.message}"`);
            }

            // First name only — protect donor privacy on livestream
            if (donation.name) {
              donation.name = donation.name.trim().split(/\s+/)[0];
            }

            // Push to dashboard webhook
            try {
              await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(donation),
              });
              console.log(`[EmailMonitor] ✅ Pushed to dashboard`);
            } catch (err) {
              console.error('[EmailMonitor] ❌ Webhook push failed:', err.message);
            }

            break; // Only match one parser per email
          } else {
            // Sender matched but subject didn't — log it so we can fix the parser
            console.log(`[EmailMonitor] ⚠️ UNMATCHED ${parser.source.toUpperCase()} email — subject didn't match pattern: "${subject.substring(0, 80)}"`);
          }
        }
      }
      if (!matched) {
        console.log(`[EmailMonitor] ⚠️ No parser matched this email`);
      }
    }
  } catch (err) {
    if (err.message?.includes('Not authenticated') || err.message?.includes('connection')) {
      console.error('[EmailMonitor] Connection lost, reconnecting...');
      connection = null;
      clearInterval(pollTimer);
      // Config will need to be passed again — handled by server.js
    }
  }
}

/**
 * Stop the email monitor.
 */
function stopEmailMonitor() {
  if (pollTimer) clearInterval(pollTimer);
  if (connection) {
    try { connection.end(); } catch {}
  }
  console.log('[EmailMonitor] Stopped');
}

module.exports = { startEmailMonitor, stopEmailMonitor };
