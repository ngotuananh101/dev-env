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

    // Get detailed system information
    ipcMain.handle('get-system-info', async () => {
        const os = require('os');
        try {
            const [cpu, mem, osInfo, graphics, network, diskLayout] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.osInfo(),
                si.graphics(),
                si.networkInterfaces(),
                si.diskLayout()
            ]);

            const separator = '='.repeat(60);
            const lines = [];

            lines.push(separator);
            lines.push('DEV-ENV SYSTEM INFORMATION');
            lines.push(separator);
            lines.push('');

            // OS Info
            lines.push('[OPERATING SYSTEM]');
            lines.push(`  OS: ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`);
            lines.push(`  Hostname: ${os.hostname()}`);
            lines.push(`  Platform: ${osInfo.platform}`);
            lines.push(`  Kernel: ${osInfo.kernel}`);
            lines.push('');

            // CPU Info
            lines.push('[CPU]');
            lines.push(`  Model: ${cpu.manufacturer} ${cpu.brand}`);
            lines.push(`  Cores: ${cpu.physicalCores} physical, ${cpu.cores} logical`);
            lines.push(`  Base Speed: ${cpu.speed} GHz`);
            if (cpu.speedMax) {
                lines.push(`  Max Speed: ${cpu.speedMax} GHz`);
            }
            lines.push('');

            // Memory Info
            lines.push('[MEMORY]');
            const totalGB = (mem.total / (1024 ** 3)).toFixed(2);
            const usedGB = (mem.used / (1024 ** 3)).toFixed(2);
            const freeGB = (mem.free / (1024 ** 3)).toFixed(2);
            lines.push(`  Total: ${totalGB} GB`);
            lines.push(`  Used: ${usedGB} GB`);
            lines.push(`  Free: ${freeGB} GB`);
            lines.push('');

            // Graphics Info
            if (graphics.controllers && graphics.controllers.length > 0) {
                lines.push('[GRAPHICS]');
                graphics.controllers.forEach((gpu, index) => {
                    lines.push(`  GPU ${index + 1}: ${gpu.vendor} ${gpu.model}`);
                    if (gpu.vram) {
                        lines.push(`    VRAM: ${gpu.vram} MB`);
                    }
                });
                lines.push('');
            }

            // Disk Info
            if (diskLayout && diskLayout.length > 0) {
                lines.push('[STORAGE]');
                diskLayout.forEach((disk, index) => {
                    const sizeGB = (disk.size / (1024 ** 3)).toFixed(2);
                    lines.push(`  Disk ${index + 1}: ${disk.vendor} ${disk.name} (${sizeGB} GB)`);
                    lines.push(`    Type: ${disk.type}`);
                });
                lines.push('');
            }

            // Network Info
            const activeNetworks = network.filter(n => !n.internal && n.ip4);
            if (activeNetworks.length > 0) {
                lines.push('[NETWORK]');
                activeNetworks.forEach(net => {
                    lines.push(`  ${net.iface}: ${net.ip4}`);
                    if (net.mac) {
                        lines.push(`    MAC: ${net.mac}`);
                    }
                });
                lines.push('');
            }

            // App Info
            lines.push('[APPLICATION]');
            lines.push(`  App Version: ${app.getVersion()}`);
            lines.push(`  Electron: ${process.versions.electron}`);
            lines.push(`  Node.js: ${process.versions.node}`);
            lines.push(`  Chrome: ${process.versions.chrome}`);
            lines.push(`  V8: ${process.versions.v8}`);
            lines.push(`  App Path: ${require.main ? require('path').dirname(require.main.filename) : 'N/A'}`);
            lines.push(`  User Data: ${app.getPath('userData')}`);
            lines.push('');

            lines.push(separator);
            lines.push(`Generated at: ${new Date().toLocaleString()}`);
            lines.push(separator);

            return { success: true, info: lines.join('\n') };
        } catch (error) {
            console.error('Failed to get system info:', error);
            return { success: false, error: error.message };
        }
    });

    // Database query
    ipcMain.handle('db-query', (event, sql, params) => {
        const dbManager = getDbManager();
        if (dbManager) {
            return dbManager.query(sql, params);
        }
        return { error: 'Database not initialized' };
    });

    // Get startup status
    ipcMain.handle('get-startup-status', () => {
        try {
            const settings = app.getLoginItemSettings();
            return { success: true, enabled: settings.openAtLogin };
        } catch (error) {
            console.error('Failed to get startup status:', error);
            return { success: false, error: error.message };
        }
    });

    // Toggle startup
    ipcMain.handle('toggle-startup', (event, enabled) => {
        try {
            app.setLoginItemSettings({
                openAtLogin: enabled,
                path: app.getPath('exe') // Explicitly set path to current executable
            });
            return { success: true, enabled };
        } catch (error) {
            console.error('Failed to toggle startup:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
