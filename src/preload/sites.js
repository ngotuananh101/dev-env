const { ipcRenderer } = require('electron');

module.exports = {
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
};
