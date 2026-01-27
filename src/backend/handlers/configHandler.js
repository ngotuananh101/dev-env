/**
 * Config Handler - IPC handlers for config file management
 * Handles: Read, save, restore config files
 */

const fs = require('fs');
const path = require('path');

// Import logApp from appsHandler (shared logging)
let logAppFn = null;

function logApp(message, type = 'INFO') {
    if (logAppFn) {
        logAppFn(message, type);
    } else {
        console.log(`${type}: ${message}`);
    }
}

/**
 * Register config-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    // Context not currently used (beyond logApp) but kept for consistency
    // Use shared logApp if provided
    if (context.logApp) {
        logAppFn = context.logApp;
    }

    // Read config file
    ipcMain.handle('app-read-config', async (event, installPath, configPath) => {
        try {
            const configFullPath = path.join(installPath, configPath);
            const backupPath = configFullPath + '.bak';

            logApp(`Reading config: ${configFullPath}`, 'CONFIG');

            if (!fs.existsSync(configFullPath)) {
                return { error: `Config file not found: ${configFullPath}` };
            }

            const content = fs.readFileSync(configFullPath, 'utf-8');
            const hasBackup = fs.existsSync(backupPath);

            return { content, hasBackup };
        } catch (err) {
            logApp(`Failed to read config: ${err.message}`, 'ERROR');
            return { error: err.message };
        }
    });

    // Save config file (backup if needed)
    ipcMain.handle('app-save-config', async (event, installPath, configPath, content) => {
        try {
            const configFullPath = path.join(installPath, configPath);
            const backupPath = configFullPath + '.bak';

            if (!fs.existsSync(configFullPath)) {
                return { error: `Config file not found: ${configFullPath}` };
            }

            // Backup if not exists
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(configFullPath, backupPath);
                logApp(`Created backup: ${backupPath}`, 'CONFIG');
            }

            // Save new content
            fs.writeFileSync(configFullPath, content, 'utf-8');
            logApp(`Saved config: ${configFullPath}`, 'CONFIG');

            return { success: true, hasBackup: true };
        } catch (err) {
            logApp(`Failed to save config: ${err.message}`, 'ERROR');
            return { error: err.message };
        }
    });

    // Restore config from backup
    ipcMain.handle('app-restore-config', async (event, installPath, configPath) => {
        try {
            const configFullPath = path.join(installPath, configPath);
            const backupPath = configFullPath + '.bak';

            if (!fs.existsSync(backupPath)) {
                return { error: 'No backup file found' };
            }

            // Restore from backup
            fs.copyFileSync(backupPath, configFullPath);
            const content = fs.readFileSync(configFullPath, 'utf-8');
            logApp(`Restored config from backup: ${configFullPath}`, 'CONFIG');

            return { success: true, content };
        } catch (err) {
            logApp(`Failed to restore config: ${err.message}`, 'ERROR');
            return { error: err.message };
        }
    });
}

module.exports = { register };
