'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clawd', {
  onInit:        (cb) => ipcRenderer.on('init',         (_, d) => cb(d)),
  onStateChange: (cb) => ipcRenderer.on('state-change', (_, s) => cb(s)),
  onThemeChange: (cb) => ipcRenderer.on('theme-change', (_, t) => cb(t)),
  dragStart:     ()  => ipcRenderer.send('drag-start'),
  dragMove:      ()  => ipcRenderer.send('drag-move'),
  dragEnd:       ()  => ipcRenderer.send('drag-end'),
  setTheme:      (t) => ipcRenderer.send('set-theme', t),
  showMenu:      ()  => ipcRenderer.send('show-context-menu'),
  setIgnoreMouse:(v) => ipcRenderer.send('set-ignore-mouse', v),
  getSettings:   ()  => ipcRenderer.invoke('get-settings'),
});
