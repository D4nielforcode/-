# Clawd on Desk 🦀

A tiny desktop mascot that lives on your screen and reacts to Claude Code activity.

- **Clawd** — orange pixel crab 🦀
- **Calico** — tri-colour cat 🐱

Right-click to switch themes or quit. Drag to move anywhere on screen.

## States

| State | Trigger |
|---|---|
| idle | no activity |
| thinking | prompt submitted / non-file tool |
| working | file writes, edits, Bash commands |
| happy | Claude Code task finished |
| notification | permission request / user attention needed |
| worried | error state |
| sleeping | no activity for 5 minutes |
| waking | activity resumes after sleeping |

## Quick install

**Requires:** [Node.js](https://nodejs.org) ≥ 16 and [Git](https://git-scm.com).

```bash
# 1. Clone
git clone https://github.com/d4nielforcode/- clawd-on-desk
cd clawd-on-desk

# 2. One-command setup (installs deps + hooks + auto-start)
node scripts/setup.js

# 3. Launch
npm start
```

After setup the mascot starts automatically every time you log in.
To stop it: right-click the mascot → **Quit Clawd**.

## Manual start (no auto-start)

```bash
npm start
```

## Uninstall

```bash
# Remove auto-start only (the app stays)
# macOS
launchctl unload ~/Library/LaunchAgents/com.clawd.mascot.plist
rm ~/Library/LaunchAgents/com.clawd.mascot.plist

# Windows  (run in cmd.exe)
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v ClaWD /f

# Linux
rm ~/.config/autostart/clawd.desktop
```

To also remove the Claude Code hooks, open `~/.claude/settings.json` and
delete the entries whose `command` contains `clawd-hook`.

## Custom theme

Drop any 8-frame spritesheet into `renderer/sprites.js` following the existing
`drawClawd` / `drawCalico` pattern, then add it to `window.Sprites.draw`
and to the context-menu in `main.js`.
