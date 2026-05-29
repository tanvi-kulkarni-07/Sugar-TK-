# Collaborative Editor Server

A real-time WebSocket server for enabling collaborative code editing, shared debugging, shared terminals, and voice/video calling in VS Code.

## Features

- **Real-time Code Editing** - Multiple users can edit code simultaneously
- **Cursor & Selection Tracking** - See where other users are working
- **Shared Debugging** - Debug sessions visible to all participants
- **Shared Terminal** - Share terminal commands/output with all participants. Server-side command execution is disabled by default.
- **Voice/Video Calling** - WebRTC-based communication
- **Session Management** - Create and manage collaborative sessions
- **Participant Tracking** - Know who's in your session

## Installation

```bash
cd collaborative-editor-server
npm install
```

## Running the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /api/health
```

### Create Session
```
POST /api/sessions
Response: { sessionId, message }
```

### Get Session Info
```
GET /api/sessions/:sessionId
Response: { id, participantCount, participants, debugState, ... }
```

### List All Sessions
```
GET /api/sessions
Response: { sessionCount, sessions }
```

## WebSocket Events

### Connection Events
- `join-session` - Join a collaborative session
- `leave-session` - Leave a session
- `participant-joined` - Broadcast when user joins
- `participant-left` - Broadcast when user leaves

### Code Editing Events
- `code-edit` - Send code changes
- `cursor-update` - Update cursor position
- `selection-update` - Update text selection

### Debugging Events
- `debug-start` - Start debugging
- `debug-stop` - Stop debugging
- `breakpoint-set` - Set a breakpoint
- `breakpoint-remove` - Remove a breakpoint
- `debug-step` - Step through code
- `debug-started` - Broadcast debug start
- `debug-stopped` - Broadcast debug stop

### Terminal Events
- `terminal-command` - Send terminal command
- `terminal-output` - Receive terminal output

By default, the server broadcasts shared terminal activity without executing commands on the host. Set `ENABLE_REMOTE_COMMAND_EXECUTION=true` only in a trusted environment if you intentionally want the server to run received commands.

### Call Events
- `call-start` - Start voice/video call
- `call-end` - End call
- `call-signal` - WebRTC signaling

## Client Usage

```javascript
import { CollaborativeEditorClient } from './client.js';

const client = new CollaborativeEditorClient('http://localhost:3000');

// Connect to server
await client.connect();

// Join a session
const sessionInfo = await client.joinSession(
  'session-id',
  'user-id',
  'User Name',
  'user@example.com'
);

// Listen for code edits
client.on('code-edit', (data) => {
  console.log('Code edit:', data);
});

// Send a code edit
client.sendCodeEdit('new code', { line: 1, column: 0 }, '+new');

// Leave session
client.leaveSession();
```

## Architecture

```
Server (Express + Socket.io)
├── REST API (session management)
├── WebSocket Events (real-time sync)
├── Session Storage (in-memory)
├── Participant Tracking
└── Edit History
```

## Next Steps

1. **Integrate with VS Code Extension** - Use the client library in extension.ts
2. **Add CRDT Support** - Use Yjs for conflict-free editing
3. **Deploy Server** - Host on cloud platform (Azure, AWS, etc.)
4. **Add Authentication** - User login/registration
5. **WebRTC Integration** - Add actual voice/video calls

## Security Notes

⚠️ **This is a development server. For production:**
- Add authentication and authorization
- Use WSS (WebSocket Secure) instead of WS
- Implement rate limiting
- Add input validation
- Use environment variables for configuration
- Add logging and monitoring

## License

MIT
