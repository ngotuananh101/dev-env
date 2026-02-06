const { contextBridge, ipcRenderer } = require('electron');

const db = require('./db');
const apps = require('./apps');
const files = require('./files');
const sites = require('./sites');
const hosts = require('./hosts');
const ssl = require('./ssl');
const logs = require('./logs');

const api = {
    getStats: () => ipcRenderer.invoke('get-sys-stats'),
    getIp: () => ipcRenderer.invoke('get-ip-address'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    quitApp: () => ipcRenderer.send('app-quit'),

    // Modules
    db: { ...db, query: db.query }, // Ensure query is available both in db namespace and generally if needed, but here it matches usage
    database: db, // Aliasing database to db module methods (as in original: db.query was separate, database.listDatabases was separate namespace but let's check)

    apps,
    files,
    sites,
    hosts,
    ssl,
    logs,

    // Terminal (top-level)
    initTerminal: (options) => ipcRenderer.send('terminal-init', options),
    writeTerminal: (data) => ipcRenderer.send('terminal-input', data),
    resizeTerminal: (dims) => ipcRenderer.send('terminal-resize', dims),
    onTerminalData: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('terminal-data', handler);
        return () => ipcRenderer.removeListener('terminal-data', handler);
    },
};

// Check original structure for 'db' vs 'database'
// Original: 
// db: { query: ... }
// database: { listDatabases: ... }
// My db.js has both.
// So:
api.db = { query: db.query };
api.database = {
    listDatabases: db.listDatabases,
    createDatabase: db.createDatabase,
    dropDatabase: db.dropDatabase,
    listUsers: db.listUsers,
    changePassword: db.changePassword
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
