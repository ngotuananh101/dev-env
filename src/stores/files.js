import { defineStore } from 'pinia';

export const useFilesStore = defineStore('files', {
    state: () => ({
        currentPath: '',
        files: [],
        loading: false,
        error: null,
        history: []
    }),

    getters: {
        breadcrumbs: (state) => {
            if (!state.currentPath) return [];
            // Windows path split logic (handles \ and /)
            const parts = state.currentPath.split(/[\\/]/).filter(p => p);
            const crumbs = [];
            let accumulated = '';

            // Handle Drive root on Windows (e.g. C:)
            if (state.currentPath.includes(':')) {
                // Simple handling for now
            }

            return parts.map((part, index) => {
                return {
                    name: part,
                    // Reconstruct naive path (simplified for POC)
                    // In reality, we rely on the backend to tell us the separator or just use what we have
                    path: 'Unknown' // TODO: Fix path reconstruction
                }
            });
        }
    },

    actions: {
        async loadDirectory(path = '') {
            this.loading = true;
            this.error = null;
            try {
                if (window.sysapi && window.sysapi.files) {
                    const result = await window.sysapi.files.list(path);
                    if (result.error) {
                        this.error = result.error;
                    } else {
                        this.currentPath = result.path;
                        this.files = result.files;
                    }
                }
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },

        async getDrives() {
            if (window.sysapi && window.sysapi.files && window.sysapi.files.getDrives) {
                return await window.sysapi.files.getDrives();
            }
            return [];
        },

        async createFolder(name) {
            if (!this.currentPath) return { error: 'No path selected' };
            try {
                const result = await window.sysapi.files.createDir({
                    targetPath: this.currentPath,
                    name: name
                });
                if (!result.error) {
                    await this.loadDirectory(this.currentPath);
                }
                return result;
            } catch (err) {
                return { error: err.message };
            }
        },

        async deletePath(path) {
            try {
                const result = await window.sysapi.files.deletePath(path);
                return result;
            } catch (err) {
                return { error: err.message };
            }
        },

        async renamePath(oldPath, newName) {
            try {
                const result = await window.sysapi.files.renamePath({
                    oldPath,
                    newName
                });
                if (!result.error) {
                    await this.loadDirectory(this.currentPath);
                }
                return result;
            } catch (err) {
                return { error: err.message };
            }
        },

        async openFile(path) {
            if (window.sysapi && window.sysapi.files && window.sysapi.files.openFile) {
                return await window.sysapi.files.openFile(path);
            }
            return { error: 'Not supported' };
        },

        // Note: Download logic often involves progress callbacks which are harder to promisify cleanly 
        // in a simple action without managing state. For now, we'll expose a wrapper.
        startDownload(url, fileName, targetPath) {
            if (window.sysapi && window.sysapi.files) {
                window.sysapi.files.download({
                    url,
                    targetPath: targetPath || this.currentPath,
                    fileName
                });
            }
        },

        cancelDownload() {
            if (window.sysapi && window.sysapi.files && window.sysapi.files.cancelDownload) {
                window.sysapi.files.cancelDownload();
            }
        }
    }
});
