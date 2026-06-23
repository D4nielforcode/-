#!/usr/bin/env node
'use strict';
// Claude Code lifecycle hook — writes mascot state to a temp file.
// Called as: node clawd-hook.js <PreToolUse|PostToolUse|Stop|Notification>
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const STATE_FILE = path.join(os.tmpdir(), 'clawd-state.json');
const event = process.argv[2] || 'Stop';

const TOOL_ACTIVE = new Set(['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'mcp']);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (input += c));
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch (_) {}

  let mascotState = 'idle';
  switch (event) {
    case 'PreToolUse': {
      const tool = data.tool_name || '';
      mascotState = TOOL_ACTIVE.has(tool) || tool.startsWith('mcp') ? 'working' : 'thinking';
      break;
    }
    case 'PostToolUse':
      mascotState = 'idle';
      break;
    case 'Stop':
      mascotState = data.stop_hook_active ? 'thinking' : 'happy';
      break;
    case 'Notification':
      mascotState = 'notification';
      break;
    default:
      mascotState = 'idle';
  }

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ state: mascotState, timestamp: Date.now() }));
  } catch (_) {}

  process.exit(0);
});
