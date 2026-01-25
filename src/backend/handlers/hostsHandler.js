/**
 * Hosts Handler - IPC handlers for Windows hosts file management
 * Handles: Read and write C:\Windows\System32\drivers\etc\hosts
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

/**
 * Register hosts-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {

    // Read hosts file
    ipcMain.handle('hosts-read', async () => {
        try {
            if (!fs.existsSync(HOSTS_PATH)) {
                return { error: 'Hosts file not found' };
            }

            const content = await fsPromises.readFile(HOSTS_PATH, 'utf-8');
            return { content };
        } catch (error) {
            console.error('Failed to read hosts:', error);
            return { error: error.message };
        }
    });

    // Write hosts file (requires admin privileges)
    ipcMain.handle('hosts-write', async (event, content) => {
        try {
            // Try direct write first
            try {
                await fsPromises.writeFile(HOSTS_PATH, content, 'utf-8');
                console.log('Hosts file saved directly');
                return { success: true };
            } catch (directError) {
                // If direct write fails, try using PowerShell with admin elevation
                console.log('Direct write failed, trying PowerShell method...');

                // Create a temp file
                const tempPath = path.join(process.env.TEMP || 'C:\\Temp', 'hosts_temp_' + Date.now());
                await fsPromises.writeFile(tempPath, content, 'utf-8');

                try {
                    // Use PowerShell to copy with elevation request
                    const psCommand = `Start-Process powershell -Verb RunAs -ArgumentList '-Command', 'Copy-Item -Path \"${tempPath}\" -Destination \"${HOSTS_PATH}\" -Force' -Wait`;
                    execSync(`powershell -Command "${psCommand}"`, { encoding: 'utf-8' });

                    // Clean up temp file
                    await fsPromises.unlink(tempPath);

                    console.log('Hosts file saved via elevated PowerShell');
                    return { success: true };
                } catch (psError) {
                    // Clean up temp file on error
                    try {
                        await fsPromises.unlink(tempPath);
                    } catch (e) { }

                    throw new Error('Administrator privileges required. Please run the app as Administrator.');
                }
            }
        } catch (error) {
            console.error('Failed to write hosts:', error);
            return { error: error.message };
        }
    });

    // Backup hosts file
    ipcMain.handle('hosts-backup', async () => {
        try {
            const content = await fsPromises.readFile(HOSTS_PATH, 'utf-8');
            const backupPath = HOSTS_PATH + '.backup_' + Date.now();

            // Try to write backup to same location
            try {
                await fsPromises.writeFile(backupPath, content, 'utf-8');
            } catch (e) {
                // If fails, save to user's temp folder
                const userBackup = path.join(process.env.TEMP || 'C:\\Temp', 'hosts_backup_' + Date.now());
                await fsPromises.writeFile(userBackup, content, 'utf-8');
                return { success: true, path: userBackup };
            }

            return { success: true, path: backupPath };
        } catch (error) {
            console.error('Failed to backup hosts:', error);
            return { error: error.message };
        }
    });
}

module.exports = { register };
