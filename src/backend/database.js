const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor(userDataPath) {
        this.db = null;
        this.userDataPath = userDataPath;
        this.init();
    }

    init() {
        try {
            const Database = require('better-sqlite3');
            const dbPath = path.join(this.userDataPath, 'dev-env.db');

            // Ensure directory exists
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new Database(dbPath, { verbose: console.log });
            this.db.pragma('journal_mode = WAL');

            console.log("SUCCESS: SQLite Database connected at", dbPath);

            // Create default tables
            this.createTables();

        } catch (err) {
            console.error("FAILURE: Could not load better-sqlite3 or connect to DB.", err);
            this.db = null;
        }
    }

    createTables() {
        if (!this.db) return;

        try {
            // Settings Table
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            `).run();

            // Installed Apps Table
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS installed_apps (
                    app_id TEXT PRIMARY KEY,
                    installed_version TEXT,
                    install_path TEXT,
                    exec_path TEXT,
                    custom_args TEXT,
                    show_on_dashboard INTEGER DEFAULT 0,
                    installed_at TEXT,
                    updated_at TEXT
                )
            `).run();

        } catch (err) {
            console.error("DB Init Tables Error:", err);
        }
    }

    query(sql, params = []) {
        if (!this.db) return { error: "Database not initialized" };
        try {
            const stmt = this.db.prepare(sql);
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return stmt.all(params);
            } else {
                return stmt.run(params);
            }
        } catch (err) {
            console.error("DB Query Error:", err);
            return { error: err.message };
        }
    }
}

module.exports = DatabaseManager;
