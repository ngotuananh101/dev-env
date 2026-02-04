/**
 * Filesystem Handler - IPC handlers for file system operations
 * Handles: Get drives, list dir, open file, download, create/delete/rename, PATH management
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const si = require('systeminformation');
const { execSync } = require('child_process');

// Download state
let currentDownloadRequest = null;
let currentDownloadPath = null;

/**
 * Register filesystem-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context containing shell
 */
function register(ipcMain, context) {
    const { shell, app } = context;

    // Get available drives (Windows)
    ipcMain.handle('fs-get-drives', async () => {
        try {
            const fsSize = await si.fsSize();
            const drives = [...new Set(fsSize.map(fs => {
                const match = fs.mount.match(/^([A-Z]:)/i);
                return match ? match[1].toUpperCase() : null;
            }).filter(Boolean))];
            return drives.sort();
        } catch (error) {
            console.error('Get drives error:', error);
            return ['C:'];
        }
    });

    // List directory contents
    ipcMain.handle('fs-list-dir', async (event, dirPath) => {
        try {
            const targetPath = dirPath ? path.resolve(dirPath) : app.getPath('userData');
            const entries = await fsPromises.readdir(targetPath, { withFileTypes: true });

            const filePromises = entries.map(async (entry) => {
                const fullPath = path.join(targetPath, entry.name);
                try {
                    const stats = await fsPromises.stat(fullPath);
                    return {
                        name: entry.name,
                        path: fullPath,
                        isDir: entry.isDirectory(),
                        size: stats.size,
                        mtime: stats.mtime,
                        perms: (stats.mode & 0o777).toString(8)
                    };
                } catch (e) {
                    return {
                        name: entry.name,
                        path: fullPath,
                        isDir: entry.isDirectory(),
                        size: 0,
                        mtime: new Date(),
                        perms: '???',
                        error: 'Access Denied'
                    };
                }
            });

            const files = await Promise.all(filePromises);

            files.sort((a, b) => {
                if (a.isDir === b.isDir) {
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                }
                return a.isDir ? -1 : 1;
            });

            return { path: targetPath, files };
        } catch (error) {
            console.error('FS list error:', error);
            return { error: error.message };
        }
    });

    // Open file with system default app
    ipcMain.handle('fs-open-file', async (event, filePath) => {
        try {
            const result = await shell.openPath(filePath);
            if (result) {
                return { error: result };
            }
            return { success: true };
        } catch (error) {
            return { error: error.message };
        }
    });

    // Download file
    ipcMain.on('fs-download-file', (event, { url, targetPath, fileName }) => {
        const fullPath = path.join(targetPath, fileName);
        currentDownloadPath = fullPath;

        const file = fs.createWriteStream(fullPath);
        const protocol = url.startsWith('https') ? https : http;

        currentDownloadRequest = protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                event.sender.send('download-error', `Failed. Status Code: ${response.statusCode}`);
                file.close();
                fs.unlink(fullPath, () => { });
                currentDownloadRequest = null;
                return;
            }

            const totalBytes = parseInt(response.headers['content-length'], 10);
            let receivedBytes = 0;

            response.on('data', (chunk) => {
                file.write(chunk);
                receivedBytes += chunk.length;
                if (totalBytes) {
                    const progress = Math.round((receivedBytes / totalBytes) * 100);
                    event.sender.send('download-progress', progress);
                }
            });

            response.on('end', () => {
                file.end();
                event.sender.send('download-complete', fullPath);
                currentDownloadRequest = null;
            });
        });

        currentDownloadRequest.on('error', (err) => {
            fs.unlink(fullPath, () => { });
            event.sender.send('download-error', err.message);
            currentDownloadRequest = null;
        });
    });

    // Cancel download
    ipcMain.on('fs-cancel-download', (event) => {
        if (currentDownloadRequest) {
            currentDownloadRequest.destroy();
            currentDownloadRequest = null;
            if (currentDownloadPath) {
                fs.unlink(currentDownloadPath, () => {
                    event.sender.send('download-error', 'Download Cancelled by User');
                });
                currentDownloadPath = null;
            }
        }
    });

    // Create directory
    ipcMain.handle('fs-create-dir', async (event, { targetPath, name }) => {
        try {
            const fullPath = path.join(targetPath, name);
            await fsPromises.mkdir(fullPath);
            return { success: true, path: fullPath };
        } catch (error) {
            return { error: error.message };
        }
    });

    // Delete file/directory
    ipcMain.handle('fs-delete-path', async (event, targetPath) => {
        try {
            await fsPromises.rm(targetPath, { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            return { error: error.message };
        }
    });

    // Rename file/directory
    ipcMain.handle('fs-rename-path', async (event, { oldPath, newName }) => {
        try {
            const dir = path.dirname(oldPath);
            const newPath = path.join(dir, newName);
            await fsPromises.rename(oldPath, newPath);
            return { success: true };
        } catch (error) {
            return { error: error.message };
        }
    });

    // Select folder using system dialog
    ipcMain.handle('fs-select-folder', async (event) => {
        const { dialog } = require('electron');
        const { BrowserWindow } = require('electron');
        const win = BrowserWindow.getFocusedWindow();

        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory']
        });

        if (result.canceled) {
            return { canceled: true };
        } else {
            return { path: result.filePaths[0] };
        }
    });

    // Find file recursively
    ipcMain.handle('fs-find-file', async (event, { dirPath, targetFileName }) => {
        try {
            const findFile = async (dir, target) => {
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        // Avoid scanning node_modules or overly deep structures if necessary, but for app dir it should be fine
                        const found = await findFile(fullPath, target);
                        if (found) return found;
                    } else {
                        if (entry.name.toLowerCase() === target.toLowerCase()) {
                            return fullPath;
                        }
                    }
                }
                return null;
            };

            const result = await findFile(dirPath, targetFileName);
            return { path: result };
        } catch (error) {
            return { error: error.message };
        }
    });

    // ========== System PATH Management (using PowerShell) ==========

    // Check if a path is in User PATH
    ipcMain.handle('path-check', async (event, targetPath) => {
        try {
            if (process.platform !== 'win32') {
                return { error: 'Only supported on Windows' };
            }

            // Get User PATH using PowerShell
            const psCommand = `[Environment]::GetEnvironmentVariable('Path', 'User')`;
            let userPath = '';
            try {
                userPath = execSync(`powershell -Command "${psCommand}"`, { encoding: 'utf-8' }).trim();
            } catch (e) {
                return { inPath: false, userPath: '' };
            }

            if (!userPath) {
                return { inPath: false, userPath: '' };
            }

            const paths = userPath.split(';').map(p => p.toLowerCase().trim()).filter(p => p);
            const normalizedTarget = path.normalize(targetPath).toLowerCase();

            const inPath = paths.some(p => p === normalizedTarget || p === normalizedTarget + '\\');

            return { inPath, userPath };
        } catch (error) {
            console.error('[PATH] Check error:', error);
            return { error: error.message };
        }
    });

    // Add a path to User PATH
    ipcMain.handle('path-add', async (event, targetPath) => {
        try {
            if (process.platform !== 'win32') {
                return { error: 'Only supported on Windows' };
            }

            const normalizedPath = path.normalize(targetPath);
            console.log(`[PATH] Adding: ${normalizedPath}`);

            // Get current User PATH using PowerShell
            let currentPath = '';
            try {
                const psCommand = `[Environment]::GetEnvironmentVariable('Path', 'User')`;
                currentPath = execSync(`powershell -Command "${psCommand}"`, { encoding: 'utf-8' }).trim();
                console.log(`[PATH] Current PATH length: ${currentPath.length}`);
            } catch (e) {
                console.log('[PATH] No existing PATH found, starting fresh');
            }

            // Check if already in PATH
            const paths = currentPath.split(';').filter(p => p.trim());
            const normalizedTarget = normalizedPath.toLowerCase();
            const alreadyExists = paths.some(p =>
                p.toLowerCase().trim() === normalizedTarget ||
                p.toLowerCase().trim() === normalizedTarget + '\\'
            );

            if (alreadyExists) {
                console.log('[PATH] Already exists in PATH');
                return { success: true, message: 'Path already in PATH' };
            }

            // Add new path
            const newPath = currentPath ? `${currentPath};${normalizedPath}` : normalizedPath;
            console.log(`[PATH] New PATH length: ${newPath.length}`);

            // Update using PowerShell (automatically broadcasts WM_SETTINGCHANGE)
            const escapedPath = newPath.replace(/'/g, "''");
            const psSetCommand = `[Environment]::SetEnvironmentVariable('Path', '${escapedPath}', 'User')`;
            execSync(`powershell -Command "${psSetCommand}"`, { encoding: 'utf-8' });

            console.log(`[PATH] Successfully added: ${normalizedPath}`);
            return { success: true };
        } catch (error) {
            console.error('[PATH] Add error:', error);
            return { error: error.message };
        }
    });

    // Remove a path from User PATH
    ipcMain.handle('path-remove', async (event, targetPath) => {
        try {
            if (process.platform !== 'win32') {
                return { error: 'Only supported on Windows' };
            }

            const normalizedPath = path.normalize(targetPath).toLowerCase();
            console.log(`[PATH] Removing: ${normalizedPath}`);

            // Get current User PATH using PowerShell
            let currentPath = '';
            try {
                const psCommand = `[Environment]::GetEnvironmentVariable('Path', 'User')`;
                currentPath = execSync(`powershell -Command "${psCommand}"`, { encoding: 'utf-8' }).trim();
            } catch (e) {
                return { success: true, message: 'PATH is empty' };
            }

            if (!currentPath) {
                return { success: true, message: 'PATH is empty' };
            }

            // Filter out the target path
            const paths = currentPath.split(';').filter(p => p.trim());
            const filteredPaths = paths.filter(p => {
                const normalized = p.toLowerCase().trim();
                return normalized !== normalizedPath && normalized !== normalizedPath + '\\';
            });

            if (filteredPaths.length === paths.length) {
                console.log('[PATH] Path not found in PATH');
                return { success: true, message: 'Path not found in PATH' };
            }

            // Update using PowerShell
            const newPath = filteredPaths.join(';');
            const escapedPath = newPath.replace(/'/g, "''");
            const psSetCommand = `[Environment]::SetEnvironmentVariable('Path', '${escapedPath}', 'User')`;
            execSync(`powershell -Command "${psSetCommand}"`, { encoding: 'utf-8' });

            console.log(`[PATH] Successfully removed: ${targetPath}`);
            return { success: true };
        } catch (error) {
            console.error('[PATH] Remove error:', error);
            return { error: error.message };
        }
    });
}

module.exports = { register };
