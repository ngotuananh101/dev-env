import { defineStore } from 'pinia';

export const useSystemStore = defineStore('system', {
    state: () => ({
        cpuLoad: 0,
        cpuCores: 0,
        mem: { used: 0, total: 0, active: 0 },
        disks: [],
        ipAddress: '127.0.0.1',
        isLoaded: false,
        pollingInterval: null,
        visibilityHandler: null
    }),

    actions: {
        async fetchStats() {
            try {
                if (window.sysapi) {
                    const stats = await window.sysapi.getStats();
                    if (stats) {
                        this.cpuLoad = stats.cpuLoad;
                        this.cpuCores = stats.cpuCores;
                        this.mem = stats.mem;
                        this.disks = stats.fsSize || [];
                        this.isLoaded = true;
                    }
                }
            } catch (err) {
                console.error('Store Fetch Error:', err);
            }
        },

        async fetchIp() {
            try {
                if (window.sysapi && window.sysapi.getIp) {
                    this.ipAddress = await window.sysapi.getIp();
                }
            } catch (err) {
                console.error('IP Fetch Error:', err);
                this.ipAddress = 'Error';
            }
        },

        startPolling() {
            // Clear existing interval to prevent duplicates
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            this.fetchStats();
            this.fetchIp();

            // Poll every 5 seconds (increased from 3s for better performance)
            this.pollingInterval = setInterval(() => {
                // Only fetch when document is visible
                if (!document.hidden) {
                    this.fetchStats();
                }
            }, 5000);

            // Pause polling when tab is hidden for better performance
            this.visibilityHandler = () => {
                if (!document.hidden && this.isLoaded) {
                    this.fetchStats(); // Refresh immediately when becoming visible
                }
            };
            document.addEventListener('visibilitychange', this.visibilityHandler);
        },

        stopPolling() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
            if (this.visibilityHandler) {
                document.removeEventListener('visibilitychange', this.visibilityHandler);
                this.visibilityHandler = null;
            }
        }
    }
});
