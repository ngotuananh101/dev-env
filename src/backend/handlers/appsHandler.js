/**
 * Apps Handler - IPC handlers for App Store operations
 * Handles: Get list, install, uninstall, cancel, update, set args/dashboard
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { Worker } = require('worker_threads');
const crypto = require('crypto');
const serviceHandler = require('./serviceHandler');
const { removeHosts } = require('./hostsHandler');
const { runningNodeProcesses, restartWebServices } = require('./sitesHandler');

/**
 * @typedef {Object} AppVersion
 * @property {string} version - Version string (e.g. "1.0.0")
 * @property {string} filename - Filename of the archive
 * @property {string} download_url - URL to download
 * @property {number} size - Size in bytes
 * @property {string} md5 - MD5 hash
 * @property {string} sha1 - SHA1 hash
 */

/**
 * @typedef {Object} App
 * @property {string} id - Unique App ID
 * @property {string} name - Display name
 * @property {string} description - Brief description
 * @property {string} developer - Developer name
 * @property {string} icon - Icon name or path
 * @property {string} category - Category ID
 * @property {'installed'|'not_installed'} status - Installation status
 * @property {string} [installedVersion] - Currently installed version
 * @property {AppVersion[]} [versions] - Available versions
 */

/**
 * @typedef {Object} InstallContext
 * @property {string} appId - App ID being installed
 * @property {boolean} cancelled - Cancellation flag
 * @property {import('http').ClientRequest} [request] - Active HTTP request
 * @property {import('worker_threads').Worker} [worker] - Active worker thread
 * @property {string} [zipPath] - Path to downloaded zip
 * @property {string} [appDir] - Target installation directory
 */

// Constants
const APP_FILES_XML_URL = 'https://archive.org/download/dev-env/dev-env_files.xml';
const ARCHIVE_BASE_URL = 'https://archive.org/download/dev-env/';
const { execSync } = require('child_process');

// Shared state
const activeInstalls = new Map();

/**
 * Wait for a process to completely stop
 * @param {string} exeName - Name of the executable to wait for
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds
 * @param {number} checkIntervalMs - Interval between checks
 * @returns {Promise<boolean>} - True if process stopped, false if timeout
 */
async function waitForProcessToStop(exeName, maxWaitMs = 5000, checkIntervalMs = 200) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const result = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, { encoding: 'utf-8' });
            if (!result.toLowerCase().includes(exeName.toLowerCase())) {
                return true; // Process has stopped
            }
        } catch (e) {
            return true; // tasklist failed, assume process stopped
        }
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    return false; // Timeout
}

/**
 * Remove a directory with retry logic
 * @param {string} dirPath - Path to the directory to remove
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function removeDirectoryWithRetry(dirPath, maxRetries = 5, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await fsPromises.rm(dirPath, { recursive: true, force: true });
            return { success: true };
        } catch (err) {
            if (err.code === 'EPERM' || err.code === 'EBUSY') {
                if (attempt < maxRetries) {
                    console.log(`Retry ${attempt}/${maxRetries}: Waiting ${delayMs}ms before retrying to remove ${dirPath}`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
            }
            return { success: false, error: err.message };
        }
    }
    return { success: false, error: 'Max retries exceeded' };
}
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


    if (logsDir) {
        const logFile = path.join(logsDir, `${dateStr}.log`);
        const timeStr = now.toLocaleTimeString();
        const logLine = `[${timeStr}] [${type}] ${message}\n`;

        console.log(`${type}: ${message}`);

        try {
            fs.appendFileSync(logFile, logLine);
        } catch (err) {
            console.error('Failed to write log:', err);
        }
    } else {
        console.log(`${type}: ${message} (No logsDir)`);
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
 * Execute NVM command and return output
 * @param {string} command - NVM command
 * @param {string} [execPath='nvm'] - Path to NVM executable
 * @returns {Promise<string>} Output
 */
function runNvmCommand(command, execPath = 'nvm') {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        // Enclose execPath in quotes if it contains spaces
        const cmd = `"${execPath}" ${command}`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                // nvm sometimes returns exit code 1 or 5 for valid errors, 
                // but stdout helps understand what happened.
                if (stdout) resolve(stdout);
                else reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

/**
 * Execute pyenv command and return output
 * @param {string} command - pyenv command
 * @param {string} [execPath='pyenv'] - Path to pyenv executable
 * @returns {Promise<string>} Output
 */
function runPyenvCommand(command, execPath = 'pyenv') {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        // pyenv-win uses .bat files, execute via cmd
        const cmd = `cmd /c "${execPath}" ${command}`;

        exec(cmd, {
            encoding: 'utf-8',
            timeout: 1800000, // 30 minutes for install commands
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }, (error, stdout, stderr) => {
            if (error) {
                // pyenv sometimes returns exit code 1 for valid errors
                if (stdout) resolve(stdout);
                else reject(error);
            } else {
                resolve(stdout || '');
            }
        });
    });
}

/**
 * Find pyenv installation path
 * @param {Object} dbManager - Database manager
 * @returns {string|null} Path to pyenv.bat or null if not found
 */
