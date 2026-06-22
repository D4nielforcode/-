'use strict';
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'clawd-state.json');
const CFG_FILE   = path.join(
  process.env.APPDATA || path.join(os.homedir(), '.config'),
  'clawd', 'settings.json',
);

let win          = null;
let dragStart    = null;
let currentTheme = 'clawd';

// ── Persistent settings ──────────────────────────────────────────────────
function loadCfg() {
  try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (_) { return {}; }
}
function saveCfg(s) {
  try { fs.mkdirSync(path.dirname(CFG_FILE), { recursive: true }); fs.writeFileSync(CFG_FILE, JSON.stringify(s, null, 2)); } catch (_) {}
}
function setTheme(theme) {
  currentTheme = theme;
  const s = loadCfg(); s.theme = theme; saveCfg(s);
  win?.webContents.send('theme-change', theme);
}

// ── Window ───────────────────────────────────────────────────────────────
function createWindow() {
  const cfg = loadCfg();
  currentTheme = cfg.theme || 'clawd';
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 160, height: 160,
    x: cfg.x ?? sw - 180,
    y: cfg.y ?? sh - 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('init', { theme: currentTheme });
  });

  // Save position when moved
  win.on('moved', () => {
    const [x, y] = win.getPosition();
    const s = loadCfg(); s.x = x; s.y = y; saveCfg(s);
  });

  // Poll state file
  let lastMtime = 0;
  let lastState = 'idle';

  const poll = setInterval(() => {
    if (!win) return;
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const stat = fs.statSync(STATE_FILE);

      if (stat.mtimeMs !== lastMtime) {
        lastMtime = stat.mtimeMs;
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (data.state !== lastState) {
          lastState = data.state;
          win?.webContents.send('state-change', data.state);
        }
      } else {
        // Auto-sleep after 5 minutes of no Claude Code activity
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (lastState !== 'sleeping' && Date.now() - (data.timestamp || 0) > 5 * 60 * 1000) {
          lastState = 'sleeping';
          win?.webContents.send('state-change', 'sleeping');
        }
      }
    } catch (_) {}
  }, 800);

  win.on('closed', () => { clearInterval(poll); win = null; });
}

// ── IPC ──────────────────────────────────────────────────────────────────
ipcMain.on('drag-start', () => {
  if (!win) return;
  dragStart = { cursor: screen.getCursorScreenPoint(), pos: win.getPosition() };
});
ipcMain.on('drag-move', () => {
  if (!win || !dragStart) return;
  const c = screen.getCursorScreenPoint();
  win.setPosition(dragStart.pos[0] + c.x - dragStart.cursor.x, dragStart.pos[1] + c.y - dragStart.cursor.y);
});
ipcMain.on('drag-end', () => { dragStart = null; });

ipcMain.on('set-theme', (_, t) => setTheme(t));

ipcMain.on('show-context-menu', () => {
  if (!win) return;
  Menu.buildFromTemplate([
    {
      label: 'Theme', submenu: [
        { label: 'Clawd (crab)', type: 'radio', checked: currentTheme === 'clawd', click: () => setTheme('clawd') },
        { label: 'Calico (cat)', type: 'radio', checked: currentTheme === 'calico', click: () => setTheme('calico') },
      ],
    },
    { type: 'separator' },
    { label: 'Quit Clawd', click: () => app.quit() },
  ]).popup({ window: win });
});

ipcMain.on('set-ignore-mouse', (_, v) => win?.setIgnoreMouseEvents(v, { forward: true }));
ipcMain.handle('get-settings', () => loadCfg());

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win) createWindow(); });
