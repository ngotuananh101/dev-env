/**
 * Filesystem Handler - IPC handlers for file system operations
 * Handles: Get drives, list dir, open file, download, create/delete/rename
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const si = require('systeminformation');

// Download state
let currentDownloadRequest = null;
let currentDownloadPath = null;

/**
 * Register filesystem-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context containing shell
 */
function register(ipcMain, context) {
    const { shell } = context;

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
            const targetPath = dirPath ? path.resolve(dirPath) : os.homedir();
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
}

module.exports = { register };
