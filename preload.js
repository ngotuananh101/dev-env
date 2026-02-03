const { contextBridge, ipcRenderer } = require('electron');

const api = {
    getStats: () => ipcRenderer.invoke('get-sys-stats'),
    getIp: () => ipcRenderer.invoke('get-ip-address'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    quitApp: () => ipcRenderer.send('app-quit'),

    // Database
    db: {
        query: (sql, params) => ipcRenderer.invoke('db-query', sql, params)
    },

    // App Store
    apps: {
        getList: () => ipcRenderer.invoke('apps-get-list'),
        updateList: () => ipcRenderer.invoke('apps-update-list'),
        readIcon: (filename) => ipcRenderer.invoke('apps-read-icon', filename),
        install: (appId, version, downloadUrl, filename, execFile, group, defaultArgs, autostart, cliFile) => ipcRenderer.invoke('apps-install', appId, version, downloadUrl, filename, execFile, group, defaultArgs, autostart, cliFile),
        cancelInstall: (appId) => ipcRenderer.invoke('apps-cancel-install', appId),
        uninstall: (appId) => ipcRenderer.invoke('apps-uninstall', appId),
        onInstallProgress: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('app-install-progress', handler);
            return () => ipcRenderer.removeListener('app-install-progress', handler);
        },
        // Config management (uses installPath, not appId)
        readConfig: (installPath, configPath) => ipcRenderer.invoke('app-read-config', installPath, configPath),
        saveConfig: (installPath, configPath, content) => ipcRenderer.invoke('app-save-config', installPath, configPath, content),
        restoreConfig: (installPath, configPath) => ipcRenderer.invoke('app-restore-config', installPath, configPath),
        // Service management
        startService: (appId, execPath, args) => ipcRenderer.invoke('app-service-start', appId, execPath, args),
        stopService: (appId, execPath, stopArgs) => ipcRenderer.invoke('app-service-stop', appId, execPath, stopArgs),
        restartService: (appId, execPath, startArgs, stopArgs) => ipcRenderer.invoke('app-service-restart', appId, execPath, startArgs, stopArgs),
        getServiceStatus: (appId, execPath) => ipcRenderer.invoke('app-service-status', appId, execPath),
        // Service logs
        getServiceLogs: (appId) => ipcRenderer.invoke('app-service-get-logs', appId),
        clearServiceLogs: (appId) => ipcRenderer.invoke('app-service-clear-logs', appId),
        onServiceLog: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('service-log', handler);
            return () => ipcRenderer.removeListener('service-log', handler);
        },

        // Extension management
        getExtensions: (appId) => ipcRenderer.invoke('apps-get-extensions', appId),
        toggleExtension: (appId, extension, enable) => ipcRenderer.invoke('apps-toggle-extension', appId, extension, enable),
        getPhpInfo: (appId) => ipcRenderer.invoke('apps-get-phpinfo', appId),
        // App logs management
        getAppLogs: (appId) => ipcRenderer.invoke('apps-get-logs', appId),
        readAppLog: (appId, filename) => ipcRenderer.invoke('apps-read-log', appId, filename),
        clearAppLog: (appId, filename) => ipcRenderer.invoke('apps-clear-log', appId, filename),
    },

    // Database Management
    database: {
        listDatabases: (appId) => ipcRenderer.invoke('db-list-databases', appId),
        createDatabase: (appId, dbName, username, password) => ipcRenderer.invoke('db-create-database', appId, dbName, username, password),
        dropDatabase: (appId, dbName) => ipcRenderer.invoke('db-drop-database', appId, dbName),
        listUsers: (appId) => ipcRenderer.invoke('db-list-users', appId),
        changePassword: (appId, username, newPassword, host) => ipcRenderer.invoke('db-change-password', appId, username, newPassword, host),
    },

    // File System
    files: {
        list: (path) => ipcRenderer.invoke('fs-list-dir', path),
        getDrives: () => ipcRenderer.invoke('fs-get-drives'),
        openFile: (path) => ipcRenderer.invoke('fs-open-file', path),
        download: (params) => ipcRenderer.send('fs-download-file', params),
        cancelDownload: () => ipcRenderer.send('fs-cancel-download'),
        createDir: (params) => ipcRenderer.invoke('fs-create-dir', params),
        deletePath: (path) => ipcRenderer.invoke('fs-delete-path', path),
        renamePath: (params) => ipcRenderer.invoke('fs-rename-path', params),
        selectFolder: () => ipcRenderer.invoke('fs-select-folder'),
        onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (e, v) => cb(v)),
        onDownloadComplete: (cb) => ipcRenderer.on('download-complete', (e, v) => cb(v)),
        onDownloadError: (cb) => ipcRenderer.on('download-error', (e, v) => cb(v)),
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('download-progress');
            ipcRenderer.removeAllListeners('download-complete');
            ipcRenderer.removeAllListeners('download-error');
        },
        // System PATH management
        checkPath: (targetPath) => ipcRenderer.invoke('path-check', targetPath),
        addToPath: (targetPath) => ipcRenderer.invoke('path-add', targetPath),
        removeFromPath: (targetPath) => ipcRenderer.invoke('path-remove', targetPath)
    },

    // Terminal
    initTerminal: (options) => ipcRenderer.send('terminal-init', options),
    writeTerminal: (data) => ipcRenderer.send('terminal-input', data),
    resizeTerminal: (dims) => ipcRenderer.send('terminal-resize', dims),
    onTerminalData: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('terminal-data', handler);
        return () => ipcRenderer.removeListener('terminal-data', handler);
    },

    // Logs
    logs: {
        read: (date) => ipcRenderer.invoke('logs-read', date),
        clear: (date) => ipcRenderer.invoke('logs-clear', date),
        list: () => ipcRenderer.invoke('logs-list'),
        readFile: (filename) => ipcRenderer.invoke('logs-read-file', filename),
        clearFile: (filename) => ipcRenderer.invoke('logs-clear-file', filename)
    },

    // Hosts file management
    hosts: {
        read: () => ipcRenderer.invoke('hosts-read'),
        write: (content) => ipcRenderer.invoke('hosts-write', content)
    },

    // Sites/Projects management
    sites: {
        list: () => ipcRenderer.invoke('sites-list'),
        create: (siteData) => ipcRenderer.invoke('sites-create', siteData),
        delete: (siteId) => ipcRenderer.invoke('sites-delete', siteId),
        startNode: (siteId) => ipcRenderer.invoke('sites-start-node', siteId),
        stopNode: (siteId) => ipcRenderer.invoke('sites-stop-node', siteId),
        getConfig: (siteId) => ipcRenderer.invoke('sites-get-config', siteId),
        saveConfig: (siteId, content) => ipcRenderer.invoke('sites-save-config', siteId, content),

        // Server root management
        updateApacheRoot: (newPath) => ipcRenderer.invoke('sites-update-apache-root', newPath),
        updateNginxRoot: (newPath) => ipcRenderer.invoke('sites-update-nginx-root', newPath),

        // PHP Version Management
        getPhpVersions: () => ipcRenderer.invoke('sites-get-php-versions'),
        updatePhpVersion: (siteId, version) => ipcRenderer.invoke('sites-update-php', siteId, version),

        // Rewrite Templates
        getRewriteTemplates: () => ipcRenderer.invoke('sites-get-rewrite-templates'),
        updateRewrite: (siteId, templateName, onlyDb = false) => ipcRenderer.invoke('sites-update-rewrite', siteId, templateName, onlyDb),
        getTemplateContent: (templateName) => ipcRenderer.invoke('sites-get-template-content', templateName),

        getWebserver: () => ipcRenderer.invoke('sites-get-webserver'),
        openBrowser: (domain) => ipcRenderer.invoke('sites-open-browser', domain),

        // Template update
        updateTemplate: (oldTemplate, newTemplate) => ipcRenderer.invoke('sites-update-template', oldTemplate, newTemplate)
    },

    // SSL Certificate Management
    ssl: {
        getStatus: () => ipcRenderer.invoke('ssl-get-status'),
        generateCert: (domain) => ipcRenderer.invoke('ssl-generate-cert', domain),
        listCerts: () => ipcRenderer.invoke('ssl-list-certs'),
        deleteCert: (domain) => ipcRenderer.invoke('ssl-delete-cert', domain),
        installCA: () => ipcRenderer.invoke('ssl-install-ca')
    }
};

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('sysapi', api);
    } catch (e) {
        console.error("Failed to expose sysapi via contextBridge:", e);
    }
} else {
    window.sysapi = api;
}

window.addEventListener('DOMContentLoaded', () => {
    // Legacy support if needed
});
