/**
 * Apps Handler - IPC handlers for App Store operations
 * Handles: Get list, install, uninstall, cancel, update, set args/dashboard
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const serviceHandler = require('./serviceHandler');

// Constants
const APP_FILES_XML_URL = 'https://archive.org/download/dev-env/dev-env_files.xml';
const ARCHIVE_BASE_URL = 'https://archive.org/download/dev-env/';

// Shared state
const activeInstalls = new Map();
let logsDir = null;
let appsJsonPath = null;

/**
 * Log application message
 * @param {string} message - Message to log
 * @param {string} type - Log type (INFO, ERROR, WARNING, etc.)
 */
function logApp(message, type = 'INFO') {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const logFile = path.join(logsDir, `${dateStr}.log`);
    const timeStr = now.toLocaleTimeString();
    const logLine = `[${timeStr}] [${type}] ${message}\n`;

    console.log(`${type}: ${message}`);

    try {
        fs.appendFileSync(logFile, logLine);
    } catch (err) {
        console.error('Failed to write log:', err);
    }
}

/**
 * Parse XML and extract versions for each app
 * @param {string} xmlString - XML content
 * @returns {Object} Versions object
 */
function parseXmlFileVersions(xmlString) {
    const versions = {};

    const fileRegex = /<file\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g;
    let match;

    while ((match = fileRegex.exec(xmlString)) !== null) {
        const fileName = match[1];
        const fileContent = match[2];

        if (fileName.includes('_meta') || fileName.includes('.torrent') || fileName.endsWith('.xml')) {
            continue;
        }

        const pathParts = fileName.split('/');
        if (pathParts.length < 2) continue;

        const appId = pathParts[0].toLowerCase();
        const zipName = pathParts[1];

        const version = extractVersionFromFilename(zipName, appId);
        if (!version) continue;

        const size = extractXmlValue(fileContent, 'size');
        const md5 = extractXmlValue(fileContent, 'md5');
        const sha1 = extractXmlValue(fileContent, 'sha1');

        if (!versions[appId]) {
            versions[appId] = [];
        }

        versions[appId].push({
            version,
            filename: zipName,
            download_url: ARCHIVE_BASE_URL + fileName,
            size: size ? parseInt(size) : 0,
            md5: md5 || '',
            sha1: sha1 || ''
        });
    }

    for (const appId in versions) {
        versions[appId].sort((a, b) => compareVersions(b.version, a.version));
    }

    return versions;
}

/**
 * Extract version number from filename
 * @param {string} filename - Filename to parse
 * @param {string} appId - App identifier
 * @returns {string|null} Version string or null
 */
function extractVersionFromFilename(filename, appId) {
    let versionMatch;

    if (appId === 'nginx') {
        versionMatch = filename.match(/nginx-(\d+\.\d+\.\d+)/i);
    } else if (appId === 'apache') {
        versionMatch = filename.match(/httpd-(\d+\.\d+\.\d+)/i);
    } else if (appId.startsWith('php')) {
        versionMatch = filename.match(/php-(\d+\.\d+\.\d+)/i);
    } else if (appId === 'redis') {
        versionMatch = filename.match(/redis-windows-(\d+\.\d+\.\d+)/i);
    } else if (appId === 'mysql') {
        versionMatch = filename.match(/mysql-(\d+\.\d+\.\d+)/i);
    } else if (appId === 'mariadb') {
        versionMatch = filename.match(/mariadb-(\d+\.\d+\.\d+)/i);
    } else if (appId === 'postgresql') {
        versionMatch = filename.match(/postgresql-(\d+\.\d+(?:\.\d+)?)/i);
    } else {
        versionMatch = filename.match(/(\d+\.\d+\.\d+)/);
    }

    return versionMatch ? versionMatch[1] : null;
}

/**
 * Extract value from XML content
 * @param {string} content - XML content
 * @param {string} tag - Tag name
 * @returns {string|null} Value or null
 */
