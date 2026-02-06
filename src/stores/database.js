import { defineStore } from 'pinia';

export const useDatabaseStore = defineStore('database', {
    state: () => ({
        settings: {}, // Cache settings as Key-Value
    }),

    actions: {
        async loadSettings() {
            if (!window.sysapi || !window.sysapi.db) return;
            try {
                const rows = await window.sysapi.db.query('SELECT * FROM settings');
                if (Array.isArray(rows)) {
                    // Convert array [{key, value}] to object {key: value}
                    this.settings = rows.reduce((acc, row) => {
                        acc[row.key] = row.value;
                        return acc;
                    }, {});
                }
            } catch (err) {
                console.error("DB Store Load Error:", err);
            }
        },

        async saveSetting(key, value) {
            if (!window.sysapi || !window.sysapi.db) return;
            try {
                // Upsert logic (SQLite supports REPLACE INTO or INSERT ... ON CONFLICT)
                await window.sysapi.db.query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
                this.settings[key] = String(value);
            } catch (err) {
                console.error("DB Store Save Error:", err);
            }
        },

        // Generic query for arbitrary use
        async executeQuery(sql, params = []) {
            if (!window.sysapi || !window.sysapi.db) return null;
            return await window.sysapi.db.query(sql, params);
        },

        async getDatabases() {
            if (!window.sysapi || !window.sysapi.db) return [];
            // 'SHOW DATABASES' equivalent logic for the system.
            // Based on `DatabaseView.vue` logic, it queries `information_schema` or specialized table.
            // Actually, the view logic is:
            // const dbs = await window.sysapi.db.query("SHOW DATABASES");
            // Filter out system dbs: information_schema, mysql, performance_schema, sys
            try {
                const dbs = await window.sysapi.db.query("SHOW DATABASES");
                if (dbs && !dbs.error) {
                    return dbs.filter(db =>
                        !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db.Database)
                    );
                }
                return [];
            } catch (err) {
                return { error: err.message };
            }
        },

        async createDatabase(name, user, password) {
            try {
                // 1. Create DB
                await window.sysapi.db.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);

                // 2. Create User if provided
                if (user && password) {
                    // Check if user exists? Or just Create user if not exists
                    // "CREATE USER IF NOT EXISTS ..."
                    await window.sysapi.db.query(`CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${password}'`);
                    await window.sysapi.db.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${user}'@'%'`);
                    await window.sysapi.db.query("FLUSH PRIVILEGES");
                }
                return { success: true };
            } catch (err) {
                return { error: err.message };
            }
        },

        async deleteDatabase(name) {
            try {
                await window.sysapi.db.query(`DROP DATABASE IF EXISTS \`${name}\``);
                return { success: true };
            } catch (err) {
                return { error: err.message };
            }
        },

        async getUsers() {
            try {
                const users = await window.sysapi.db.query("SELECT User, Host FROM mysql.user");
                if (users && !users.error) {
                    return users.filter(u =>
                        !['mysql.session', 'mysql.sys', 'root'].includes(u.User)
                    );
                }
                return [];
            } catch (err) {
                return { error: err.message };
            }
        },

        async createUser(name, password, host = '%') {
            try {
                await window.sysapi.db.query(`CREATE USER '${name}'@'${host}' IDENTIFIED BY '${password}'`);
                return { success: true };
            } catch (err) {
                return { error: err.message };
            }
        },

        async deleteUser(user, host) {
            try {
                await window.sysapi.db.query(`DROP USER '${user}'@'${host}'`);
                return { success: true };
            } catch (err) {
                return { error: err.message };
            }
        },

        async changePassword(user, host, password) {
            try {
                // MySQL 5.7+ / 8.0 syntax might vary slightly but ALTER USER is standard now
                await window.sysapi.db.query(`ALTER USER '${user}'@'${host}' IDENTIFIED BY '${password}'`);
                return { success: true };
            } catch (err) {
                return { error: err.message };
            }
        }
    }
});
