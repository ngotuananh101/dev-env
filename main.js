/**
 * Main Process - Electron Application Entry Point
 * This file contains only global variables, window creation, and app lifecycle.
 * All IPC handlers are organized in separate modules under ./src/backend/handlers/
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const DatabaseManager = require('./src/backend/database');

// Import handlers
const systemHandler = require('./src/backend/handlers/systemHandler');
const appsHandler = require('./src/backend/handlers/appsHandler');
const configHandler = require('./src/backend/handlers/configHandler');
const serviceHandler = require('./src/backend/handlers/serviceHandler');
const filesystemHandler = require('./src/backend/handlers/filesystemHandler');
const terminalHandler = require('./src/backend/handlers/terminalHandler');
const logsHandler = require('./src/backend/handlers/logsHandler');
const hostsHandler = require('./src/backend/handlers/hostsHandler');
const sitesHandler = require('./src/backend/handlers/sitesHandler');

// Global variables
let dbManager = null;

// Enable hot reload in development
try {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    ignored: /apps|logs|[\/\\]\./
  });
} catch (_) { }

/**
 * Create the main application window
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Dev vs Prod Loading
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    win.loadFile('dist/index.html');
  }
}

/**
 * Create shared context for handlers
 * @returns {Object} Context object with shared dependencies
 */
function createHandlerContext() {
  return {
    app,
    shell,
    appDir: __dirname,
    userDataPath: app.getPath('userData'),
    getDbManager: () => dbManager,
    logApp: appsHandler.logApp
  };
}

/**
 * Register all IPC handlers
 */
function registerAllHandlers() {
  const context = createHandlerContext();

  // Register each handler module
  systemHandler.register(ipcMain, context);
  appsHandler.register(ipcMain, context);
  configHandler.register(ipcMain, context);
  serviceHandler.register(ipcMain, context);
  filesystemHandler.register(ipcMain, context);
  terminalHandler.register(ipcMain, context);
  logsHandler.register(ipcMain, context);
  hostsHandler.register(ipcMain, context);
  sitesHandler.register(ipcMain, context);
}

// Register handlers immediately (before app.whenReady)
registerAllHandlers();

// Application ready
app.whenReady().then(async () => {
  // Initialize database
  dbManager = new DatabaseManager(app.getPath('userData'));

  // Log startup info with system details
  await logStartupInfo();

  // Create main window
  createWindow();

  // Auto-start apps that were running before
  if (dbManager) {
    try {
      const autoStartApps = dbManager.query('SELECT * FROM installed_apps WHERE auto_start = 1');
      if (Array.isArray(autoStartApps) && autoStartApps.length > 0) {
        console.log(`Found ${autoStartApps.length} apps to auto-start`);
        // Use a small delay to ensure everything is initialized
        setTimeout(async () => {
          for (const appInfo of autoStartApps) {
            if (appInfo.exec_path) {
              console.log(`Auto-starting: ${appInfo.app_id}`);
              const result = await serviceHandler.startAppService(appInfo.app_id, appInfo.exec_path, appInfo.custom_args);
              if (result.error) {
                console.error(`Failed to auto-start ${appInfo.app_id}: ${result.error}`);
              }
            }
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Auto-start error:', e);
    }
  }

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Log startup info with system details
 */
async function logStartupInfo() {
  const os = require('os');
  const si = require('systeminformation');
  const logApp = appsHandler.logApp;

  try {
    // Get system info
    const [cpu, mem, osInfo, graphics, network] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.graphics(),
      si.networkInterfaces()
    ]);

    const separator = '='.repeat(60);

    logApp(separator, 'STARTUP');
    logApp(`Dev-Env Application Started`, 'STARTUP');
    logApp(separator, 'STARTUP');

    // OS Info
    logApp(`OS: ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`, 'SYSTEM');
    logApp(`Hostname: ${os.hostname()}`, 'SYSTEM');
    logApp(`Platform: ${osInfo.platform}`, 'SYSTEM');

    // CPU Info
    logApp(`CPU: ${cpu.manufacturer} ${cpu.brand}`, 'SYSTEM');
    logApp(`CPU Cores: ${cpu.physicalCores} physical, ${cpu.cores} logical`, 'SYSTEM');
    logApp(`CPU Speed: ${cpu.speed} GHz`, 'SYSTEM');

    // Memory Info
    const totalGB = (mem.total / (1024 ** 3)).toFixed(2);
    const usedGB = (mem.used / (1024 ** 3)).toFixed(2);
    const freeGB = (mem.free / (1024 ** 3)).toFixed(2);
    logApp(`Memory: ${usedGB} GB used / ${totalGB} GB total (${freeGB} GB free)`, 'SYSTEM');

    // Graphics Info
    if (graphics.controllers && graphics.controllers.length > 0) {
      const gpu = graphics.controllers[0];
      logApp(`GPU: ${gpu.vendor} ${gpu.model}`, 'SYSTEM');
      if (gpu.vram) {
        logApp(`GPU VRAM: ${gpu.vram} MB`, 'SYSTEM');
      }
    }

    // Network Info
    const mainNetwork = network.find(n => !n.internal && n.ip4);
    if (mainNetwork) {
      logApp(`Network: ${mainNetwork.iface} - ${mainNetwork.ip4}`, 'SYSTEM');
    }

    // App Info
    logApp(`App Version: ${app.getVersion()}`, 'APP');
    logApp(`Electron: ${process.versions.electron}`, 'APP');
    logApp(`Node.js: ${process.versions.node}`, 'APP');
    logApp(`Chrome: ${process.versions.chrome}`, 'APP');
    logApp(`App Path: ${__dirname}`, 'APP');
    logApp(`User Data: ${app.getPath('userData')}`, 'APP');

    logApp(separator, 'STARTUP');
    logApp(`Ready to serve!`, 'STARTUP');
    logApp(separator, 'STARTUP');

  } catch (error) {
    console.error('Failed to log startup info:', error);
    logApp(`Startup logging failed: ${error.message}`, 'ERROR');
  }
}

// Cleanup before quit
app.on('before-quit', () => {
  const runningProcesses = serviceHandler.runningProcesses;

  if (runningProcesses.size > 0) {
    console.log(`Cleaning up ${runningProcesses.size} running processes before exit`);

    for (const [appId, proc] of runningProcesses) {
      try {
        console.log(`Terminating service tree: ${appId} (PID: ${proc.pid})`);
        // Use taskkill /T (tree) /F (force) to kill process and all children
        if (process.platform === 'win32') {
          try {
            execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
          } catch (e) {
            proc.kill();
          }
        } else {
          proc.kill();
        }
      } catch (err) {
        console.error(`Failed to terminate ${appId}: ${err.message}`);
      }
    }
    runningProcesses.clear();
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
