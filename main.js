const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs');
const fsPromises = require('fs').promises;
const si = require('systeminformation');
const os = require('os');
const DatabaseManager = require('./src/backend/database'); // Import DB Manager

let ptyProcess = null;
let ptyModule = null;
let dbManager = null; // DB Instance

try {
  ptyModule = require('node-pty');
  console.log("SUCCESS: node-pty loaded successfully.");
} catch (e) {
  console.error("FAILURE: node-pty failed to load.", e);
}

try {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    ignored: /apps|logs|[\/\\]\./
  });
} catch (_) { }


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Dev vs Prod Loading
  const isDev = !app.isPackaged; // Simple check or use process.env.NODE_ENV
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile('dist/index.html');
  }
}

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

ipcMain.handle('get-ip-address', async () => {
  try {
    const interfaces = await si.networkInterfaces();
    // si.networkInterfaces() returns array of objects.
    // We want the first non-internal, IPv4
    const mainInterface = interfaces.find(iface => !iface.internal && iface.ip4 && iface.ip4 !== '127.0.0.1');
    return mainInterface ? mainInterface.ip4 : '127.0.0.1';
  } catch (error) {
    console.error('IP Error:', error);
    return '127.0.0.1';
  }
});

ipcMain.on('app-quit', () => {
  app.quit();
});

ipcMain.handle('db-query', (event, sql, params) => {
  if (dbManager) {
    return dbManager.query(sql, params);
  }
  return { error: 'Database not initialized' };
});

// App Store - Get apps list from JSON file
const appsJsonPath = path.join(__dirname, 'data', 'apps.json');
const logsDir = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function logApp(message, type = 'INFO') {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logsDir, `${dateStr}.log`);
  const timeStr = now.toLocaleTimeString();
  const logLine = `[${timeStr}] [${type}] ${message}\n`;

  console.log(`${type}: ${message}`); // Keep console log for dev

  try {
    fs.appendFileSync(logFile, logLine);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

ipcMain.handle('apps-get-list', async () => {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(appsJsonPath);
    if (!fs.existsSync(dataDir)) {
      await fsPromises.mkdir(dataDir, { recursive: true });
    }

    // Check if file exists
    if (!fs.existsSync(appsJsonPath)) {
      return { apps: [], version: '0.0.0', lastUpdated: null };
    }

    const data = await fsPromises.readFile(appsJsonPath, 'utf-8');
    const jsonData = JSON.parse(data);

    // Get installed apps from database
    let installedApps = [];
    if (dbManager) {
      const result = dbManager.query('SELECT * FROM installed_apps');
      if (!result.error) {
        installedApps = result;
      }
    }

    // Create a map for quick lookup
    const installedMap = new Map();
    for (const app of installedApps) {
      installedMap.set(app.app_id, app);
    }

    // Merge with JSON data
    for (const app of jsonData.apps) {
      const installed = installedMap.get(app.id);
      if (installed) {
        app.status = 'installed';
        app.installedVersion = installed.installed_version;
        app.installPath = installed.install_path;
        app.showOnDashboard = installed.show_on_dashboard === 1;
        app.installedAt = installed.installed_at;
        app.execPath = installed.exec_path;
        app.customArgs = installed.custom_args;
      } else {
        app.status = 'not_installed';
        app.showOnDashboard = false;
      }
    }

    return jsonData;
  } catch (error) {
    console.error('Failed to read apps.json:', error);
    return { error: error.message };
  }
});

// Track active installations for cancel functionality
const activeInstalls = new Map();

