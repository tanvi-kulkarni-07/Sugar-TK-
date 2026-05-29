import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CollaborativePanel } from './webviewPanel';
import { ServerClient, SessionInfo, WebRTCManager } from './serverClient';

const execFileAsync = promisify(execFile);

export interface WorkspaceSessionState {
  sessionId?: string;
  userId: string;
  userName: string;
  email: string;
  identityConfirmed?: boolean;
}

export class WorkspaceCollaborationSession {
  private readonly serverClient: ServerClient;
  private readonly webrtcManager: WebRTCManager;
  private panel: CollaborativePanel | undefined;
  private sharedTerminal: vscode.Terminal | undefined;
  private readonly persistedState: WorkspaceSessionState;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceFolder: vscode.WorkspaceFolder,
    private readonly serverUrl: string,
    initialState: WorkspaceSessionState,
    private readonly saveState: (state: WorkspaceSessionState | undefined) => Thenable<void>
  ) {
    this.persistedState = { ...initialState };
    this.serverClient = new ServerClient(
      serverUrl,
      initialState.userId,
      initialState.userName,
      initialState.email
    );
    this.webrtcManager = new WebRTCManager(this.serverClient);
  }

  get workspaceKey(): string {
    return this.workspaceFolder.uri.toString();
  }

  get workspaceName(): string {
    return this.workspaceFolder.name;
  }

  isConnectedToServer(): boolean {
    return this.serverClient.isConnectedToServer();
  }

  isSessionActive(): boolean {
    return this.serverClient.isSessionActive();
  }

  getSessionId(): string | null {
    return this.serverClient.getSessionId();
  }

  getUserId(): string {
    return this.serverClient.getUserId();
  }

  async connect(): Promise<void> {
    await this.ensureUserProfile();
    await this.serverClient.connect();
  }

  async setIdentity(): Promise<WorkspaceSessionState | undefined> {
    const defaults = await resolveDefaultIdentity(this.workspaceFolder);
    const currentName = hasUsableIdentity(this.persistedState)
      ? this.persistedState.userName
      : defaults.userName;
    const currentEmail = hasUsableIdentity(this.persistedState)
      ? this.persistedState.email
      : defaults.email;

    const userName = await vscode.window.showInputBox({
      title: 'Collaboration Display Name',
      prompt: 'This name appears to other collaborators.',
      value: currentName,
      ignoreFocusOut: true,
      validateInput: value => value.trim() ? undefined : 'Enter a display name.'
    });

    if (userName === undefined) {
      return undefined;
    }

    const email = await vscode.window.showInputBox({
      title: 'Collaboration Email',
      prompt: 'This email appears in the participant list.',
      value: currentEmail,
      ignoreFocusOut: true,
      validateInput: value => isLikelyEmail(value.trim()) ? undefined : 'Enter a valid email address.'
    });

    if (email === undefined) {
      return undefined;
    }

    await this.updateIdentity(userName.trim(), email.trim());
    return { ...this.persistedState };
  }

  async showPanel(): Promise<void> {
    await this.connect();
    await this.ensurePanel();

    if (this.persistedState.sessionId && !this.serverClient.isSessionActive()) {
      await this.panel!.joinSession(this.persistedState.sessionId, false);
    }

    await this.panel!.show();
  }

  async startSession(): Promise<void> {
    const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    await this.joinSession(sessionId);
  }

  async joinSession(sessionId: string): Promise<void> {
    await this.connect();
    await this.ensurePanel();
    const sessionInfo = await this.panel!.joinSession(sessionId);
    if (!sessionInfo) {
      return;
    }

    this.persistedState.sessionId = sessionInfo.id;
    await this.saveState(this.persistedState);
  }

  leaveSession(): void {
    if (this.panel) {
      this.panel.leaveSession();
    } else {
      this.serverClient.leaveSession();
      this.persistedState.sessionId = undefined;
      void this.saveState(this.persistedState);
    }
  }

  async openSharedTerminal(): Promise<void> {
    if (!this.serverClient.isSessionActive()) {
      vscode.window.showWarningMessage('No active session.');
      return;
    }

    if (!this.sharedTerminal) {
      this.sharedTerminal = vscode.window.createTerminal(`Shared Terminal - ${this.workspaceName}`);
    }

    this.sharedTerminal.show();
    vscode.window.showInformationMessage('Shared terminal created for this workspace');

    const terminalDisposable = vscode.window.onDidCloseTerminal(terminal => {
      if (terminal === this.sharedTerminal) {
        this.sharedTerminal = undefined;
      }
    });

    this.context.subscriptions.push(terminalDisposable);
  }

  startDebugging(): void {
    if (!this.serverClient.isSessionActive()) {
      vscode.window.showWarningMessage('No active session.');
      return;
    }

    this.serverClient.startDebugging();
  }

  stopDebugging(): void {
    if (!this.serverClient.isSessionActive()) {
      return;
    }

    this.serverClient.stopDebugging();
  }

  setBreakpoint(line: number): void {
    if (!this.serverClient.isSessionActive()) {
      return;
    }

    this.serverClient.setBreakpoint(line);
  }

  startCall(callType: 'video' | 'voice', targetId?: string): void {
    if (!this.serverClient.isSessionActive()) {
      vscode.window.showWarningMessage('No active session.');
      return;
    }

    this.serverClient.startCall(callType, targetId);
  }

  acceptCall(callId: string): void {
    this.serverClient.acceptCall(callId);
  }

  rejectCall(callId: string, reason?: string): void {
    this.serverClient.rejectCall(callId, reason);
  }

  endCall(): void {
    this.serverClient.endCall();
    this.webrtcManager.closeAllConnections();
    this.webrtcManager.stopLocalStream();
  }

  requestPermissions(): void {
    void this.webrtcManager.getLocalStream({ audio: true, video: true });
  }

  sendCodeEdit(content: string, position: any, deltaText: string): void {
    this.serverClient.sendCodeEdit(content, position, deltaText);
  }

  sendCursorUpdate(cursorPosition: { line: number; column: number }): void {
    this.serverClient.sendCursorUpdate(cursorPosition);
  }

  sendSelectionUpdate(selection: any): void {
    this.serverClient.sendSelectionUpdate(selection);
  }

  sendTerminalCommand(command: string, output?: string): void {
    this.serverClient.sendTerminalCommand(command, output);
  }

  async sendWebRTCOffer(targetUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    this.serverClient.sendWebRTCOffer(targetUserId, offer);
  }

  async sendWebRTCAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    this.serverClient.sendWebRTCAnswer(targetUserId, answer);
  }

  async sendICECandidate(targetUserId: string, candidate: RTCIceCandidate | null): Promise<void> {
    this.serverClient.sendICECandidate(targetUserId, candidate);
  }

  dispose(): void {
    this.clearTerminal();
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
    this.serverClient.disconnect();
  }

  private async ensurePanel(): Promise<CollaborativePanel> {
    if (!this.panel) {
      this.panel = new CollaborativePanel(
        this.extensionUri,
        this.serverClient,
        this.webrtcManager,
        `Collaborative Editor - ${this.workspaceName}`,
        {
          onSessionJoined: sessionInfo => {
            this.persistedState.sessionId = sessionInfo.id;
            void this.saveState(this.persistedState);
          },
          onSessionLeft: () => {
            this.persistedState.sessionId = undefined;
            void this.saveState(this.persistedState);
          }
        }
      );
    }

    return this.panel;
  }

  private clearTerminal(): void {
    if (this.sharedTerminal) {
      this.sharedTerminal.dispose();
      this.sharedTerminal = undefined;
    }
  }

  private async ensureUserProfile(): Promise<void> {
    if (hasUsableIdentity(this.persistedState)) {
      this.serverClient.updateUserProfile(
        this.persistedState.userName,
        this.persistedState.email
      );
      return;
    }

    const defaults = await resolveDefaultIdentity(this.workspaceFolder);
    if (defaults.userName && defaults.email) {
      await this.updateIdentity(defaults.userName, defaults.email);
      return;
    }

    const identity = await this.setIdentity();
    if (!identity) {
      throw new Error('A collaboration display name and email are required.');
    }
  }

  private async updateIdentity(userName: string, email: string): Promise<void> {
    this.persistedState.userName = userName;
    this.persistedState.email = email;
    this.persistedState.identityConfirmed = true;
    this.serverClient.updateUserProfile(userName, email);
    await this.saveState(this.persistedState);
  }
}

