const { contextBridge, ipcRenderer } = require('electron');

const api = {
    getStats: () => ipcRenderer.invoke('get-sys-stats'),
    getIp: () => ipcRenderer.invoke('get-ip-address'),
    quitApp: () => ipcRenderer.send('app-quit'),

    // Database
    db: {
        query: (sql, params) => ipcRenderer.invoke('db-query', sql, params)
    },

    // App Store
    apps: {
        getList: () => ipcRenderer.invoke('apps-get-list'),
        updateList: () => ipcRenderer.invoke('apps-update-list'),
        install: (appId, version, downloadUrl, filename, execFile, group) => ipcRenderer.invoke('apps-install', appId, version, downloadUrl, filename, execFile, group),
        cancelInstall: (appId) => ipcRenderer.invoke('apps-cancel-install', appId),
        uninstall: (appId) => ipcRenderer.invoke('apps-uninstall', appId),
        setArgs: (appId, args) => ipcRenderer.invoke('apps-set-args', appId, args),
        setDashboard: (appId, show) => ipcRenderer.invoke('apps-set-dashboard', appId, show),
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
        getServiceStatus: (appId, execPath) => ipcRenderer.invoke('app-service-status', appId, execPath)
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
        list: () => ipcRenderer.invoke('logs-list')
    },

    // Hosts file management
    hosts: {
        read: () => ipcRenderer.invoke('hosts-read'),
        write: (content) => ipcRenderer.invoke('hosts-write', content),
        backup: () => ipcRenderer.invoke('hosts-backup')
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
        updateRoot: (siteId, newPath) => ipcRenderer.invoke('sites-update-root', siteId, newPath),

        // Server root management
        getServerRoot: (webserverType) => ipcRenderer.invoke('sites-get-server-root', webserverType),
        updateServerRoot: (webserverType, newPath) => ipcRenderer.invoke('sites-update-server-root', webserverType, newPath),

        getWebserver: () => ipcRenderer.invoke('sites-get-webserver'),
        openBrowser: (domain) => ipcRenderer.invoke('sites-open-browser', domain)
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