// App Store - Install an app (download, extract, save to DB)
ipcMain.handle('apps-install', async (event, appId, version, downloadUrl, filename, execFile, group) => {
  if (!dbManager) {
    return { error: 'Database not initialized' };
  }

  // Check if already installing
  if (activeInstalls.has(appId)) {
    return { error: 'Installation already in progress' };
  }

  // Check exclusive group restriction (e.g., only one webserver allowed)
  if (group) {
    try {
      const appsJsonPath = path.join(__dirname, 'data', 'apps.json');
      const appsData = JSON.parse(fs.readFileSync(appsJsonPath, 'utf-8'));
      const sameGroupApps = appsData.apps.filter(a => a.group === group && a.id !== appId);

      if (sameGroupApps.length > 0) {
        const installedApps = dbManager.query('SELECT app_id FROM installed_apps');
        const installedIds = installedApps.map(a => a.app_id);

        const conflictApp = sameGroupApps.find(a => installedIds.includes(a.id));
        if (conflictApp) {
          return { error: `Cannot install: ${conflictApp.name} is already installed. Only one ${group} can be installed at a time.` };
        }
      }
    } catch (err) {
      logApp(`Failed to check group restriction: ${err.message}`, 'WARNING');
    }
  }

  // Create install context for tracking
  const installContext = {
    appId,
    cancelled: false,
    request: null,
    zipPath: null,
    appDir: null
  };
  activeInstalls.set(appId, installContext);

  try {
    const https = require('https');
    const http = require('http');
    const AdmZip = require('adm-zip');

    logApp(`Starting installation for ${appId} version ${version}`, 'INSTALL');

    // Create apps directory in current working directory
    const appsDir = path.join(__dirname, 'apps');
    if (!fs.existsSync(appsDir)) {
      await fsPromises.mkdir(appsDir, { recursive: true });
    }

    // Create app-specific directory
    const appDir = path.join(appsDir, appId);
    installContext.appDir = appDir;
    if (!fs.existsSync(appDir)) {
      await fsPromises.mkdir(appDir, { recursive: true });
    }

    // Download file
    const zipPath = path.join(appDir, filename);
    installContext.zipPath = zipPath;

    // Send progress to renderer (throttled to 1 update per second)
    let lastProgressTime = 0;
    let lastStatus = '';
    const sendProgress = (progress, status, logDetail = null) => {
      if (!installContext.cancelled) {
        const now = Date.now();
        // Always send if: new status phase, 100% complete, or 1 second has passed
        if (status !== lastStatus || progress === 100 || now - lastProgressTime >= 1000) {
          event.sender.send('app-install-progress', { appId, progress, status, logDetail });
          lastProgressTime = now;
          lastStatus = status;
        }
      }
    };

    sendProgress(0, 'Downloading...');

    // Download file with progress
    await new Promise((resolve, reject) => {
      const protocol = downloadUrl.startsWith('https') ? https : http;

      const request = protocol.get(downloadUrl, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
          const redirectRequest = redirectProtocol.get(redirectUrl, handleResponse);
          redirectRequest.on('error', reject);
          installContext.request = redirectRequest;
          return;
        }
        handleResponse(response);

        function handleResponse(res) {
          if (installContext.cancelled) {
            res.destroy();
            reject(new Error('Installation cancelled'));
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP Error: ${res.statusCode}`));
            return;
          }

          const totalSize = parseInt(res.headers['content-length'], 10) || 0;
          let downloadedSize = 0;

          const fileStream = fs.createWriteStream(zipPath);

          res.on('data', (chunk) => {
            if (installContext.cancelled) {
              res.destroy();
              fileStream.close();
              return;
            }
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const percent = Math.round((downloadedSize / totalSize) * 50); // 0-50% for download
              const downloadedMB = (downloadedSize / (1024 * 1024)).toFixed(2);
              const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
              sendProgress(percent, 'Downloading...', `Downloaded ${downloadedMB} MB / ${totalMB} MB`);
            } else {
              const downloadedMB = (downloadedSize / (1024 * 1024)).toFixed(2);
              sendProgress(25, 'Downloading...', `Downloaded ${downloadedMB} MB`);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            if (installContext.cancelled) {
              reject(new Error('Installation cancelled'));
            } else {
              resolve();
            }
          });

          fileStream.on('error', (err) => {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            reject(err);
          });
        }
      });

      installContext.request = request;
      request.on('error', reject);
      request.setTimeout(1800000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });

    // Check if cancelled before extraction
    if (installContext.cancelled) {
      throw new Error('Installation cancelled');
    }

    sendProgress(50, 'Extracting...');

    // Extract ZIP file
    try {
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      const totalEntries = zipEntries.length;
      let extractedCount = 0;

      sendProgress(50, 'Extracting...', `Starting extraction of ${totalEntries} files`);

      for (const entry of zipEntries) {
        if (installContext.cancelled) {
          throw new Error('Installation cancelled');
        }

        try {
          // Extract each entry
          zip.extractEntryTo(entry, appDir, true, true);
        } catch (err) {
          logApp(`Failed to extract ${entry.entryName}: ${err.message}`, 'WARNING');
        }

        extractedCount++;
        // Report progress every 5%
        if (extractedCount % Math.ceil(totalEntries / 20) === 0 || extractedCount === totalEntries) {
          const extractPercent = 50 + Math.round((extractedCount / totalEntries) * 40); // 50-90%
          sendProgress(extractPercent, 'Extracting...', `Extracted ${extractedCount} / ${totalEntries} files`);
        }
      }

      sendProgress(90, 'Finishing...');
    } catch (extractError) {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      throw new Error(`Failed to extract: ${extractError.message}`);
    }

    // Delete ZIP file after extraction
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Find executable path
    let execPath = '';
    if (execFile) {
      sendProgress(95, `Locating ${execFile}...`);

      const findFile = async (dir, target) => {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = await findFile(fullPath, target);
            if (found) return found;
          } else if (fullPath.endsWith(target.replace('/', '\\')) || fullPath.endsWith(target.replace('\\', '/'))) {
            // Handle both slash types and check if path ends with target (e.g. bin/mysqld.exe)
            return fullPath;
          }
        }
        return null;
      };

      const foundPath = await findFile(appDir, execFile);
      if (foundPath) {
        execPath = foundPath;
      }
    }

    // Save to database
    const now = new Date().toISOString();
    const result = dbManager.query(
      `INSERT OR REPLACE INTO installed_apps (app_id, installed_version, install_path, exec_path, custom_args, show_on_dashboard, installed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [appId, version, appDir, execPath, '', now, now]
    );

    if (result.error) {
      return { error: result.error };
    }

    sendProgress(100, 'Installed!');
    logApp(`Successfully installed ${appId}`, 'INSTALL');

    return { success: true, installPath: appDir, execPath };
  } catch (error) {
    console.error('Failed to install app:', error);
    logApp(`Installation failed for ${appId}: ${error.message}`, 'ERROR');

    // Clean up partial files on error
    const ctx = activeInstalls.get(appId);
    if (ctx && ctx.zipPath && fs.existsSync(ctx.zipPath)) {
      fs.unlinkSync(ctx.zipPath);
    }
    if (ctx && ctx.appDir && ctx.cancelled && fs.existsSync(ctx.appDir)) {
      try {
        await fsPromises.rm(ctx.appDir, { recursive: true, force: true });
      } catch (e) { /* ignore */ }
    }

    return { error: error.message, cancelled: ctx?.cancelled };
  } finally {
    activeInstalls.delete(appId);
  }
});

// App Store - Cancel an ongoing installation
ipcMain.handle('apps-cancel-install', async (event, appId) => {
  const ctx = activeInstalls.get(appId);
  if (!ctx) {
    return { error: 'No active installation found' };
  }

  ctx.cancelled = true;
  logApp(`Cancelling installation for ${appId}`, 'INSTALL');

  // Abort the request if it's active
  if (ctx.request) {
    ctx.request.destroy();
  }

  return { success: true };
});

// App Store - Uninstall an app
ipcMain.handle('apps-uninstall', async (event, appId) => {
  if (!dbManager) {
    return { error: 'Database not initialized' };
  }

  // Get app info first to find path
  const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
  if (!apps || apps.length === 0) {
    return { error: 'App not found' };
  }

  const app = apps[0];
  const appPath = app.install_path;
  logApp(`Uninstalling ${appId} from ${appPath}`, 'UNINSTALL');

  // Remove from DB
  const result = dbManager.query('DELETE FROM installed_apps WHERE app_id = ?', [appId]);

  if (result.error) {
    return { error: result.error };
  }

  // Try to remove files
  try {
    if (appPath && fs.existsSync(appPath)) {
      await fsPromises.rm(appPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to remove app files for ${appId}:`, err);
    // Don't fail the operation if just file removal fails (DB is already updated)
  }

  return { success: true };
});

// App Store - Set custom args
ipcMain.handle('apps-set-args', async (event, appId, args) => {
  if (!dbManager) {
    return { error: 'Database not initialized' };
  }

  const now = new Date().toISOString();
  const result = dbManager.query(
    'UPDATE installed_apps SET custom_args = ?, updated_at = ? WHERE app_id = ?',
    [args, now, appId]
  );

  if (result.error) {
    return { error: result.error };
  }

  return { success: true };
});

// App Store - Update show on dashboard setting
ipcMain.handle('apps-set-dashboard', async (event, appId, showOnDashboard) => {
  if (!dbManager) {
    return { error: 'Database not initialized' };
  }

  try {
    const result = dbManager.query(
      'UPDATE installed_apps SET show_on_dashboard = ?, updated_at = ? WHERE app_id = ?',
      [showOnDashboard ? 1 : 0, new Date().toISOString(), appId]
    );

    if (result.error) {
      return { error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to update dashboard setting:', error);
    return { error: error.message };
  }
});

// App Store - Download XML and update app versions
const APP_FILES_XML_URL = 'https://archive.org/download/dev-env/dev-env_files.xml';
const ARCHIVE_BASE_URL = 'https://archive.org/download/dev-env/';

// ========== Config File Management ==========

// Read config file
ipcMain.handle('app-read-config', async (event, installPath, configPath) => {
  try {
    const configFullPath = path.join(installPath, configPath);
    const backupPath = configFullPath + '.bak';

    logApp(`Reading config: ${configFullPath}`, 'CONFIG');

    if (!fs.existsSync(configFullPath)) {
      return { error: `Config file not found: ${configFullPath}` };
    }

    const content = fs.readFileSync(configFullPath, 'utf-8');
    const hasBackup = fs.existsSync(backupPath);

    return { content, hasBackup };
  } catch (err) {
    logApp(`Failed to read config: ${err.message}`, 'ERROR');
    return { error: err.message };
  }
});

// Save config file (backup if needed)
ipcMain.handle('app-save-config', async (event, installPath, configPath, content) => {
  try {
    const configFullPath = path.join(installPath, configPath);
    const backupPath = configFullPath + '.bak';

    if (!fs.existsSync(configFullPath)) {
      return { error: `Config file not found: ${configFullPath}` };
    }

    // Backup if not exists
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(configFullPath, backupPath);
      logApp(`Created backup: ${backupPath}`, 'CONFIG');
    }

    // Save new content
    fs.writeFileSync(configFullPath, content, 'utf-8');
    logApp(`Saved config: ${configFullPath}`, 'CONFIG');

    return { success: true, hasBackup: true };
  } catch (err) {
    logApp(`Failed to save config: ${err.message}`, 'ERROR');
    return { error: err.message };
  }
});

// Restore config from backup
ipcMain.handle('app-restore-config', async (event, installPath, configPath) => {
  try {
    const configFullPath = path.join(installPath, configPath);
    const backupPath = configFullPath + '.bak';

    if (!fs.existsSync(backupPath)) {
      return { error: 'No backup file found' };
    }

    // Restore from backup
    fs.copyFileSync(backupPath, configFullPath);
    const content = fs.readFileSync(configFullPath, 'utf-8');
    logApp(`Restored config from backup: ${configFullPath}`, 'CONFIG');

    return { success: true, content };
  } catch (err) {
    logApp(`Failed to restore config: ${err.message}`, 'ERROR');
    return { error: err.message };
  }
});

// ========== Service Management ==========
const runningProcesses = new Map();

// Start service
// Helper to start service (used by IPC and auto-start)
const startAppService = async (appId, execPath, args) => {
  try {
    if (runningProcesses.has(appId)) {
      return { error: 'Service already running' };
    }

    const { spawn } = require('child_process');
    const execDir = path.dirname(execPath);

    // Create logs folder if needed (nginx requires this)
    const logsDir = path.join(execDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logApp(`Created logs folder: ${logsDir}`, 'SERVICE');
    }

    // Create temp folders if needed (nginx requires these)
    const tempFolders = ['temp/client_body_temp', 'temp/proxy_temp', 'temp/fastcgi_temp', 'temp/uwsgi_temp', 'temp/scgi_temp'];
    for (const folder of tempFolders) {
      const folderPath = path.join(execDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    }
    logApp(`Ensured temp folders exist in ${execDir}`, 'SERVICE');

    const cmdArgs = args ? args.split(' ').filter(a => a) : [];
    logApp(`Starting: ${execPath} ${cmdArgs.join(' ')} in ${execDir}`, 'SERVICE');

    const proc = spawn(execPath, cmdArgs, {
      cwd: execDir,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Capture stderr for debugging
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

    return { success: true, pid: proc.pid };
  } catch (err) {
    logApp(`Failed to start service: ${err.message}`, 'ERROR');
    return { error: err.message };
  }
};

// Start service
ipcMain.handle('app-service-start', async (event, appId, execPath, args) => {
  const result = await startAppService(appId, execPath, args);

  if (result.success) {
    // Save auto-start state
    dbManager.query('UPDATE installed_apps SET auto_start = 1 WHERE app_id = ?', [appId]);
  }

  return result;
});

// Stop service
ipcMain.handle('app-service-stop', async (event, appId, execPath, stopArgs) => {
  try {
    const { spawn, execSync } = require('child_process');

    // Update auto-start state to 0 (user intentionally stopped)
    dbManager.query('UPDATE installed_apps SET auto_start = 0 WHERE app_id = ?', [appId]);

    // If we have stop args, use them (e.g., nginx -s stop)
    if (stopArgs) {
      const execDir = path.dirname(execPath);
      const cmdArgs = stopArgs.split(' ').filter(a => a);

      return new Promise((resolve) => {
        const proc = spawn(execPath, cmdArgs, {
          cwd: execDir,
          stdio: 'ignore'
        });

        proc.on('close', (code) => {
          runningProcesses.delete(appId);
          logApp(`Stopped service: ${appId}`, 'SERVICE');
          resolve({ success: true });
        });

        proc.on('error', (err) => {
          resolve({ error: err.message });
        });
      });
    }

    // Otherwise try to kill the tracked process
    const proc = runningProcesses.get(appId);
    if (proc) {
      proc.kill();
      runningProcesses.delete(appId);
      logApp(`Killed service: ${appId}`, 'SERVICE');
      return { success: true };
    }

    // Try to kill by process name
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
    const { execSync } = require('child_process');
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



ipcMain.handle('apps-update-list', async () => {
  try {
    const https = require('https');
    const http = require('http');

    // Download XML file
    const xmlData = await new Promise((resolve, reject) => {
      const protocol = APP_FILES_XML_URL.startsWith('https') ? https : http;

      const request = protocol.get(APP_FILES_XML_URL, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
          return redirectProtocol.get(redirectUrl, handleResponse).on('error', reject);
        }
        handleResponse(response);

        function handleResponse(res) {
          if (res.statusCode !== 200) {
            resolve({ error: `HTTP Error: ${res.statusCode}` });
            return;
          }

          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ success: true, data }));
        }
      });

      request.on('error', (err) => resolve({ error: err.message }));
      request.setTimeout(15000, () => {
        request.destroy();
        resolve({ error: 'Request timeout' });
      });
    });

    if (xmlData.error) {
      return xmlData;
    }

    // Parse XML to extract file info
    const fileVersions = parseXmlFileVersions(xmlData.data);

    // Read current apps.json
    let appsData;
    try {
      const data = await fsPromises.readFile(appsJsonPath, 'utf-8');
      appsData = JSON.parse(data);
    } catch (e) {
      return { error: 'Failed to read apps.json' };
    }

    // Update versions in apps
    let updatedCount = 0;
    for (const app of appsData.apps) {
      const versions = fileVersions[app.id];
      if (versions && versions.length > 0) {
        app.versions = versions;
        updatedCount++;
      }
    }

    // Update lastUpdated timestamp
    appsData.lastUpdated = new Date().toISOString();

    // Save updated apps.json
    await fsPromises.writeFile(appsJsonPath, JSON.stringify(appsData, null, 2), 'utf-8');

    return { success: true, updatedCount, data: appsData };
  } catch (error) {
    console.error('Failed to update apps list:', error);
    return { error: error.message };
  }
});

// Parse XML and extract versions for each app
function parseXmlFileVersions(xmlString) {
  const versions = {};

  // Simple XML parsing using regex (no external dependency)
  const fileRegex = /<file\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g;
  let match;

  while ((match = fileRegex.exec(xmlString)) !== null) {
    const fileName = match[1];
    const fileContent = match[2];

    // Skip metadata files
    if (fileName.includes('_meta') || fileName.includes('.torrent') || fileName.endsWith('.xml')) {
      continue;
    }

    // Extract app id from folder name (e.g., "nginx/nginx-1.28.1.zip" -> "nginx")
    const pathParts = fileName.split('/');
    if (pathParts.length < 2) continue;

    const appId = pathParts[0].toLowerCase();
    const zipName = pathParts[1];

    // Extract version from filename
    const version = extractVersionFromFilename(zipName, appId);
    if (!version) continue;

    // Extract file metadata
    const size = extractXmlValue(fileContent, 'size');
    const md5 = extractXmlValue(fileContent, 'md5');
    const sha1 = extractXmlValue(fileContent, 'sha1');

    // Initialize versions array for this app
    if (!versions[appId]) {
      versions[appId] = [];
    }

    // Add version entry
    versions[appId].push({
      version,
      filename: zipName,
      download_url: ARCHIVE_BASE_URL + fileName,
      size: size ? parseInt(size) : 0,
      md5: md5 || '',
      sha1: sha1 || ''
    });
  }

  // Sort versions descending (newest first)
  for (const appId in versions) {
    versions[appId].sort((a, b) => compareVersions(b.version, a.version));
  }

  return versions;
}

// Extract version number from filename
function extractVersionFromFilename(filename, appId) {
  // Different patterns for different apps
  let versionMatch;

  if (appId === 'nginx') {
    // nginx-1.28.1.zip -> 1.28.1
    versionMatch = filename.match(/nginx-(\d+\.\d+\.\d+)/i);
  } else if (appId === 'apache') {
    // httpd-2.4.66-260107-Win64-VS18.zip -> 2.4.66
    versionMatch = filename.match(/httpd-(\d+\.\d+\.\d+)/i);
  } else if (appId.startsWith('php')) {
    // php-8.2.30-nts-Win32-vs16-x64.zip -> 8.2.30
    versionMatch = filename.match(/php-(\d+\.\d+\.\d+)/i);
  } else if (appId === 'redis') {
    // redis-windows-8.4.0.zip -> 8.4.0
    versionMatch = filename.match(/redis-windows-(\d+\.\d+\.\d+)/i);
  } else if (appId === 'mysql') {
    // mysql-8.0.30-winx64.zip -> 8.0.30
    versionMatch = filename.match(/mysql-(\d+\.\d+\.\d+)/i);
  } else if (appId === 'mariadb') {
    // mariadb-10.11.4-winx64.zip -> 10.11.4
    versionMatch = filename.match(/mariadb-(\d+\.\d+\.\d+)/i);
  } else if (appId === 'postgresql') {
    // postgresql-15.3-2-windows-x64.zip -> 15.3
    versionMatch = filename.match(/postgresql-(\d+\.\d+(?:\.\d+)?)/i);
  } else {
    // Generic pattern: try to find version-like string
    versionMatch = filename.match(/(\d+\.\d+\.\d+)/);
  }

  return versionMatch ? versionMatch[1] : null;
}

// Extract value from XML content
function extractXmlValue(content, tag) {
  const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

// Compare two version strings
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

// Get available drives (Windows)
ipcMain.handle('fs-get-drives', async () => {
  try {
    const fsSize = await si.fsSize();
    // Extract unique drive letters from mount points
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

// File System IPC
ipcMain.handle('fs-list-dir', async (event, dirPath) => {
  try {
    // Default to Home Directory if no path provided
    const targetPath = dirPath ? path.resolve(dirPath) : os.homedir();

    // Read directory
    const entries = await fsPromises.readdir(targetPath, { withFileTypes: true });

    // Get stats for each file (size, time, etc.)
    const filePromises = entries.map(async (entry) => {
      const fullPath = path.join(targetPath, entry.name);
      try {
        const stats = await fsPromises.stat(fullPath);
        return {
          name: entry.name,
          path: fullPath,
          isDir: entry.isDirectory(),
          size: stats.size,
          mtime: stats.mtime, // Date object
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

    // Sort: Folders first, then case-insensitive name
    files.sort((a, b) => {
      if (a.isDir === b.isDir) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return a.isDir ? -1 : 1;
    });

    return {
      path: targetPath,
      files
    };

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
      return { error: result }; // shell.openPath returns error string if failed
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// Download IPC
// Download IPC
const https = require('https');
const http = require('http');
let currentDownloadRequest = null;
let currentDownloadPath = null;

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

ipcMain.handle('fs-create-dir', async (event, { targetPath, name }) => {
  try {
    const fullPath = path.join(targetPath, name);
    await fsPromises.mkdir(fullPath);
    return { success: true, path: fullPath };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('fs-delete-path', async (event, targetPath) => {
  try {
    await fsPromises.rm(targetPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

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

// Terminal IPC
ipcMain.on('terminal-init', (event, options = {}) => {
  if (!ptyModule) {
    event.sender.send('terminal-data', 'Error: node-pty module could not be loaded. Terminal unavailable.\r\n');
    return;
  }

  const requestedCwd = options.cwd || os.homedir();

  if (ptyProcess) {
    if (options.cwd) {
      console.log("Changing dir to:", requestedCwd);
      // Change dir to requested cwd and clear screen (PowerShell)
      ptyProcess.resize(80, 30);
      ptyProcess.write(`Set-Location -Path "${requestedCwd}"; Clear-Host\r\n`);
    }
    // Reuse existing PTY process
    return;
  }

  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

  try {
    ptyProcess = ptyModule.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: requestedCwd,
      env: process.env
    });

    ptyProcess.onData((data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal-data', data);
      }
    });

    console.log("PTY spawned PID:", ptyProcess.pid, "CWD:", requestedCwd);
  } catch (err) {
    console.error("PTY Spawn error:", err);
    event.sender.send('terminal-data', `Error spawning shell: ${err.message}\r\n`);
  }
});

ipcMain.on('terminal-input', (event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows);
    } catch (e) { }
  }
});

app.whenReady().then(() => {
  dbManager = new DatabaseManager(app.getPath('userData'));
  createWindow()

  // Auto-start apps that were running
  if (dbManager) {
    try {
      const autoStartApps = dbManager.query('SELECT * FROM installed_apps WHERE auto_start = 1');
      if (Array.isArray(autoStartApps) && autoStartApps.length > 0) {
        console.log(`Found ${autoStartApps.length} apps to auto-start`);
        // Use a small delay to ensure everything is initialized
        setTimeout(async () => {
          for (const app of autoStartApps) {
            if (app.exec_path) {
              console.log(`Auto-starting: ${app.app_id}`);
              const result = await startAppService(app.app_id, app.exec_path, app.custom_args);
              if (result.error) {
                console.error(`Failed to auto-start ${app.app_id}: ${result.error}`);
              }
            }
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Auto-start error:', e);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
