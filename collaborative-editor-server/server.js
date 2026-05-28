import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(cors());
app.use(express.json());

// Session storage
const sessions = new Map();
const userSessions = new Map();

// Session class
class CollaborativeSession {
  constructor(id) {
    this.id = id;
    this.participants = new Map();
    this.edits = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.debugState = {
      isDebugging: false,
      breakpoints: [],
      currentLine: null
    };
    this.sharedTerminalOutput = [];
  }

  addParticipant(userId, userData) {
    this.participants.set(userId, {
      id: userId,
      ...userData,
      joinedAt: new Date(),
      cursorPosition: { line: 0, column: 0 },
      selection: null
    });
    this.updatedAt = new Date();
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
    this.updatedAt = new Date();
  }

  recordEdit(userId, edit) {
    this.edits.push({
      userId,
      ...edit,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  setDebugState(state) {
    this.debugState = { ...this.debugState, ...state };
    this.updatedAt = new Date();
  }

  addTerminalOutput(output) {
    this.sharedTerminalOutput.push({
      content: output,
      timestamp: new Date()
    });
  }

  getSessionInfo() {
    return {
      id: this.id,
      participantCount: this.participants.size,
      participants: this.getParticipants(),
      debugState: this.debugState,
      editsCount: this.edits.length,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Collaborative Editor Server is running',
    timestamp: new Date()
  });
});

app.post('/api/sessions', (req, res) => {
  const sessionId = uuidv4();
  const session = new CollaborativeSession(sessionId);
  sessions.set(sessionId, session);

  res.json({
    sessionId,
    message: 'Session created successfully'
  });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session.getSessionInfo());
});

app.get('/api/sessions', (req, res) => {
  const allSessions = Array.from(sessions.values()).map(s => s.getSessionInfo());
  res.json({
    sessionCount: allSessions.length,
    sessions: allSessions
  });
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // User joins a session
  socket.on('join-session', (data) => {
    const { sessionId, userId, userName, email } = data;
    let session = sessions.get(sessionId);

    // Create session if it doesn't exist
    if (!session) {
      session = new CollaborativeSession(sessionId);
      sessions.set(sessionId, session);
    }

    // Add participant to session
    session.addParticipant(userId, { userName, email });
    userSessions.set(socket.id, { sessionId, userId });

    // Join socket to room
    socket.join(sessionId);

    console.log(`User ${userName} (${userId}) joined session ${sessionId}`);

    // Notify all participants in session
    io.to(sessionId).emit('participant-joined', {
      userId,
      userName,
      email,
      participants: session.getParticipants()
    });

    // Send session info to the newly joined user
    socket.emit('session-info', session.getSessionInfo());
  });

  // User leaves session
  socket.on('leave-session', () => {
    const { sessionId, userId } = userSessions.get(socket.id) || {};

    if (sessionId && userId) {
      const session = sessions.get(sessionId);
      if (session) {
        session.removeParticipant(userId);
        io.to(sessionId).emit('participant-left', {
          userId,
          participants: session.getParticipants()
        });

        // Delete empty sessions
        if (session.participants.size === 0) {
          sessions.delete(sessionId);
        }
      }
    }

    userSessions.delete(socket.id);
    socket.leave(sessionId || '');
  });

  // Code edit event
  socket.on('code-edit', (data) => {
    const { sessionId, userId, content, position, deltaText } = data;
    const session = sessions.get(sessionId);

    if (session) {
      session.recordEdit(userId, {
        content,
        position,
        deltaText
      });

      // Broadcast to all participants except sender
      socket.to(sessionId).emit('code-edit', {
        userId,
        content,
        position,
        deltaText
      });
    }
  });

  // Cursor position update
  socket.on('cursor-update', (data) => {
    const { sessionId, userId, cursorPosition } = data;
    const session = sessions.get(sessionId);

    if (session && session.participants.has(userId)) {
      const participant = session.participants.get(userId);
      participant.cursorPosition = cursorPosition;

      // Broadcast cursor position to all participants
      io.to(sessionId).emit('cursor-update', {
        userId,
        cursorPosition
      });
    }
  });

  // Selection update
  socket.on('selection-update', (data) => {
    const { sessionId, userId, selection } = data;
    const session = sessions.get(sessionId);

    if (session && session.participants.has(userId)) {
      const participant = session.participants.get(userId);
      participant.selection = selection;

      // Broadcast selection to all participants
      io.to(sessionId).emit('selection-update', {
        userId,
        selection
      });
    }
  });

  // Shared debugging events
  socket.on('debug-start', (data) => {
    const { sessionId, userId } = data;
    const session = sessions.get(sessionId);

    if (session) {
      session.setDebugState({ isDebugging: true });
      io.to(sessionId).emit('debug-started', {
        userId,
        debugState: session.debugState
      });
    }
  });

  socket.on('debug-stop', (data) => {
    const { sessionId, userId } = data;
    const session = sessions.get(sessionId);

    if (session) {
      session.setDebugState({ isDebugging: false });
      io.to(sessionId).emit('debug-stopped', {
        userId,
        debugState: session.debugState
      });
    }
  });

  socket.on('breakpoint-set', (data) => {
    const { sessionId, line } = data;
    const session = sessions.get(sessionId);

    if (session && !session.debugState.breakpoints.includes(line)) {
      session.debugState.breakpoints.push(line);
      io.to(sessionId).emit('breakpoint-set', {
        line,
        breakpoints: session.debugState.breakpoints
      });
    }
  });

  socket.on('breakpoint-remove', (data) => {
    const { sessionId, line } = data;
    const session = sessions.get(sessionId);

    if (session) {
      session.debugState.breakpoints = session.debugState.breakpoints.filter(b => b !== line);
      io.to(sessionId).emit('breakpoint-removed', {
        line,
        breakpoints: session.debugState.breakpoints
      });
    }
  });

  socket.on('debug-step', (data) => {
    const { sessionId, currentLine } = data;
    const session = sessions.get(sessionId);

    if (session) {
      session.setDebugState({ currentLine });
      io.to(sessionId).emit('debug-step', {
        currentLine,
        debugState: session.debugState
      });
    }
  });

  // Shared terminal events
  socket.on('terminal-command', (data) => {
    const { sessionId, userId, command, output } = data;
    const session = sessions.get(sessionId);

    if (session) {
      session.addTerminalOutput(`[${userId}] $ ${command}`);
      
      // Execute command asynchronously
      exec(command, { maxBuffer: 1024 * 1024 * 5, shell: true }, (error, stdout, stderr) => {
        const result = error 
          ? (stderr || error.message)
          : stdout;
        
        session.addTerminalOutput(result || '(no output)');

        // Broadcast terminal output to all participants
        io.to(sessionId).emit('terminal-output', {
          userId,
          command,
          output: result,
          error: !!error,
          timestamp: new Date()
        });
      });
      
      // Send immediate acknowledgment
      io.to(sessionId).emit('terminal-output', {
        userId,
        command,
        output: `[Executing: ${command}]`,
        error: false,
        timestamp: new Date()
      });
    }
  });

  // Voice/Video call events
  socket.on('call-start', (data) => {
    const { sessionId, userId, callType, targetId } = data; // callType: 'voice' or 'video'
    const callId = uuidv4();
    
    // If targeting a specific user, send them the request
    if (targetId) {
      socket.to(sessionId).emit('call-request', {
        initiatorId: userId,
        callId,
        targetId,
        callType,
        sessionId,
        timestamp: new Date()
      });
    } else {
      // Broadcast to all in session
      io.to(sessionId).emit('call-started', {
        initiatorId: userId,
        callId,
        callType,
        participants: [],
        timestamp: new Date()
      });
    }
  });

  socket.on('call-accept', (data) => {
    const { sessionId, userId, callId } = data;
    io.to(sessionId).emit('call-accepted', {
      acceptorId: userId,
      callId,
      timestamp: new Date()
    });
  });

  socket.on('call-reject', (data) => {
    const { sessionId, userId, callId, reason } = data;
    io.to(sessionId).emit('call-rejected', {
      rejecterId: userId,
      callId,
      reason,
      timestamp: new Date()
    });
  });

  socket.on('call-end', (data) => {
    const { sessionId, userId } = data;
    io.to(sessionId).emit('call-ended', {
      initiatorId: userId,
      timestamp: new Date()
    });
  });

  socket.on('call-signal', (data) => {
    const { sessionId, to, signal } = data;
    socket.to(sessionId).emit('call-signal', {
      from: socket.id,
      to,
      signal,
      timestamp: new Date()
    });
  });

  // WebRTC signaling events
  socket.on('webrtc-offer', (data) => {
    const { sessionId, from, to, offer } = data;
    io.to(sessionId).emit('webrtc-offer', {
      from,
      to,
      offer,
      timestamp: new Date()
    });
  });

  socket.on('webrtc-answer', (data) => {
    const { sessionId, from, to, answer } = data;
    io.to(sessionId).emit('webrtc-answer', {
      from,
      to,
      answer,
      timestamp: new Date()
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const { sessionId, from, to, candidate } = data;
    io.to(sessionId).emit('webrtc-ice-candidate', {
      from,
      to,
      candidate,
      timestamp: new Date()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const { sessionId, userId } = userSessions.get(socket.id) || {};

    if (sessionId && userId) {
      const session = sessions.get(sessionId);
      if (session) {
        session.removeParticipant(userId);
        io.to(sessionId).emit('participant-left', {
          userId,
          participants: session.getParticipants()
        });

        // Delete empty sessions
        if (session.participants.size === 0) {
          sessions.delete(sessionId);
        }
      }
    }

    userSessions.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Collaborative Editor Server Running`);
  console.log(`========================================`);
  console.log(`Port: ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
  console.log(`API Base: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
});
