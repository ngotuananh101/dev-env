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

            // Seed default settings
            this.db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_template', '[site].local')").run();
            this.db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_auto_create', 'true')").run();
            this.db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_php_version', '8.2')").run();

            // Installed Apps Table
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS installed_apps (
                    app_id TEXT PRIMARY KEY,
                    installed_version TEXT,
                    install_path TEXT,
                    exec_path TEXT,
                    custom_args TEXT,
                    auto_start INTEGER DEFAULT 0,
                    show_on_dashboard INTEGER DEFAULT 0,
                    installed_at TEXT,
                    updated_at TEXT
                )
            `).run();

            // Sites Table (Website/Project Management)
            this.db.prepare(`
                CREATE TABLE IF NOT EXISTS sites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    domain TEXT NOT NULL UNIQUE,
                    type TEXT NOT NULL,
                    webserver TEXT DEFAULT 'nginx',
                    root_path TEXT,
                    port INTEGER,
                    php_version TEXT,
                    node_script TEXT,
                    proxy_target TEXT,
                    status TEXT DEFAULT 'stopped',
                    is_auto INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT
                )
            `).run();

            // Migrations: Try to add columns if they don't exist
            try { this.db.prepare("ALTER TABLE installed_apps ADD COLUMN custom_args TEXT").run(); } catch (e) { }
            try { this.db.prepare("ALTER TABLE installed_apps ADD COLUMN auto_start INTEGER DEFAULT 0").run(); } catch (e) { }

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
