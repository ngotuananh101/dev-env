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
        }
    }
});
