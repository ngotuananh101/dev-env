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
    const { execute: loadApps } = useAsyncAction(async () => {
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
        await Promise.all(apps.value.map(async (app) => {
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
        }));
    };

    const loadIcons = () => {
        // Load icons in parallel without blocking
        apps.value
            .filter(app => app.icon_file && !app.iconContent)
            .forEach(app => {
                window.sysapi.apps.readIcon(app.icon_file)
                    .then(iconResult => {
                        if (iconResult && !iconResult.error && iconResult.data) {
                            app.iconContent = `data:${iconResult.mime};base64,${iconResult.data}`;
                        }
                    })
                    .catch(err => console.error('Icon load error:', err));
            });
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
        if (!app || !version) return { error: 'Invalid parameters' };

        try {
            const result = await window.sysapi.apps.install(
                app.id,
                version.version,
                version.download_url,
                version.filename,
                app.exec_file,
                app.group || null,
                app.default_args || null,
                app.autostart || false,
                app.cli_file || null
            );

            if (result.error) {
                return result; // Propagate error
            }

            // Update app status locally on success
            const installedApp = apps.value.find(a => a.id === app.id);
            if (installedApp) {
                installedApp.status = 'installed';
                installedApp.installedVersion = version.version;
                installedApp.installPath = result.installPath;
                installedApp.execPath = result.execPath;
                installedApp.cliPath = result.cliPath;
                installedApp.customArgs = installedApp.default_args || '';

                // Check and update inPath status
                let cliDir = null;
                if (result.cliPath) {
                    cliDir = result.cliPath.substring(0, result.cliPath.lastIndexOf('\\'));
                } else if (installedApp.cli_file && result.installPath) {
                    const cliPath = result.installPath + '\\' + installedApp.cli_file.replace(/\//g, '\\');
                    cliDir = cliPath.substring(0, cliPath.lastIndexOf('\\'));
                } else if (result.execPath) {
                    cliDir = result.execPath.substring(0, result.execPath.lastIndexOf('\\'));
                }

                if (cliDir) {
                    installedApp.cliDir = cliDir;
                    try {
                        const pathResult = await window.sysapi.files.checkPath(cliDir);
                        installedApp.inPath = pathResult.inPath || false;
                    } catch (e) {
                        installedApp.inPath = false;
                    }
                } else {
                    installedApp.inPath = false;
                }

                // We don't call addToRecentlyUsed here because that's UI/History preference, can remain in View or be moved.
                // Let's keep it in view for now or expose an action for it if strictly needed.
                // Actually, let's expose it to be clean.
                addToRecentlyUsed(installedApp);
            }

            return result;
        } catch (err) {
            return { error: err.message };
        }
    };

    const cancelInstall = async (appId) => {
        try {
            return await window.sysapi.apps.cancelInstall(appId);
        } catch (err) {
            return { error: err.message };
        }
    };

    // Helper to manage recently used in localStorage
    const addToRecentlyUsed = (app) => {
        const saved = localStorage.getItem('recentlyUsedApps') || '[]';
        const recent = JSON.parse(saved);

        const exists = recent.find(a => a.id === app.id);
        if (!exists) {
            recent.unshift({
                id: app.id,
                name: app.name,
                icon: app.icon, // These might be icon names string
                iconColor: app.iconColor,
                iconContent: app.iconContent
            });
            if (recent.length > 5) recent.pop();
            localStorage.setItem('recentlyUsedApps', JSON.stringify(recent));
        }
    };

    // Service actions
    const startService = async (app) => {
        if (!app.execPath) return { error: 'No exec path' };

        try {
            // Note: useServiceControl hook logic was: startServiceApi(app, startArgs)
            // We can replicate simple API call here.
            // But wait, the hook handles 'serviceLoading' state.
            // We should replicate that state handling here if we want to replace the hook.
            // Let's stick to the plan: "Move core API call here". UI state can remain in View or Store.
            // If we move to store, we need to manage `app.serviceLoading` in store state (reactive app object).

            app.serviceLoading = true;
            const startArgs = app.service_commands?.start || app.customArgs || '';
            const result = await window.sysapi.apps.startService(app.id, app.execPath, startArgs);

            if (result.success) {
                app.serviceRunning = true;
            }
            app.serviceLoading = false;
            return result;
        } catch (err) {
            app.serviceLoading = false;
            return { error: err.message };
        }
    };

    const stopService = async (app) => {
        if (!app.execPath) return { error: 'No exec path' };
        app.serviceLoading = true;
        try {
            const stopArgs = app.service_commands?.stop || '';
            const result = await window.sysapi.apps.stopService(app.id, app.execPath, stopArgs);
            if (result.success) {
                app.serviceRunning = false;
            }
            app.serviceLoading = false;
            return result;
        } catch (err) {
            app.serviceLoading = false;
            return { error: err.message };
        }
    };

    const restartService = async (app) => {
        if (!app.execPath) return { error: 'No exec path' };
        app.serviceLoading = true;
        try {
            const startArgs = app.service_commands?.start || app.customArgs || '';
            const stopArgs = app.service_commands?.stop || '';
            const result = await window.sysapi.apps.restartService(app.id, app.execPath, startArgs, stopArgs);
            if (result.success) {
                app.serviceRunning = true;
            }
            app.serviceLoading = false;
            return result;
        } catch (err) {
            app.serviceLoading = false;
            return { error: err.message };
        }
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
        allFilteredApps,
        installApp,
        cancelInstall,
        startService,
        stopService,
        restartService
    };
});