function findPyenvPath(dbManager) {
    let pyenvPath = null;

    // Try database first
    if (dbManager) {
        const result = dbManager.query("SELECT cli_path, install_path FROM installed_apps WHERE app_id = 'pyenv'");
        if (result && result.length > 0) {
            if (result[0].cli_path && fs.existsSync(result[0].cli_path)) {
                return result[0].cli_path;
            }

            if (result[0].install_path) {
                const possiblePath = path.join(result[0].install_path, 'bin', 'pyenv.bat');
                if (fs.existsSync(possiblePath)) {
                    return possiblePath;
                }
            }
        }
    }

    // Try default location (user's home directory)
    const userProfile = process.env.USERPROFILE;
    if (userProfile) {
        const defaultPath = path.join(userProfile, '.pyenv', 'pyenv-win', 'bin', 'pyenv.bat');
        if (fs.existsSync(defaultPath)) {
            return defaultPath;
        }
    }

    return null;
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
 * Post-install/Re-configure phpMyAdmin
 * @param {Object} dbManager - Database Manager
 * @param {Object} context - App Context
 */
async function configurePhpMyAdmin(dbManager, context) {
    const { appDir } = context;
    const fs = require('fs');
    const fsPromises = fs.promises;
    const path = require('path');

    logApp('Configuring phpMyAdmin...', 'CONFIG');

    try {
        // Find phpMyAdmin install path
        const apps = dbManager.query("SELECT * FROM installed_apps WHERE app_id = 'phpmyadmin'");
        if (!apps || apps.length === 0) {
            // Not installed, nothing to do
            return;
        }

        const app = apps[0];
        const execPath = app.exec_path;
        if (!execPath) return;

        const phpMyAdminRoot = path.dirname(execPath);
        const phpMyAdminRootSlash = phpMyAdminRoot.replace(/\\/g, '/');

        // 1. Get Default PHP Version
        const defaultPhpSettings = dbManager.query("SELECT value FROM settings WHERE key = 'default_php_version'");
        if (defaultPhpSettings && defaultPhpSettings.length > 0) {
            const phpVersion = defaultPhpSettings[0].value; // e.g. "8.2" or "8.2.30"
            // Match major.minor for id
            const versionMatch = phpVersion.match(/^(\d+\.\d+)/);
            if (versionMatch) {
                const shortVersion = versionMatch[1];
                const phpAppId = `php${shortVersion}`; // e.g. php8.2

                // 2. Get PHP Port from installed app args
                const installedPhp = dbManager.query("SELECT custom_args FROM installed_apps WHERE app_id = ?", [phpAppId]);
                let phpPort = '9000'; // Default fallback

                if (installedPhp && installedPhp.length > 0 && installedPhp[0].custom_args) {
                    const args = installedPhp[0].custom_args;
                    logApp(`PHP custom_args: ${args}`, 'CONFIG');
                    const portMatch = args.match(/-b\s+[\d\.]+:(\d+)/);
                    if (portMatch) {
                        // Ensure we only get digits, although regex (\d+) guarantees it
                        const extracted = portMatch[1];
                        // If extracted has non-digits (impossible with \d+ but safety first)
                        phpPort = extracted.replace(/\D/g, '');
                        logApp(`Extracted PHP Port: ${phpPort}`, 'CONFIG');
                    }
                }

                // 3. Generate Configs

                // Nginx
                const nginxConfigContent = `location ^~ /phpmyadmin/ {
    alias "${phpMyAdminRootSlash}/";
    index index.php index.html index.htm;

    location ~ \\.php$ {
        if (!-f $request_filename) { return 404; }
        fastcgi_pass   127.0.0.1:${phpPort};
        fastcgi_index  index.php;
        include        fastcgi_params;
        fastcgi_param  SCRIPT_FILENAME $request_filename;
    }
}`;
                const nginxStaticDir = path.join(context.userDataPath, 'static', 'nginx');
                if (!fs.existsSync(nginxStaticDir)) {
                    await fsPromises.mkdir(nginxStaticDir, { recursive: true });
                }
                await fsPromises.writeFile(path.join(nginxStaticDir, 'phpmyadmin.conf'), nginxConfigContent, 'utf-8');
                logApp(`phpMyAdmin Nginx config created (PHP ${shortVersion} :${phpPort})`, 'CONFIG');


                // Apache
                const apacheConfigContent = `Alias /phpmyadmin "${phpMyAdminRootSlash}"
<Directory "${phpMyAdminRootSlash}">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
    <FilesMatch "\\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:${phpPort}"
    </FilesMatch>
</Directory>`;
                const apacheStaticDir = path.join(context.userDataPath, 'static', 'apache');
                if (!fs.existsSync(apacheStaticDir)) {
                    await fsPromises.mkdir(apacheStaticDir, { recursive: true });
                }
                await fsPromises.writeFile(path.join(apacheStaticDir, 'phpmyadmin.conf'), apacheConfigContent, 'utf-8');
                logApp(`phpMyAdmin Apache config created (PHP ${shortVersion} :${phpPort})`, 'CONFIG');

                // 4. Generate config.inc.php
                // Copy config.sample.inc.php
                await fsPromises.copyFile(path.join(phpMyAdminRoot, 'config.sample.inc.php'), path.join(phpMyAdminRoot, 'config.inc.php'));
                logApp(`phpMyAdmin config.inc.php created (PHP ${shortVersion} :${phpPort})`, 'CONFIG');
                // Read file
                let configIncPhpContent = await fsPromises.readFile(path.join(phpMyAdminRoot, 'config.inc.php'), 'utf-8');
                // replace $cfg['blowfish_secret'] = ''; /* YOU MUST FILL IN THIS FOR COOKIE AUTH! */
                const blowfishSecret = crypto.randomBytes(32).toString('hex');
                configIncPhpContent = configIncPhpContent.replace(`$cfg['blowfish_secret'] = '';`, `$cfg['blowfish_secret'] = '${blowfishSecret}';`);
                // $cfg['Servers'][$i]['AllowNoPassword'] = false; to true
                configIncPhpContent = configIncPhpContent.replace(`$cfg['Servers'][$i]['AllowNoPassword'] = false;`, `$cfg['Servers'][$i]['AllowNoPassword'] = true;`);
                // Write file
                await fsPromises.writeFile(path.join(phpMyAdminRoot, 'config.inc.php'), configIncPhpContent, 'utf-8');
                logApp(`phpMyAdmin config.inc.php updated (PHP ${shortVersion} :${phpPort})`, 'CONFIG');

                // Restart webserver to apply changes
                await restartWebServices(dbManager);
            } else {
                logApp('Could not determine default PHP version short code', 'WARNING');
            }
        } else {
            logApp('Default PHP version not set, skipping phpMyAdmin config', 'WARNING');
        }
    } catch (err) {
        logApp(`Failed to configure phpMyAdmin: ${err.message}`, 'ERROR');
        console.error(err);
    }
}

/**
 * Post-install/Configure pyenv - Setup environment variables
 * @param {Object} dbManager - Database Manager
 * @param {string} installPath - pyenv installation path
 * @returns {Promise<Object>} Result
 */
async function configurePyenv(dbManager, installPath) {
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    logApp('Configuring pyenv environment variables...', 'CONFIG');

    try {
        // pyenv-win-master.zip can extract to different structures
        // Try to find the correct path
        let pyenvHome = null;
        const possiblePaths = [
            path.join(installPath, 'pyenv-win-master', 'pyenv-win'),
            path.join(installPath, 'pyenv-win-master', 'pyenv'),
            path.join(installPath, 'pyenv')
        ];

        for (const possiblePath of possiblePaths) {
            const binPath = path.join(possiblePath, 'bin', 'pyenv.bat');
            if (fs.existsSync(binPath)) {
                pyenvHome = possiblePath;
                logApp(`Found pyenv structure at: ${possiblePath}`, 'CONFIG');
                break;
            }
        }

        if (!pyenvHome) {
            logApp('Could not find pyenv directory structure', 'ERROR');
            return { success: false, error: 'pyenv directory not found' };
        }

        const pyenvBin = path.join(pyenvHome, 'bin');
        const pyenvShims = path.join(pyenvHome, 'shims');

        logApp(`PYENV_HOME: ${pyenvHome}`, 'CONFIG');
        logApp(`PYENV_BIN: ${pyenvBin}`, 'CONFIG');

        // Set system environment variables using setx
        // Note: setx requires admin for system-wide vars, but works for user vars without admin
        // We'll use user-level environment variables

        return new Promise((resolve, reject) => {
            const commands = [
                `setx PYENV "${pyenvHome}"`,
                `setx PYENV_HOME "${pyenvHome}"`,
                `setx PYENV_ROOT "${pyenvHome}"`
            ];

            // Execute commands sequentially
            let currentIndex = 0;
            const executeNext = () => {
                if (currentIndex >= commands.length) {
                    // All commands executed, now add to PATH
                    // Get current user PATH
                    exec('powershell -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"', (err, stdout) => {
                        if (err) {
                            logApp(`Failed to get PATH: ${err.message}`, 'ERROR');
                            resolve({ success: false, error: err.message });
                            return;
                        }

                        let currentPath = stdout.trim();
                        const pathsToAdd = [pyenvBin, pyenvShims];
                        let pathModified = false;

                        pathsToAdd.forEach(p => {
                            if (!currentPath.toLowerCase().includes(p.toLowerCase())) {
                                currentPath = currentPath ? `${currentPath};${p}` : p;
                                pathModified = true;
                            }
                        });

                        if (pathModified) {
                            // Update PATH
                            const escapedPath = currentPath.replace(/"/g, '`"');
                            exec(`powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${escapedPath}', 'User')"`, (pathErr) => {
                                if (pathErr) {
                                    logApp(`Failed to update PATH: ${pathErr.message}`, 'ERROR');
                                    resolve({ success: false, error: pathErr.message });
                                } else {
                                    logApp('pyenv environment variables configured successfully', 'CONFIG');
                                    resolve({ success: true });
                                }
                            });
                        } else {
                            logApp('pyenv paths already in PATH', 'CONFIG');
                            resolve({ success: true });
                        }
                    });
                    return;
                }

                const cmd = commands[currentIndex];
                exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                        logApp(`Failed to execute: ${cmd} - ${error.message}`, 'WARNING');
                    } else {
                        logApp(`Executed: ${cmd}`, 'CONFIG');
                    }
                    currentIndex++;
                    executeNext();
                });
            };

            executeNext();
        });
    } catch (err) {
        logApp(`Failed to configure pyenv: ${err.message}`, 'ERROR');
        return { success: false, error: err.message };
    }
}

