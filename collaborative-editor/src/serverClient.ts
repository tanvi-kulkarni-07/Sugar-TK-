import * as vscode from 'vscode';
import io, { Socket } from 'socket.io-client';

export interface SessionInfo {
  id: string;
  participantCount: number;
  participants: Participant[];
  debugState: DebugState;
  editsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  userName: string;
  email: string;
  joinedAt: string;
  cursorPosition: { line: number; column: number };
  selection: any;
}

export interface DebugState {
  isDebugging: boolean;
  breakpoints: number[];
  currentLine: number | null;
}

export class ServerClient {
  private socket: Socket | null = null;
  private serverUrl: string;
  private sessionId: string | null = null;
  private userId: string;
  private userName: string;
  private email: string;
  private listeners: Map<string, Function[]> = new Map();
  private isConnected: boolean = false;

  constructor(
    serverUrl: string = 'https://sugar-tk.onrender.com',
    userId: string = generateUserId(),
    userName: string = 'User',
    email: string = ''
  ) {
    this.serverUrl = serverUrl;
    this.userId = userId;
    this.userName = userName;
    this.email = email;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to collaborative editor server');
        this.isConnected = true;
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.emit('disconnected', {});
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  async joinSession(sessionId: string): Promise<SessionInfo> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.sessionId = sessionId;

      this.socket.emit('join-session', {
        sessionId,
        userId: this.userId,
        userName: this.userName,
        email: this.email
      });

      const timeout = setTimeout(() => {
        reject(new Error('Timeout joining session'));
      }, 5000);

      this.socket.once('session-info', (sessionInfo: SessionInfo) => {
        clearTimeout(timeout);
        resolve(sessionInfo);
      });
    });
  }

  leaveSession(): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('leave-session');
      this.sessionId = null;
    }
  }

  sendCodeEdit(content: string, position: any, deltaText: string): void {
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

  sendCursorUpdate(cursorPosition: { line: number; column: number }): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('cursor-update', {
        sessionId: this.sessionId,
        userId: this.userId,
        cursorPosition
      });
    }
  }

  sendSelectionUpdate(selection: any): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('selection-update', {
        sessionId: this.sessionId,
        userId: this.userId,
        selection
      });
    }
  }

  startDebugging(): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('debug-start', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  stopDebugging(): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('debug-stop', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  setBreakpoint(line: number): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('breakpoint-set', {
        sessionId: this.sessionId,
        line
      });
    }
  }

  removeBreakpoint(line: number): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('breakpoint-remove', {
        sessionId: this.sessionId,
        line
      });
    }
  }

  debugStep(currentLine: number): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('debug-step', {
        sessionId: this.sessionId,
        currentLine
      });
    }
  }

  sendTerminalCommand(command: string, output?: string): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('terminal-command', {
        sessionId: this.sessionId,
        userId: this.userId,
        command,
        output
      });
    }
  }

  startCall(callType: 'video' | 'voice' = 'video', targetId?: string): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('call-start', {
        sessionId: this.sessionId,
        userId: this.userId,
        callType,
        targetId
      });
    }
  }

  acceptCall(callId: string): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('call-accept', {
        sessionId: this.sessionId,
        userId: this.userId,
        callId
      });
    }
  }

  rejectCall(callId: string, reason?: string): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('call-reject', {
        sessionId: this.sessionId,
        userId: this.userId,
        callId,
        reason: reason || 'User declined'
      });
    }
  }

  endCall(): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('call-end', {
        sessionId: this.sessionId,
        userId: this.userId
      });
    }
  }

  // FIX: WebRTCManager is only useful in a browser context (webview). In the
  // extension host (Node.js) RTCPeerConnection is unavailable, so
  // setupEventListeners() must NOT attempt to instantiate WebRTCManager or
  // call browser-only APIs. All peer-connection logic lives exclusively in the
  // webview JS. ServerClient simply relays the signalling messages.
  private setupEventListeners(): void {
    if (!this.socket) return;

    const forward = (event: string) => {
      this.socket!.on(event, (data: any) => this.emit(event, data));
    };

    forward('participant-joined');
    forward('participant-left');
    forward('code-edit');
    forward('cursor-update');
    forward('selection-update');
    forward('debug-started');
    forward('debug-stopped');
    forward('breakpoint-set');
    forward('breakpoint-removed');
    forward('debug-step');
    forward('terminal-output');
    forward('call-started');
    forward('call-ended');
    forward('call-signal');
    forward('call-request');
    forward('call-accepted');
    forward('call-rejected');
    forward('webrtc-offer');
    forward('webrtc-answer');
    forward('webrtc-ice-candidate');
    forward('call-stream-ready');
  }

  sendWebRTCOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('webrtc-offer', {
        sessionId: this.sessionId,
        from: this.userId,
        to: targetUserId,
        offer
      });
    }
  }

  sendWebRTCAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('webrtc-answer', {
        sessionId: this.sessionId,
        from: this.userId,
        to: targetUserId,
        answer
      });
    }
  }

  sendICECandidate(targetUserId: string, candidate: RTCIceCandidate | null): void {
    if (this.socket && this.sessionId) {
      this.socket.emit('webrtc-ice-candidate', {
        sessionId: this.sessionId,
        from: this.userId,
        to: targetUserId,
        candidate: candidate
          ? {
              candidate: candidate.candidate,
              sdpMLineIndex: candidate.sdpMLineIndex,
              sdpMid: candidate.sdpMid
            }
          : null
      });
    }
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  isSessionActive(): boolean {
    return !!this.sessionId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getUserId(): string {
    return this.userId;
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }
}

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// FIX: WebRTCManager is kept as a thin helper that only operates when the
// browser context is available (i.e. inside a VS Code webview or a real
// browser). In the extension host process it is instantiated but all methods
// that touch browser APIs bail out early via the browserContext guard.
// The actual RTCPeerConnection objects live in the webview JS; this class
// holds the local MediaStream obtained via requestMediaPermissions() and
// acts as the event-relay bridge between the webview and the socket layer.
export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private serverClient: ServerClient;
  private listeners: Map<string, Function[]> = new Map();
  readonly browserContext: boolean;
  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  constructor(serverClient: ServerClient) {
    this.serverClient = serverClient;
    this.browserContext =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof RTCPeerConnection !== 'undefined';

    // Only wire up socket→WebRTC bridging when browser APIs exist.
    if (this.browserContext) {
      this.setupSocketListeners();
    }
  }

  async getLocalStream(
    constraints: MediaStreamConstraints = { audio: true, video: true }
  ): Promise<MediaStream> {
    if (!this.browserContext) {
      throw new Error('WebRTC media access is only available in a browser context');
    }
    try {
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.emit('local-stream-ready', { stream: this.localStream });
      }
      return this.localStream;
    } catch (error) {
      console.error('Error getting media stream:', error);
      this.emit('media-error', { error: (error as Error).message });
      throw error;
    }
  }

  async createPeerConnection(remoteUserId: string): Promise<RTCPeerConnection> {
    if (!this.browserContext) {
      throw new Error('WebRTC peer connections are only available in a browser context');
    }

    if (this.peerConnections.has(remoteUserId)) {
      return this.peerConnections.get(remoteUserId)!;
    }

    const peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        this.serverClient.sendICECandidate(remoteUserId, event.candidate);
      }
    };

    peerConnection.ontrack = event => {
      this.emit('remote-stream', { userId: remoteUserId, stream: event.streams[0] });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      this.emit('connection-state-change', { userId: remoteUserId, state });
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.closePeerConnection(remoteUserId);
      }
    };

    this.peerConnections.set(remoteUserId, peerConnection);
    return peerConnection;
  }

  async createOffer(remoteUserId: string): Promise<RTCSessionDescriptionInit> {
    if (!this.browserContext) {
      throw new Error('WebRTC peer connections are only available in a browser context');
    }
    const pc = await this.createPeerConnection(remoteUserId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(
    remoteUserId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    if (!this.browserContext) {
      throw new Error('WebRTC peer connections are only available in a browser context');
    }
    const pc = await this.createPeerConnection(remoteUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(remoteUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.browserContext) return;
    const pc = this.peerConnections.get(remoteUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleICECandidate(remoteUserId: string, candidate: any): Promise<void> {
    if (!this.browserContext) return;
    const pc = this.peerConnections.get(remoteUserId);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  closePeerConnection(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
      this.emit('peer-connection-closed', { userId });
    }
  }

  closeAllConnections(): void {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
  }

  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // FIX: setupSocketListeners is only called when browserContext is true, so
  // RTCPeerConnection and RTCSessionDescription are guaranteed to exist here.
  private setupSocketListeners(): void {
    this.serverClient.on('webrtc-offer', async (data: any) => {
      try {
        const answer = await this.handleOffer(data.from, data.offer);
        this.serverClient.sendWebRTCAnswer(data.from, answer);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    this.serverClient.on('webrtc-answer', async (data: any) => {
      try {
        await this.handleAnswer(data.from, data.answer);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    this.serverClient.on('webrtc-ice-candidate', async (data: any) => {
      try {
        await this.handleICECandidate(data.from, data.candidate);
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    });
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebRTC listener for ${event}:`, error);
        }
      });
    }
  }

  getPeerConnections(): Map<string, RTCPeerConnection> {
    return this.peerConnections;
  }
}