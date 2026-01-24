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

        async navigateUp() {
            // Backend determines parent, or we split string.
            // For now, let's just use ..
            if (this.currentPath) {
                await this.loadDirectory(this.currentPath + '/..');
            }
        }
    }
});
