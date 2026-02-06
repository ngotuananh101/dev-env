const { ipcRenderer } = require('electron');

module.exports = {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),

    // Database Management
    listDatabases: (appId) => ipcRenderer.invoke('db-list-databases', appId),
    createDatabase: (appId, dbName, username, password) => ipcRenderer.invoke('db-create-database', appId, dbName, username, password),
    dropDatabase: (appId, dbName) => ipcRenderer.invoke('db-drop-database', appId, dbName),
    listUsers: (appId) => ipcRenderer.invoke('db-list-users', appId),
    changePassword: (appId, username, newPassword, host) => ipcRenderer.invoke('db-change-password', appId, username, newPassword, host),

    // Redis Management
    redis: {
        getInfo: () => ipcRenderer.invoke('redis-info'),
        getKeys: (dbIndex, pattern, cursor, count) => ipcRenderer.invoke('redis-get-keys', dbIndex, pattern, cursor, count),
        getKeyInfo: (dbIndex, key) => ipcRenderer.invoke('redis-get-key-info', dbIndex, key),
        setKey: (dbIndex, key, value, ttl, dataType) => ipcRenderer.invoke('redis-set-key', dbIndex, key, value, ttl, dataType),
        deleteKey: (dbIndex, key) => ipcRenderer.invoke('redis-delete-key', dbIndex, key),
        deleteKeys: (dbIndex, keys) => ipcRenderer.invoke('redis-delete-keys', dbIndex, keys),
        flushDb: (dbIndex) => ipcRenderer.invoke('redis-flush-db', dbIndex),
    },
};
