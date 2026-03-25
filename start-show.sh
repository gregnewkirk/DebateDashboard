#!/bin/bash
# Start the Debate Dashboard show
# 1. Start the server (with server-side mic capture)
# 2. Open Safari to the dashboard
# 3. True fullscreen Safari (Cmd+Ctrl+F)
#
# Mic is captured SERVER-SIDE via SoX + Whisper — Safari is display-only

# Start server if not running
if ! lsof -i :8080 -sTCP:LISTEN > /dev/null 2>&1; then
  cd /Users/gregnewkirk/CCODE/DebateDashboard
  node server.js &
  sleep 3
fi

# Open dashboard in Safari
open -a Safari "http://localhost:8080"
sleep 2

# True fullscreen Safari (Cmd+Ctrl+F)
# Requires Terminal in System Settings → Privacy & Security → Accessibility
osascript -e '
tell application "Safari"
  activate
  delay 1
end tell
tell application "System Events"
  tell process "Safari"
    keystroke "f" using {command down, control down}
  end tell
end tell
' 2>/dev/null || echo "(For auto-fullscreen: grant Terminal accessibility permission, or just press Cmd+Ctrl+F)"

echo "Show is live! Mic is server-side — Safari is display-only."