export class CollaborationSessionManager {
  private readonly sessions = new Map<string, WorkspaceCollaborationSession>();
  private readonly storageKey = 'collaborative-editor.workspaceSessions';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    private readonly serverUrl: string
  ) {}

  async openPanel(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const session = this.getOrCreateSession(workspaceFolder);
    await session.showPanel();
  }

  async startSession(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const session = this.getOrCreateSession(workspaceFolder);
    await session.startSession();
  }

  async joinSession(workspaceFolder: vscode.WorkspaceFolder, sessionId: string): Promise<void> {
    const session = this.getOrCreateSession(workspaceFolder);
    await session.joinSession(sessionId);
  }

  leaveSession(workspaceFolder: vscode.WorkspaceFolder): void {
    this.getOrCreateSession(workspaceFolder).leaveSession();
  }

  async connect(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    await this.getOrCreateSession(workspaceFolder).connect();
  }

  async openSharedTerminal(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    await this.getOrCreateSession(workspaceFolder).openSharedTerminal();
  }

  startSharedDebug(workspaceFolder: vscode.WorkspaceFolder): void {
    this.getOrCreateSession(workspaceFolder).startDebugging();
  }

  stopSharedDebug(workspaceFolder: vscode.WorkspaceFolder): void {
    this.getOrCreateSession(workspaceFolder).stopDebugging();
  }

  setBreakpoint(workspaceFolder: vscode.WorkspaceFolder, line: number): void {
    this.getOrCreateSession(workspaceFolder).setBreakpoint(line);
  }

  startCall(workspaceFolder: vscode.WorkspaceFolder, callType: 'video' | 'voice', targetId?: string): void {
    this.getOrCreateSession(workspaceFolder).startCall(callType, targetId);
  }

  acceptCall(workspaceFolder: vscode.WorkspaceFolder, callId: string): void {
    this.getOrCreateSession(workspaceFolder).acceptCall(callId);
  }

  rejectCall(workspaceFolder: vscode.WorkspaceFolder, callId: string, reason?: string): void {
    this.getOrCreateSession(workspaceFolder).rejectCall(callId, reason);
  }

  endCall(workspaceFolder: vscode.WorkspaceFolder): void {
    this.getOrCreateSession(workspaceFolder).endCall();
  }

  requestPermissions(workspaceFolder: vscode.WorkspaceFolder): void {
    this.getOrCreateSession(workspaceFolder).requestPermissions();
  }

  sendCodeEdit(workspaceFolder: vscode.WorkspaceFolder, content: string, position: any, deltaText: string): void {
    this.getOrCreateSession(workspaceFolder).sendCodeEdit(content, position, deltaText);
  }

  sendCursorUpdate(workspaceFolder: vscode.WorkspaceFolder, cursorPosition: { line: number; column: number }): void {
    this.getOrCreateSession(workspaceFolder).sendCursorUpdate(cursorPosition);
  }

  sendSelectionUpdate(workspaceFolder: vscode.WorkspaceFolder, selection: any): void {
    this.getOrCreateSession(workspaceFolder).sendSelectionUpdate(selection);
  }

  sendTerminalCommand(workspaceFolder: vscode.WorkspaceFolder, command: string, output?: string): void {
    this.getOrCreateSession(workspaceFolder).sendTerminalCommand(command, output);
  }

  sendWebRTCOffer(workspaceFolder: vscode.WorkspaceFolder, targetUserId: string, offer: RTCSessionDescriptionInit): void {
    this.getOrCreateSession(workspaceFolder).sendWebRTCOffer(targetUserId, offer);
  }

  sendWebRTCAnswer(workspaceFolder: vscode.WorkspaceFolder, targetUserId: string, answer: RTCSessionDescriptionInit): void {
    this.getOrCreateSession(workspaceFolder).sendWebRTCAnswer(targetUserId, answer);
  }

  sendICECandidate(workspaceFolder: vscode.WorkspaceFolder, targetUserId: string, candidate: RTCIceCandidate | null): void {
    this.getOrCreateSession(workspaceFolder).sendICECandidate(targetUserId, candidate);
  }

  async setIdentity(workspaceFolder: vscode.WorkspaceFolder): Promise<WorkspaceSessionState | undefined> {
    return this.getOrCreateSession(workspaceFolder).setIdentity();
  }

  isConnected(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getOrCreateSession(workspaceFolder).isConnectedToServer();
  }

  isSessionActive(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getOrCreateSession(workspaceFolder).isSessionActive();
  }

  getSessionId(workspaceFolder: vscode.WorkspaceFolder): string | null {
    return this.getOrCreateSession(workspaceFolder).getSessionId();
  }

  dispose(): void {
    this.sessions.forEach(session => session.dispose());
    this.sessions.clear();
  }

  disposeWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const key = this.getWorkspaceKey(workspaceFolder);
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }

    session.dispose();
    this.sessions.delete(key);
  }

  private getOrCreateSession(workspaceFolder: vscode.WorkspaceFolder): WorkspaceCollaborationSession {
    const key = this.getWorkspaceKey(workspaceFolder);
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const storedState = this.getStoredSessionState(key);
    const initialState = storedState
      ? { ...storedState, userId: generateUserId() }
      : this.createDefaultSessionState();
    const session = new WorkspaceCollaborationSession(
      this.context,
      this.extensionUri,
      workspaceFolder,
      this.serverUrl,
      initialState,
      state => this.persistSessionState(key, state)
    );

    this.sessions.set(key, session);
    return session;
  }

  private getWorkspaceKey(workspaceFolder: vscode.WorkspaceFolder): string {
    return workspaceFolder.uri.toString();
  }

  private getStoredSessionState(key: string): WorkspaceSessionState | undefined {
    const allStates = this.context.workspaceState.get<Record<string, WorkspaceSessionState>>(this.storageKey, {});
    return allStates[key];
  }

  private async persistSessionState(
    key: string,
    state: WorkspaceSessionState | undefined
  ): Promise<void> {
    const allStates = this.context.workspaceState.get<Record<string, WorkspaceSessionState>>(this.storageKey, {});

    if (state) {
      allStates[key] = state;
    } else {
      delete allStates[key];
    }

    await this.context.workspaceState.update(this.storageKey, allStates);
  }

  private createDefaultSessionState(): WorkspaceSessionState {
    return {
      userId: generateUserId(),
      userName: '',
      email: '',
      identityConfirmed: false
    };
  }
}

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

