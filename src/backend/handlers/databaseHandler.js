/**
 * Database Handler - IPC handlers for database management operations
 * Handles: List databases, create/drop database, list users, change passwords
 * Supports: MySQL, MariaDB, PostgreSQL
 */

const { execSync, exec } = require('child_process');
const path = require('path');

/**
 * Execute a database CLI command
 * @param {string} command - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, error: string}>}
 */
function execCommand(command, options = {}) {
    return new Promise((resolve) => {
        exec(command, { ...options, encoding: 'utf-8', timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ error: error.message, stderr });
            } else {
                resolve({ stdout: stdout || '', stderr });
            }
        });
    });
}

/**
 * Get database type from appId
 * @param {string} appId
 * @returns {'mysql'|'postgresql'|null}
 */
function getDbType(appId) {
    if (appId === 'mysql' || appId === 'mariadb') return 'mysql';
    if (appId === 'postgresql') return 'postgresql';
    return null;
}

/**
 * Get CLI executable path for database
 * @param {string} appId
 * @param {string} installPath
 * @returns {Object} { client, psql }
 */
function getDbCliPaths(appId, installPath) {
    if (appId === 'mysql') {
        return {
            client: path.join(installPath, 'bin', 'mysql.exe')
        };
    } else if (appId === 'mariadb') {
        return {
            client: path.join(installPath, 'bin', 'mariadb.exe')
        };
    } else if (appId === 'postgresql') {
        return {
            client: path.join(installPath, 'bin', 'psql.exe')
        };
    }
    return {};
}

/**
 * Register database-related IPC handlers
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} context
 */
