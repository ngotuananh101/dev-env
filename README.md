# Dev-Env

A modern, Electron-based local development environment manager for Windows. `Dev-Env` provides a sleek dashboard to manage development tools, web servers, databases, and projects with ease.

## ✨ Features

### �️ Dashboard & Monitoring
- **Real-time System Stats**: Monitor CPU usage, RAM consumption, and Disk space.
- **Service Status**: At-a-glance view of running services and their health.

### � App Store & Service Manager
- **One-Click Installation**: Easily install development tools like **PHP** (multiple versions), **Nginx**, **Apache**, **MySQL**, **MariaDB**, **PostgreSQL**, **Redis**, and **phpMyAdmin**.
- **Version Management**: Switch between different versions of PHP or databases effortlessly.
- **Service Control**: Start, stop, and restart services individually or all at once.
- **Process Management**: Auto-start services on app launch (configurable).

### 🌐 Site Management
- **Virtual Hosts**: Create and manage local websites (e.g., `myproject.local`) with automatic `hosts` file updates.
- **Auto-Discovery**: Automatically create sites from a root directory.
- **Template System**: Configurable domain templates (default: `[site].local`).
- **Tech Stack Support**: Support for PHP, Node.js, and static HTML sites.
- **Reverse Proxy**: Built-in support for proxying to other local ports (e.g., for Node.js apps).

### 🔒 SSL & Security
- **Local HTTPS**: Integrated `mkcert` support for trusted local SSL certificates.
- **CA Management**: Install/Uninstall the local Certificate Authority (CA) to the system trust store directly from Settings.
- **Automatic Certs**: Automatically generate SSL certificates for created sites.

### 🛠️ Developer Tools
- **Configuration Editor**: Built-in editor for config files (`nginx.conf`, `php.ini`, etc.) with syntax highlighting.
- **Terminal**: Integrated terminal emulator (`xterm.js`) for running commands without leaving the app.
- **Database Manager**: Create and delete databases and users directly from the UI.
- **File Manager**: Browse project files and logs.

### ⚙️ Settings & Customization
- **Startup Behavior**: Option to start the application automatically with Windows.
- **System Tray**: Minimize to system tray to keep services running in the background.
- **Theme**: Dark mode optimized UI.

## 🚀 Getting Started

### Prerequisites
- **OS**: Windows 10/11 (64-bit)
- **Runtime**: Node.js 18+ installed

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dev-env

# Install dependencies
npm install

# Rebuild native modules (required for node-pty/better-sqlite3)
npm run rebuild
```

### Development

```bash
# Start development server (Vite + Electron)
npm run dev
```

### Build for Production

```bash
# Create a distributable installer (NSIS)
npm run build
```

## 📂 Project Structure

```
dev-env/
├── main.js                  # Electron main process entry
├── preload.js               # Main preload script (loads src/preload)
├── src/
│   ├── main.js              # Vue application entry
│   ├── App.vue              # Root Vue component
│   ├── main.css             # Tailwind CSS entry
│   ├── views/               # Page views (Dashboard, Apps, Sites, etc.)
│   ├── components/          # Reusable UI components
│   ├── stores/              # Pinia state management
│   ├── router/              # Vue Router configuration
│   ├── composables/         # Shared Vue composables
│   ├── utils/               # Frontend utility functions
│   ├── preload/             # Preload scripts source
│   └── backend/             # Backend logic & IPC handlers
│       ├── handlers/        # IPC handlers by module
│       ├── workers/         # Background workers
│       └── database.js      # SQLite connection & schema
├── data/                    # App data & resources
├── build/                   # Build assets (icons)
├── dist/                    # Frontend build output
└── release/                 # Packaged application output
```

## 🏗️ Tech Stack

- **Core**: [Electron](https://www.electronjs.org/)
- **Frontend**: [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Backend/IPC**: Node.js
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Terminal**: [xterm.js](https://xtermjs.org/) + [node-pty](https://github.com/microsoft/node-pty)

## 📄 License

ISC
