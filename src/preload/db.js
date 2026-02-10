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

    // Meilisearch Management
    meilisearch: {
        health: () => ipcRenderer.invoke('meilisearch-health'),
        getStats: () => ipcRenderer.invoke('meilisearch-get-stats'),
        listIndexes: () => ipcRenderer.invoke('meilisearch-list-indexes'),
        createIndex: (uid, primaryKey) => ipcRenderer.invoke('meilisearch-create-index', uid, primaryKey),
        deleteIndex: (uid) => ipcRenderer.invoke('meilisearch-delete-index', uid),
        getDocuments: (uid, options) => ipcRenderer.invoke('meilisearch-get-documents', uid, options),
        addDocuments: (uid, documents) => ipcRenderer.invoke('meilisearch-add-documents', uid, documents),
        deleteDocument: (uid, docId) => ipcRenderer.invoke('meilisearch-delete-document', uid, docId),
        deleteAllDocuments: (uid) => ipcRenderer.invoke('meilisearch-delete-all-documents', uid),
        search: (uid, query, options) => ipcRenderer.invoke('meilisearch-search', uid, query, options),
        getSettings: (uid) => ipcRenderer.invoke('meilisearch-get-settings', uid),
        updateSettings: (uid, settings) => ipcRenderer.invoke('meilisearch-update-settings', uid, settings),
        getKeys: () => ipcRenderer.invoke('meilisearch-get-keys'),
        createKey: (keyData) => ipcRenderer.invoke('meilisearch-create-key', keyData),
        deleteKey: (key) => ipcRenderer.invoke('meilisearch-delete-key', key),
        getTasks: (options) => ipcRenderer.invoke('meilisearch-get-tasks', options),
    },
};
