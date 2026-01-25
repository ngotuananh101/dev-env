/**
 * System Handler - IPC handlers for system-related operations
 * Handles: System stats, IP address, database queries, app quit
 */

const si = require('systeminformation');

/**
 * Register system-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context containing dbManager, app, etc.
 */
function register(ipcMain, context) {
    const { app, getDbManager } = context;

    // Get system stats (CPU, RAM, Disk)
    ipcMain.handle('get-sys-stats', async () => {
        try {
            const [cpu, mem, currentLoad, fsSize] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.currentLoad(),
                si.fsSize()
            ]);

            return {
                cpuLoad: currentLoad.currentLoad,
                loadAvg: currentLoad.cpus.map(c => c.load),
                mem: {
                    used: mem.used,
                    total: mem.total,
                    active: mem.active
                },
                cpuCores: cpu.cores,
                fsSize: fsSize,
            };
        } catch (error) {
            console.error('Stats error:', error);
            return null;
        }
    });

    // Get IP address
    ipcMain.handle('get-ip-address', async () => {
        try {
            const interfaces = await si.networkInterfaces();
            const mainInterface = interfaces.find(iface => !iface.internal && iface.ip4 && iface.ip4 !== '127.0.0.1');
            return mainInterface ? mainInterface.ip4 : '127.0.0.1';
        } catch (error) {
            console.error('IP Error:', error);
            return '127.0.0.1';
        }
    });

    // Quit application
    ipcMain.on('app-quit', () => {
        app.quit();
    });

    // Database query
    ipcMain.handle('db-query', (event, sql, params) => {
        const dbManager = getDbManager();
        if (dbManager) {
            return dbManager.query(sql, params);
        }
        return { error: 'Database not initialized' };
    });
}

module.exports = { register };
