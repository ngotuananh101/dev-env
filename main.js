/**
 * Main Process - Electron Application Entry Point
 * This file contains only global variables, window creation, and app lifecycle.
 * All IPC handlers are organized in separate modules under ./src/backend/handlers/
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const DatabaseManager = require('./src/backend/database');

// Global variables for tray
let tray = null;
let mainWindow = null;
let isQuitting = false;

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
const sslHandler = require('./src/backend/handlers/sslHandler');
const databaseHandler = require('./src/backend/handlers/databaseHandler');

// Global variables
let dbManager = null;

/**
 * Create the main application window
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    title: `${app.getName()} v${app.getVersion()}`,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Prevent page from overriding the window title
  win.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  // Handle minimize button - minimize to tray by default
  win.on('minimize', (event) => {
    event.preventDefault();
    win.hide();
  });

  // Handle close button based on user setting
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      // Check user setting for close behavior
      const closeToTray = getCloseToTraySetting();
      if (closeToTray) {
        win.hide();
      } else {
        isQuitting = true;
        app.quit();
      }
    }
  });

  // Dev vs Prod Loading
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    win.removeMenu();
    win.loadFile('dist/index.html');
  }

  // Set mainWindow for service log streaming
  serviceHandler.setMainWindow(win);

  return win;
}

/**
 * Get close to tray setting from database
 * @returns {boolean} Whether to close to tray (default: true)
 */
function getCloseToTraySetting() {
  if (!dbManager) return true;
  try {
    const result = dbManager.queryOne('SELECT value FROM settings WHERE key = ?', ['close_to_tray']);
    if (result && result.value !== undefined) {
      return result.value === 'true' || result.value === true;
    }
  } catch (e) {
    console.error('Error getting close_to_tray setting:', e);
  }
  return true; // Default to minimize to tray
}

/**
 * Create system tray icon and menu
 */
function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip(`${app.getName()} v${app.getVersion()}`);
  tray.setContextMenu(contextMenu);

  // Double-click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * Create shared context for handlers
 * @returns {Object} Context object with shared dependencies
 */
function createHandlerContext() {
  const isDev = !app.isPackaged;

  // In production, resources are in extraResources (outside asar)
  // In dev mode, resources are in the project directory
  const resourcePath = isDev ? __dirname : process.resourcesPath;

  return {
    app,
    shell,
    appDir: resourcePath,
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
  sslHandler.register(ipcMain, context);
  databaseHandler.register(ipcMain, context);
}

// Register handlers immediately (before app.whenReady)
registerAllHandlers();

// Application ready
app.whenReady().then(async () => {
  // Initialize database
  dbManager = new DatabaseManager(app.getPath('userData'));

  // Initialize SSL (create CA if needed)
  try {
    const sslResult = await sslHandler.initializeSSL(app.getPath('userData'));
    if (sslResult.success) {
      if (sslResult.isNew) {
        console.log('[STARTUP] New SSL CA created');
      } else {
        console.log('[STARTUP] SSL CA loaded');
      }
    } else {
      console.error('[STARTUP] SSL initialization failed:', sslResult.error);
    }
  } catch (err) {
    console.error('[STARTUP] SSL initialization error:', err);
  }

  // Create main window
  mainWindow = createWindow();

  // Create system tray
  createTray();

  // Auto-start apps that were running before
  if (dbManager) {
    try {
      const autoStartApps = dbManager.query('SELECT * FROM installed_apps WHERE auto_start = 1');
      if (Array.isArray(autoStartApps) && autoStartApps.length > 0) {
        console.log(`Found ${autoStartApps.length} apps to auto-start`);
        // Use a small delay to ensure everything is initialized
        // Wait for window to be ready before starting services
        // Use a single-fire listener for when the page finishes loading
        mainWindow.webContents.once('did-finish-load', async () => {
          console.log('[AUTO-START] Window loaded, starting apps...');
          for (const appInfo of autoStartApps) {
            if (appInfo.exec_path) {
              console.log(`Auto-starting: ${appInfo.app_id}`);
              const result = await serviceHandler.startAppService(appInfo.app_id, appInfo.exec_path, appInfo.custom_args);
              if (result.error) {
                console.error(`Failed to auto-start ${appInfo.app_id}: ${result.error}`);
              }
            }
          }
        });
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

// Cleanup before quit
app.on('before-quit', () => {
  isQuitting = true;
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
