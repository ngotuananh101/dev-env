/**
 * Hosts Handler - IPC handlers for Windows hosts file management
 * Handles: Read and write C:\Windows\System32\drivers\etc\hosts
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const START_MARKER = '# START DEV ENV';
const END_MARKER = '# END DEV ENV';

async function readHosts() {
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
}

async function writeHosts(content) {
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
}

async function addHosts(domains) {
    if (!domains || domains.length === 0) return;

    const result = await readHosts();
    if (result.error) return result;

    let content = result.content;
    const lines = content.split(/\r?\n/);

    let startIdx = lines.findIndex(l => l.trim() === START_MARKER);
    let endIdx = lines.findIndex(l => l.trim() === END_MARKER);

    if (startIdx === -1) {
        // Block doesn't exist, append it
        content += `\n${START_MARKER}\n`;
        for (const domain of domains) {
            content += `127.0.0.1 ${domain}\n`;
        }
        content += `${END_MARKER}\n`;
    } else {
        // Block exists
        // Get existing domains in block
        const existingBlock = lines.slice(startIdx + 1, endIdx);
        const existingDomains = new Set();
        existingBlock.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2 && parts[0] === '127.0.0.1') {
                existingDomains.add(parts[1]);
            }
        });

        // Add new domains if not exist
        const domainsToAdd = domains.filter(d => !existingDomains.has(d));
        if (domainsToAdd.length === 0) return { success: true }; // Nothing to add

        // Reconstruct content
        const beforeBlock = lines.slice(0, startIdx + 1);
        const blockContent = lines.slice(startIdx + 1, endIdx);
        const afterBlock = lines.slice(endIdx);

        for (const domain of domainsToAdd) {
            blockContent.push(`127.0.0.1 ${domain}`);
        }

        content = [...beforeBlock, ...blockContent, ...afterBlock].join('\n');
    }

    return await writeHosts(content);
}

async function removeHosts(domains) {
    if (!domains || domains.length === 0) return;

    const result = await readHosts();
    if (result.error) return result;

    let content = result.content;
    const lines = content.split(/\r?\n/);

    let startIdx = lines.findIndex(l => l.trim() === START_MARKER);
    let endIdx = lines.findIndex(l => l.trim() === END_MARKER);

    if (startIdx === -1 || endIdx === -1) return { success: true }; // Nothing to remove

    const beforeBlock = lines.slice(0, startIdx + 1);
    let blockContent = lines.slice(startIdx + 1, endIdx);
    const afterBlock = lines.slice(endIdx);

    // Filter out domains to remove
    const domainsToRemove = new Set(domains);
    blockContent = blockContent.filter(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && parts[0] === '127.0.0.1') {
            return !domainsToRemove.has(parts[1]);
        }
        return true; // Keep comments or other lines
    });

    content = [...beforeBlock, ...blockContent, ...afterBlock].join('\n');
    return await writeHosts(content);
}

/**
 * Register hosts-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    // Read hosts file
    ipcMain.handle('hosts-read', async () => readHosts());

    // Write hosts file (requires admin privileges)
    ipcMain.handle('hosts-write', async (event, content) => writeHosts(content));

    // Backup hosts file
    ipcMain.handle('hosts-backup', async () => {
        try {
            const content = await fsPromises.readFile(HOSTS_PATH, 'utf-8');

            // Try to write backup to userData first (safe writable location)
            const { userDataPath } = context;
            const backupPath = path.join(userDataPath, 'hosts_backup_' + Date.now());

            try {
                await fsPromises.writeFile(backupPath, content, 'utf-8');
                return { success: true, path: backupPath };
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

    // Manual add/remove (optional, exposed for frontend if needed)
    ipcMain.handle('hosts-add', async (event, domains) => addHosts(domains));
    ipcMain.handle('hosts-remove', async (event, domains) => removeHosts(domains));
}

module.exports = { register, readHosts, writeHosts, addHosts, removeHosts };