function hasUsableIdentity(state: WorkspaceSessionState): boolean {
  return Boolean(
    state.userName.trim() &&
      state.email.trim() &&
      state.email !== 'user@example.com' &&
      !/^User \d+$/.test(state.userName)
  );
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveDefaultIdentity(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<{ userName: string; email: string }> {
  const [userName, email] = await Promise.all([
    readGitConfigValue('user.name', workspaceFolder),
    readGitConfigValue('user.email', workspaceFolder)
  ]);

  return {
    userName: userName ?? '',
    email: email ?? ''
  };
}

async function readGitConfigValue(
  key: 'user.name' | 'user.email',
  workspaceFolder: vscode.WorkspaceFolder
): Promise<string | undefined> {
  const lookups: Array<{ args: string[]; cwd?: string }> = [];

  if (workspaceFolder.uri.scheme === 'file') {
    lookups.push({
      args: ['config', key],
      cwd: workspaceFolder.uri.fsPath
    });
  }

  lookups.push({ args: ['config', '--global', key] });

  for (const lookup of lookups) {
    try {
      const { stdout } = await execFileAsync('git', lookup.args, { cwd: lookup.cwd });
      const value = stdout.toString().trim();
      if (value) {
        return value;
      }
    } catch {
      // Git may not be installed, or this workspace may not have local Git config.
    }
  }

  return undefined;
}
