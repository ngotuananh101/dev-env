const { ipcRenderer } = require('electron');

module.exports = {
    read: (date) => ipcRenderer.invoke('logs-read', date),
    clear: (date) => ipcRenderer.invoke('logs-clear', date),
    list: () => ipcRenderer.invoke('logs-list'),
    readFile: (filename) => ipcRenderer.invoke('logs-read-file', filename),
    clearFile: (filename) => ipcRenderer.invoke('logs-clear-file', filename)
};
