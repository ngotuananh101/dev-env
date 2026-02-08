const { ipcRenderer } = require('electron');

module.exports = {
    getStatus: () => ipcRenderer.invoke('ssl-get-status'),
    generateCert: (domain) => ipcRenderer.invoke('ssl-generate-cert', domain),
    listCerts: () => ipcRenderer.invoke('ssl-list-certs'),
    deleteCert: (domain) => ipcRenderer.invoke('ssl-delete-cert', domain),
    installCA: () => ipcRenderer.invoke('ssl-install-ca'),
    uninstallCA: () => ipcRenderer.invoke('ssl-uninstall-ca')
};
