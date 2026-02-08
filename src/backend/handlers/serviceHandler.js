/**
 * Service Handler - IPC handlers for service management
 * Handles: Start, stop, restart, status check for services
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Shared state - running processes map
const runningProcesses = new Map();

// Service logs storage (circular buffer per app, max 100 lines)
const serviceLogs = new Map();
const MAX_LOG_LINES = 100;

// Reference to mainWindow for sending IPC events
let mainWindowRef = null;

// Callback for service status changes (used by tray menu)
let onServiceChangeCallback = null;

// Import logApp function reference
let logAppFn = null;

// Context
let currentContext = {};

function logApp(message, type = 'INFO') {
    if (logAppFn) {
        logAppFn(message, type);
    } else {
        console.log(`${type}: ${message}`);
    }
}

// Notify when service status changes
function notifyServiceChange() {
    if (onServiceChangeCallback) {
        onServiceChangeCallback();
    }
}

// Add log entry for a service
function addServiceLog(appId, type, message) {
    if (!serviceLogs.has(appId)) {
        serviceLogs.set(appId, []);
    }

    const logs = serviceLogs.get(appId);
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, type, message };

    logs.push(entry);

    // Keep only last MAX_LOG_LINES entries
    if (logs.length > MAX_LOG_LINES) {
        logs.shift();
    }

    // Stream to frontend if mainWindow available
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('service-log', { appId, ...entry });
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

        if (appId === 'nginx') {
            // Create temp folders if needed (nginx requires these)
            const tempFolders = ['temp/client_body_temp', 'temp/proxy_temp', 'temp/fastcgi_temp', 'temp/uwsgi_temp', 'temp/scgi_temp'];
            for (const folder of tempFolders) {
                const folderPath = path.join(execDir, ...folder.split('/'));
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }
            }
            logApp(`Ensured temp folders exist in ${execDir}`, 'SERVICE');
        }
        // MySQL/MariaDB Initialization
        else if (appId === 'mysql' || appId === 'mariadb') {
            const dataDir = path.join(execDir, '..', 'data');
            if (!fs.existsSync(dataDir)) {
                logApp(`${appId === 'mariadb' ? 'MariaDB' : 'MySQL'} data directory not found at ${dataDir}. Initializing...`, 'SERVICE');

                try {
                    // Create data directory first
                    fs.mkdirSync(dataDir, { recursive: true });
                    logApp(`Created data directory: ${dataDir}`, 'SERVICE');

                    const baseDir = path.resolve(execDir, '..');

                    if (appId === 'mariadb') {
                        // MariaDB uses mariadb-install-db.exe or mysql_install_db.exe
                        const mariadbInstallDb = path.join(execDir, 'mariadb-install-db.exe');
                        const mysqlInstallDb = path.join(execDir, 'mysql_install_db.exe');

                        let installDbPath = null;
                        if (fs.existsSync(mariadbInstallDb)) {
                            installDbPath = mariadbInstallDb;
                        } else if (fs.existsSync(mysqlInstallDb)) {
                            installDbPath = mysqlInstallDb;
                        }

                        if (installDbPath) {
                            const initArgs = [
                                `--datadir="${dataDir}"`
                            ];
                            logApp(`Running initialization: ${installDbPath} ${initArgs.join(' ')}`, 'SERVICE');
                            execSync(`"${installDbPath}" ${initArgs.join(' ')}`, {
                                cwd: execDir,
                                stdio: 'inherit'
                            });
                        } else {
                            // Fallback: Just create the data directory and let MariaDB create files on first start
                            logApp('MariaDB install script not found. Will attempt first-start initialization.', 'SERVICE');
                        }
                    } else {
                        // MySQL uses --initialize-insecure
                        const initArgs = ['--initialize-insecure', '--console'];
                        initArgs.push(`--basedir="${baseDir}"`);
                        initArgs.push(`--datadir="${dataDir}"`);

                        logApp(`Running initialization: ${execPathNormalized} ${initArgs.join(' ')}`, 'SERVICE');
                        execSync(`"${execPathNormalized}" ${initArgs.join(' ')}`, {
                            cwd: execDir,
                            stdio: 'inherit'
                        });
                    }

                    // Load default config
                    const defaultIniPath = path.join(dataDir, 'my.ini');
                    const templateIniPath = path.join(currentContext.appDir, 'data', 'config', 'my.ini');
                    // check if template config exists
                    if (fs.existsSync(templateIniPath)) {
                        let iniContent = fs.readFileSync(templateIniPath, 'utf-8');
                        // Replace [dataDir] placeholder
                        iniContent = iniContent.replace(/\[dataDir\]/g, dataDir.replace(/\\/g, '/'));
                        // Replace [pluginDir] placeholder
                        const pluginDir = path.join(baseDir, 'lib', 'plugin').replace(/\\/g, '/');
                        iniContent = iniContent.replace(/\[pluginDir\]/g, pluginDir);

                        fs.writeFileSync(defaultIniPath, iniContent, 'utf-8');
                        logApp(`Wrote default my.ini config to ${defaultIniPath}`, 'SERVICE');
                    }

                    logApp(`${appId === 'mariadb' ? 'MariaDB' : 'MySQL'} initialized successfully.`, 'SERVICE');
                } catch (initErr) {
                    logApp(`${appId === 'mariadb' ? 'MariaDB' : 'MySQL'} initialization failed: ${initErr.message}`, 'ERROR');
                    return { error: `Failed to initialize database: ${initErr.message}` };
                }
            }
        }
        // MongoDB Initialization
        else if (appId === 'mongodb') {
            const dataDir = path.join(execDir, '..', 'data');
            if (!fs.existsSync(dataDir)) {
                logApp(`MongoDB data directory not found at ${dataDir}. Creating...`, 'SERVICE');
                fs.mkdirSync(dataDir, { recursive: true });
            }
            // Ensure dbpath exists (MongoDB requires this)
            const dbPath = path.join(dataDir, 'db');
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
                logApp(`Created MongoDB db path: ${dbPath}`, 'SERVICE');
            }

            // Append MongoDB args
            // If args already contains --dbpath, don't add it.
            if (!args || !args.includes('--dbpath')) {
                args = (args || '') + ` --dbpath "${dbPath}"`;
            }
            if (!args || !args.includes('--port')) {
                args = (args || '') + ` --port 27017`;
            }
            if (!args || !args.includes('--bind_ip')) {
                args = (args || '') + ` --bind_ip 127.0.0.1`;
            }
            // Logs
            const logFile = path.join(logsDir, 'mongod.log');
            if (!args || !args.includes('--logpath')) {
                args = (args || '') + ` --logpath "${logFile}"`;
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

                    // Load default config
                    const defaultConfPath = path.join(dataDir, 'postgresql.conf');
                    const localConfPath = path.join(currentContext.appDir, 'data', 'config', 'postgresql.local.conf');
                    // Check if local config exists
                    if (fs.existsSync(localConfPath)) {
                        let confContent = fs.readFileSync(defaultConfPath, 'utf-8');

                        // Include custom config at the end of postgresql.conf
                        confContent += `\n# Include custom local config\ninclude 'postgresql.local.conf'\n`;

                        // Copy local config file
                        const localConfDestPath = path.join(dataDir, 'postgresql.local.conf');
                        fs.copyFileSync(localConfPath, localConfDestPath);
                        logApp(`Copied local config to ${localConfDestPath}`, 'SERVICE');

                        fs.writeFileSync(defaultConfPath, confContent, 'utf-8');
                        logApp(`Updated postgresql.conf to include local config`, 'SERVICE');
                    }

                    logApp('PostgreSQL initialized successfully.', 'SERVICE');
                } catch (initErr) {
                    logApp(`PostgreSQL initialization failed: ${initErr.message}`, 'ERROR');
                    return { error: `Failed to initialize database: ${initErr.message}` };
                }
            }
            const dataDir2 = path.join(execDir, '..', 'data');
            args = args + ` -D "${dataDir2}"`;
        }

        // Parse args properly, respecting quoted strings
        let cmdArgs = [];
        if (args) {
            // Match either quoted strings or non-space sequences
            const matches = args.match(/"([^"]+)"|([^\s]+)/g);
            if (matches) {
                cmdArgs = matches.map(arg => arg.replace(/^"|"$/g, ''));
            }
        }
        logApp(`Starting: ${execPathNormalized} ${cmdArgs.join(' ')} in ${execDir}`, 'SERVICE');

        // Clear old logs for this app
        serviceLogs.set(appId, []);
        addServiceLog(appId, 'info', `Starting ${appId}...`);
        addServiceLog(appId, 'info', `Command: ${execPathNormalized} ${cmdArgs.join(' ')}`);

        const proc = spawn(execPathNormalized, cmdArgs, {
            cwd: execDir,
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Stream stdout
        proc.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => addServiceLog(appId, 'stdout', line));
        });

        // Stream stderr
        proc.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => addServiceLog(appId, 'stderr', line));
        });

        proc.on('error', (err) => {
            logApp(`Service ${appId} error: ${err.message}`, 'ERROR');
            addServiceLog(appId, 'error', `Process error: ${err.message}`);
            runningProcesses.delete(appId);
            notifyServiceChange();
        });

        proc.on('exit', (code) => {
            logApp(`Service ${appId} exited with code ${code}`, 'SERVICE');
            addServiceLog(appId, 'info', `Process exited with code ${code}`);
            runningProcesses.delete(appId);
            notifyServiceChange();
        });

        runningProcesses.set(appId, proc);
        logApp(`Started service: ${appId} (PID: ${proc.pid})`, 'SERVICE');
        notifyServiceChange();

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (proc.exitCode !== null) {
            logApp(`Service ${appId} failed to start (exited with ${proc.exitCode})`, 'ERROR');
            // Check logs
            const logs = serviceLogs.get(appId) || [];
            const lastLogs = logs.slice(-5).map(l => `[${l.type}] ${l.message}`).join('\n');
            const errorMsg = `Service exited immediately with code ${proc.exitCode}.\nLast output:\n${lastLogs}`;
            return { error: errorMsg };
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
    currentContext = context;

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
        const dbManager = getDbManager();
        if (dbManager) {
            dbManager.query('UPDATE installed_apps SET auto_start = 0 WHERE app_id = ?', [appId]);
        }

        return await stopAppService(appId, execPath, stopArgs);
    });

    // Check service status
    ipcMain.handle('app-service-status', async (event, appId, execPath) => {
        return getAppServiceStatus(appId, execPath);
    });

    // Restart service
    ipcMain.handle('app-service-restart', async (event, appId, execPath, startArgs, stopArgs) => {
        logApp(`Restarting service: ${appId}`, 'SERVICE');

        // Fallback: If startArgs is missing, try to fetch from DB
        if (!startArgs) {
            const dbManager = getDbManager();
            if (dbManager) {
                try {
                    const apps = dbManager.query('SELECT custom_args FROM installed_apps WHERE app_id = ?', [appId]);
                    if (apps && apps.length > 0 && apps[0].custom_args) {
                        startArgs = apps[0].custom_args;
                        logApp(`Recovered start args for ${appId} from DB: ${startArgs}`, 'WARNING');
                    }
                } catch (err) {
                    logApp(`Failed to fetch fallback args for ${appId}: ${err.message}`, 'ERROR');
                }
            }
        }

        // Always try to stop first to ensure clean state
        await stopAppService(appId, execPath, stopArgs);
        // Wait a bit to ensure port is released
        await new Promise(r => setTimeout(r, 1000));

        return await startAppService(appId, execPath, startArgs);
    });

    // Get service logs
    ipcMain.handle('app-service-get-logs', async (event, appId) => {
        const logs = serviceLogs.get(appId) || [];
        return { logs };
    });

    // Clear service logs
    ipcMain.handle('app-service-clear-logs', async (event, appId) => {
        serviceLogs.set(appId, []);
        return { success: true };
    });
}

// Set mainWindow reference for IPC events
function setMainWindow(win) {
    mainWindowRef = win;
}

/**
 * Stop a service
 * @param {string} appId - App identifier
 * @param {string} execPath - Path to executable
 * @param {string} stopArgs - Arguments for stop command
 * @returns {Promise<Object>} Result object
 */
