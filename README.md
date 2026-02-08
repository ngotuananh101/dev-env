# Dev-Env

A modern Electron-based development environment manager for Windows. Provides a sleek dashboard interface for managing development tools, databases, and web servers.

## Features

- 📊 **System Dashboard** - Real-time CPU, RAM, and disk monitoring
- 🛒 **App Store** - Install and manage development tools (Nginx, Apache, MySQL, PostgreSQL, etc.)
- 📁 **File Manager** - Browse and manage files with built-in viewer
- 💻 **Terminal** - Integrated terminal emulator
- 🔧 **Service Manager** - Start/stop installed applications

## Tech Stack

- **Frontend**: Vue 3 + Vite + Tailwind CSS v4
- **Backend**: Electron 40 + Node.js
- **Database**: SQLite (better-sqlite3)
- **Terminal**: xterm.js + node-pty

## Prerequisites

- Node.js 18+ 
- Windows 10/11 (64-bit)
- Visual Studio Build Tools (for native modules)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd dev-env

# Install dependencies
npm install

# Rebuild native modules for Electron
npm run rebuild
```

## Development

```bash
# Start development server with hot reload
npm run dev
```

## Build

```bash
# Build for production
npm run build
```

## Project Structure

```
dev-env/
├── main.js              # Electron main process
├── preload.js           # Preload scripts for IPC
├── index.html           # Entry HTML
├── src/
│   ├── App.vue          # Root Vue component
│   ├── main.js          # Vue app entry
│   ├── main.css         # Tailwind CSS
│   ├── views/           # Page components
│   ├── components/      # Reusable components
│   ├── router/          # Vue Router config
│   └── backend/         # Backend utilities
├── data/
│   └── apps.json        # App store catalog
├── apps/                # Installed applications
├── logs/                # Application logs
└── dist/                # Build output
```

## App Store Features

- Download and install development tools
- Version selection for each app
- Installation progress with detailed logs
- Cancel ongoing installations
- Exclusive group restriction (e.g., only one web server at a time)

## License

ISC

## TODO
[x] Chặn việc add nhiều PHP vào PATH
[ ] Tự động cài composer khi cài đặt PHP
[ ] Kích hoạt tự động vài PHP Ext hay dùng
[ ] Kiểm tra lại app cần auto start khi cài đặt
[ ] Thêm tính năng gỡ certificate khỏi hệ điều hành
[ ] Tùy chọn start cùng windows