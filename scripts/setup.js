#!/usr/bin/env node
'use strict';
/**
 * One-shot setup script:
 *   1. npm install (Electron deps)
 *   2. Registers Claude Code lifecycle hooks in ~/.claude/settings.json
 *   3. Configures OS auto-start
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const ROOT        = path.resolve(__dirname, '..');
const HOOK_SCRIPT = path.join(ROOT, 'hooks', 'clawd-hook.js');
const NODE_BIN    = process.execPath;
const PLATFORM    = process.platform;

log('🦀  Clawd desktop mascot — setup\n');

// ── 1. Dependencies ───────────────────────────────────────────────────────
log('📦  Installing npm dependencies…');
try {
  execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  log('✅  Done\n');
} catch (e) {
  die('npm install failed: ' + e.message);
}

// ── 2. Claude Code hooks ──────────────────────────────────────────────────
log('🪝  Registering Claude Code hooks…');
setupHooks();

// ── 3. Auto-start ─────────────────────────────────────────────────────────
log('\n🚀  Configuring auto-start…');
setupAutoStart();

log('\n✅  Setup complete!');
log('   Run  npm start  in the clawd-on-desk folder to launch the mascot.');
log('   Or restart your computer — it will appear automatically.\n');

// ── Hooks impl ────────────────────────────────────────────────────────────
function setupHooks() {
  const cfgDir  = path.join(os.homedir(), '.claude');
  const cfgFile = path.join(cfgDir, 'settings.json');

  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (_) {}
  if (!settings.hooks) settings.hooks = {};

  const events = ['PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
  let changed = false;

  for (const evt of events) {
    if (!Array.isArray(settings.hooks[evt])) settings.hooks[evt] = [];
    const already = settings.hooks[evt].some(h =>
      h.hooks?.some(hh => (hh.command || '').includes('clawd-hook'))
    );
    if (!already) {
      settings.hooks[evt].push({
        matcher: '',
        hooks: [{ type: 'command', command: `"${NODE_BIN}" "${HOOK_SCRIPT}" ${evt}` }],
      });
      changed = true;
    }
  }

  if (changed) {
    try {
      fs.mkdirSync(cfgDir, { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(settings, null, 2));
      log('✅  Hooks written to ~/.claude/settings.json');
    } catch (e) {
      warn('Could not write ~/.claude/settings.json: ' + e.message);
    }
  } else {
    log('ℹ️   Hooks already registered — skipped');
  }
}

// ── Auto-start impl ────────────────────────────────────────────────────────
function setupAutoStart() {
  const electronBin = path.join(ROOT, 'node_modules', '.bin',
    PLATFORM === 'win32' ? 'electron.cmd' : 'electron');

  if (PLATFORM === 'darwin') {
    const plistDir  = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistPath = path.join(plistDir, 'com.clawd.mascot.plist');
    const logDir    = path.join(os.homedir(), '.clawd');
    fs.mkdirSync(logDir, { recursive: true });

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.clawd.mascot</string>
  <key>ProgramArguments</key>
  <array>
    <string>${electronBin}</string>
    <string>${ROOT}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardErrorPath</key><string>${path.join(logDir, 'error.log')}</string>
</dict></plist>`;

    try {
      fs.mkdirSync(plistDir, { recursive: true });
      fs.writeFileSync(plistPath, plist);
      try { execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' }); } catch (_) {}
      log('✅  macOS LaunchAgent created → ' + plistPath);
    } catch (e) { warn('macOS auto-start failed: ' + e.message); }

  } else if (PLATFORM === 'win32') {
    const cmd     = `"${electronBin}" "${ROOT}"`;
    const regKey  = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    try {
      execSync(`reg add "${regKey}" /v "ClaWD" /t REG_SZ /d "${cmd}" /f`, { stdio: 'pipe' });
      log('✅  Windows Registry key added (HKCU Run)');
    } catch (e) {
      warn('Windows auto-start failed: ' + e.message);
      log('   Tip: manually add a shortcut to %APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup');
    }

  } else {
    // Linux / freedesktop
    const autostartDir  = path.join(os.homedir(), '.config', 'autostart');
    const desktopPath   = path.join(autostartDir, 'clawd.desktop');
    const desktop = `[Desktop Entry]
Type=Application
Name=Clawd
Exec="${electronBin}" "${ROOT}"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`;
    try {
      fs.mkdirSync(autostartDir, { recursive: true });
      fs.writeFileSync(desktopPath, desktop);
      log('✅  Linux autostart entry created → ' + desktopPath);
    } catch (e) { warn('Linux auto-start failed: ' + e.message); }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function log(msg)  { console.log(msg); }
function warn(msg) { console.warn('  ⚠️  ' + msg); }
function die(msg)  { console.error('❌  ' + msg); process.exit(1); }
