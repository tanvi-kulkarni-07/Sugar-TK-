# collaborative-editor README

This is the README for your extension "collaborative-editor". After writing up a brief description, we recommend including the following sections.

## Features

- Clean collaboration dashboard with session controls, participant list, live activity, shared terminal, debugging, and voice/video tools in separate sections.
- Real-time activity feed so developers can see joins, terminal usage, debugging, and call events as they happen.
- WebRTC-based voice/video calls with Socket.IO signaling for offers, answers, and ICE candidates.
- Shared editing, cursor, selection, and terminal updates routed through the collaborative server room for the active session.

## Real-time Collaboration Flow

1. A developer starts or joins a session using the session ID shown in the panel.
2. The extension connects to the Socket.IO server and joins the matching server room.
3. Code edits, cursor updates, selections, terminal events, and debug events are broadcast to everyone in that room.
4. For voice and video, the server only relays signaling messages. The actual media stream is negotiated peer-to-peer through WebRTC after the initial handshake.

The updated panel shows that flow directly in the UI so new collaborators can understand what is happening without opening the code first.

## Requirements

The extension connects to the local collaborative server by default at `http://localhost:3000`. Update the `collaborative-editor.serverUrl` setting if your server runs elsewhere.

Run the server from the `collaborative-editor-server` folder before joining a session.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
