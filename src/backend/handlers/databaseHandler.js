/**
 * Database Handler - IPC handlers for database management operations
 * Handles: List databases, create/drop database, list users, change passwords
 * Supports: MySQL, MariaDB, PostgreSQL, Redis
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute a database CLI command
 * @param {string} command - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, error: string}>}
 */
function execCommand(command, options = {}) {
    return new Promise((resolve) => {


        // Use spawn with shell option for better Windows compatibility
        const proc = spawn(command, [], {
            cwd: options.cwd,
            env: options.env || process.env,
            shell: true,
            windowsHide: true,
            timeout: 30000
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('error', (err) => {
            console.error('[DB Handler] Process error:', err.message);
            resolve({ error: err.message, stderr });
        });

        proc.on('close', (code) => {
            if (code !== 0 && stderr) {
                resolve({ error: stderr || `Process exited with code ${code}`, stderr });
            } else {
                resolve({ stdout, stderr });
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
 * @param {string} execPath - exec_path from installed_apps table
 * @returns {Object} { client }
 */
function getDbCliPaths(appId, execPath) {


    // Get bin directory from exec_path
    const binDir = path.dirname(execPath);


    let result = {};
    if (appId === 'mysql') {
        result = { client: path.join(binDir, 'mysql.exe') };
    } else if (appId === 'mariadb') {
        result = { client: path.join(binDir, 'mariadb.exe') };
    } else if (appId === 'postgresql') {
        result = { client: path.join(binDir, 'psql.exe') };
    } else if (appId === 'redis') {
        result = { client: path.join(binDir, 'redis-cli.exe') };
    }


    return result;
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
            const cliPaths = getDbCliPaths(appId, app.exec_path);

            if (dbType === 'mysql' || dbType === 'mariadb') {
                const result = await execCommand(
                    `"${cliPaths.client}" -u root -e "SHOW DATABASES"`,
                    { cwd: path.dirname(cliPaths.client) }
                );

                if (result.error) {
                    return { error: result.error };
                }

                const realDbs = result.stdout
                    .split('\n')
                    .slice(1) // Skip header
                    .map(line => line.trim())
                    .filter(line => line && !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(line));

                // Get saved credentials
                const savedCreds = dbManager.query('SELECT * FROM created_databases WHERE app_id = ?', [appId]);
                const credMap = new Map();
                if (savedCreds && Array.isArray(savedCreds)) {
                    savedCreds.forEach(c => credMap.set(c.db_name, c));
                }

                const databases = realDbs.map(dbName => {
                    const info = credMap.get(dbName);
                    return {
                        name: dbName,
                        username: info ? info.username : '',
                        password: info ? info.password : '',
                        host: info ? info.host : 'localhost'
                    };
                });

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

                const realDbs = result.stdout
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line !== 'postgres');

                // Get saved credentials
                const savedCreds = dbManager.query('SELECT * FROM created_databases WHERE app_id = ?', [appId]);
                const credMap = new Map();
                if (savedCreds && Array.isArray(savedCreds)) {
                    savedCreds.forEach(c => credMap.set(c.db_name, c));
                }

                const databases = realDbs.map(dbName => {
                    const info = credMap.get(dbName);
                    return {
                        name: dbName,
                        username: info ? info.username : '',
                        password: info ? info.password : '',
                        host: info ? info.host : 'localhost'
                    };
                });

                return { databases };
            }

            return { error: 'Unsupported database type' };
        } catch (error) {
            console.error('Failed to list databases:', error);
            return { error: error.message };
        }
    });

    // Create database
    ipcMain.handle('db-create-database', async (event, appId, dbName, username, password) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            // Validate database name (allow alphanumeric, underscore, and hyphen)
            if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(dbName)) {
                return { error: 'Invalid database name. Use letters, numbers, underscores, and hyphens.' };
            }

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
            if (!apps || apps.length === 0) return { error: 'App not found' };

            const app = apps[0];
            const dbType = getDbType(appId);
            const cliPaths = getDbCliPaths(appId, app.exec_path);

            if (dbType === 'mysql') {
                // 1. Create Database
                let result = await execCommand(
                    `"${cliPaths.client}" -u root -e "CREATE DATABASE \`${dbName}\`"`,
                    { cwd: path.dirname(cliPaths.client) }
                );
                if (result.error) return { error: result.error };

                // 2. Create User & Grant Privileges (if provided)
                if (username && password) {
                    try {
                        const commands = [
                            `CREATE USER '${username}'@'localhost' IDENTIFIED BY '${password}'`,
                            `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${username}'@'localhost'`,
                            `FLUSH PRIVILEGES`
                        ];

                        for (const cmd of commands) {
                            const userResult = await execCommand(
                                `"${cliPaths.client}" -u root -e "${cmd}"`,
                                { cwd: path.dirname(cliPaths.client) }
                            );
                            if (userResult.error && !userResult.error.includes('Operation CREATE USER failed')) {
                                console.warn('User creation warning:', userResult.error);
                            }
                        }
                    } catch (uErr) {
                        console.error('Failed to create user:', uErr);
                        // Continue even if user creation fails? Or return error?
                        // Let's create DB at least.
                    }
                }
            } else if (dbType === 'postgresql') {
                const dataDir = path.join(app.install_path, 'data');
                const env = { ...process.env, PGDATA: dataDir };

                // 1. Create Database
                let result = await execCommand(
                    `"${cliPaths.client}" -U postgres -c "CREATE DATABASE \\"${dbName}\\""`,
                    { cwd: path.dirname(cliPaths.client), env }
                );
                if (result.error) return { error: result.error };

                // 2. Create User & Grant Privileges (if provided)
                if (username && password) {
                    try {
                        // Postgres: Create User
                        await execCommand(
                            `"${cliPaths.client}" -U postgres -c "CREATE USER \\"${username}\\" WITH PASSWORD '${password}'"`,
                            { cwd: path.dirname(cliPaths.client), env }
                        );

                        // Postgres: Grant Privileges
                        await execCommand(
                            `"${cliPaths.client}" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE \\"${dbName}\\" TO \\"${username}\\""`,
                            { cwd: path.dirname(cliPaths.client), env }
                        );
                        // Grant schema usage? usually public is accessible.
                    } catch (uErr) {
                        console.error('Failed to create user:', uErr);
                    }
                }
            } else {
                return { error: 'Unsupported database type' };
            }

            // Save to internal DB
            dbManager.query(
                `INSERT INTO created_databases (app_id, db_name, username, password, created_at) VALUES (?, ?, ?, ?, ?)`,
                [appId, dbName, username || null, password || null, new Date().toISOString()]
            );

            return { success: true };

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
            const cliPaths = getDbCliPaths(appId, app.exec_path);

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
                    `"${cliPaths.client}" -U postgres -c "DROP DATABASE \\"${dbName}\\""`,
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
            const cliPaths = getDbCliPaths(appId, app.exec_path);

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
            const cliPaths = getDbCliPaths(appId, app.exec_path);

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

    // =====================
    // Redis Handlers
    // =====================

    // Get Redis info (server stats, db sizes)
    ipcMain.handle('redis-info', async (event) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);

            const result = await execCommand(
                `"${cliPaths.client}" INFO`,
                { cwd: path.dirname(cliPaths.client) }
            );

            if (result.error) {
                return { error: result.error };
            }

            // Parse INFO output to get db sizes
            const dbSizes = {};
            const lines = result.stdout.split('\n');
            for (const line of lines) {
                const match = line.match(/^db(\d+):keys=(\d+)/);
                if (match) {
                    dbSizes[parseInt(match[1])] = parseInt(match[2]);
                }
            }

            return { info: result.stdout, dbSizes };
        } catch (error) {
            console.error('Failed to get Redis info:', error);
            return { error: error.message };
        }
    });

    // Get keys from a specific Redis database
    ipcMain.handle('redis-get-keys', async (event, dbIndex = 0, pattern = '*', cursor = 0, count = 100) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);

            // Use SCAN for pagination
            const result = await execCommand(
                `"${cliPaths.client}" -n ${dbIndex} SCAN ${cursor} MATCH "${pattern}" COUNT ${count}`,
                { cwd: path.dirname(cliPaths.client) }
            );

            if (result.error) {
                return { error: result.error };
            }

            // Parse SCAN output: first line is next cursor, rest are keys
            const lines = result.stdout.trim().split('\n').filter(l => l.trim());
            const nextCursor = parseInt(lines[0]) || 0;
            const keys = lines.slice(1).map(k => k.trim()).filter(Boolean);

            return { keys, nextCursor, cursor };
        } catch (error) {
            console.error('Failed to get Redis keys:', error);
            return { error: error.message };
        }
    });

    // Get key details (value, type, ttl)
    ipcMain.handle('redis-get-key-info', async (event, dbIndex, key) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);
            const cwd = path.dirname(cliPaths.client);

            // Get type
            const typeResult = await execCommand(
                `"${cliPaths.client}" -n ${dbIndex} TYPE "${key}"`,
                { cwd }
            );
            const type = typeResult.stdout?.trim() || 'unknown';

            // Get TTL
            const ttlResult = await execCommand(
                `"${cliPaths.client}" -n ${dbIndex} TTL "${key}"`,
                { cwd }
            );
            const ttl = parseInt(ttlResult.stdout?.trim()) || -1;

            // Get value based on type
            let value = '';
            let length = 0;

            if (type === 'string') {
                const valResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} GET "${key}"`,
                    { cwd }
                );
                value = valResult.stdout?.trim() || '';
                length = value.length;
            } else if (type === 'list') {
                const lenResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} LLEN "${key}"`,
                    { cwd }
                );
                length = parseInt(lenResult.stdout?.trim()) || 0;
                const valResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} LRANGE "${key}" 0 99`,
                    { cwd }
                );
                value = valResult.stdout?.trim() || '';
            } else if (type === 'set') {
                const lenResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} SCARD "${key}"`,
                    { cwd }
                );
                length = parseInt(lenResult.stdout?.trim()) || 0;
                const valResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} SMEMBERS "${key}"`,
                    { cwd }
                );
                value = valResult.stdout?.trim() || '';
            } else if (type === 'zset') {
                const lenResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} ZCARD "${key}"`,
                    { cwd }
                );
                length = parseInt(lenResult.stdout?.trim()) || 0;
                const valResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} ZRANGE "${key}" 0 99 WITHSCORES`,
                    { cwd }
                );
                value = valResult.stdout?.trim() || '';
            } else if (type === 'hash') {
                const lenResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} HLEN "${key}"`,
                    { cwd }
                );
                length = parseInt(lenResult.stdout?.trim()) || 0;
                const valResult = await execCommand(
                    `"${cliPaths.client}" -n ${dbIndex} HGETALL "${key}"`,
                    { cwd }
                );
                value = valResult.stdout?.trim() || '';
            }

            return { key, type, ttl, value, length };
        } catch (error) {
            console.error('Failed to get Redis key info:', error);
            return { error: error.message };
        }
    });

    // Set a key value (supports multiple data types)
    ipcMain.handle('redis-set-key', async (event, dbIndex, key, value, ttl = -1, dataType = 'string') => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);
            const cwd = path.dirname(cliPaths.client);

            // Delete existing key first (to change type if needed)
            await execCommand(`"${cliPaths.client}" -n ${dbIndex} DEL "${key}"`, { cwd });

            let result;

            if (dataType === 'string') {
                // String: SET key value
                const escapedValue = value.replace(/"/g, '\\"');
                let command = `"${cliPaths.client}" -n ${dbIndex} SET "${key}" "${escapedValue}"`;
                if (ttl > 0) {
                    command += ` EX ${ttl}`;
                }
                result = await execCommand(command, { cwd });
            } else if (dataType === 'list') {
                // List: RPUSH key value1 value2 ...
                const items = value.split('\n').filter(item => item.trim());
                if (items.length > 0) {
                    const escapedItems = items.map(item => `"${item.trim().replace(/"/g, '\\"')}"`).join(' ');
                    result = await execCommand(`"${cliPaths.client}" -n ${dbIndex} RPUSH "${key}" ${escapedItems}`, { cwd });
                } else {
                    return { error: 'List cannot be empty' };
                }
            } else if (dataType === 'set') {
                // Set: SADD key member1 member2 ...
                const members = value.split('\n').filter(item => item.trim());
                if (members.length > 0) {
                    const escapedMembers = members.map(m => `"${m.trim().replace(/"/g, '\\"')}"`).join(' ');
                    result = await execCommand(`"${cliPaths.client}" -n ${dbIndex} SADD "${key}" ${escapedMembers}`, { cwd });
                } else {
                    return { error: 'Set cannot be empty' };
                }
            } else if (dataType === 'zset') {
                // Sorted Set: ZADD key score1 member1 score2 member2 ...
                const lines = value.split('\n').filter(item => item.trim());
                const args = [];
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const score = parseFloat(parts[0]) || 0;
                        const member = parts.slice(1).join(' ');
                        args.push(`${score} "${member.replace(/"/g, '\\"')}"`);
                    }
                }
                if (args.length > 0) {
                    result = await execCommand(`"${cliPaths.client}" -n ${dbIndex} ZADD "${key}" ${args.join(' ')}`, { cwd });
                } else {
                    return { error: 'Sorted set cannot be empty' };
                }
            } else if (dataType === 'hash') {
                // Hash: HSET key field1 value1 field2 value2 ...
                const lines = value.split('\n').filter(item => item.trim());
                const args = [];
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const field = parts[0];
                        const val = parts.slice(1).join(' ');
                        args.push(`"${field.replace(/"/g, '\\"')}" "${val.replace(/"/g, '\\"')}"`);
                    }
                }
                if (args.length > 0) {
                    result = await execCommand(`"${cliPaths.client}" -n ${dbIndex} HSET "${key}" ${args.join(' ')}`, { cwd });
                } else {
                    return { error: 'Hash cannot be empty' };
                }
            } else {
                return { error: 'Unsupported data type' };
            }

            if (result.error) {
                return { error: result.error };
            }

            // Set TTL if specified (for non-string types)
            if (ttl > 0 && dataType !== 'string') {
                await execCommand(`"${cliPaths.client}" -n ${dbIndex} EXPIRE "${key}" ${ttl}`, { cwd });
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to set Redis key:', error);
            return { error: error.message };
        }
    });

    // Delete a key
    ipcMain.handle('redis-delete-key', async (event, dbIndex, key) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);

            const result = await execCommand(
                `"${cliPaths.client}" -n ${dbIndex} DEL "${key}"`,
                { cwd: path.dirname(cliPaths.client) }
            );

            if (result.error) {
                return { error: result.error };
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to delete Redis key:', error);
            return { error: error.message };
        }
    });

    // Delete multiple keys
    ipcMain.handle('redis-delete-keys', async (event, dbIndex, keys) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);

            const keysList = keys.map(k => `"${k}"`).join(' ');
            const result = await execCommand(
                `"${cliPaths.client}" -n ${dbIndex} DEL ${keysList}`,
                { cwd: path.dirname(cliPaths.client) }
            );

            if (result.error) {
                return { error: result.error };
            }

            return { success: true, deleted: parseInt(result.stdout?.trim()) || 0 };
        } catch (error) {
            console.error('Failed to delete Redis keys:', error);
            return { error: error.message };
        }
    });

    // Flush a database
    ipcMain.handle('redis-flush-db', async (event, dbIndex) => {
        try {
            const dbManager = getDbManager();
            if (!dbManager) return { error: 'Database not initialized' };

            const apps = dbManager.query('SELECT * FROM installed_apps WHERE app_id = ?', ['redis']);
            if (!apps || apps.length === 0) return { error: 'Redis not installed' };

            const app = apps[0];
            const cliPaths = getDbCliPaths('redis', app.exec_path);

            const result = await execCommand(
                `"${cliPaths.client}" -n ${dbIndex} FLUSHDB`,
                { cwd: path.dirname(cliPaths.client) }
            );

            if (result.error) {
                return { error: result.error };
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to flush Redis db:', error);
            return { error: error.message };
        }
    });
}

module.exports = { register };
