const { ipcRenderer } = require('electron');

module.exports = {
    read: () => ipcRenderer.invoke('hosts-read'),
    write: (content) => ipcRenderer.invoke('hosts-write', content)
};
