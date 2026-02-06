const { ipcRenderer } = require('electron');

module.exports = {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),

    // Database Management
    listDatabases: (appId) => ipcRenderer.invoke('db-list-databases', appId),
    createDatabase: (appId, dbName, username, password) => ipcRenderer.invoke('db-create-database', appId, dbName, username, password),
    dropDatabase: (appId, dbName) => ipcRenderer.invoke('db-drop-database', appId, dbName),
    listUsers: (appId) => ipcRenderer.invoke('db-list-users', appId),
    changePassword: (appId, username, newPassword, host) => ipcRenderer.invoke('db-change-password', appId, username, newPassword, host),
};
