import * as vscode from 'vscode';
import { ServerClient, SessionInfo, WebRTCManager } from './serverClient';

export interface CollaborativePanelHooks {
  onSessionJoined?: (sessionInfo: SessionInfo) => void;
  onSessionLeft?: () => void;
}

export class CollaborativePanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private currentSessionInfo: SessionInfo | null = null;
  private sessionRefreshInterval: ReturnType<typeof setInterval> | undefined;

  constructor(
    private extensionUri: vscode.Uri,
    private serverClient: ServerClient,
    private webrtcManager: WebRTCManager,
    private panelTitle: string,
    private hooks: CollaborativePanelHooks = {}
  ) {}

  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'collaborativeEditor',
      this.panelTitle,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.svg');
    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.clearSessionRefresh();
    });

    this.panel.webview.onDidReceiveMessage(message => {
      this.handleWebviewMessage(message);
    });

    this.setupServerListeners();

    this.sessionRefreshInterval = setInterval(() => {
      if (this.currentSessionInfo) {
        this.updateSessionUI();
      }
    }, 1000);
  }

  private clearSessionRefresh(): void {
    if (this.sessionRefreshInterval !== undefined) {
      clearInterval(this.sessionRefreshInterval);
      this.sessionRefreshInterval = undefined;
    }
  }

  private setupServerListeners(): void {
    this.serverClient.on('participant-joined', (data: any) => {
      this.currentSessionInfo = data;
      this.postMessage({ command: 'participant-joined', data });
      this.postMessage({
        command: 'notify',
        data: {
          type: 'success',
          message: `${data.participants[data.participants.length - 1]?.userName || 'User'} joined!`,
          duration: 3000
        }
      });
    });

    this.serverClient.on('participant-left', (data: any) => {
      this.currentSessionInfo = data;
      this.postMessage({ command: 'participant-left', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'warning', message: 'A participant left the session', duration: 2000 }
      });
    });

    this.serverClient.on('code-edit', (data: any) => {
      this.postMessage({ command: 'code-edit', data });
      this.postMessage({ command: 'activity-ping', data: { userId: data.userId, type: 'edit' } });
    });

    this.serverClient.on('cursor-update', (data: any) => {
      this.postMessage({ command: 'cursor-update', data });
    });

    this.serverClient.on('selection-update', (data: any) => {
      this.postMessage({ command: 'selection-update', data });
    });

    this.serverClient.on('debug-started', (data: any) => {
      this.postMessage({ command: 'debug-started', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'info', message: 'Debugging session started', duration: 3000 }
      });
    });

    this.serverClient.on('debug-stopped', (data: any) => {
      this.postMessage({ command: 'debug-stopped', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'info', message: 'Debugging session ended', duration: 3000 }
      });
    });

    this.serverClient.on('debug-step', (data: any) => {
      this.postMessage({ command: 'debug-step', data });
    });

    this.serverClient.on('breakpoint-set', (data: any) => {
      this.postMessage({ command: 'breakpoint-set', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'info', message: `Breakpoint set at line ${data.line}`, duration: 2000 }
      });
    });

    this.serverClient.on('breakpoint-removed', (data: any) => {
      this.postMessage({ command: 'breakpoint-removed', data });
    });

    this.serverClient.on('terminal-output', (data: any) => {
      this.postMessage({ command: 'terminal-output', data });
      this.postMessage({
        command: 'activity-ping',
        data: { userId: data.userId, type: 'terminal' }
      });
    });

    this.serverClient.on('call-started', (data: any) => {
      this.postMessage({ command: 'call-started', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'success', message: 'Call started!', duration: 3000 }
      });
    });

    this.serverClient.on('call-ended', (data: any) => {
      this.postMessage({ command: 'call-ended', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'info', message: 'Call ended', duration: 2000 }
      });
    });

    this.serverClient.on('call-request', (data: any) => {
      this.postMessage({ command: 'call-request', data });
      this.postMessage({
        command: 'notify',
        data: {
          type: 'info',
          message: `Incoming ${data.callType} call from participant`,
          duration: 5000
        }
      });
    });

    this.serverClient.on('call-accepted', (data: any) => {
      this.postMessage({ command: 'call-accepted', data });
      this.postMessage({
        command: 'notify',
        data: { type: 'success', message: 'Call accepted by participant', duration: 3000 }
      });
    });

    this.serverClient.on('call-rejected', (data: any) => {
      this.postMessage({ command: 'call-rejected', data });
      this.postMessage({
        command: 'notify',
        data: {
          type: 'warning',
          message: 'Call declined: ' + (data.reason || 'User unavailable'),
          duration: 3000
        }
      });
    });

    this.serverClient.on('webrtc-offer', (data: any) => {
      this.postMessage({ command: 'webrtc-offer', data });
    });

    this.serverClient.on('webrtc-answer', (data: any) => {
      this.postMessage({ command: 'webrtc-answer', data });
    });

    this.serverClient.on('webrtc-ice-candidate', (data: any) => {
      this.postMessage({ command: 'webrtc-ice-candidate', data });
    });

    this.webrtcManager.on('local-stream-ready', (_data: any) => {
      this.postMessage({ command: 'local-stream-ready', data: { ready: true } });
      this.postMessage({
        command: 'notify',
        data: { type: 'success', message: 'Camera and microphone ready', duration: 2000 }
      });
    });

    this.webrtcManager.on('remote-stream', (data: any) => {
      this.postMessage({ command: 'remote-stream', data: { userId: data.userId } });
    });

    this.webrtcManager.on('connection-state-change', (data: any) => {
      this.postMessage({ command: 'connection-state-change', data });
    });

    this.webrtcManager.on('media-error', (data: any) => {
      this.postMessage({
        command: 'notify',
        data: { type: 'error', message: 'Media error: ' + data.error, duration: 3000 }
      });
    });

    this.serverClient.on('disconnected', (_data: any) => {
      this.postMessage({ command: 'disconnected', data: {} });
      this.postMessage({
        command: 'notify',
        data: { type: 'error', message: 'Disconnected from server', duration: 5000 }
      });
    });
  }

  private updateSessionUI(): void {
    if (!this.currentSessionInfo) {
      return;
    }

    this.postMessage({
      command: 'update-session-ui',
      data: {
        sessionId: this.currentSessionInfo.id,
        participantCount: this.currentSessionInfo.participantCount,
        editsCount: this.currentSessionInfo.editsCount
      }
    });
  }

  private handleWebviewMessage(message: any): void {
    const { command, data } = message;

    switch (command) {
      case 'join-session':
        void this.joinSession(data.sessionId);
        break;
      case 'leave-session':
        this.leaveSession();
        break;
      case 'code-edit':
        this.serverClient.sendCodeEdit(data.content, data.position, data.deltaText);
        break;
      case 'cursor-update':
        this.serverClient.sendCursorUpdate(data.cursorPosition);
        break;
      case 'start-debug':
        this.serverClient.startDebugging();
        break;
      case 'stop-debug':
        this.serverClient.stopDebugging();
        break;
      case 'set-breakpoint':
        this.serverClient.setBreakpoint(data.line);
        break;
      case 'start-call':
        this.serverClient.startCall(data.callType, data.targetId);
        break;
      case 'accept-call':
        this.serverClient.acceptCall(data.callId);
        break;
      case 'reject-call':
        this.serverClient.rejectCall(data.callId, data.reason);
        break;
      case 'end-call':
        this.serverClient.endCall();
        this.webrtcManager.closeAllConnections();
        this.webrtcManager.stopLocalStream();
        break;
      case 'terminal-command':
        this.serverClient.sendTerminalCommand(data.command, data.output);
        break;
      case 'request-permissions':
        this.requestMediaPermissions();
        break;
      case 'webrtc-offer':
        this.serverClient.sendWebRTCOffer(data.to, data.offer);
        break;
      case 'webrtc-answer':
        this.serverClient.sendWebRTCAnswer(data.to, data.answer);
        break;
      case 'webrtc-ice-candidate':
        this.serverClient.sendICECandidate(data.to, data.candidate);
        break;
    }
  }

  private async requestMediaPermissions(): Promise<void> {
    try {
      await this.webrtcManager.getLocalStream({ audio: true, video: true });
      this.postMessage({ command: 'local-stream-ready', data: { ready: true } });
    } catch (_error) {
      this.postMessage({
        command: 'notify',
        data: { type: 'error', message: 'Failed to access camera/microphone', duration: 3000 }
      });
    }
  }

  public async joinSession(sessionId: string, announce = true): Promise<SessionInfo | undefined> {
    try {
      const sessionInfo = await this.serverClient.joinSession(sessionId);
      this.currentSessionInfo = sessionInfo;
      this.postMessage({
        command: 'session-joined',
        data: { ...sessionInfo, currentUserId: this.serverClient.getUserId() }
      });
      this.hooks.onSessionJoined?.(sessionInfo);
      if (announce) {
        this.postMessage({
          command: 'notify',
          data: {
            type: 'success',
            message: `Joined session: ${sessionId.substring(0, 8)}...`,
            duration: 4000
          }
        });
        vscode.window.showInformationMessage(`Connected to session: ${sessionId}`);
      }
      return sessionInfo;
    } catch (error) {
      if (announce) {
        this.postMessage({
          command: 'notify',
          data: { type: 'error', message: `Failed to join session: ${error}`, duration: 5000 }
        });
        vscode.window.showErrorMessage(`Failed to join session: ${error}`);
      }
      return undefined;
    }
  }

  public leaveSession(announce = true): void {
    this.serverClient.leaveSession();
    this.currentSessionInfo = null;
    this.postMessage({ command: 'session-left', data: {} });
    this.hooks.onSessionLeft?.();
    if (announce) {
      this.postMessage({
        command: 'notify',
        data: { type: 'warning', message: 'Left collaborative session', duration: 3000 }
      });
      vscode.window.showInformationMessage('Left collaborative session');
    }
  }

  private postMessage(message: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collaborative Editor</title>
  <style>
    :root {
      --bg: #0f1318;
      --panel: #171b21;
      --panel-2: #1f252d;
      --border: #2c3642;
      --text: #eef3f8;
      --muted: #9aa6b2;
      --accent: #74d7c4;
      --accent-strong: #66a8ff;
      --danger: #ff6b5c;
      --warning: #f4bf57;
      --success: #5ad08d;
      --shadow: 0 18px 52px rgba(0, 0, 0, 0.34);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background:
        radial-gradient(circle at top left, rgba(116, 215, 196, 0.14), transparent 30%),
        radial-gradient(circle at top right, rgba(102, 168, 255, 0.10), transparent 28%),
        linear-gradient(180deg, #0b0f14, var(--bg));
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.45;
    }

    .shell {
      max-width: 1240px;
      margin: 0 auto;
      display: grid;
      gap: 14px;
    }

    .hero,
    .card {
      background: linear-gradient(180deg, rgba(23, 27, 33, 0.98), rgba(19, 23, 28, 0.98));
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
    }

    .hero {
      padding: 18px;
      display: grid;
      gap: 14px;
    }

    .hero-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(116, 215, 196, 0.18), rgba(102, 168, 255, 0.18));
      color: var(--accent);
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.03em;
    }

    .subtitle {
      margin-top: 2px;
      color: var(--muted);
      font-size: 13px;
    }

    .chip-row,
    .action-row,
    .status-row,
    .control-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .chip,
    .status-pill,
    .metric {
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 14px;
    }

    .chip,
    .status-pill {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--muted);
    }

    .chip strong,
    .status-pill strong { color: var(--text); }
    .status-pill.connected { color: var(--success); }
    .status-pill.offline { color: var(--danger); }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .metric {
      padding: 12px;
      border-radius: 16px;
    }

    .metric-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .metric-value {
      margin-top: 6px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
      gap: 14px;
    }

    .stack {
      display: grid;
      gap: 14px;
    }

    .card {
      padding: 16px;
    }

    .card h2 {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent-strong);
    }

    .support-text {
      color: var(--muted);
      font-size: 12px;
    }

    .input,
    select {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text);
      border-radius: 12px;
      padding: 11px 12px;
      font-size: 13px;
    }

    .input:focus,
    select:focus {
      outline: none;
      border-color: rgba(102, 168, 255, 0.7);
      box-shadow: 0 0 0 3px rgba(102, 168, 255, 0.14);
    }

    button {
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      color: #f8fbff;
      background: linear-gradient(180deg, #2e7dd8, #2564ad);
      cursor: pointer;
      transition: transform 0.14s ease, filter 0.14s ease;
    }

    button:hover { filter: brightness(1.05); transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    button.secondary { background: linear-gradient(180deg, #3c4652, #2e3640); }
    button.danger { background: linear-gradient(180deg, #dc5a4a, #b84436); }
    button.success { background: linear-gradient(180deg, #3aa96c, #2c8b57); }
    button[disabled] { opacity: 0.55; cursor: default; transform: none; }

    .participants-list,
    .activity-list {
      display: grid;
      gap: 8px;
    }

    .participant-item,
    .activity-item,
    .call-request-box {
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 14px;
    }

    .participant-item {
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .participant-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .participant-avatar,
    .activity-dot {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 999px;
    }

    .participant-avatar {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, rgba(116, 215, 196, 0.18), rgba(102, 168, 255, 0.18));
      color: var(--accent);
      font-weight: 700;
      font-size: 12px;
    }

    .participant-name {
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .participant-email,
    .activity-meta,
    .video-label {
      color: var(--muted);
      font-size: 12px;
    }

    .participant-badge {
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .activity-item {
      padding: 11px 12px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .activity-dot {
      width: 10px;
      height: 10px;
      margin-top: 4px;
      background: var(--accent-strong);
      box-shadow: 0 0 0 6px rgba(102, 168, 255, 0.08);
    }

    .activity-title {
      font-size: 13px;
      font-weight: 600;
    }

    .terminal-output {
      margin-top: 10px;
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #0f1318;
      font-family: 'Cascadia Mono', 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
    }

    .terminal-line {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #c6d0da;
      word-break: break-word;
    }

    .terminal-line.command { color: var(--accent); }

    .empty-state {
      padding: 14px;
      text-align: center;
      color: var(--muted);
      font-size: 12px;
    }

    .video-container {
      display: grid;
      gap: 10px;
    }

    .video-element {
      width: 100%;
      min-height: 150px;
      background: #0f1318;
      border-radius: 14px;
      border: 1px solid var(--border);
      object-fit: cover;
      display: none;
    }

    .video-element.active { display: block; }
    #localVideo { border-color: rgba(116, 215, 196, 0.55); }

    .call-request-box {
      display: none;
      padding: 12px;
      margin-top: 10px;
    }

    .call-request-box h3 {
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--warning);
    }

    .flow-box {
      display: grid;
      gap: 8px;
    }

    .flow-step {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .flow-step-number {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(102, 168, 255, 0.18);
      color: var(--accent-strong);
      font-size: 12px;
      font-weight: 700;
      flex: 0 0 auto;
    }

    .flow-step-title { font-size: 13px; font-weight: 700; }
    .flow-step-copy { font-size: 12px; color: var(--muted); margin-top: 2px; }

    #toast-area {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      display: grid;
      gap: 8px;
      width: min(320px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      padding: 12px 14px;
      border-radius: 14px;
      color: #fff;
      box-shadow: var(--shadow);
    }

    .toast.success { background: #2e9f61; }
    .toast.error { background: #d24f46; }
    .toast.warning { background: #d19b2f; }
    .toast.info { background: #2b74c7; }

    @media (max-width: 920px) {
      .grid { grid-template-columns: 1fr; }
      .metric-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="toast-area"></div>
  <div class="shell">
    <div class="hero">
      <div class="hero-top">
        <div class="brand">
          <div class="brand-mark">CE</div>
          <div>
            <h1>Collaborative Editor</h1>
            <div class="subtitle">A workspace for shared coding, debugging, terminal work, and live calls.</div>
          </div>
        </div>
        <div class="status-row">
          <div class="status-pill offline" id="connectionStatus">Disconnected</div>
          <div class="status-pill" id="sessionStatusPill">No active session</div>
        </div>
      </div>

      <div class="chip-row">
        <div class="chip"><strong>Live sync</strong> on code edits and cursor updates</div>
        <div class="chip"><strong>Shared terminal</strong> for runnable commands</div>
        <div class="chip"><strong>WebRTC</strong> for voice and video</div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <div class="metric-label">Session</div>
          <div class="metric-value" id="sessionMetric">--</div>
        </div>
        <div class="metric">
          <div class="metric-label">Participants</div>
          <div class="metric-value" id="participantMetric">0</div>
        </div>
        <div class="metric">
          <div class="metric-label">Edits</div>
          <div class="metric-value" id="editMetric">0</div>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="stack">
        <div class="card">
          <h2>Session Control</h2>
          <div class="control-row">
            <input class="input" type="text" id="sessionIdInput" placeholder="Session ID, or leave blank to create a new one">
            <button onclick="joinSession()">Join or create</button>
            <button class="secondary" onclick="copySessionId()">Copy ID</button>
          </div>
          <div class="action-row" style="margin-top: 10px;">
            <button class="secondary" onclick="leaveSession()">Leave session</button>
            <button class="secondary" onclick="requestPermissions()">Enable camera / mic</button>
          </div>
          <div class="support-text" style="margin-top: 10px;" id="sessionStatus">Join a session to start collaborating in real time.</div>
        </div>

        <div class="card" id="participantsSection" style="display:none">
          <h2>Participants</h2>
          <div class="participants-list" id="participantsList">
            <div class="empty-state">No participants yet</div>
          </div>
        </div>

        <div class="card">
          <h2>Live Activity</h2>
          <div class="activity-list" id="activityFeed">
            <div class="empty-state">Join a session to see live events here</div>
          </div>
        </div>

        <div class="card">
          <h2>How Real-Time Connection Works</h2>
          <div class="flow-box">
            <div class="flow-step">
              <div class="flow-step-number">1</div>
              <div>
                <div class="flow-step-title">Everyone joins the same session</div>
                <div class="flow-step-copy">The session ID is sent to the Socket.IO server, which places each collaborator into the same room.</div>
              </div>
            </div>
            <div class="flow-step">
              <div class="flow-step-number">2</div>
              <div>
                <div class="flow-step-title">The extension forwards changes immediately</div>
                <div class="flow-step-copy">Typing, cursor moves, selections, terminal actions, and debug events are pushed to the server and broadcast back to the room.</div>
              </div>
            </div>
            <div class="flow-step">
              <div class="flow-step-number">3</div>
              <div>
                <div class="flow-step-title">Voice and video use WebRTC signaling</div>
                <div class="flow-step-copy">The server relays offers, answers, and ICE candidates so peers can connect directly after the handshake.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <h2>Debugging</h2>
          <div class="action-row">
            <button onclick="startDebug()">Start debug</button>
            <button class="danger" onclick="stopDebug()">Stop debug</button>
          </div>
          <div class="support-text" style="margin-top: 10px;" id="debugStatus">Debug inactive</div>
        </div>

        <div class="card">
          <h2>Shared Terminal</h2>
          <div class="control-row">
            <input class="input" type="text" id="terminalInput" placeholder="Enter command..." onkeydown="if(event.key==='Enter') executeTerminalCommand()">
            <button onclick="executeTerminalCommand()">Run command</button>
          </div>
          <div id="terminalOutput" class="terminal-output">
            <div class="empty-state">No commands yet</div>
          </div>
        </div>

        <div class="card">
          <h2>Communication</h2>
          <select id="callTarget">
            <option value="">No other participants</option>
          </select>
          <div class="action-row" style="margin-top: 10px;">
            <button onclick="startCall('video')">Video call</button>
            <button onclick="startCall('voice')">Voice call</button>
            <button class="danger" onclick="endCall()">End call</button>
          </div>
          <div class="support-text" style="margin-top: 10px;" id="callStatus">No active call</div>

          <div class="call-request-box" id="callRequestBox">
            <h3>Incoming call</h3>
            <div id="callRequestDetails" class="support-text" style="margin-bottom: 10px;"></div>
            <div class="action-row">
              <button class="success" onclick="acceptIncomingCall()">Accept</button>
              <button class="danger" onclick="rejectIncomingCall()">Decline</button>
            </div>
          </div>
        </div>

        <div class="card" id="callSection" style="display:none">
          <h2>Video / Audio</h2>
          <div class="video-container">
            <div>
              <video id="localVideo" class="video-element" autoplay muted playsinline></video>
              <div class="video-label">You</div>
            </div>
            <div id="remoteVideos"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let isSessionActive = false;
    let isDebugging = false;
    let isCallActive = false;
    let currentUserId = null;
    let currentParticipants = [];
    let currentSessionId = null;
    let incomingCallId = null;
    let localStream = null;
    let pendingOutgoingCallTarget = null;

    const peerConnections = new Map();
    const remoteStreams = new Map();

    const ICE_SERVERS = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];

    window.addEventListener('message', ({ data: msg }) => {
      switch (msg.command) {
        case 'session-joined':
          handleSessionJoined(msg.data);
          break;
        case 'session-left':
          handleSessionLeft();
          break;
        case 'participant-joined':
        case 'participant-left':
          updateParticipants(msg.data);
          break;
        case 'debug-started':
          isDebugging = true;
          renderDebugStatus();
          addActivity('Debugging started', 'A shared debug session is now active.');
          break;
        case 'debug-stopped':
          isDebugging = false;
          renderDebugStatus();
          addActivity('Debugging stopped', 'The shared debug session ended.');
          break;
        case 'terminal-output':
          addTerminalLine(msg.data);
          addActivity('Terminal command', msg.data.command || 'Command output shared in real time.');
          break;
        case 'call-started':
          isCallActive = true;
          renderCallStatus();
          addActivity('Call started', 'A session-wide call was started.');
          break;
        case 'call-ended':
          isCallActive = false;
          renderCallStatus();
          addActivity('Call ended', 'The active call was closed.');
          break;
        case 'call-request':
          handleIncomingCall(msg.data);
          addActivity('Incoming call', 'A participant is requesting ' + (msg.data.callType || 'voice') + ' chat.');
          break;
        case 'call-accepted':
          handleCallAccepted(msg.data);
          addActivity('Call accepted', 'WebRTC negotiation is starting.');
          break;
        case 'call-rejected':
          showToast('warning', 'Call declined: ' + (msg.data.reason || 'User unavailable'));
          break;
        case 'local-stream-ready':
          document.getElementById('callSection').style.display = 'block';
          if (localStream) displayLocalStream(localStream);
          break;
        case 'webrtc-offer':
          handleWebRTCOffer(msg.data);
          break;
        case 'webrtc-answer':
          handleWebRTCAnswer(msg.data);
          break;
        case 'webrtc-ice-candidate':
          handleWebRTCICE(msg.data);
          break;
        case 'connection-state-change':
          renderCallStatus();
          break;
        case 'disconnected':
          handleDisconnected();
          break;
        case 'update-session-ui':
          renderSessionStats(msg.data);
          break;
        case 'notify':
          showToast(msg.data.type, msg.data.message, msg.data.duration);
          break;
      }
    });

    function handleSessionJoined(info) {
      isSessionActive = true;
      currentUserId = info.currentUserId || null;
      currentSessionId = info.id || null;
      currentParticipants = info.participants || [];
      document.getElementById('sessionStatus').textContent = 'Connected to session ' + info.id;
      document.getElementById('sessionStatusPill').innerHTML = '<strong>Session</strong> ' + info.id.substring(0, 8);
      document.getElementById('connectionStatus').textContent = 'Connected';
      document.getElementById('connectionStatus').className = 'status-pill connected';
      document.getElementById('participantsSection').style.display = 'block';
      renderParticipants(currentParticipants);
      populateCallTargets();
      updateMetrics(info.participantCount || 0, info.editsCount || 0, info.id || '--');
      addActivity('Session joined', 'You are now connected to ' + info.id.substring(0, 8) + '.');
    }

    function handleSessionLeft() {
      isSessionActive = false;
      currentParticipants = [];
      currentUserId = null;
      currentSessionId = null;
      document.getElementById('sessionStatus').textContent = 'Join a session to start collaborating in real time.';
      document.getElementById('sessionStatusPill').textContent = 'No active session';
      document.getElementById('connectionStatus').textContent = 'Disconnected';
      document.getElementById('connectionStatus').className = 'status-pill offline';
      document.getElementById('participantsSection').style.display = 'none';
      document.getElementById('participantsList').innerHTML = '<div class="empty-state">No participants yet</div>';
      document.getElementById('activityFeed').innerHTML = '<div class="empty-state">Join a session to see live events here</div>';
      updateMetrics(0, 0, '--');
      populateCallTargets();
    }

    function handleDisconnected() {
      isSessionActive = false;
      document.getElementById('connectionStatus').textContent = 'Disconnected';
      document.getElementById('connectionStatus').className = 'status-pill offline';
    }

    function renderSessionStats(data) {
      if (!isSessionActive) {
        return;
      }
      updateMetrics(data.participantCount || 0, data.editsCount || 0, data.sessionId || currentSessionId || '--');
    }

    function updateMetrics(participantCount, editsCount, sessionValue) {
      document.getElementById('participantMetric').textContent = String(participantCount);
      document.getElementById('editMetric').textContent = String(editsCount);
      document.getElementById('sessionMetric').textContent = sessionValue === '--' ? '--' : String(sessionValue).substring(0, 8);
    }

    function updateParticipants(data) {
      currentParticipants = data.participants || [];
      renderParticipants(currentParticipants);
      populateCallTargets();
      document.getElementById('participantMetric').textContent = String(currentParticipants.length);
    }

    function renderParticipants(participants) {
      const list = document.getElementById('participantsList');
      if (!participants || participants.length === 0) {
        list.innerHTML = '<div class="empty-state">No participants yet</div>';
        return;
      }

      list.innerHTML = participants.map(p => {
        const avatar = (p.userName || 'U').trim().charAt(0).toUpperCase();
        const isMe = p.id && p.id === currentUserId;
        return '<div class="participant-item">' +
          '<div class="participant-main">' +
            '<div class="participant-avatar">' + escHtml(avatar) + '</div>' +
            '<div style="min-width: 0;">' +
              '<div class="participant-name">' + escHtml(p.userName) + (isMe ? ' <span class="participant-badge">You</span>' : '') + '</div>' +
              '<div class="participant-email">' + escHtml(p.email) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="participant-badge">' + (p.id ? p.id.substring(0, 8) : 'pending') + '</div>' +
        '</div>';
      }).join('');
    }

    function populateCallTargets() {
      const select = document.getElementById('callTarget');
      const others = currentParticipants.filter(p => p.id && p.id !== currentUserId);
      const prev = select.value;

      if (others.length === 0) {
        select.innerHTML = '<option value="">No other participants</option>';
        select.disabled = true;
        return;
      }

      select.disabled = false;
      select.innerHTML = others.map(p => '<option value="' + escHtml(p.id) + '">' + escHtml(p.userName) + ' (' + p.id.substring(0, 8) + ')</option>').join('');
      if (others.some(p => p.id === prev)) {
        select.value = prev;
      }
    }

    function renderDebugStatus() {
      document.getElementById('debugStatus').textContent = isDebugging ? 'Debugging active' : 'Debug inactive';
    }

    function renderCallStatus() {
      document.getElementById('callStatus').textContent = isCallActive ? 'Call active' : 'No active call';
    }

    function addActivity(title, copy) {
      const feed = document.getElementById('activityFeed');
      const empty = feed.querySelector('.empty-state');
      if (empty) {
        empty.remove();
      }
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = '<div class="activity-dot"></div>' +
        '<div>' +
          '<div class="activity-title">' + escHtml(title) + '</div>' +
          '<div class="activity-meta">' + escHtml(copy) + '</div>' +
        '</div>';
      feed.prepend(item);
      while (feed.children.length > 8) {
        feed.removeChild(feed.lastElementChild);
      }
    }

    function showToast(type, message, duration) {
      const area = document.getElementById('toast-area');
      const el = document.createElement('div');
      el.className = 'toast ' + (type || 'info');
      el.textContent = message;
      area.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => el.remove(), 350);
      }, duration || 3000);
    }

    function addTerminalLine(data) {
      const out = document.getElementById('terminalOutput');
      const empty = out.querySelector('.empty-state');
      if (empty) {
        empty.remove();
      }

      const cmd = document.createElement('div');
      cmd.className = 'terminal-line command';
      cmd.textContent = '[' + data.userId + '] $ ' + data.command;
      out.appendChild(cmd);

      if (data.output) {
        const res = document.createElement('div');
        res.className = 'terminal-line';
        res.textContent = data.output;
        out.appendChild(res);
      }
      out.scrollTop = out.scrollHeight;
    }

    function joinSession() {
      const raw = document.getElementById('sessionIdInput').value.trim();
      const sessionId = raw || 'session_' + Math.random().toString(36).substr(2, 9);
      vscode.postMessage({ command: 'join-session', data: { sessionId } });
    }

    function leaveSession() {
      vscode.postMessage({ command: 'leave-session', data: {} });
    }

    function copySessionId() {
      if (!currentSessionId) {
        showToast('warning', 'Join a session first to copy the session ID.');
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentSessionId)
          .then(() => showToast('success', 'Session ID copied.'))
          .catch(() => showToast('warning', 'Could not copy the session ID.'));
        return;
      }

      showToast('info', 'Session ID: ' + currentSessionId);
    }

    function startDebug() {
      vscode.postMessage({ command: 'start-debug', data: {} });
    }

    function stopDebug() {
      vscode.postMessage({ command: 'stop-debug', data: {} });
    }

    function executeTerminalCommand() {
      const input = document.getElementById('terminalInput');
      const command = input.value.trim();
      if (!command) {
        return;
      }
      vscode.postMessage({ command: 'terminal-command', data: { command, output: 'Command executed' } });
      input.value = '';
    }

    async function startCall(callType) {
      const targetId = document.getElementById('callTarget').value;
      if (!targetId) {
        showToast('warning', 'Select a participant before starting a call.');
        return;
      }
      try {
        await ensureLocalMedia();
      } catch (_e) {
        return;
      }
      pendingOutgoingCallTarget = targetId;
      vscode.postMessage({ command: 'start-call', data: { callType, targetId } });
      document.getElementById('callSection').style.display = 'block';
    }

    function endCall() {
      vscode.postMessage({ command: 'end-call', data: {} });
      closeAllPeerConnections();
      stopLocalStream();
      isCallActive = false;
      renderCallStatus();
    }

    function requestPermissions() {
      vscode.postMessage({ command: 'request-permissions', data: {} });
    }

    function handleIncomingCall(data) {
      incomingCallId = data.callId || Math.random().toString(36).substr(2, 9);
      const label = data.callType === 'video' ? 'Video' : 'Voice';
      document.getElementById('callRequestDetails').textContent = 'Type: ' + label + ' call';
      document.getElementById('callRequestBox').style.display = 'block';
    }

    async function acceptIncomingCall() {
      try {
        await ensureLocalMedia();
      } catch (_e) {
        return;
      }
      vscode.postMessage({ command: 'accept-call', data: { callId: incomingCallId } });
      document.getElementById('callRequestBox').style.display = 'none';
      document.getElementById('callSection').style.display = 'block';
    }

    function rejectIncomingCall() {
      vscode.postMessage({ command: 'reject-call', data: { callId: incomingCallId, reason: 'User declined' } });
      document.getElementById('callRequestBox').style.display = 'none';
      incomingCallId = null;
    }

    async function ensureLocalMedia() {
      if (localStream) {
        return localStream;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      displayLocalStream(stream);
      document.getElementById('callSection').style.display = 'block';
      return stream;
    }

    function createPeerConnection(userId) {
      if (peerConnections.has(userId)) {
        return peerConnections.get(userId);
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          vscode.postMessage({
            command: 'webrtc-ice-candidate',
            data: {
              to: userId,
              candidate: {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex
              }
            }
          });
        }
      };

      pc.ontrack = ({ streams }) => {
        if (streams[0]) {
          displayRemoteStream(userId, streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        renderCallStatus();
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          removeRemoteStream(userId);
          peerConnections.delete(userId);
        }
      };

      peerConnections.set(userId, pc);
      return pc;
    }

    async function handleCallAccepted(data) {
      if (!pendingOutgoingCallTarget) {
        return;
      }
      try {
        const pc = createPeerConnection(pendingOutgoingCallTarget);
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        vscode.postMessage({ command: 'webrtc-offer', data: { to: pendingOutgoingCallTarget, offer } });
      } catch (err) {
        console.error('Failed to send WebRTC offer:', err);
        showToast('error', 'Failed to start media negotiation.');
      }
    }

    async function handleWebRTCOffer(data) {
      try {
        await ensureLocalMedia();
        const pc = createPeerConnection(data.from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        vscode.postMessage({ command: 'webrtc-answer', data: { to: data.from, answer } });
      } catch (err) {
        console.error('Failed to handle offer:', err);
        showToast('error', 'Failed to handle incoming call.');
      }
    }

    async function handleWebRTCAnswer(data) {
      try {
        const pc = peerConnections.get(data.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        pendingOutgoingCallTarget = null;
      } catch (err) {
        console.error('Failed to handle answer:', err);
      }
    }

    async function handleWebRTCICE(data) {
      try {
        const pc = peerConnections.get(data.from);
        if (pc && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    }

    function displayLocalStream(stream) {
      localStream = stream;
      const vid = document.getElementById('localVideo');
      vid.srcObject = stream;
      vid.classList.add('active');
    }

    function displayRemoteStream(userId, stream) {
      remoteStreams.set(userId, stream);
      const container = document.getElementById('remoteVideos');
      let vid = document.getElementById('remote-' + userId);
      if (!vid) {
        const wrap = document.createElement('div');
        vid = document.createElement('video');
        vid.id = 'remote-' + userId;
        vid.className = 'video-element active';
        vid.autoplay = true;
        vid.playsInline = true;
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = 'Participant ' + userId.substring(0, 8);
        wrap.appendChild(vid);
        wrap.appendChild(label);
        container.appendChild(wrap);
      }
      vid.srcObject = stream;
    }

    function removeRemoteStream(userId) {
      remoteStreams.delete(userId);
      const vid = document.getElementById('remote-' + userId);
      if (vid && vid.parentElement) {
        vid.parentElement.remove();
      }
    }

    function stopLocalStream() {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      const vid = document.getElementById('localVideo');
      if (vid) {
        vid.srcObject = null;
        vid.classList.remove('active');
      }
    }

    function closeAllPeerConnections() {
      peerConnections.forEach(pc => pc.close());
      peerConnections.clear();
      remoteStreams.forEach((_stream, userId) => removeRemoteStream(userId));
    }

    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.clearSessionRefresh();

    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }

    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
  }
}
