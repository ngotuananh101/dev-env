/**
 * Service Handler - IPC handlers for service management
 * Handles: Start, stop, restart, status check for services
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Shared state - running processes map
const runningProcesses = new Map();

// Import logApp function reference
let logAppFn = null;

function logApp(message, type = 'INFO') {
    if (logAppFn) {
        logAppFn(message, type);
    } else {
        console.log(`${type}: ${message}`);
    }
}

/**
 * Helper to start service (used by IPC and auto-start)
 * @param {string} appId - App identifier
 * @param {string} execPath - Path to executable
 * @param {string} args - Command line arguments
 * @returns {Promise<Object>} Result object
 */
async function startAppService(appId, execPath, args) {
    try {
        if (runningProcesses.has(appId)) {
            const existingProc = runningProcesses.get(appId);
            try {
                process.kill(existingProc.pid, 0);
                return { error: 'Service already running' };
            } catch (e) {
                logApp(`Found stale process for ${appId} (PID: ${existingProc.pid}), cleaning up`, 'WARNING');
                runningProcesses.delete(appId);
            }
        }

        const execPathNormalized = path.normalize(execPath);
        const execDir = path.dirname(execPathNormalized);

        // Create logs folder if needed (nginx requires this)
        const logsDir = path.join(execDir, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
            logApp(`Created logs folder: ${logsDir}`, 'SERVICE');
        }

        // Create temp folders if needed (nginx requires these)
        const tempFolders = ['temp/client_body_temp', 'temp/proxy_temp', 'temp/fastcgi_temp', 'temp/uwsgi_temp', 'temp/scgi_temp'];
        for (const folder of tempFolders) {
            const folderPath = path.join(execDir, ...folder.split('/'));
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
        }
        logApp(`Ensured temp folders exist in ${execDir}`, 'SERVICE');

        // MySQL/MariaDB Initialization
        if (appId === 'mysql' || appId === 'mariadb') {
            const dataDir = path.join(execDir, '..', 'data');
            if (!fs.existsSync(dataDir)) {
                logApp(`MySQL data directory not found at ${dataDir}. Initializing...`, 'SERVICE');

                try {
                    const initArgs = ['--initialize-insecure', '--console'];
                    const baseDir = path.resolve(execDir, '..');
                    initArgs.push(`--basedir=${baseDir}`);
                    initArgs.push(`--datadir=${dataDir}`);

                    logApp(`Running initialization: ${execPathNormalized} ${initArgs.join(' ')}`, 'SERVICE');

                    execSync(`"${execPathNormalized}" ${initArgs.join(' ')}`, {
                        cwd: execDir,
                        stdio: 'inherit'
                    });

                    logApp('MySQL initialized successfully.', 'SERVICE');
                } catch (initErr) {
                    logApp(`MySQL initialization failed: ${initErr.message}`, 'ERROR');
                    return { error: `Failed to initialize database: ${initErr.message}` };
                }
            }
        }
        // PostgreSQL Initialization
        else if (appId === 'postgresql') {
            const dataDir = path.join(execDir, '..', 'data');
            if (!fs.existsSync(dataDir)) {
                logApp(`PostgreSQL data directory not found at ${dataDir}. Initializing...`, 'SERVICE');

                try {
                    const initDbPath = path.join(execDir, 'initdb.exe');

                    if (!fs.existsSync(initDbPath)) {
                        throw new Error(`initdb.exe not found at ${initDbPath}`);
                    }

                    const initArgs = [
                        `-D "${dataDir}"`,
                        '-E UTF8',
                        '-U postgres',
                        '--locale=C',
                        '-A trust'
                    ];

                    logApp(`Running initialization: ${initDbPath} ${initArgs.join(' ')}`, 'SERVICE');

                    execSync(`"${initDbPath}" ${initArgs.join(' ')}`, {
                        cwd: execDir,
                        stdio: 'inherit'
                    });

                    logApp('PostgreSQL initialized successfully.', 'SERVICE');
                } catch (initErr) {
                    logApp(`PostgreSQL initialization failed: ${initErr.message}`, 'ERROR');
                    return { error: `Failed to initialize database: ${initErr.message}` };
                }
            }
            const dataDir2 = path.join(execDir, '..', 'data');
            args = args + ' -D ' + dataDir2;
        }

        const cmdArgs = args ? args.split(' ').filter(a => a) : [];
        logApp(`Starting: ${execPathNormalized} ${cmdArgs.join(' ')} in ${execDir}`, 'SERVICE');

        const proc = spawn(execPathNormalized, cmdArgs, {
            cwd: execDir,
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderrData = '';
        proc.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        proc.on('error', (err) => {
            logApp(`Service ${appId} error: ${err.message}`, 'ERROR');
            runningProcesses.delete(appId);
        });

        proc.on('exit', (code) => {
            logApp(`Service ${appId} exited with code ${code}`, 'SERVICE');
            if (stderrData) {
                logApp(`Service ${appId} stderr: ${stderrData}`, 'ERROR');
            }
            runningProcesses.delete(appId);
        });

        runningProcesses.set(appId, proc);
        logApp(`Started service: ${appId} (PID: ${proc.pid})`, 'SERVICE');

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (proc.exitCode !== null) {
            logApp(`Service ${appId} failed to start (exited with ${proc.exitCode})`, 'ERROR');
            return { error: `Service exited immediately with code ${proc.exitCode}. Check logs.` };
        }

        return { success: true, pid: proc.pid };
    } catch (err) {
        logApp(`Failed to start service: ${err.message}`, 'ERROR');
        return { error: err.message };
    }
}

/**
 * Register service-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    const { getDbManager } = context;

    // Use shared logApp if provided
    if (context.logApp) {
        logAppFn = context.logApp;
    }

    // Start service
    ipcMain.handle('app-service-start', async (event, appId, execPath, args) => {
        const result = await startAppService(appId, execPath, args);

        if (result.success) {
            const dbManager = getDbManager();
            if (dbManager) {
                dbManager.query('UPDATE installed_apps SET auto_start = 1 WHERE app_id = ?', [appId]);
            }
        }

        return result;
    });

    // Stop service
    ipcMain.handle('app-service-stop', async (event, appId, execPath, stopArgs) => {
        try {
            const dbManager = getDbManager();
            if (dbManager) {
                dbManager.query('UPDATE installed_apps SET auto_start = 0 WHERE app_id = ?', [appId]);
            }

            if (stopArgs) {
                const execDir = path.dirname(execPath);
                const cmdArgs = stopArgs.split(' ').filter(a => a);

                return new Promise((resolve) => {
                    const proc = spawn(execPath, cmdArgs, {
                        cwd: execDir,
                        stdio: 'ignore'
                    });

                    let resolved = false;
                    const cleanup = () => {
                        if (!resolved) {
                            runningProcesses.delete(appId);
                            logApp(`Stopped service: ${appId}`, 'SERVICE');
                            resolved = true;
                            resolve({ success: true });
                        }
                    };

                    proc.on('close', (code) => {
                        cleanup();
                    });

                    proc.on('error', (err) => {
                        if (!resolved) {
                            logApp(`Stop command failed for ${appId}: ${err.message}`, 'ERROR');
                            runningProcesses.delete(appId);
                            resolved = true;
                            resolve({ error: err.message });
                        }
                    });

                    setTimeout(() => {
                        if (!resolved) {
                            logApp(`Stop command timed out for ${appId}, forcing cleanup`, 'WARNING');
                            runningProcesses.delete(appId);
                            resolved = true;
                            resolve({ success: true });
                        }
                    }, 5000);
                });
            }

            const proc = runningProcesses.get(appId);
            if (proc) {
                if (process.platform === 'win32') {
                    try {
                        execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
                        logApp(`Taskkilled service: ${appId} (PID: ${proc.pid})`, 'SERVICE');
                    } catch (e) {
                        proc.kill();
                    }
                } else {
                    proc.kill();
                }
                runningProcesses.delete(appId);
                logApp(`Killed service: ${appId}`, 'SERVICE');
                return { success: true };
            }

            try {
                const exeName = path.basename(execPath);
                execSync(`taskkill /IM ${exeName} /F`, { stdio: 'ignore' });
                logApp(`Force killed: ${exeName}`, 'SERVICE');
                return { success: true };
            } catch (e) {
                return { error: 'Process not found' };
            }
        } catch (err) {
            logApp(`Failed to stop service: ${err.message}`, 'ERROR');
            return { error: err.message };
        }
    });

    // Check service status
    ipcMain.handle('app-service-status', async (event, appId, execPath) => {
        try {
            const exeName = path.basename(execPath);

            try {
                const result = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, { encoding: 'utf-8' });
                const isRunning = result.toLowerCase().includes(exeName.toLowerCase());
                return { running: isRunning };
            } catch (e) {
                return { running: false };
            }
        } catch (err) {
            return { running: false, error: err.message };
        }
    });

    // Restart service
    ipcMain.handle('app-service-restart', async (event, appId, execPath, startArgs, stopArgs) => {
        logApp(`Restarting service: ${appId}`, 'SERVICE');

        if (runningProcesses.has(appId)) {
            await new Promise(async (resolve) => {
                const proc = runningProcesses.get(appId);

                if (stopArgs) {
                    try {
                        const execDir = path.dirname(execPath);
                        const cmdArgs = stopArgs.split(' ').filter(a => a);

                        const stopProc = spawn(execPath, cmdArgs, { cwd: execDir, stdio: 'ignore' });

                        stopProc.on('close', () => {
                            runningProcesses.delete(appId);
                            resolve();
                        });

                        stopProc.on('error', () => {
                            if (proc) proc.kill();
                            runningProcesses.delete(appId);
                            resolve();
                        });

                        setTimeout(() => {
                            if (runningProcesses.has(appId)) {
                                if (proc) proc.kill();
                                runningProcesses.delete(appId);
                            }
                            resolve();
                        }, 5000);

                        return;
                    } catch (e) { }
                }

                if (proc) proc.kill();
                runningProcesses.delete(appId);
                resolve();
            });

            runningProcesses.delete(appId);
        }

        await new Promise(r => setTimeout(r, 1000));

        return await startAppService(appId, execPath, startArgs);
    });
}

// Export functions and state for use by main.js
module.exports = {
    register,
    startAppService,
    runningProcesses
};
