import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useToast } from 'vue-toastification';
import { useAsyncAction } from '../composables/useAsyncAction';

export const useAppsStore = defineStore('apps', () => {
    const toast = useToast();

    // State
    const apps = ref([]);
    const appListVersion = ref('');
    const activeCategory = ref('all');

    // Actions
    const { execute: loadApps, isLoading: isLoadingApps } = useAsyncAction(async () => {
        const result = await window.sysapi.apps.getList();
        if (result.error) {
            throw new Error(result.error);
        }

        apps.value = result.apps || [];
        appListVersion.value = result.version || '';

        await checkPathsForApps();
        loadIcons();
        return result;
    }, { errorMessage: 'Error loading apps', showError: false }); // showError false to avoid spam on generic loads if desired, or true

    const checkPathsForApps = async () => {
        for (const app of apps.value) {
            if (app.status === 'installed' && app.installPath) {
                let cliDir;
                if (app.cliPath) {
                    cliDir = app.cliPath.substring(0, app.cliPath.lastIndexOf('\\'));
                } else if (app.cli_file) {
                    const cliPath = app.installPath + '\\' + app.cli_file.replace(/\//g, '\\');
                    cliDir = cliPath.substring(0, cliPath.lastIndexOf('\\'));
                } else if (app.execPath) {
                    cliDir = app.execPath.substring(0, app.execPath.lastIndexOf('\\'));
                }

                if (cliDir) {
                    try {
                        const pathResult = await window.sysapi.files.checkPath(cliDir);
                        app.inPath = pathResult.inPath || false;
                        app.cliDir = cliDir;
                    } catch (e) {
                        app.inPath = false;
                    }
                } else {
                    app.inPath = false;
                }
            } else {
                app.inPath = false;
            }
        }
    };

    const loadIcons = async () => {
        for (const app of apps.value) {
            if (app.icon_file && !app.iconContent) {
                window.sysapi.apps.readIcon(app.icon_file).then(iconResult => {
                    if (iconResult && !iconResult.error && iconResult.data) {
                        app.iconContent = `data:${iconResult.mime};base64,${iconResult.data}`;
                    }
                }).catch(err => console.error('Icon load error:', err));
            }
        }
    };

    const { execute: updateAppList, isLoading: isUpdatingList } = useAsyncAction(async () => {
        const result = await window.sysapi.apps.updateList();
        if (result.error) throw new Error(result.error);

        if (result.success) {
            await loadApps();
            return result.updatedCount || 0;
        }
    }, { successMessage: 'App list updated successfully!', errorMessage: 'Failed to update app list' });

    // Link isUpdating state
    const isUpdating = computed(() => isUpdatingList.value);

    const togglePath = async (app) => {
        let cliDir = app.cliDir;
        if (!cliDir) {
            if (app.cliPath) {
                cliDir = app.cliPath.substring(0, app.cliPath.lastIndexOf('\\'));
            } else if (app.cli_file && app.installPath) {
                const cliPath = app.installPath + '\\' + app.cli_file.replace(/\//g, '\\');
                cliDir = cliPath.substring(0, cliPath.lastIndexOf('\\'));
            } else if (app.execPath) {
                cliDir = app.execPath.substring(0, app.execPath.lastIndexOf('\\'));
            }
        }

        if (!cliDir) return;

        try {
            const newValue = !app.inPath;
            toast.info(newValue ? `Adding ${app.name} to PATH...` : `Removing ${app.name} from PATH...`);

            let result;
            if (newValue) {
                result = await window.sysapi.files.addToPath(cliDir);
            } else {
                result = await window.sysapi.files.removeFromPath(cliDir);
            }

            if (result.error) {
                toast.error(`Failed to update PATH: ${result.error}`);
                return;
            }

            app.inPath = newValue;
            toast.success(newValue ? `Added ${cliDir} to PATH` : `Removed from PATH`);
        } catch (error) {
            console.error('Toggle PATH error:', error);
            toast.error(`Error: ${error.message}`);
        }
    };

    const uninstallApp = async (app) => {
        if (!confirm(`Uninstall ${app.name}?`)) return;

        try {
            const result = await window.sysapi.apps.uninstall(app.id);
            if (result.error) {
                toast.error(`Failed to uninstall ${app.name}: ${result.error}`);
                return;
            }

            app.status = 'not_installed';
            app.showOnDashboard = false;
        } catch (error) {
            console.error('Uninstall error:', error);
            toast.error(`Error: ${error.message}`);
        }
    };

    // Getters
    const allFilteredApps = computed(() => (searchQuery) => {
        let result = apps.value;

        // Filter by category
        if (activeCategory.value === 'installed') {
            result = result.filter(app => app.status === 'installed');
        } else if (activeCategory.value !== 'all') {
            result = result.filter(app => app.category === activeCategory.value);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(app =>
                app.name.toLowerCase().includes(query) ||
                app.description.toLowerCase().includes(query)
            );
        }

        return result;
    });

    const installApp = async (app, version) => {
        // Logic install here (partially moved or kept in view for modal handling? 
        // For now, keep modal handling in View but move core API call here would be better if we extract Modal too.
        // Let's keep strict logic actions here)
        // ...
    };


    return {
        apps,
        isUpdating,
        appListVersion,
        activeCategory,
        loadApps,
        updateAppList,
        togglePath,
        uninstallApp,
        allFilteredApps
    };
});