function extractXmlValue(content, tag) {
    const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`);
    const match = content.match(regex);
    return match ? match[1] : null;
}

/**
 * Compare two version strings
 * @param {string} a - Version A
 * @param {string} b - Version B
 * @returns {number} Comparison result
 */
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

/**
 * Register apps-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    const { getDbManager, appDir } = context;

    // Initialize paths
    appsJsonPath = path.join(appDir, 'data', 'apps.json');
    logsDir = path.join(appDir, 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Get apps list
    ipcMain.handle('apps-get-list', async () => {
        try {
            const dataDir = path.dirname(appsJsonPath);
            if (!fs.existsSync(dataDir)) {
                await fsPromises.mkdir(dataDir, { recursive: true });
            }

            if (!fs.existsSync(appsJsonPath)) {
                return { apps: [], version: '0.0.0', lastUpdated: null };
            }

            const data = await fsPromises.readFile(appsJsonPath, 'utf-8');
            const jsonData = JSON.parse(data);

            let installedApps = [];
            const dbManager = getDbManager();
            if (dbManager) {
                const result = dbManager.query('SELECT * FROM installed_apps');
                if (!result.error) {
                    installedApps = result;
                }
            }

            const installedMap = new Map();
            for (const app of installedApps) {
                installedMap.set(app.app_id, app);
            }

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

    // Install app
    ipcMain.handle('apps-install', async (event, appId, version, downloadUrl, filename, execFile, group) => {
        const dbManager = getDbManager();
        if (!dbManager) {
            return { error: 'Database not initialized' };
        }

        if (activeInstalls.has(appId)) {
            return { error: 'Installation already in progress' };
        }

        // Check exclusive group restriction
        if (group) {
            try {
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

        const installContext = {
            appId,
            cancelled: false,
            request: null,
            zipPath: null,
            appDir: null
        };
        activeInstalls.set(appId, installContext);

        try {
            const AdmZip = require('adm-zip');

            logApp(`Starting installation for ${appId} version ${version}`, 'INSTALL');

            const appsDir = path.join(context.appDir, 'apps');
            if (!fs.existsSync(appsDir)) {
                await fsPromises.mkdir(appsDir, { recursive: true });
            }

            const appInstallDir = path.join(appsDir, appId);
            installContext.appDir = appInstallDir;
            if (!fs.existsSync(appInstallDir)) {
                await fsPromises.mkdir(appInstallDir, { recursive: true });
            }

            const zipPath = path.join(appInstallDir, filename);
            installContext.zipPath = zipPath;

            let lastProgressTime = 0;
            let lastStatus = '';
            const sendProgress = (progress, status, logDetail = null) => {
                if (!installContext.cancelled) {
                    const now = Date.now();
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
                                const percent = Math.round((downloadedSize / totalSize) * 50);
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
                        zip.extractEntryTo(entry, appInstallDir, true, true);
                    } catch (err) {
                        logApp(`Failed to extract ${entry.entryName}: ${err.message}`, 'WARNING');
                    }

                    extractedCount++;
                    if (extractedCount % Math.ceil(totalEntries / 20) === 0 || extractedCount === totalEntries) {
                        const extractPercent = 50 + Math.round((extractedCount / totalEntries) * 40);
                        sendProgress(extractPercent, 'Extracting...', `Extracted ${extractedCount} / ${totalEntries} files`);
                    }
                }

                sendProgress(90, 'Finishing...');
            } catch (extractError) {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                throw new Error(`Failed to extract: ${extractError.message}`);
            }

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
                            return fullPath;
                        }
                    }
                    return null;
                };

                const foundPath = await findFile(appInstallDir, execFile);
                if (foundPath) {
                    execPath = foundPath;

                    // Post-install configuration
                    if (appId.startsWith('php')) {
                        const configPath = path.join(appInstallDir, 'php.ini');
                        const devConfigPath = path.join(appInstallDir, 'php.ini-development');
                        if (fs.existsSync(devConfigPath)) {
                            fs.copyFileSync(devConfigPath, configPath);
                        }
                    } else if (appId === 'apache') {
                        logApp('Configuring Apache...', 'CONFIG');
                        try {
                            const serverRoot = path.dirname(path.dirname(execPath));
                            const templatePath = path.join(context.appDir, 'data', 'config', 'apache.conf');
                            const targetPath = path.join(serverRoot, 'conf', 'httpd.conf');

                            if (fs.existsSync(templatePath)) {
                                let configContent = await fsPromises.readFile(templatePath, 'utf-8');

                                // Prepare paths (convert to forward slashes for Apache config)
                                const serverRootSlash = serverRoot.replace(/\\/g, '/');
                                const htdocsPathSlash = path.join(context.appDir, 'htdocs').replace(/\\/g, '/');
                                const cgiBinPathSlash = path.join(serverRoot, 'cgi-bin').replace(/\\/g, '/');

                                // Ensure sites directory exists
                                const sitesDir = path.join(context.appDir, 'sites');
                                if (!fs.existsSync(sitesDir)) {
                                    await fsPromises.mkdir(sitesDir, { recursive: true });
                                }
                                const sitesPathSlash = path.join(sitesDir, '*.conf').replace(/\\/g, '/');

                                // Perform replacements
                                configContent = configContent.replace(/\[execPath\]/g, serverRootSlash);
                                configContent = configContent.replace(/\[htdocsPath\]/g, htdocsPathSlash);
                                configContent = configContent.replace(/\[cgiBinPath\]/g, cgiBinPathSlash);
                                configContent = configContent.replace(/\[siteEnablePath\]/g, `IncludeOptional "${sitesPathSlash}"`);

                                // Write config
                                await fsPromises.writeFile(targetPath, configContent, 'utf-8');
                                logApp(`Apache configuration updated at ${targetPath}`, 'CONFIG');
                            } else {
                                logApp(`Apache template config not found at ${templatePath}`, 'WARNING');
                            }
                        } catch (configErr) {
                            logApp(`Failed to configure Apache: ${configErr.message}`, 'ERROR');
                            console.error('Apache config error:', configErr);
                        }
                    }
                }
            }

            // Save to database
            const now = new Date().toISOString();
            const result = dbManager.query(
                `INSERT OR REPLACE INTO installed_apps (app_id, installed_version, install_path, exec_path, custom_args, show_on_dashboard, installed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
                [appId, version, appInstallDir, execPath, '', now, now]
            );

            if (result.error) {
                return { error: result.error };
            }

            sendProgress(100, 'Installed!');
            logApp(`Successfully installed ${appId}`, 'INSTALL');

            return { success: true, installPath: appInstallDir, execPath };
        } catch (error) {
            console.error('Failed to install app:', error);
            logApp(`Installation failed for ${appId}: ${error.message}`, 'ERROR');

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

    // Cancel installation
    ipcMain.handle('apps-cancel-install', async (event, appId) => {
        const ctx = activeInstalls.get(appId);
        if (!ctx) {
            return { error: 'No active installation found' };
        }

        ctx.cancelled = true;
        logApp(`Cancelling installation for ${appId}`, 'INSTALL');

        if (ctx.request) {
            ctx.request.destroy();
        }

        // Clean up app directory immediately
        if (ctx.appDir && fs.existsSync(ctx.appDir)) {
            try {
                await fsPromises.rm(ctx.appDir, { recursive: true, force: true });
                logApp(`Removed partial installation directory for ${appId}`, 'INSTALL');
            } catch (err) {
                logApp(`Failed to remove directory for ${appId}: ${err.message}`, 'WARNING');
            }
        }

        return { success: true };
    });

    // Uninstall app
    ipcMain.handle('apps-uninstall', async (event, appId) => {
        const dbManager = getDbManager();
        if (!dbManager) {
            return { error: 'Database not initialized' };
        }

        const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
        if (!apps || apps.length === 0) {
            return { error: 'App not found' };
        }

        const app = apps[0];
        const appPath = app.install_path;
        logApp(`Uninstalling ${appId} from ${appPath}`, 'UNINSTALL');

        // Check if service is running and stop it if necessary
        if (app.exec_path) {
            try {
                const status = serviceHandler.getAppServiceStatus(appId, app.exec_path);
                if (status.running) {
                    logApp(`Service ${appId} is running, stopping before uninstall...`, 'UNINSTALL');
                    await serviceHandler.stopAppService(appId, app.exec_path, null);
                }
            } catch (err) {
                logApp(`Failed to stop service before uninstall: ${err.message}`, 'WARNING');
            }
        }

        const result = dbManager.query('DELETE FROM installed_apps WHERE app_id = ?', [appId]);

        if (result.error) {
            return { error: result.error };
        }

        try {
            if (appPath && fs.existsSync(appPath)) {
                await fsPromises.rm(appPath, { recursive: true, force: true });
            }
        } catch (err) {
            console.error(`Failed to remove app files for ${appId}:`, err);
        }

        return { success: true };
    });

    // Set custom args
    ipcMain.handle('apps-set-args', async (event, appId, args) => {
        const dbManager = getDbManager();
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

    // Set dashboard visibility
    ipcMain.handle('apps-set-dashboard', async (event, appId, showOnDashboard) => {
        const dbManager = getDbManager();
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

    // Update apps list from XML
    ipcMain.handle('apps-update-list', async () => {
        try {
            const xmlData = await new Promise((resolve, reject) => {
                const protocol = APP_FILES_XML_URL.startsWith('https') ? https : http;

                const request = protocol.get(APP_FILES_XML_URL, (response) => {
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

            const fileVersions = parseXmlFileVersions(xmlData.data);

            let appsData;
            try {
                const data = await fsPromises.readFile(appsJsonPath, 'utf-8');
                appsData = JSON.parse(data);
            } catch (e) {
                return { error: 'Failed to read apps.json' };
            }

            let updatedCount = 0;
            for (const app of appsData.apps) {
                const versions = fileVersions[app.id];
                if (versions && versions.length > 0) {
                    app.versions = versions;
                    updatedCount++;
                }
            }

            appsData.lastUpdated = new Date().toISOString();

            await fsPromises.writeFile(appsJsonPath, JSON.stringify(appsData, null, 2), 'utf-8');

            return { success: true, updatedCount, data: appsData };
        } catch (error) {
            console.error('Failed to update apps list:', error);
            return { error: error.message };
        }
    });
}

// Export for use by other handlers
module.exports = { register, logApp };