function register(ipcMain, context) {
    const { getDbManager } = context;

    // List databases
    ipcMain.handle('db-list-databases', async (event, appId) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const dbType = getDbType(appId);
            const cliPaths = getDbCliPaths(appId, app.install_path);

            if (dbType === 'mysql') {
                const result = await execCommand(
                    `"${cliPaths.client}" -u root -e "SHOW DATABASES"`,
                    { cwd: path.dirname(cliPaths.client) }
                );

                if (result.error) {
                    return { error: result.error };
                }

                const databases = result.stdout
                    .split('\n')
                    .slice(1) // Skip header
                    .map(line => line.trim())
                    .filter(line => line && !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(line));

                return { databases };
            } else if (dbType === 'postgresql') {
                const dataDir = path.join(app.install_path, 'data');
                const result = await execCommand(
                    `"${cliPaths.client}" -U postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false"`,
                    { cwd: path.dirname(cliPaths.client), env: { ...process.env, PGDATA: dataDir } }
                );

                if (result.error) {
                    return { error: result.error };
                }

                const databases = result.stdout
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line !== 'postgres');

                return { databases };
            }

            return { error: 'Unsupported database type' };
        } catch (error) {
            console.error('Failed to list databases:', error);
            return { error: error.message };
        }
    });

    // Create database
    ipcMain.handle('db-create-database', async (event, appId, dbName) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            // Validate database name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
                return { error: 'Invalid database name. Use only letters, numbers, and underscores.' };
            }

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const dbType = getDbType(appId);
            const cliPaths = getDbCliPaths(appId, app.install_path);

            if (dbType === 'mysql') {
                const result = await execCommand(
                    `"${cliPaths.client}" -u root -e "CREATE DATABASE \`${dbName}\`"`,
                    { cwd: path.dirname(cliPaths.client) }
                );

                if (result.error) {
                    return { error: result.error };
                }
                return { success: true };
            } else if (dbType === 'postgresql') {
                const dataDir = path.join(app.install_path, 'data');
                const result = await execCommand(
                    `"${cliPaths.client}" -U postgres -c "CREATE DATABASE ${dbName}"`,
                    { cwd: path.dirname(cliPaths.client), env: { ...process.env, PGDATA: dataDir } }
                );

                if (result.error) {
                    return { error: result.error };
                }
                return { success: true };
            }

            return { error: 'Unsupported database type' };
        } catch (error) {
            console.error('Failed to create database:', error);
            return { error: error.message };
        }
    });

    // Drop database
    ipcMain.handle('db-drop-database', async (event, appId, dbName) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const dbType = getDbType(appId);
            const cliPaths = getDbCliPaths(appId, app.install_path);

            if (dbType === 'mysql') {
                const result = await execCommand(
                    `"${cliPaths.client}" -u root -e "DROP DATABASE \`${dbName}\`"`,
                    { cwd: path.dirname(cliPaths.client) }
                );

                if (result.error) {
                    return { error: result.error };
                }
                return { success: true };
            } else if (dbType === 'postgresql') {
                const dataDir = path.join(app.install_path, 'data');
                const result = await execCommand(
                    `"${cliPaths.client}" -U postgres -c "DROP DATABASE ${dbName}"`,
                    { cwd: path.dirname(cliPaths.client), env: { ...process.env, PGDATA: dataDir } }
                );

                if (result.error) {
                    return { error: result.error };
                }
                return { success: true };
            }

            return { error: 'Unsupported database type' };
        } catch (error) {
            console.error('Failed to drop database:', error);
            return { error: error.message };
        }
    });

    // List users
    ipcMain.handle('db-list-users', async (event, appId) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const dbType = getDbType(appId);
            const cliPaths = getDbCliPaths(appId, app.install_path);

            if (dbType === 'mysql') {
                const result = await execCommand(
                    `"${cliPaths.client}" -u root -e "SELECT User, Host FROM mysql.user"`,
                    { cwd: path.dirname(cliPaths.client) }
                );

                if (result.error) {
                    return { error: result.error };
                }

                const users = result.stdout
                    .split('\n')
                    .slice(1) // Skip header
                    .map(line => {
                        const [user, host] = line.split('\t').map(s => s?.trim());
                        return user && host ? { user, host } : null;
                    })
                    .filter(Boolean);

                return { users };
            } else if (dbType === 'postgresql') {
                const dataDir = path.join(app.install_path, 'data');
                const result = await execCommand(
                    `"${cliPaths.client}" -U postgres -t -c "SELECT usename FROM pg_user"`,
                    { cwd: path.dirname(cliPaths.client), env: { ...process.env, PGDATA: dataDir } }
                );

                if (result.error) {
                    return { error: result.error };
                }

                const users = result.stdout
                    .split('\n')
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(user => ({ user, host: 'local' }));

                return { users };
            }

            return { error: 'Unsupported database type' };
        } catch (error) {
            console.error('Failed to list users:', error);
            return { error: error.message };
        }
    });

    // Change user password
    ipcMain.handle('db-change-password', async (event, appId, username, newPassword, host = 'localhost') => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const dbType = getDbType(appId);
            const cliPaths = getDbCliPaths(appId, app.install_path);

            if (dbType === 'mysql') {
                const result = await execCommand(
                    `"${cliPaths.client}" -u root -e "ALTER USER '${username}'@'${host}' IDENTIFIED BY '${newPassword}'"`,
                    { cwd: path.dirname(cliPaths.client) }
                );

                if (result.error) {
                    return { error: result.error };
                }
                return { success: true };
            } else if (dbType === 'postgresql') {
                const dataDir = path.join(app.install_path, 'data');
                const result = await execCommand(
                    `"${cliPaths.client}" -U postgres -c "ALTER USER ${username} WITH PASSWORD '${newPassword}'"`,
                    { cwd: path.dirname(cliPaths.client), env: { ...process.env, PGDATA: dataDir } }
                );

                if (result.error) {
                    return { error: result.error };
                }
                return { success: true };
            }

            return { error: 'Unsupported database type' };
        } catch (error) {
            console.error('Failed to change password:', error);
            return { error: error.message };
        }
    });
}

module.exports = { register };
