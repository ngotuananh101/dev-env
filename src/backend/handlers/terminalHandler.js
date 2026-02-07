/**
 * Terminal Handler - IPC handlers for terminal operations
 * Handles: Terminal init, input, resize
 */

const os = require('os');

// Shared state
let ptyProcess = null;
let ptyModule = null;

// Try to load node-pty
try {
    ptyModule = require('node-pty');
} catch (e) {
    console.error("FAILURE: node-pty failed to load.", e);
}

/**
 * Register terminal-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {

    // Initialize terminal
    ipcMain.on('terminal-init', (event, options = {}) => {
        if (!ptyModule) {
            event.sender.send('terminal-data', 'Error: node-pty module could not be loaded. Terminal unavailable.\r\n');
            return;
        }

        const requestedCwd = options.cwd || os.homedir();

        if (ptyProcess) {
            if (options.cwd) {
                ptyProcess.resize(80, 30);
                ptyProcess.write(`Set-Location -Path "${requestedCwd}"; Clear-Host\r\n`);
            }
            return;
        }

        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

        try {
            ptyProcess = ptyModule.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: requestedCwd,
                env: process.env
            });

            ptyProcess.onData((data) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send('terminal-data', data);
                }
            });

        } catch (err) {
            console.error("PTY Spawn error:", err);
            event.sender.send('terminal-data', `Error spawning shell: ${err.message}\r\n`);
        }
    });

    // Terminal input
    ipcMain.on('terminal-input', (event, data) => {
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });

    // Terminal resize
    ipcMain.on('terminal-resize', (event, { cols, rows }) => {
        if (ptyProcess) {
            try {
                ptyProcess.resize(cols, rows);
            } catch (e) { }
        }
    });
}

module.exports = { register };
