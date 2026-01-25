/**
 * Logs Handler - IPC handlers for log file operations
 * Handles: Read, clear, list log files
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

let logsDir = null;

/**
 * Register logs-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    const { appDir } = context;

    // Initialize logs directory
    logsDir = path.join(appDir, 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Read log file for a specific date
    ipcMain.handle('logs-read', async (event, date) => {
        try {
            const logFile = path.join(logsDir, `${date}.log`);

            if (!fs.existsSync(logFile)) {
                return { content: '', error: null };
            }

            const content = await fsPromises.readFile(logFile, 'utf-8');
            return { content };
        } catch (error) {
            console.error('Failed to read log:', error);
            return { error: error.message };
        }
    });

    // Clear log file for a specific date
    ipcMain.handle('logs-clear', async (event, date) => {
        try {
            const logFile = path.join(logsDir, `${date}.log`);

            if (fs.existsSync(logFile)) {
                await fsPromises.unlink(logFile);
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to clear log:', error);
            return { error: error.message };
        }
    });

    // List available log files
    ipcMain.handle('logs-list', async () => {
        try {
            if (!fs.existsSync(logsDir)) {
                return { files: [] };
            }

            const entries = await fsPromises.readdir(logsDir);
            const logFiles = entries
                .filter(f => f.endsWith('.log'))
                .map(f => f.replace('.log', ''))
                .sort()
                .reverse();

            return { files: logFiles };
        } catch (error) {
            console.error('Failed to list logs:', error);
            return { error: error.message };
        }
    });
}

module.exports = { register };