/**
 * Register apps-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    const { getDbManager, appDir, userDataPath } = context;

    // Initialize paths
    // Define writable paths in userData
    const userDataDataDir = path.join(userDataPath, 'data');
    const userDataAppsJsonPath = path.join(userDataDataDir, 'apps.json');
    logsDir = path.join(userDataPath, 'logs');

    // Determine working apps.json path
    // In Dev Mode (!app.isPackaged), we prefer reading from source for development convenience, 
    // but we might want to still write to userData to avoid polluting source.
    // However, for simplicity and ensuring updates are seen, let's prioritize source in dev.
    const isDev = !context.app.isPackaged;

    // In Dev mode, use the source data directory
    const sourceDataDir = path.join(appDir, 'data');
    const sourceAppsJsonPath = path.join(sourceDataDir, 'apps.json');

    if (isDev) {
        appsJsonPath = sourceAppsJsonPath;
        // Also ensure we use source data dir for icons/etc if needed
    } else {
        appsJsonPath = userDataAppsJsonPath;
    }

    // Ensure directories exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    if (!fs.existsSync(userDataDataDir)) {
        fs.mkdirSync(userDataDataDir, { recursive: true });
    }

    // Copy default apps.json if it doesn't exist in userData (ONLY IN PROD)
    if (!isDev && !fs.existsSync(appsJsonPath)) {
        const defaultAppsJson = path.join(appDir, 'data', 'apps.json');
        if (fs.existsSync(defaultAppsJson)) {
            try {
                fs.copyFileSync(defaultAppsJson, appsJsonPath);
            } catch (e) {
                console.error('Failed to copy default apps.json:', e);
            }
        }
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

                    // Auto-fix missing custom_args for PHP apps
                    for (const app of installedApps) {
                        if (app.app_id.startsWith('php') && !app.custom_args) {
                            const jsonApp = jsonData.apps.find(a => a.id === app.app_id);
                            if (jsonApp && jsonApp.default_args) {
                                try {
                                    dbManager.query('UPDATE installed_apps SET custom_args = ? WHERE app_id = ?', [jsonApp.default_args, app.app_id]);
                                    app.custom_args = jsonApp.default_args;
                                    console.log(`Auto-fixed custom_args for ${app.app_id}`);
                                } catch (err) {
                                    console.error(`Failed to auto-fix custom_args for ${app.app_id}`, err);
                                }
                            }
                        }
                    }
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

    // Get App Icon
    ipcMain.handle('apps-read-icon', async (event, filename) => {
        try {
            if (!filename) return null;

            // Allow reading from icons directory
            let iconsDir;
            if (!context.app.isPackaged) {
                // Dev mode: use source icons
                iconsDir = path.join(context.appDir, 'data', 'icons');
            } else {
                // Prod mode: use userData icons
                iconsDir = path.join(context.userDataPath, 'data', 'icons');

                // If not found in userData, try fallback to app resources (common case for fresh installs)
                if (!fs.existsSync(path.join(iconsDir, filename))) {
                    const resourceIcons = path.join(process.resourcesPath, 'data', 'icons');
                    if (fs.existsSync(path.join(resourceIcons, filename))) {
                        iconsDir = resourceIcons;
                    }
                }
            }

            const iconPath = path.join(iconsDir, filename);

            // Basic security check to prevent traversal
            if (!iconPath.startsWith(iconsDir)) {
                return { error: 'Invalid icon path' };
            }

            if (!fs.existsSync(iconPath)) {
                return { error: 'Icon not found' };
            }

            const content = await fsPromises.readFile(iconPath, 'base64');
            return {
                mime: 'image/svg+xml',
                data: content
            };
        } catch (error) {
            console.error(`Failed to read icon ${filename}:`, error);
            return { error: error.message };
        }
    });

    /**
     * Install pyenv using official PowerShell script
     * @param {Object} event - IPC event
     * @param {string} appId - App ID (pyenv)
     * @param {string} version - Version
     * @param {Object} dbManager - Database manager
     * @returns {Promise<Object>} Installation result
     */
    async function installPyenvUsingScript(event, appId, version, dbManager) {
        const { exec } = require('child_process');
        const os = require('os');

        logApp('Installing pyenv using official PowerShell script...', 'INSTALL');

        const sendProgress = (progress, status, logDetail = null) => {
            event.sender.send('app-install-progress', { appId, progress, status, logDetail });
        };

        try {
            sendProgress(10, 'Preparing PowerShell script...');

            // Create temporary PowerShell script file to avoid escaping nightmares
            const tempScriptPath = path.join(os.tmpdir(), `pyenv-install-${Date.now()}.ps1`);

            const psScriptContent = `
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

try {
    Write-Host "=== Starting pyenv-win installation ===" -ForegroundColor Green
    
    $installerUrl = "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1"
    $installerPath = "$env:TEMP\\install-pyenv-win.ps1"
    
    Write-Host "Downloading: $installerUrl" -ForegroundColor Yellow
    Invoke-WebRequest -UseBasicParsing -Uri $installerUrl -OutFile $installerPath -ErrorAction Stop
    Write-Host "Downloaded to: $installerPath" -ForegroundColor Green
    Write-Host "Downloaded to: $installerPath" -ForegroundColor Green
    
    if (!(Test-Path $installerPath)) {
        throw "Downloaded script not found"
    }
    
    $scriptSize = (Get-Item $installerPath).Length
    Write-Host "Script size: $scriptSize bytes"
    
    Write-Host "Executing installer..." -ForegroundColor Yellow
    & $installerPath
    
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0 -and $null -ne $exitCode) {
        throw "Installer failed with exit code: $exitCode"
    }
    
    Write-Host "Installer completed" -ForegroundColor Green
    
    $pyenvPath = "$env:USERPROFILE\\.pyenv\\pyenv-win\\bin\\pyenv.bat"
    Write-Host "Verifying: $pyenvPath"
    
    if (Test-Path $pyenvPath) {
        Write-Host "SUCCESS: pyenv.bat found!" -ForegroundColor Green
    } else {
        Write-Host "WARNING: pyenv.bat not found" -ForegroundColor Yellow
        
        Write-Host "Searching for pyenv..."
        $searchPaths = @(
            "$env:USERPROFILE\\.pyenv",
            "$env:LOCALAPPDATA\\pyenv",
            "$env:APPDATA\\pyenv"
        )
        
        foreach ($sp in $searchPaths) {
            if (Test-Path $sp) {
                Write-Host "Checking: $sp"
                Get-ChildItem -Path $sp -Recurse -Filter "pyenv.bat" -ErrorAction SilentlyContinue | ForEach-Object {
                    Write-Host "  Found: $($_.FullName)" -ForegroundColor Cyan
                }
            }
        }
        
        throw "pyenv.bat not found after installation"
    }
    
    Remove-Item $installerPath -ErrorAction SilentlyContinue
    
    Write-Host "=== Installation completed ===" -ForegroundColor Green
    exit 0
    
} catch {
    Write-Error "Installation failed: $_"
    Write-Error $_.Exception.Message
    exit 1
}
`;

            // Write PowerShell script to temp file
            await fsPromises.writeFile(tempScriptPath, psScriptContent, 'utf-8');

            sendProgress(50, 'Installing pyenv-win...');

            return new Promise((resolve, reject) => {
                // Execute PowerShell script file
                exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`, {
                    encoding: 'utf-8',
                    timeout: 300000,
                    maxBuffer: 10 * 1024 * 1024
                }, async (error, stdout, stderr) => {

                    // Cleanup temp script
                    try {
                        await fsPromises.unlink(tempScriptPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }

                    // Log errors only
                    if (error) {
                        logApp(`PowerShell installation failed: ${error.message}`, 'ERROR');
                        if (stderr) {
                            logApp(`Error details: ${stderr}`, 'ERROR');
                        }
                        sendProgress(0, 'Installation failed');
                        resolve({
                            error: `Failed to install pyenv: ${error.message}\n\nStdout: ${stdout}\n\nStderr: ${stderr}`
                        });
                        return;
                    }

                    sendProgress(80, 'Verifying installation...');

                    // Find pyenv installation path
                    const userProfile = process.env.USERPROFILE;
                    const pyenvRoot = path.join(userProfile, '.pyenv', 'pyenv-win');
                    const pyenvBat = path.join(pyenvRoot, 'bin', 'pyenv.bat');

                    if (!fs.existsSync(pyenvBat)) {
                        // Try to find it in other locations
                        const possibleLocations = [
                            path.join(userProfile, '.pyenv', 'pyenv-win', 'bin', 'pyenv.bat'),
                            path.join(userProfile, '.pyenv', 'bin', 'pyenv.bat'),
                            path.join(process.env.LOCALAPPDATA, 'pyenv', 'pyenv-win', 'bin', 'pyenv.bat'),
                        ];

                        let foundPath = null;
                        for (const loc of possibleLocations) {
                            if (fs.existsSync(loc)) {
                                foundPath = loc;
                                break;
                            }
                        }

                        if (!foundPath) {
                            sendProgress(0, 'Installation verification failed');
                            resolve({
                                error: `pyenv installation failed - pyenv.bat not found.`
                            });
                            return;
                        }

                        // Update paths if found in different location
                        const foundRoot = path.dirname(path.dirname(foundPath));

                        // Save to database
                        const now = new Date().toISOString();
                        const result = dbManager.query(
                            `INSERT OR REPLACE INTO installed_apps (app_id, installed_version, install_path, exec_path, cli_path, custom_args, auto_start, show_on_dashboard, installed_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                            [appId, version, foundRoot, foundPath, foundPath, '', 0, now, now]
                        );

                        if (result.error) {
                            resolve({ error: result.error });
                            return;
                        }

                        sendProgress(100, 'Installed!');
                        logApp('pyenv installation completed successfully', 'INSTALL');
                        resolve({
                            success: true,
                            installPath: foundRoot,
                            execPath: foundPath,
                            cliPath: foundPath
                        });
                        return;
                    }

                    // Save to database
                    const now = new Date().toISOString();
                    const result = dbManager.query(
                        `INSERT OR REPLACE INTO installed_apps (app_id, installed_version, install_path, exec_path, cli_path, custom_args, auto_start, show_on_dashboard, installed_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                        [appId, version, pyenvRoot, pyenvBat, pyenvBat, '', 0, now, now]
                    );

                    if (result.error) {
                        logApp(`Failed to save to database: ${result.error}`, 'ERROR');
                        resolve({ error: result.error });
                        return;
                    }

                    sendProgress(100, 'Installed!');
                    logApp('pyenv installation completed successfully', 'INSTALL');

                    resolve({
                        success: true,
                        installPath: pyenvRoot,
                        execPath: pyenvBat,
                        cliPath: pyenvBat
                    });
                });
            });

        } catch (err) {
            logApp(`pyenv installation error: ${err.message}`, 'ERROR');
            sendProgress(0, 'Installation failed');
            return { error: err.message };
        }
    }

    // Install app
    ipcMain.handle('apps-install', async (event, appId, version, downloadUrl, filename, execFile, group, defaultArgs, autostart, cliFile) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) {
                return { error: 'Database not initialized' };
            }

            if (activeInstalls.has(appId)) {
                const ctx = activeInstalls.get(appId);
                if (ctx && ctx.cancelled) {
                    // If it was cancelled but still in map, assume it's safe to retry/force clean
                    activeInstalls.delete(appId);
                    logApp(`Force cleaning cancelled installation for ${appId}`, 'WARNING');
                } else {
                    return { error: 'Installation already in progress' };
                }
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

            // Special handling for pyenv - use PowerShell installer script
            if (appId === 'pyenv') {
                return await installPyenvUsingScript(event, appId, version, dbManager);
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
                logApp(`Starting installation for ${appId} version ${version}`, 'INSTALL');

                const appsDir = path.join(context.userDataPath, 'apps');
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
                                if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath); } catch (e) { }
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

                // Extract ZIP file using Worker thread to avoid blocking UI
                try {
                    await new Promise((resolve, reject) => {
                        const workerPath = path.join(__dirname, '..', 'workers', 'extractWorker.js');
                        const worker = new Worker(workerPath, {
                            workerData: {
                                zipPath,
                                appInstallDir
                            }
                        });

                        installContext.worker = worker;

                        worker.on('message', (msg) => {
                            if (installContext.cancelled) {
                                worker.terminate();
                                reject(new Error('Installation cancelled'));
                                return;
                            }

                            switch (msg.type) {
                                case 'start':
                                    sendProgress(50, 'Extracting...', `Starting extraction of ${msg.totalEntries} files`);
                                    break;
                                case 'progress':
                                    const extractPercent = 50 + Math.round((msg.extractedCount / msg.totalEntries) * 40);
                                    sendProgress(extractPercent, 'Extracting...', `Extracted ${msg.extractedCount} / ${msg.totalEntries} files`);
                                    break;
                                case 'warning':
                                    logApp(msg.message, 'WARNING');
                                    break;
                                case 'complete':
                                    sendProgress(90, 'Finishing...');
                                    resolve();
                                    break;
                                case 'error':
                                    reject(new Error(msg.message));
                                    break;
                            }
                        });

                        worker.on('error', (err) => {
                            reject(err);
                        });

                        worker.on('exit', (code) => {
                            if (code !== 0 && !installContext.cancelled) {
                                reject(new Error(`Worker stopped with exit code ${code}`));
                            }
                        });
                    });
                } catch (extractError) {
                    if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath); } catch (e) { }
                    throw new Error(`Failed to extract: ${extractError.message}`);
                }

                if (fs.existsSync(zipPath)) {
                    try { fs.unlinkSync(zipPath); } catch (e) { }
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
                            } else {
                                // Strict filename check if target is just a filename
                                // If target contains separators, we might keep the suffix check but be careful
                                // Assuming target usually comes from executables config like "bin/mysql.exe" or "nvm.exe"

                                const targetName = path.basename(target);
                                // If exact filename matches
                                if (entry.name.toLowerCase() === targetName.toLowerCase()) {
                                    // Verify if target had path components, that they also match?
                                    // The original logic was loose. Let's make it check if the path ends with the full target.
                                    // But crucially, ensure it ends with explicit separator if target doesn't start with one.
                                    const normalizedTarget = target.replace(/\//g, '\\');

                                    if (fullPath.endsWith(normalizedTarget)) {
                                        // Check that the character before the match is a separator, to avoid "author-nvm.exe" matching "nvm.exe"
                                        const pathBefore = fullPath.slice(0, -normalizedTarget.length);
                                        if (pathBefore.endsWith('\\') || pathBefore === '') {
                                            return fullPath;
                                        }
                                    }
                                }
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
                            // Check if current php app is single
                            const phpAppInstalled = await dbManager.query("SELECT * FROM installed_apps WHERE app_id Like 'php%';");
                            logApp(`Number of PHP apps installed: ${phpAppInstalled.length}`, 'CONFIG');
                            if (phpAppInstalled.length === 0) {
                                // Update default_php_version
                                const phpVersion = appId.replace('php', '');
                                await dbManager.query("UPDATE settings SET value = ? WHERE key = 'default_php_version'", [phpVersion]);
                                logApp(`Default PHP version updated to ${phpVersion}`, 'CONFIG');
                            }
                        }
                        else if (appId === 'apache') {
                            logApp('Configuring Apache...', 'CONFIG');
                            try {
                                const serverRoot = path.dirname(path.dirname(execPath));
                                const templatePath = path.join(context.appDir, 'data', 'config', 'apache.conf');
                                const targetPath = path.join(serverRoot, 'conf', 'httpd.conf');

                                if (fs.existsSync(templatePath)) {
                                    let configContent = await fsPromises.readFile(templatePath, 'utf-8');

                                    // Prepare paths (convert to forward slashes for Apache config)
                                    const serverRootSlash = serverRoot.replace(/\\/g, '/');
                                    // Make sure htdocs exists (use userDataPath for writable directories)
                                    const htdocsPath = path.join(context.userDataPath, 'htdocs');
                                    if (!fs.existsSync(htdocsPath)) {
                                        await fsPromises.mkdir(htdocsPath, { recursive: true });
                                    }
                                    const htdocsPathSlash = htdocsPath.replace(/\\/g, '/');
                                    // Make sure cgi-bin exists
                                    const cgiBinPath = path.join(serverRoot, 'cgi-bin');
                                    if (!fs.existsSync(cgiBinPath)) {
                                        await fsPromises.mkdir(cgiBinPath, { recursive: true });
                                    }
                                    const cgiBinPathSlash = cgiBinPath.replace(/\\/g, '/');
                                    // Make sure logs directory exists
                                    const logsPath = path.join(serverRoot, 'logs');
                                    if (!fs.existsSync(logsPath)) {
                                        await fsPromises.mkdir(logsPath, { recursive: true });
                                    }

                                    // Ensure sites directory exists (use userDataPath for writable directories)
                                    const sitesDir = path.join(context.userDataPath, 'sites');
                                    if (!fs.existsSync(sitesDir)) {
                                        await fsPromises.mkdir(sitesDir, { recursive: true });
                                    }
                                    const sitesPathSlash = path.join(sitesDir, '*.conf').replace(/\\/g, '/');

                                    // static app path (use userDataPath for writable directories)
                                    const staticAppPath = path.join(context.userDataPath, 'static', 'apache');
                                    if (!fs.existsSync(staticAppPath)) {
                                        await fsPromises.mkdir(staticAppPath, { recursive: true });
                                    }
                                    const staticAppPathSlash = path.join(staticAppPath, '*.conf').replace(/\\/g, '/');

                                    // Perform replacements
                                    configContent = configContent.replace(/\[execPath\]/g, serverRootSlash);
                                    configContent = configContent.replace(/\[htdocsPath\]/g, htdocsPathSlash);
                                    configContent = configContent.replace(/\[cgiBinPath\]/g, cgiBinPathSlash);
                                    configContent = configContent.replace(/\[siteEnablePath\]/g, `IncludeOptional "${sitesPathSlash}"`);
                                    configContent = configContent.replace(/\[staticAppPath\]/g, `IncludeOptional "${staticAppPathSlash}"`);

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
                        else if (appId === 'nginx') {
                            logApp('Configuring Nginx...', 'CONFIG');
                            try {
                                const serverRoot = path.dirname(execPath);
                                const templatePath = path.join(context.appDir, 'data', 'config', 'nginx.conf');
                                const targetPath = path.join(serverRoot, 'conf', 'nginx.conf');

                                if (fs.existsSync(templatePath)) {
                                    let configContent = await fsPromises.readFile(templatePath, 'utf-8');
                                    // Use userDataPath for writable directories
                                    const htdocsPathSlash = path.join(context.userDataPath, 'htdocs').replace(/\\/g, '/');
                                    // Ensure htdocs directory exists
                                    if (!fs.existsSync(path.join(context.userDataPath, 'htdocs'))) {
                                        await fsPromises.mkdir(path.join(context.userDataPath, 'htdocs'), { recursive: true });
                                    }
                                    // Ensure sites directory exists (use userDataPath for writable directories)
                                    const sitesDir = path.join(context.userDataPath, 'sites');
                                    if (!fs.existsSync(sitesDir)) {
                                        await fsPromises.mkdir(sitesDir, { recursive: true });
                                    }
                                    const sitesPathSlash = path.join(sitesDir, '*.conf').replace(/\\/g, '/');

                                    // static app path (use userDataPath for writable directories)
                                    const staticAppPath = path.join(context.userDataPath, 'static', 'nginx');
                                    if (!fs.existsSync(staticAppPath)) {
                                        await fsPromises.mkdir(staticAppPath, { recursive: true });
                                    }
                                    const staticAppPathSlash = path.join(staticAppPath, '*.conf').replace(/\\/g, '/');

                                    // Perform replacement
                                    configContent = configContent.replace(/\[siteEnablePath\]/g, `include "${sitesPathSlash}";`);
                                    configContent = configContent.replace(/\[staticAppPath\]/g, `include "${staticAppPathSlash}";`);
                                    // Update default root "root html;" -> "root newPath;"
                                    // We use a regex to ensure we match the 'root' directive inside location / or server block
                                    configContent = configContent.replace(/root\s+html;/g, `root "${htdocsPathSlash}";`);

                                    // Write config
                                    await fsPromises.writeFile(targetPath, configContent, 'utf-8');
                                    logApp(`Nginx configuration updated at ${targetPath}`, 'CONFIG');
                                } else {
                                    logApp(`Nginx template config not found at ${templatePath}`, 'WARNING');
                                }
                            } catch (configErr) {
                                logApp(`Failed to configure Nginx: ${configErr.message}`, 'ERROR');
                                console.error('Nginx config error:', configErr);
                            }
                        }
                        else if (appId === 'phpmyadmin') {
                            await configurePhpMyAdmin(dbManager, context, execPath);
                        }
                    }
                }

                // Find CLI path (for PATH operations)
                let cliPath = '';
                if (cliFile) {
                    const findFile = async (dir, target) => {
                        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const fullPath = path.join(dir, entry.name);
                            if (entry.isDirectory()) {
                                const found = await findFile(fullPath, target);
                                if (found) return found;
                            } else {
                                const targetName = path.basename(target);
                                if (entry.name.toLowerCase() === targetName.toLowerCase()) {
                                    const normalizedTarget = target.replace(/\//g, '\\');
                                    if (fullPath.endsWith(normalizedTarget)) {
                                        const pathBefore = fullPath.slice(0, -normalizedTarget.length);
                                        if (pathBefore.endsWith('\\') || pathBefore === '') {
                                            return fullPath;
                                        }
                                    }
                                }
                            }
                        }
                        return null;
                    };

                    const foundCliPath = await findFile(appInstallDir, cliFile);
                    if (foundCliPath) {
                        cliPath = foundCliPath;
                    }
                }

                // Save to database
                const now = new Date().toISOString();
                const autoStartValue = autostart ? 1 : 0;
                const result = dbManager.query(
                    `INSERT OR REPLACE INTO installed_apps (app_id, installed_version, install_path, exec_path, cli_path, custom_args, auto_start, show_on_dashboard, installed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                    [appId, version, appInstallDir, execPath, cliPath, defaultArgs || '', autoStartValue, now, now]
                );

                if (result.error) {
                    return { error: result.error };
                }

                sendProgress(100, 'Installed!');
                logApp(`Successfully installed ${appId}`, 'INSTALL');

                await configurePhpMyAdmin(dbManager, context);

                return { success: true, installPath: appInstallDir, execPath, cliPath };
            } catch (error) {
                console.error('Failed to install app:', error);
                logApp(`Installation failed for ${appId}: ${error.message}`, 'ERROR');

                const ctx = activeInstalls.get(appId);
                if (ctx && ctx.zipPath && fs.existsSync(ctx.zipPath)) {
                    try { fs.unlinkSync(ctx.zipPath); } catch (e) { }
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
        } catch (fatalError) {
            console.error('Fatal install error:', fatalError);
            return { error: `Fatal Error: ${fatalError.message}` };
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

        // Terminate worker if running
        if (ctx.worker) {
            try {
                ctx.worker.terminate();
            } catch (e) { /* ignore */ }
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
        let exeName = null;
        if (app.exec_path) {
            exeName = path.basename(app.exec_path);
            try {
                const status = serviceHandler.getAppServiceStatus(appId, app.exec_path);
                if (status.running) {
                    logApp(`Service ${appId} is running, stopping before uninstall...`, 'UNINSTALL');
                    await serviceHandler.stopAppService(appId, app.exec_path, null);

                    // Wait for process to completely stop
                    logApp(`Waiting for ${exeName} to stop...`, 'UNINSTALL');
                    const stopped = await waitForProcessToStop(exeName, 10000, 500);
                    if (!stopped) {
                        logApp(`Process ${exeName} still running after timeout, attempting force kill...`, 'WARNING');
                        try {
                            execSync(`taskkill /IM ${exeName} /F`, { stdio: 'ignore' });
                            await waitForProcessToStop(exeName, 3000, 300);
                        } catch (e) {
                            // Ignore errors from taskkill
                        }
                    }
                }
            } catch (err) {
                logApp(`Failed to stop service before uninstall: ${err.message}`, 'WARNING');
            }
        }

        // Remove from PATH if the app was added to PATH
        try {
            let cliDir = null;
            if (app.cli_path) {
                cliDir = path.dirname(app.cli_path);
            } else if (app.exec_path) {
                cliDir = path.dirname(app.exec_path);
            }

            if (cliDir) {
                // Get User PATH from Registry
                let userPath = '';
                try {
                    const result = execSync(
                        'reg query "HKCU\\Environment" /v Path',
                        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
                    );
                    const match = result.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
                    if (match && match[1]) {
                        userPath = match[1].trim();
                    }
                } catch (e) {
                    userPath = '';
                }

                if (userPath) {
                    const paths = userPath.split(';').map(p => p.toLowerCase().trim()).filter(p => p);
                    const normalizedCliDir = cliDir.toLowerCase();
                    const inPath = paths.some(p => p === normalizedCliDir || p === normalizedCliDir + '\\');

                    if (inPath) {
                        logApp(`Removing ${cliDir} from PATH...`, 'UNINSTALL');

                        // Filter out the cli directory from PATH
                        const filteredPaths = userPath.split(';').filter(p => {
                            const normalized = p.toLowerCase().trim();
                            return normalized !== normalizedCliDir && normalized !== normalizedCliDir + '\\';
                        });

                        const newPath = filteredPaths.join(';');

                        // Update Registry
                        execSync(
                            `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`,
                            { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
                        );


                        logApp(`Successfully removed ${cliDir} from PATH`, 'UNINSTALL');
                    }
                }
            }
        } catch (err) {
            logApp(`Failed to remove from PATH: ${err.message}`, 'WARNING');
        }

        const result = dbManager.query('DELETE FROM installed_apps WHERE app_id = ?', [appId]);

        if (result.error) {
            return { error: result.error };
        }

        const appDir = path.join(context.userDataPath, 'apps', appId);
        if (fs.existsSync(appDir)) {
            logApp(`Removing app directory: ${appDir}`, 'UNINSTALL');
            const removeResult = await removeDirectoryWithRetry(appDir, 5, 1000);
            if (!removeResult.success) {
                console.error(`Failed to remove app dir for ${appId}:`, removeResult.error);
                logApp(`Failed to remove app directory: ${removeResult.error}`, 'WARNING');
                // Return error but don't fail the uninstall completely
                return { success: true, warning: `App uninstalled but failed to remove directory: ${removeResult.error}` };
            }
        }

        // Delete vhost dir if app is nginx or apache
        if (appId === 'nginx' || appId === 'apache') {
            try {
                // 1. Stop all running Node processes
                if (runningNodeProcesses && runningNodeProcesses.size > 0) {
                    for (const [id, proc] of runningNodeProcesses) {
                        try {
                            proc.kill();
                        } catch (e) {
                            console.error(`Failed to kill process for site ${id}`, e);
                        }
                    }
                    runningNodeProcesses.clear();
                }

                // 2. Remove all hosts entries
                const sites = dbManager.query('SELECT domain FROM sites');
                if (sites && sites.length > 0) {
                    const domains = sites.map(s => s.domain);
                    await removeHosts(domains);
                }

                // 3. Clear sites database
                dbManager.query('DELETE FROM sites');

            } catch (err) {
                console.error('Failed to clean up sites data:', err);
                logApp(`Failed to clean up sites data: ${err.message}`, 'WARNING');
            }

            // 4. Delete sites directory
            const sitesDir = path.join(context.userDataPath, 'sites');
            if (fs.existsSync(sitesDir)) {
                try {
                    await fsPromises.rm(sitesDir, { recursive: true, force: true });
                } catch (err) {
                    console.error(`Failed to remove sites dir for ${appId}:`, err);
                }
            }
        }

        return { success: true };
    });

    // Get PHP Extensions
    ipcMain.handle('apps-get-extensions', async (event, appId) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const installPath = app.install_path;
            const extDir = path.join(installPath, 'ext');

            if (!fs.existsSync(extDir)) {
                return { error: 'Extensions directory not found' };
            }

            // List .dll files in ext
            const files = await fsPromises.readdir(extDir);
            const dlls = files.filter(f => f.endsWith('.dll'));

            // Get loaded extensions via PHP CLI
            const phpPath = path.join(installPath, 'php.exe');
            let loadedModules = [];

            if (fs.existsSync(phpPath)) {
                try {
                    const { exec } = require('child_process');
                    const stdout = await new Promise((resolve) => {
                        exec(`"${phpPath}" -m`, (error, stdout, stderr) => {
                            if (error) {
                                console.warn('php -m warning:', error.message);
                            }
                            resolve(stdout || '');
                        });
                    });

                    loadedModules = stdout.split(/\r?\n/)
                        .map(m => m.trim().toLowerCase())
                        .filter(m => m && !m.startsWith('[')); // Exclude [PHP Modules], [Zend Modules]
                } catch (e) {
                    console.error('Failed to run php -m', e);
                }
            }

            const extensions = dlls.map(filename => {
                // Derived name: php_mysqli.dll -> mysqli
                let name = filename;
                if (name.startsWith('php_')) name = name.substring(4);
                if (name.endsWith('.dll')) name = name.substring(0, name.length - 4);

                // Check status against loaded modules
                const isEnabled = loadedModules.includes(name.toLowerCase());

                return {
                    name: name,
                    filename: filename,
                    enabled: isEnabled
                };
            });

            return { success: true, extensions };

        } catch (error) {
            console.error('Failed to get extensions:', error);
            return { error: error.message };
        }
    });

    // Toggle PHP Extension
    ipcMain.handle('apps-toggle-extension', async (event, appId, extension, enable) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const phpIniPath = path.join(app.install_path, 'php.ini');

            if (!fs.existsSync(phpIniPath)) {
                return { error: 'php.ini not found' };
            }

            let content = await fsPromises.readFile(phpIniPath, 'utf-8');
            let lines = content.split(/\r?\n/);

            // Name variations to look for
            const name = extension.name;
            const filename = extension.filename; // e.g. php_mysqli.dll

            // Construct absolute path for the extension
            // Only relevant for enabling, but good to have
            const extAbsPath = path.join(app.install_path, 'ext', filename);

            if (enable) {
                // Enable: Check if ALREADY ENABLED (active)
                let activeExists = false;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    // Skip comments
                    if (line.startsWith(';')) continue;

                    const cleanLine = line; // It's already trimmed and check for ; passed
                    if (cleanLine.startsWith('extension=')) {
                        const val = cleanLine.substring(10).trim().replace(/['"]/g, '');
                        const base = path.basename(val);
                        // Check against name, filename, or absolute path
                        if (base.toLowerCase() === filename.toLowerCase() ||
                            base.toLowerCase() === name.toLowerCase() ||
                            base.toLowerCase() === (name + '.dll').toLowerCase()) {
                            activeExists = true;
                            break;
                        }
                    }
                }

                if (!activeExists) {
                    // Insert new line (absolute path)
                    const newLine = `extension="${extAbsPath}"`;

                    // Find insertion point: after ;zend_extension=opcache
                    let insertIdx = -1;
                    for (let i = 0; i < lines.length; i++) {
                        // Loose check for opcache directive
                        if (lines[i].includes('zend_extension=opcache')) {
                            insertIdx = i;
                            break;
                        }
                    }

                    if (insertIdx !== -1) {
                        lines.splice(insertIdx + 1, 0, newLine);
                    } else {
                        // Fallback: append to end
                        lines.push(newLine);
                    }
                }
                await fsPromises.writeFile(phpIniPath, lines.join('\n'), 'utf-8');

            } else {
                // Disable: Remove lines completely
                const newLines = lines.filter(line => {
                    const trimLine = line.trim();
                    const cleanLine = trimLine.replace(/^;/, '').trim();
                    if (cleanLine.startsWith('extension=')) {
                        const val = cleanLine.substring(10).trim().replace(/['"]/g, '');
                        const base = path.basename(val);
                        if (base.toLowerCase() === filename.toLowerCase() ||
                            base.toLowerCase() === name.toLowerCase() ||
                            base.toLowerCase() === (name + '.dll').toLowerCase()) {
                            return false; // Remove this line
                        }
                    }
                    return true; // Keep other lines
                });

                if (newLines.length !== lines.length) {
                    await fsPromises.writeFile(phpIniPath, newLines.join('\n'), 'utf-8');
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Failed to toggle extension:', error);
            return { error: error.message };
        }
    });

    // ========== NVM Management ==========

    // List installed node versions (nvm list)
    ipcMain.handle('nvm-list', async () => {
        try {
            const dbManager = getDbManager();
            let nvmPath = 'nvm';
            if (dbManager) {
                const result = dbManager.query("SELECT cli_path FROM installed_apps WHERE app_id = 'nvm'");
                if (result && result.length > 0 && result[0].cli_path) {
                    nvmPath = result[0].cli_path;
                }
            }

            const output = await runNvmCommand('list', nvmPath);
            const lines = output.split('\n');
            const installed = [];
            let current = '';

            lines.forEach(line => {
                line = line.trim();
                if (!line) return;

                const isCurrent = line.includes('*'); // Simpler check

                // Extract version using regex to ignore ANSI codes, whitespace, etc.
                const versionMatch = line.match(/(\d+\.\d+\.\d+)/);

                if (versionMatch) {
                    const cleanVersion = versionMatch[1];
                    installed.push(cleanVersion);
                    if (isCurrent) current = cleanVersion;
                }
            });

            return { success: true, installed, current };
        } catch (err) {
            return { error: err.message };
        }
    });

    // List available (nvm list available) - Parsing this is fragile, maybe just fetch from nodejs.org?
    // nvm-windows "list available" shows a table.
    // Let's implement a direct fetch from nodejs.org dist index.json for reliability and speed
    ipcMain.handle('nvm-list-available', async () => {
        try {
            return new Promise((resolve, reject) => {
                const https = require('https');
                https.get('https://nodejs.org/dist/index.json', { headers: { 'User-Agent': 'DevEnv' } }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const allVersions = JSON.parse(data);
                            // Filter for LTS and Current (last 50 or so to avoid huge list)
                            const lts = allVersions.filter(v => v.lts).slice(0, 20);
                            const current = allVersions.filter(v => !v.lts).slice(0, 10);

                            // Transform to simple objects
                            const processVer = (v) => ({
                                version: v.version.replace('v', ''),
                                lts: v.lts ? (typeof v.lts === 'string' ? v.lts : 'Yes') : false,
                                date: v.date
                            });

                            resolve({
                                success: true,
                                lts: lts.map(processVer),
                                current: current.map(processVer)
                            });
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });
        } catch (err) {
            return { error: err.message };
        }
    });

    // Install version
    ipcMain.handle('nvm-install', async (event, version) => {
        try {
            const dbManager = getDbManager();
            let nvmPath = 'nvm';
            if (dbManager) {
                const result = dbManager.query("SELECT cli_path FROM installed_apps WHERE app_id = 'nvm'");
                if (result && result.length > 0 && result[0].cli_path) {
                    nvmPath = result[0].cli_path;
                }
            }

            // This can take a while, send events?
            // For now, simple await. nvm install output is streamed to stdout
            // We can't easily stream it back with current runNvmCommand helper.
            // Just return success/fail.
            await runNvmCommand(`install ${version}`, nvmPath);
            return { success: true };
        } catch (err) {
            // Check if it's just "already installed" or true error
            if (err && err.message && err.message.includes('is already installed')) {
                return { success: true, message: 'Already installed' };
            }
            return { error: err.message || 'Install failed' };
        }
    });

    // Uninstall version
    ipcMain.handle('nvm-uninstall', async (event, version) => {
        try {
            const dbManager = getDbManager();
            let nvmPath = 'nvm';
            if (dbManager) {
                const result = dbManager.query("SELECT cli_path FROM installed_apps WHERE app_id = 'nvm'");
                if (result && result.length > 0 && result[0].cli_path) {
                    nvmPath = result[0].cli_path;
                }
            }

            await runNvmCommand(`uninstall ${version}`, nvmPath);
            return { success: true };
        } catch (err) {
            return { error: err.message };
        }
    });

    // Use version
    ipcMain.handle('nvm-use', async (event, version) => {
        try {
            const dbManager = getDbManager();
            let nvmPath = 'nvm';
            if (dbManager) {
                const result = dbManager.query("SELECT cli_path FROM installed_apps WHERE app_id = 'nvm'");
                if (result && result.length > 0 && result[0].cli_path) {
                    nvmPath = result[0].cli_path;
                }
            }

            // 'nvm use' requires Admin on Windows usually.
            // The app should be run as Admin for this to work reliably if not using NVM for Windows >= 1.1.8 with developer mode enabled (?)
            const output = await runNvmCommand(`use ${version}`, nvmPath);
            if (output.includes('Now using')) {
                return { success: true };
            } else {
                // Often 'exit status 1' or 'Access is denied'
                return { error: output || 'Failed to switch version' };
            }
        } catch (err) {
            return { error: err.message || err.toString() };
        }
    });

    // ========== pyenv Management ==========

    // List installed Python versions (pyenv versions)
    ipcMain.handle('pyenv-list', async () => {
        try {
            const dbManager = getDbManager();
            const pyenvPath = findPyenvPath(dbManager);

            if (!pyenvPath) {
                return { error: 'pyenv is not installed or not found. Please install pyenv first.' };
            }

            // Get versions directory first - this is the most reliable source
            const pyenvBinDir = path.dirname(pyenvPath); // .../bin
            const pyenvRoot = path.dirname(pyenvBinDir); // .../pyenv-win
            const versionsDir = path.join(pyenvRoot, 'versions');

            let installedFromDir = [];
            if (fs.existsSync(versionsDir)) {
                const entries = fs.readdirSync(versionsDir);

                installedFromDir = entries.filter(dir => {
                    const fullPath = path.join(versionsDir, dir);
                    const isDir = fs.statSync(fullPath).isDirectory();
                    const matchesVersion = /^\d+\.\d+\.\d+$/.test(dir);
                    return isDir && matchesVersion;
                });
            } else {
                // Try to create it
                try {
                    fs.mkdirSync(versionsDir, { recursive: true });
                } catch (createErr) {
                    logApp(`Failed to create versions directory: ${createErr.message}`, 'ERROR');
                }
            }

            // Try running pyenv versions command (may not work if empty)
            let current = '';
            try {
                const output = await runPyenvCommand('versions', pyenvPath);

                if (output && output.trim()) {
                    const lines = output.split('\n');
                    lines.forEach(line => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return;

                        const isCurrent = trimmedLine.includes('*');
                        if (isCurrent) {
                            const versionMatch = trimmedLine.match(/(\d+\.\d+\.\d+)/);
                            if (versionMatch) {
                                current = versionMatch[1];
                            }
                        }
                    });
                }
            } catch (err) {
                // Ignore - use directory listing
            }

            // Use directory listing as the source of truth
            const installed = [...installedFromDir];

            return { success: true, installed, current };
        } catch (err) {
            return { error: err.message };
        }
    });

    // List available Python versions using pyenv install --list
    ipcMain.handle('pyenv-list-available', async () => {
        try {
            const dbManager = getDbManager();
            const pyenvPath = findPyenvPath(dbManager);

            if (!pyenvPath) {
                return { error: 'pyenv is not installed. Please install pyenv from App Store first.' };
            }

            // Run pyenv install --list to get available versions
            const output = await runPyenvCommand('install --list', pyenvPath);

            const lines = output.split('\n');
            const versions = [];

            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                // Match version patterns like: "3.12.1" or "  3.11.7"
                const versionMatch = trimmedLine.match(/^(\d+\.\d+\.\d+)$/);

                if (versionMatch) {
                    const version = versionMatch[1];
                    const parts = version.split('.');
                    const major = parseInt(parts[0]);
                    const minor = parseInt(parts[1]);

                    // Only include Python 3.9+
                    if (major === 3 && minor >= 9) {
                        versions.push({
                            version: version,
                            date: '',
                            isPreRelease: false
                        });
                    }
                }
            });

            // Sort by version descending
            versions.sort((a, b) => {
                const partsA = a.version.split('.').map(Number);
                const partsB = b.version.split('.').map(Number);

                for (let i = 0; i < 3; i++) {
                    if (partsB[i] !== partsA[i]) return partsB[i] - partsA[i];
                }
                return 0;
            });

            // Limit to 50 most recent versions
            const limitedVersions = versions.slice(0, 50);


            return {
                success: true,
                versions: limitedVersions
            };
        } catch (err) {
            logApp(`Failed to get available versions: ${err.message}`, 'ERROR');
            return { error: err.message };
        }
    });

    // Install Python version
    ipcMain.handle('pyenv-install', async (event, version) => {
        try {
            const dbManager = getDbManager();
            const pyenvPath = findPyenvPath(dbManager);

            if (!pyenvPath) {
                return { error: 'pyenv is not installed. Please install pyenv from App Store first.' };
            }

            // Verify pyenv is working
            try {
                await runPyenvCommand('--version', pyenvPath);
            } catch (versionErr) {
                return { error: `pyenv is not working properly: ${versionErr.message}` };
            }

            // Install Python version
            try {
                await runPyenvCommand(`install ${version}`, pyenvPath);
            } catch (installErr) {
                // Check if already installed
                if (installErr.message && installErr.message.includes('already installed')) {
                    return { success: true, message: 'Already installed' };
                }
                return { error: `Failed to install Python ${version}: ${installErr.message}` };
            }

            // Run rehash to update shims
            try {
                await runPyenvCommand('rehash', pyenvPath);
            } catch (rehashErr) {
                // Ignore rehash errors
            }

            // Verify installation
            const pyenvBinDir = path.dirname(pyenvPath);
            const pyenvRoot = path.dirname(pyenvBinDir);
            const versionsDir = path.join(pyenvRoot, 'versions');
            const pythonInstallDir = path.join(versionsDir, version);

            if (fs.existsSync(versionsDir)) {
                const versionDirs = fs.readdirSync(versionsDir);

                if (!fs.existsSync(pythonInstallDir)) {
                    logApp(`WARNING: Python ${version} directory not found at: ${pythonInstallDir}`, 'WARNING');
                } else {
                    const pythonExe = path.join(pythonInstallDir, 'python.exe');
                    if (!fs.existsSync(pythonExe)) {
                        logApp(`WARNING: python.exe not found at: ${pythonExe}`, 'WARNING');
                    }
                }
            } else {
                return { error: `Installation may have failed - versions directory not found` };
            }

            return { success: true };
        } catch (err) {
            // Check if already installed
            if (err && err.message && err.message.includes('already installed')) {
                return { success: true, message: 'Already installed' };
            }
            return { error: err.message || 'Install failed' };
        }
    });

    // Uninstall Python version
    ipcMain.handle('pyenv-uninstall', async (event, version) => {
        try {
            const dbManager = getDbManager();
            const pyenvPath = findPyenvPath(dbManager);

            if (!pyenvPath) {
                return { error: 'pyenv is not installed.' };
            }

            // Use -f to force uninstall without confirmation
            await runPyenvCommand(`uninstall -f ${version}`, pyenvPath);
            return { success: true };
        } catch (err) {
            return { error: err.message };
        }
    });

    // Set global Python version
    ipcMain.handle('pyenv-global', async (event, version) => {
        try {
            const dbManager = getDbManager();
            const pyenvPath = findPyenvPath(dbManager);

            if (!pyenvPath) {
                return { error: 'pyenv is not installed.' };
            }

            const output = await runPyenvCommand(`global ${version}`, pyenvPath);
            // pyenv global doesn't output much on success, just check for errors
            if (output && output.toLowerCase().includes('error')) {
                return { error: output || 'Failed to set global version' };
            }

            return { success: true };
        } catch (err) {
            return { error: err.message || err.toString() };
        }
    });

    // Get PHP Info
    ipcMain.handle('apps-get-phpinfo', async (event, appId) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const installPath = app.install_path;

            // Try to find php-cgi.exe for HTML output, fallback to php.exe
            const phpCgiPath = path.join(installPath, 'php-cgi.exe');
            const phpPath = path.join(installPath, 'php.exe');

            let execCmd = '';
            let isHtml = false;

            if (fs.existsSync(phpCgiPath)) {
                execCmd = `"${phpCgiPath}" -i`;
                isHtml = true;
            } else if (fs.existsSync(phpPath)) {
                execCmd = `"${phpPath}" -i`;
                isHtml = false;
            } else {
                return { error: 'PHP executable not found' };
            }

            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec(execCmd, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Failed to run php info:', error);
                        resolve({ error: error.message });
                        return;
                    }
                    // php-cgi -i often outputs headers first (Content-type: text/html...)
                    // We should strip them to get just the HTML
                    let content = stdout;
                    if (isHtml) {
                        const headerEnd = content.indexOf('<!DOCTYPE');
                        if (headerEnd !== -1) {
                            content = content.substring(headerEnd);
                        } else {
                            // Fallback attempts if DOCTYPE isn't there (older PHP?)
                            const htmlStart = content.indexOf('<html');
                            if (htmlStart !== -1) {
                                content = content.substring(htmlStart);
                            }
                        }
                    }

                    resolve({ success: true, content, isHtml });
                });
            });

        } catch (error) {
            console.error('Failed to get php info:', error);
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

    // Get list of log files for an app
    ipcMain.handle('apps-get-logs', async (event, appId) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const installPath = app.install_path;

            // Find logs directory - could be in different locations depending on app
            const possibleLogDirs = [
                path.join(installPath, 'logs'),
                path.join(installPath, 'log'),
                path.join(path.dirname(app.exec_path), 'logs'),
                path.join(path.dirname(app.exec_path), 'log'),
                path.join(installPath, 'data')
            ];

            let logsPath = null;
            for (const dir of possibleLogDirs) {
                if (fs.existsSync(dir)) {
                    logsPath = dir;
                    break;
                }
            }

            if (!logsPath) {
                return { files: [], logsPath: null };
            }

            const entries = await fsPromises.readdir(logsPath);
            const logFiles = entries
                .filter(f => f.endsWith('.log') || f.endsWith('.err'))
                .map(f => ({
                    name: f,
                    path: path.join(logsPath, f)
                }));

            return { files: logFiles, logsPath };
        } catch (error) {
            console.error('Failed to get app logs:', error);
            return { error: error.message };
        }
    });

    // Read content of a specific log file
    ipcMain.handle('apps-read-log', async (event, appId, filename) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const installPath = app.install_path;

            // Security: ensure filename is just a filename
            const baseName = path.basename(filename);
            if (baseName !== filename) {
                return { error: 'Invalid filename' };
            }

            // Find the log file
            const possibleLogDirs = [
                path.join(installPath, 'logs'),
                path.join(installPath, 'log'),
                path.join(path.dirname(app.exec_path), 'logs'),
                path.join(path.dirname(app.exec_path), 'log'),
                path.join(installPath, 'data')
            ];

            let logFilePath = null;
            for (const dir of possibleLogDirs) {
                const candidate = path.join(dir, filename);
                if (fs.existsSync(candidate)) {
                    logFilePath = candidate;
                    break;
                }
            }

            if (!logFilePath) {
                return { content: '', error: null };
            }

            // Get file stats
            const stats = await fsPromises.stat(logFilePath);
            const maxSize = 500 * 1024; // 500KB max to avoid performance issues

            let content;
            if (stats.size > maxSize) {
                // Read only last 500KB
                const fd = await fsPromises.open(logFilePath, 'r');
                const buffer = Buffer.alloc(maxSize);
                await fd.read(buffer, 0, maxSize, stats.size - maxSize);
                await fd.close();
                content = '... (showing last 500KB) ...\n\n' + buffer.toString('utf-8');
            } else {
                content = await fsPromises.readFile(logFilePath, 'utf-8');
            }

            return { content, size: stats.size };
        } catch (error) {
            console.error('Failed to read app log:', error);
            return { error: error.message };
        }
    });

    // Clear a specific log file
    ipcMain.handle('apps-clear-log', async (event, appId, filename) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const installPath = app.install_path;

            // Security: ensure filename is just a filename
            const baseName = path.basename(filename);
            if (baseName !== filename) {
                return { error: 'Invalid filename' };
            }

            // Find the log file
            const possibleLogDirs = [
                path.join(installPath, 'logs'),
                path.join(installPath, 'log'),
                path.join(path.dirname(app.exec_path), 'logs'),
                path.join(path.dirname(app.exec_path), 'log'),
                path.join(installPath, 'data')
            ];

            let logFilePath = null;
            for (const dir of possibleLogDirs) {
                const candidate = path.join(dir, filename);
                if (fs.existsSync(candidate)) {
                    logFilePath = candidate;
                    break;
                }
            }

            if (!logFilePath) {
                return { success: true }; // File doesn't exist, consider it cleared
            }

            // Truncate file instead of deleting
            await fsPromises.writeFile(logFilePath, '', 'utf-8');
            logApp(`Cleared log file: ${logFilePath}`, 'LOGS');

            return { success: true };
        } catch (error) {
            console.error('Failed to clear app log:', error);
            return { error: error.message };
        }
    });

    // Update Default PHP Version and re-configure related apps (e.g. phpMyAdmin)
    ipcMain.handle('apps-update-default-php', async (event, version) => {
        const dbManager = getDbManager();
        if (!dbManager) return { error: 'Database not initialized' };

        try {
            // Update setting
            dbManager.query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['default_php_version', version]);
            logApp(`Default PHP version updated to ${version}`, 'CONFIG');

            // Re-configure phpMyAdmin
            await configurePhpMyAdmin(dbManager, context);

            return { success: true };
        } catch (err) {
            console.error('Failed to update default PHP version:', err);
            return { error: err.message };
        }
    });
}

// Export for use by other handlers
module.exports = { register, logApp };
