# Collaborative Editor - Complete Setup Guide

## 🎉 Installation Complete!

Your collaborative code editing extension is now fully set up with a backend WebSocket server. Here's everything you need to know to use it.

---

## 📁 Project Structure

```
Desktop/Extension/
├── collaborative-editor/              # VS Code Extension
│   ├── src/
│   │   ├── extension.ts              # Main extension code
│   │   ├── serverClient.ts           # Server communication client
│   │   └── webviewPanel.ts           # UI panel for collaboration
│   ├── package.json                  # Extension manifest
│   └── dist/                         # Compiled extension
│
└── collaborative-editor-server/      # WebSocket Backend
    ├── server.js                     # Express + Socket.io server
    ├── client.js                     # JavaScript client library
    ├── package.json                  # Server dependencies
    └── node_modules/                 # Installed packages
```

---

## 🚀 Quick Start

### Step 1: Start the Backend Server

Open a terminal and run:

```bash
cd C:\Users\tkulk\Desktop\Extension\collaborative-editor-server
node server.js
```

You should see:
```
========================================
Collaborative Editor Server Running
========================================
Port: 3000
WebSocket URL: ws://localhost:3000
API Base: http://localhost:3000/api
========================================
```

**✓ Server is now running on port 3000**

### Step 2: Open VS Code Extension in Debug Mode

1. Open another terminal
2. Navigate to the extension directory:
   ```bash
   cd C:\Users\tkulk\Desktop\Extension\collaborative-editor
   ```
3. Open in VS Code:
   ```bash
   code .
   ```
4. Press **F5** to launch the extension in debug mode

A new VS Code window will open with your extension loaded.

### Step 3: Connect to the Collaborative Server

In the new VS Code window:

1. Press **Ctrl+Shift+P** to open the command palette
2. Type: **Connect to Server**
3. Select the command and press Enter

You should see the message: **"✓ Connected to Collaborative Server!"**

A **Collaborative Editor** panel will open on the right side.

---

## 💡 Features & How to Use

### 1. **Create or Join a Session**

In the Collaborative Editor panel:

- **To CREATE a new session**: Leave the "Session ID" field empty and click "Join Session"
  - You'll get a new session ID
  - Share this ID with collaborators

- **To JOIN an existing session**: Enter the session ID and click "Join Session"
  - You'll connect to that collaborative session
  - See all participants in real-time

### 2. **See Participants**

Once in a session, the "Participants" section shows:
- User names and emails of all connected collaborators
- Real-time status (🟢 online/🔴 offline)

### 3. **Real-Time Code Editing**

- When any participant edits code in their editor, **all others see the changes in real-time**
- Cursor positions are synchronized across all participants
- Text selections are visible to everyone

### 4. **Shared Debugging**

- Click **"Start Debug"** to begin a shared debugging session
- All participants can see:
  - Breakpoints set by anyone
  - Current line being debugged
  - Variable values
- Click **"Stop Debug"** to end the session

### 5. **Shared Terminal**

- Type a command in the "Shared Terminal" section
- Click **"Execute"**
- Command output is visible to all participants
- All participants can see who ran which command

### 6. **Voice/Video Calls**

- Click **"Start Video Call"** to initiate a call
  - Currently shows a placeholder message
  - Ready to integrate with WebRTC services (Jitsi, Daily.co, etc.)
- Click **"End Call"** to disconnect

---

## 📋 Available VS Code Commands

Press **Ctrl+Shift+P** to access these commands:

| Command | Description |
|---------|-------------|
| **Connect to Server** | Connect to the collaborative server |
| **Start Collaborative Session** | Create a new collaborative session |
| **Join Session** | Join an existing session by ID |
| **Stop Session** | Leave the current session |
| **Invite Participant** | Invite someone by email (shows session ID) |
| **Open Shared Terminal** | Create a terminal visible to all participants |
| **Start Shared Debugging** | Begin a shared debug session |
| **Stop Shared Debugging** | End shared debugging |
| **Set Breakpoint** | Mark a line as a breakpoint (shared) |
| **Start Video Call** | Initiate a video call |
| **Start Voice Call** | Initiate a voice call |
| **End Call** | Disconnect from active call |
| **Show Panel** | Show the collaborative editor panel |

---

## 🔧 API Endpoints (Server)

You can also interact with the server directly via HTTP:

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Create Session
```bash
curl -X POST http://localhost:3000/api/sessions
```

### Get Session Info
```bash
curl http://localhost:3000/api/sessions/{sessionId}
```

### List All Sessions
```bash
curl http://localhost:3000/api/sessions
```

---

## 🛠️ Troubleshooting

### "Failed to connect"
- Make sure the server is running on port 3000
- Check: `node server.js` in the server directory

### Extension not loading
- Press **F5** in VS Code to reload
- Check the "Debug Console" for errors
- Make sure `npm run compile` completes without errors

### WebSocket connection fails
- Verify server is running: `http://localhost:3000/api/health`
- Check firewall isn't blocking port 3000
- Look at browser console for WebSocket errors

### Code not syncing between users
- Ensure both users are in the same session ID
- Check network connectivity between machines
- Monitor the shared terminal to verify connectivity

---

## 🚀 Next Steps - Advanced Features

### 1. **Add Real-Time Conflict Resolution (CRDT)**
Install Yjs for conflict-free collaborative editing:
```bash
npm install yjs y-websocket
```

### 2. **Integrate WebRTC for Voice/Video**
Options:
- **Jitsi Meet**: Open-source, self-hosted
- **Daily.co**: Simple API, free tier available
- **PeerJS**: P2P library for WebRTC

### 3. **Deploy to Cloud**
- Azure App Service (recommended for Windows)
- AWS EC2 or Heroku
- DigitalOcean

### 4. **Add Authentication**
- User login/registration
- JWT tokens
- Session tokens

### 5. **Enable Persistence**
- Save sessions to database
- Store edit history
- Replay sessions

---

## 📊 Architecture Overview

```
VS Code Extension
    ↓
[ServerClient] ←→ WebSocket ←→ [Backend Server]
    ↑                              ↓
[WebviewPanel]              [Session Manager]
    ↑                              ↓
[Editor Listeners]          [Participant Tracker]
```

---

## 🔐 Security Notes

⚠️ **For Development Only**: This setup is not production-ready.

For production deployment:
1. ✅ Add user authentication
2. ✅ Use WSS (WebSocket Secure) instead of WS
3. ✅ Validate all inputs
4. ✅ Implement rate limiting
5. ✅ Add CORS properly
6. ✅ Use environment variables for config
7. ✅ Add logging and monitoring
8. ✅ Implement access controls

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review VS Code debug console for errors
3. Check server logs in the terminal
4. Ensure both users have the same session ID

---

## 🎓 Learning Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Socket.io Documentation](https://socket.io/docs/)
- [WebRTC Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Yjs Documentation](https://github.com/yjs/yjs)

---

**Happy collaborating! 🎉**
