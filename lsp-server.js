const ws = require('ws');
const { WebSocketMessageReader, WebSocketMessageWriter, toSocket } = require('vscode-ws-jsonrpc');
const { createConnection, createServerProcess, forward } = require('vscode-ws-jsonrpc/server');

function initLspServer(server) {
  const wss = new ws.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      if (pathname.startsWith('/lsp/')) {
        wss.handleUpgrade(request, socket, head, (webSocket) => {
          wss.emit('connection', webSocket, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.error('❌ [LSP Upgrade Error] failed to parse upgrade request URL:', err);
      socket.destroy();
    }
  });

  wss.on('connection', (webSocket, request) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname;
      const lang = pathname.split('/').pop();

      console.log(`⚡ [LSP WebSocket] Client connected for language: ${lang}`);

      let command = '';
      let args = [];

      if (lang === 'cpp') {
        command = 'clangd';
        args = ['--log=error', '--stdio'];
      } else if (lang === 'python') {
        command = 'npx';
        args = ['pyright-langserver', '--stdio'];
      } else if (lang === 'java') {
        command = 'jdtls';
        args = [];
      } else {
        console.warn(`⚠️ [LSP WebSocket] Unsupported language requested: ${lang}`);
        webSocket.close(1003, `Unsupported language: ${lang}`);
        return;
      }

      const socket = toSocket(webSocket);
      const reader = new WebSocketMessageReader(socket);
      const writer = new WebSocketMessageWriter(socket);

      console.log(`🔧 [LSP WebSocket] Spawning child process: ${command} ${args.join(' ')}`);
      const serverProcess = createServerProcess(lang.toUpperCase(), command, args);

      const socketConnection = createConnection(reader, writer, () => {
        console.log(`🔌 [LSP WebSocket] Connection closed for ${lang}`);
        socket.dispose();
      });

      forward(socketConnection, serverProcess, (message) => {
        // Forwarding message between Monaco and language server
        return message;
      });

      serverProcess.onExit((code, signal) => {
        console.log(`⚠️ [LSP WebSocket] ${lang.toUpperCase()} server process exited with code ${code}, signal ${signal}`);
        try {
          webSocket.close(1011, `LSP process exited with code ${code}`);
        } catch (e) {}
      });

      serverProcess.onError((err) => {
        console.error(`❌ [LSP WebSocket] ${lang.toUpperCase()} server process error:`, err);
      });

    } catch (err) {
      console.error(`❌ [LSP WebSocket] Exception setting up LSP:`, err);
      try {
        webSocket.close(1011, `LSP setup failed: ${err.message}`);
      } catch (e) {}
    }
  });

  console.log('🔌 [LSP Server] WebSocket LSP Server Initialized successfully.');
}

module.exports = { initLspServer };
