import * as vscode from 'vscode';
import { CollaborationSessionManager } from './collaborationSession';

let sessionManager: CollaborationSessionManager | undefined;
const DEFAULT_SERVER_URL = 'https://sugar-tk.onrender.com';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Collaborative Editor Extension activated!');

  const configuration = vscode.workspace.getConfiguration('collaborative-editor');
  const serverUrl = configuration.get<string>('serverUrl', DEFAULT_SERVER_URL);

  sessionManager = new CollaborationSessionManager(context, context.extensionUri, serverUrl);

  const connectCmd = vscode.commands.registerCommand(
    'collaborative-editor.connectToServer',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      try {
        await sessionManager!.openPanel(workspaceFolder);
        vscode.window.showInformationMessage(
          `Connected to Collaborative Editor for ${workspaceFolder.name}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
      }
    }
  );

  const startSession = vscode.commands.registerCommand(
    'collaborative-editor.startSession',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      try {
        await sessionManager!.startSession(workspaceFolder);
        await sessionManager!.openPanel(workspaceFolder);
        vscode.window.showInformationMessage(
          `Collaborative session started for ${workspaceFolder.name}.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start session: ${error}`);
      }
    }
  );

  const joinSession = vscode.commands.registerCommand(
    'collaborative-editor.joinSession',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      const sessionId = await vscode.window.showInputBox({
        placeHolder: 'Enter session ID',
        prompt: 'Enter the session ID to join'
      });

      if (!sessionId) {
        return;
      }

      try {
        await sessionManager!.joinSession(workspaceFolder, sessionId);
        await sessionManager!.openPanel(workspaceFolder);
        vscode.window.showInformationMessage(
          `Joined collaborative session in ${workspaceFolder.name}.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to join session: ${error}`);
      }
    }
  );

  const stopSession = vscode.commands.registerCommand(
    'collaborative-editor.stopSession',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      sessionManager!.leaveSession(workspaceFolder);
      vscode.window.showInformationMessage(`Left collaborative session in ${workspaceFolder.name}`);
    }
  );

  const inviteParticipant = vscode.commands.registerCommand(
    'collaborative-editor.inviteParticipant',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      if (!sessionManager!.isSessionActive(workspaceFolder)) {
        vscode.window.showWarningMessage('No active session. Start or join a session first.');
        return;
      }

      const email = await vscode.window.showInputBox({
        placeHolder: 'user@example.com',
        prompt: 'Enter participant email to invite'
      });

      if (email) {
        const sessionId = sessionManager!.getSessionId(workspaceFolder);
        vscode.window.showInformationMessage(
          `Invitation sent to ${email}\nShare session ID: ${sessionId}`
        );
      }
    }
  );

  const showParticipants = vscode.commands.registerCommand(
    'collaborative-editor.showParticipants',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      if (!sessionManager!.isSessionActive(workspaceFolder)) {
        vscode.window.showWarningMessage('No active session. Start or join a session first.');
        return;
      }

      await sessionManager!.openPanel(workspaceFolder);
      const sessionId = sessionManager!.getSessionId(workspaceFolder);
      vscode.window.showInformationMessage(
        `Participants are shown in the collaboration panel for session ${sessionId}.`
      );
    }
  );

  const setIdentity = vscode.commands.registerCommand(
    'collaborative-editor.setIdentity',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      const identity = await sessionManager!.setIdentity(workspaceFolder);
      if (!identity) {
        return;
      }

      vscode.window.showInformationMessage(
        `Collaboration identity set to ${identity.userName} <${identity.email}>`
      );
    }
  );

  const openSharedTerminal = vscode.commands.registerCommand(
    'collaborative-editor.openSharedTerminal',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      await sessionManager!.openSharedTerminal(workspaceFolder);
    }
  );

  const startSharedDebug = vscode.commands.registerCommand(
    'collaborative-editor.startSharedDebug',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      if (!sessionManager!.isSessionActive(workspaceFolder)) {
        vscode.window.showWarningMessage('No active session.');
        return;
      }

      sessionManager!.startSharedDebug(workspaceFolder);
      vscode.window.showInformationMessage(`Shared debugging started for ${workspaceFolder.name}`);
    }
  );

  const stopSharedDebug = vscode.commands.registerCommand(
    'collaborative-editor.stopSharedDebug',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      sessionManager!.stopSharedDebug(workspaceFolder);
      vscode.window.showInformationMessage(`Shared debugging stopped for ${workspaceFolder.name}`);
    }
  );

  const setBreakpoint = vscode.commands.registerCommand(
    'collaborative-editor.setBreakpoint',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('Open a workspace file to set a shared breakpoint.');
        return;
      }

      if (!sessionManager!.isSessionActive(workspaceFolder)) {
        vscode.window.showWarningMessage('No active session.');
        return;
      }

      const line = editor.selection.active.line;
      sessionManager!.setBreakpoint(workspaceFolder, line);
      vscode.window.showInformationMessage(
        `Breakpoint set at line ${line + 1} in ${workspaceFolder.name}`
      );
    }
  );

  const startVideoCall = vscode.commands.registerCommand(
    'collaborative-editor.startVideoCall',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      if (!sessionManager!.isSessionActive(workspaceFolder)) {
        vscode.window.showWarningMessage('No active session.');
        return;
      }

      sessionManager!.startCall(workspaceFolder, 'video');
      vscode.window.showInformationMessage(`Video call initiated for ${workspaceFolder.name}`);
    }
  );

  const startVoiceCall = vscode.commands.registerCommand(
    'collaborative-editor.startVoiceCall',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      if (!sessionManager!.isSessionActive(workspaceFolder)) {
        vscode.window.showWarningMessage('No active session.');
        return;
      }

      sessionManager!.startCall(workspaceFolder, 'voice');
      vscode.window.showInformationMessage(`Voice call initiated for ${workspaceFolder.name}`);
    }
  );

  const endCurrentCall = async () => {
    const workspaceFolder = await resolveWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    sessionManager!.endCall(workspaceFolder);
    vscode.window.showInformationMessage(`Call ended for ${workspaceFolder.name}`);
  };

  const endCall = vscode.commands.registerCommand(
    'collaborative-editor.endCall',
    endCurrentCall
  );

  const endVideoCall = vscode.commands.registerCommand(
    'collaborative-editor.endVideoCall',
    endCurrentCall
  );

  const showPanel = vscode.commands.registerCommand(
    'collaborative-editor.showPanel',
    async () => {
      const workspaceFolder = await resolveWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      try {
        await sessionManager!.openPanel(workspaceFolder);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open panel: ${error}`);
      }
    }
  );

  const docChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    const manager = sessionManager;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(event.document.uri);
    if (!workspaceFolder || !manager?.isSessionActive(workspaceFolder)) {
      return;
    }

    const { document, contentChanges } = event;
    contentChanges.forEach(change => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        manager.sendCodeEdit(workspaceFolder, document.getText(), editor.selection.active, change.text);
      }
    });
  });

  const cursorChangeListener = vscode.window.onDidChangeTextEditorSelection(event => {
    const manager = sessionManager;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(event.textEditor.document.uri);
    if (!workspaceFolder || !manager?.isSessionActive(workspaceFolder)) {
      return;
    }

    const { line, character } = event.selections[0].active;
    manager.sendCursorUpdate(workspaceFolder, { line, column: character });
    manager.sendSelectionUpdate(workspaceFolder, event.selections);
  });

  const workspaceFolderListener = vscode.workspace.onDidChangeWorkspaceFolders(event => {
    event.removed.forEach(folder => sessionManager?.disposeWorkspace(folder));
  });

  context.subscriptions.push(
    connectCmd,
    startSession,
    joinSession,
    stopSession,
    inviteParticipant,
    showParticipants,
    setIdentity,
    openSharedTerminal,
    startSharedDebug,
    stopSharedDebug,
    setBreakpoint,
    startVideoCall,
    startVoiceCall,
    endCall,
    endVideoCall,
    showPanel,
    docChangeListener,
    cursorChangeListener,
    workspaceFolderListener
  );

  vscode.window
    .showInformationMessage(
      'Welcome to Collaborative Editor! Run "Connect to Server" to get started.',
      'Connect'
    )
    .then(selection => {
      if (selection === 'Connect') {
        vscode.commands.executeCommand('collaborative-editor.connectToServer');
      }
    });
}

export function deactivate() {
  sessionManager?.dispose();
}

async function resolveWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (activeFolder) {
      return activeFolder;
    }
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 1) {
    return folders[0];
  }

  if (folders.length > 1) {
    return vscode.window.showWorkspaceFolderPick({
      placeHolder: 'Choose the workspace to collaborate in'
    });
  }

  vscode.window.showWarningMessage('Open a workspace folder to use Collaborative Editor.');
  return undefined;
}