async function stopAppService(appId, execPath, stopArgs) {
    try {
        // First try graceful stop with stopArgs if provided
        if (stopArgs) {
            const execDir = path.dirname(execPath);
            const cmdArgs = stopArgs.split(' ').filter(a => a);

            await new Promise((resolve) => {
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
                        resolve();
                    }
                };

                proc.on('close', () => cleanup());
                proc.on('error', () => cleanup());

                // Timeout after 3 seconds
                setTimeout(cleanup, 3000);
            });

            // Wait a bit for graceful shutdown
            await new Promise(r => setTimeout(r, 500));
        }

        // Always force kill to ensure process is stopped
        const proc = runningProcesses.get(appId);
        if (proc) {
            if (process.platform === 'win32') {
                try {
                    execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
                    logApp(`Taskkilled service: ${appId} (PID: ${proc.pid})`, 'SERVICE');
                } catch (e) {
                    // Process might already be dead
                }
            } else {
                try { proc.kill(); } catch (e) { }
            }
            runningProcesses.delete(appId);
        }

        // Also kill by executable name to catch any orphaned processes
        try {
            const exeName = path.basename(execPath);
            execSync(`taskkill /IM ${exeName} /F`, { stdio: 'ignore' });
            logApp(`Force killed all: ${exeName}`, 'SERVICE');
        } catch (e) {
            // No process found, that's fine
        }

        logApp(`Stopped service: ${appId}`, 'SERVICE');
        notifyServiceChange();
        return { success: true };
    } catch (err) {
        logApp(`Failed to stop service: ${err.message}`, 'ERROR');
        return { error: err.message };
    }
}

/**
 * Check service status
 * @param {string} appId - App identifier
 * @param {string} execPath - Path to executable
 * @returns {Object} Status object { running: boolean }
 */
function getAppServiceStatus(appId, execPath) {
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
}

/**
 * Set callback for service status changes
 * @param {Function} callback - Callback function to call when service status changes
 */
function setOnServiceChange(callback) {
    onServiceChangeCallback = callback;
}

// Export functions and state for use by main.js
module.exports = {
    register,
    startAppService,
    stopAppService,
    getAppServiceStatus,
    setMainWindow,
    setOnServiceChange,
    runningProcesses
};
