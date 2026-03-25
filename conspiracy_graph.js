/**
 * Conspiracy Network Graph
 *
 * Tracks how conspiracy topics connect during a debate.
 * When someone goes vaccines → bill gates → 5G, lines draw between nodes.
 * By end of show, you see the full conspiracy web.
 */

// Known connections from 93-stream analysis
const KNOWN_CONNECTIONS = {
  'vaccines': ['big_pharma', 'autism', 'rfk', 'mandates', 'vaers', 'natural_immunity', 'myocarditis'],
  'big_pharma': ['vaccines', 'censorship', 'bill_gates', 'ivermectin', 'liability'],
  'flat_earth': ['nasa', 'moon_landing', 'illuminati', 'censorship'],
  'rfk': ['vaccines', 'big_pharma', 'censorship', 'fluoride', 'food_dyes'],
  'censorship': ['big_pharma', 'rfk', 'illuminati', 'lab_leak'],
  'bill_gates': ['vaccines', 'big_pharma', 'illuminati', '5g', 'graphene'],
  'illuminati': ['bill_gates', 'censorship', 'flat_earth', 'new_world_order'],
  'lab_leak': ['censorship', 'big_pharma', 'bill_gates', 'gain_of_function'],
  '5g': ['bill_gates', 'graphene', 'vaccines'],
  'natural_immunity': ['vaccines', 'terrain_theory', 'mandates'],
  'terrain_theory': ['natural_immunity', 'germ_denial', 'ivermectin'],
};

let activeNodes = new Set();   // Topics mentioned this session
let activeEdges = [];          // Connections drawn
let claimSequence = [];        // Order claims were made

/**
 * Map a claim/topic to a graph node ID.
 */
function claimToNode(claim) {
  const lower = (claim || '').toLowerCase();
  if (lower.includes('vaccin') || lower.includes('autism') || lower.includes('vaers')) return 'vaccines';
  if (lower.includes('flat') || lower.includes('globe')) return 'flat_earth';
  if (lower.includes('pharma') || lower.includes('profit')) return 'big_pharma';
  if (lower.includes('rfk') || lower.includes('maha') || lower.includes('kennedy')) return 'rfk';
  if (lower.includes('censor') || lower.includes('silence') || lower.includes('suppress')) return 'censorship';
  if (lower.includes('gates')) return 'bill_gates';
  if (lower.includes('illuminat') || lower.includes('new world') || lower.includes('deep state')) return 'illuminati';
  if (lower.includes('lab leak') || lower.includes('wuhan') || lower.includes('bioweapon')) return 'lab_leak';
  if (lower.includes('5g') || lower.includes('five g')) return '5g';
  if (lower.includes('natural immun')) return 'natural_immunity';
  if (lower.includes('terrain') || lower.includes('germ theory')) return 'terrain_theory';
  if (lower.includes('ivermectin')) return 'ivermectin';
  if (lower.includes('myocarditis') || lower.includes('heart')) return 'myocarditis';
  if (lower.includes('mandate') || lower.includes('freedom')) return 'mandates';
  if (lower.includes('graphene') || lower.includes('nanobot')) return 'graphene';
  if (lower.includes('moon') || lower.includes('nasa')) return 'moon_landing';
  if (lower.includes('fluoride')) return 'fluoride';
  if (lower.includes('gene therapy') || lower.includes('mrna')) return 'gene_therapy';
  if (lower.includes('spike protein')) return 'spike_protein';
  return null;
}

/**
 * Add a claim to the graph. Returns new edges if connections found.
 */
function addClaim(claim) {
  const node = claimToNode(claim);
  if (!node) return { node: null, newEdges: [] };

  const isNew = !activeNodes.has(node);
  activeNodes.add(node);
  claimSequence.push({ node, time: Date.now() });

  // Check for connections to previously mentioned topics
  const newEdges = [];
  const connections = KNOWN_CONNECTIONS[node] || [];
  for (const connected of connections) {
    if (activeNodes.has(connected)) {
      const edgeId = [node, connected].sort().join('↔');
      if (!activeEdges.find(e => e.id === edgeId)) {
        const edge = { id: edgeId, from: node, to: connected, time: Date.now() };
        activeEdges.push(edge);
        newEdges.push(edge);
      }
    }
  }

  if (newEdges.length > 0) {
    console.log(`[ConspiracyGraph] ${node} connected to: ${newEdges.map(e => e.to === node ? e.from : e.to).join(', ')}`);
  }

  return { node, isNew, newEdges, totalNodes: activeNodes.size, totalEdges: activeEdges.length };
}

/**
 * Get the full graph state for rendering.
 */
function getGraph() {
  return {
    nodes: [...activeNodes],
    edges: activeEdges,
    sequence: claimSequence,
    pipelineLength: claimSequence.length,
  };
}

/**
 * Get Marie's commentary on the graph.
 */
function getGraphCommentary() {
  const n = activeNodes.size;
  const e = activeEdges.length;
  if (n <= 1) return null;
  if (e === 0) return `${n} conspiracy topics and somehow none of them are connected. That's new.`;
  if (e <= 3) return `The conspiracy web is forming. ${n} topics, ${e} connections so far.`;
  if (e <= 6) return `Classic pipeline. ${n} topics, ${e} connections. They always lead to each other.`;
  if (e <= 10) return `We're building a conspiracy spiderweb here. ${n} topics, ${e} connections. Impressive.`;
  return `And there it is. The full conspiracy network. ${n} topics, ${e} connections. From vaccines to Illuminati in one conversation.`;
}

function resetGraph() {
  activeNodes = new Set();
  activeEdges = [];
  claimSequence = [];
}

module.exports = { addClaim, getGraph, getGraphCommentary, resetGraph };
