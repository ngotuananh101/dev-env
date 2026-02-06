const { ipcRenderer } = require('electron');

module.exports = {
    list: (path) => ipcRenderer.invoke('fs-list-dir', path),
    getDrives: () => ipcRenderer.invoke('fs-get-drives'),
    openFile: (path) => ipcRenderer.invoke('fs-open-file', path),
    download: (params) => ipcRenderer.send('fs-download-file', params),
    cancelDownload: () => ipcRenderer.send('fs-cancel-download'),
    createDir: (params) => ipcRenderer.invoke('fs-create-dir', params),
    deletePath: (path) => ipcRenderer.invoke('fs-delete-path', path),
    renamePath: (params) => ipcRenderer.invoke('fs-rename-path', params),
    selectFolder: () => ipcRenderer.invoke('fs-select-folder'),
    findFile: (dirPath, targetFileName) => ipcRenderer.invoke('fs-find-file', { dirPath, targetFileName }),
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
};
