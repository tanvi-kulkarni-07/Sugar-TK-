# Quick Reference - Collaborative Editor

## 🎯 Start Here

### Terminal 1: Start Backend Server
```bash
cd C:\Users\tkulk\Desktop\Extension\collaborative-editor-server
node server.js
```
✓ Server runs on http://localhost:3000

### Terminal 2: Open Extension in Debug Mode
```bash
cd C:\Users\tkulk\Desktop\Extension\collaborative-editor
code .
```
Then press **F5** to debug

---

## 🎮 In VS Code (Debug Window)

### 1️⃣ Connect
- **Ctrl+Shift+P** → "Connect to Server"

### 2️⃣ Create/Join Session
- In the right panel under "Session"
- Leave ID blank to create, or enter ID to join

### 3️⃣ Start Collaborating
- **Code Editing** → Changes sync automatically
- **Debugging** → Click "Start Debug" button
- **Terminal** → Type command and execute
- **Calls** → Click "Start Video Call"

---

## 📋 All Commands

```
collaborative-editor.connectToServer          → Connect to server
collaborative-editor.startSession             → Create new session
collaborative-editor.joinSession              → Join by session ID
collaborative-editor.stopSession              → Leave session
collaborative-editor.inviteParticipant        → Show session ID
collaborative-editor.openSharedTerminal       → Create shared terminal
collaborative-editor.startSharedDebug         → Start debugging
collaborative-editor.stopSharedDebug          → Stop debugging
collaborative-editor.setBreakpoint            → Set breakpoint at cursor
collaborative-editor.startVideoCall           → Video call
collaborative-editor.startVoiceCall           → Voice call
collaborative-editor.endCall                  → End call
collaborative-editor.showPanel                → Show collaboration panel
```

---

## 🌐 Real-Time Sync

✅ **Code Edits** - Synchronized instantly
✅ **Cursor Position** - See where others are editing
✅ **Debugging** - Shared breakpoints and stepping
✅ **Terminal Output** - All commands visible
✅ **Participant List** - Real-time member status

---

## 📊 Server API

```
GET  /api/health                  → Server status
POST /api/sessions                → Create session
GET  /api/sessions/:sessionId     → Get session info
GET  /api/sessions                → List all sessions
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

## 💬 WebSocket Events

**Sent to Server:**
- `join-session`, `leave-session`
- `code-edit`, `cursor-update`, `selection-update`
- `debug-start`, `debug-stop`, `breakpoint-set`
- `terminal-command`, `call-start`, `call-end`

**Received from Server:**
- `session-info`, `participant-joined/left`
- `code-edit`, `cursor-update`, `selection-update`
- `debug-started/stopped`, `breakpoint-set/removed`
- `terminal-output`, `call-started/ended`

---

## 🔧 Ports

- **VS Code Extension**: Running in debug mode (local)
- **Backend Server**: `http://localhost:3000`
- **WebSocket**: `ws://localhost:3000`

---

## 💡 Pro Tips

1. **Multi-Device**: Run extension on multiple computers with same session ID
2. **Share Session ID**: Tell collaborators your session ID from "Invite Participant" command
3. **Check Server**: Visit http://localhost:3000/api/health to verify server is up
4. **Terminal Sync**: All terminal commands are visible to everyone
5. **Debug Together**: Set breakpoints together and step through code

---

## 🐛 If Something Goes Wrong

```bash
# Restart server (in server directory)
node server.js

# Recompile extension (in extension directory)
npm run compile

# Check server is accessible
curl http://localhost:3000/api/health

# See server logs
# (in terminal where server is running)
```

---

## 🚀 What's Next?

- [ ] Test with multiple users
- [ ] Integrate Jitsi for video/audio
- [ ] Add Yjs for better conflict resolution
- [ ] Deploy to Azure/AWS
- [ ] Add user authentication
- [ ] Save session history

---

**Version:** 1.0
**Created:** May 27, 2026
**Status:** ✅ Ready to Use
