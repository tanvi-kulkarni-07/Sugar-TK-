// WebSocket client for collaborative editing
// This module should be used by the VS Code extension

import io from 'socket.io-client';

export class CollaborativeEditorClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.sessionId = null;
    this.userId = null;
    this.listeners = new Map();
  }

  // Connect to server
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });

      this.socket.on('connect', () => {
        console.log('Connected to collaborative editor server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.setupEventListeners();
    });
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Join a collaborative session
  joinSession(sessionId, userId, userName, email) {
    this.sessionId = sessionId;
    this.userId = userId;

    return new Promise((resolve, reject) => {
      this.socket.emit('join-session', {
        sessionId,
        userId,
        userName,
        email
      });

      // Wait for session-info response
      const timeout = setTimeout(() => {
        reject(new Error('Timeout joining session'));
      }, 5000);

      this.socket.once('session-info', (sessionInfo) => {
        clearTimeout(timeout);
        resolve(sessionInfo);
      });
    });
  }

  // Leave session
  leaveSession() {
    if (this.socket && this.sessionId) {
      this.socket.emit('leave-session');
      this.sessionId = null;
      this.userId = null;
    }
  }

  // Emit code edit
  sendCodeEdit(content, position, deltaText) {
    if (this.socket && this.sessionId) {
      this.socket.emit('code-edit', {
        sessionId: this.sessionId,
        userId: this.userId,
        content,
        position,
        deltaText
      });
    }
  }

  // Update cursor position
  sendCursorUpdate(cursorPosition) {
    if (this.socket && this.sessionId) {
      this.socket.emit('cursor-update', {
        sessionId: this.sessionId,
        userId: this.userId,
        cursorPosition
      });
    }
  }

  // Update selection
  sendSelectionUpdate(selection) {
    if (this.socket && this.sessionId) {
      this.socket.emit('selection-update', {
        sessionId: this.sessionId,
        userId: this.userId,
        selection
      });
    }
  }

  // Start debugging
  startDebugging() {
    if (this.socket && this.sessionId) {
      this.socket.emit('debug-start', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  // Stop debugging
  stopDebugging() {
    if (this.socket && this.sessionId) {
      this.socket.emit('debug-stop', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  // Set breakpoint
  setBreakpoint(line) {
    if (this.socket && this.sessionId) {
      this.socket.emit('breakpoint-set', {
        sessionId: this.sessionId,
        line
      });
    }
  }

  // Remove breakpoint
  removeBreakpoint(line) {
    if (this.socket && this.sessionId) {
      this.socket.emit('breakpoint-remove', {
        sessionId: this.sessionId,
        line
      });
    }
  }

  // Step through debugger
  debugStep(currentLine) {
    if (this.socket && this.sessionId) {
      this.socket.emit('debug-step', {
        sessionId: this.sessionId,
        currentLine
      });
    }
  }

  // Send terminal command
  sendTerminalCommand(command, output) {
    if (this.socket && this.sessionId) {
      this.socket.emit('terminal-command', {
        sessionId: this.sessionId,
        userId: this.userId,
        command,
        output
      });
    }
  }

  // Start call
  startCall(callType = 'video') {
    if (this.socket && this.sessionId) {
      this.socket.emit('call-start', {
        sessionId: this.sessionId,
        userId: this.userId,
        callType
      });
    }
  }

  // End call
  endCall() {
    if (this.socket && this.sessionId) {
      this.socket.emit('call-end', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Participant events
    this.socket.on('participant-joined', (data) => {
      this.emit('participant-joined', data);
    });

    this.socket.on('participant-left', (data) => {
      this.emit('participant-left', data);
    });

    // Code editing events
    this.socket.on('code-edit', (data) => {
      this.emit('code-edit', data);
    });

    this.socket.on('cursor-update', (data) => {
      this.emit('cursor-update', data);
    });

    this.socket.on('selection-update', (data) => {
      this.emit('selection-update', data);
    });

    // Debugging events
    this.socket.on('debug-started', (data) => {
      this.emit('debug-started', data);
    });

    this.socket.on('debug-stopped', (data) => {
      this.emit('debug-stopped', data);
    });

    this.socket.on('breakpoint-set', (data) => {
      this.emit('breakpoint-set', data);
    });

    this.socket.on('breakpoint-removed', (data) => {
      this.emit('breakpoint-removed', data);
    });

    this.socket.on('debug-step', (data) => {
      this.emit('debug-step', data);
    });

    // Terminal events
    this.socket.on('terminal-output', (data) => {
      this.emit('terminal-output', data);
    });

    // Call events
    this.socket.on('call-started', (data) => {
      this.emit('call-started', data);
    });

    this.socket.on('call-ended', (data) => {
      this.emit('call-ended', data);
    });

    this.socket.on('call-signal', (data) => {
      this.emit('call-signal', data);
    });
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }
}

export default CollaborativeEditorClient;
