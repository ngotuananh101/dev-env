const { ipcRenderer } = require('electron');

module.exports = {
    getList: () => ipcRenderer.invoke('apps-get-list'),
    updateList: () => ipcRenderer.invoke('apps-update-list'),
    readIcon: (filename) => ipcRenderer.invoke('apps-read-icon', filename),
    getVersions: (appId) => ipcRenderer.invoke('apps-get-versions', appId),
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
    onServiceLog: (appId, callback) => {
        const handler = (event, data) => {
            // Only call callback if data is for this appId
            if (data.appId === appId) {
                callback(data);
            }
        };
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

    // NVM Management
    nvmList: () => ipcRenderer.invoke('nvm-list'),
    nvmListAvailable: () => ipcRenderer.invoke('nvm-list-available'),
    nvmInstall: (version) => ipcRenderer.invoke('nvm-install', version),
    nvmUninstall: (version) => ipcRenderer.invoke('nvm-uninstall', version),
    nvmUse: (version) => ipcRenderer.invoke('nvm-use', version),

    // pyenv Management
    pyenvList: () => ipcRenderer.invoke('pyenv-list'),
    pyenvListAvailable: () => ipcRenderer.invoke('pyenv-list-available'),
    pyenvInstall: (version) => ipcRenderer.invoke('pyenv-install', version),
    pyenvUninstall: (version) => ipcRenderer.invoke('pyenv-uninstall', version),
    pyenvGlobal: (version) => ipcRenderer.invoke('pyenv-global', version),

    updateDefaultPhp: (version) => ipcRenderer.invoke('apps-update-default-php', version),
};
