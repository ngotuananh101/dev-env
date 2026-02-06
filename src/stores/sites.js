import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAsyncAction } from '../composables/useAsyncAction';

export const useSitesStore = defineStore('sites', () => {
    const toast = useToast();

    // State
    const sites = ref([]);
    const webserver = ref({ nginx: null, apache: null });
    const isLoading = ref(false);
    const activeTab = ref('php');
    const phpVersions = ref([]);

    // Actions
    const { execute: loadSites, isLoading: isLoadingSites } = useAsyncAction(async () => {
        const result = await window.sysapi.sites.list();
        if (result.error) throw new Error(result.error);
        sites.value = result.sites || [];
        return result;
    }, { errorMessage: 'Failed to load sites' });

    // Sync global isLoading
    watch(isLoadingSites, (val) => isLoading.value = val);

    const loadWebserver = async () => {
        try {
            const result = await window.sysapi.sites.getWebserver();
            webserver.value = {
                nginx: result.nginx,
                apache: result.apache
            };
        } catch (error) {
            console.error('Load webserver error:', error);
        }
    };

    const loadPhpVersions = async () => {
        try {
            const result = await window.sysapi.sites.getPhpVersions();
            if (result.versions) {
                phpVersions.value = result.versions;
            }
        } catch (error) {
            console.error('Load PHP versions error:', error);
        }
    };

    const updatePhpVersion = async (site, newVersion) => {
        if (site.php_version === newVersion) return;

        site.updatingPhp = true;
        try {
            const result = await window.sysapi.sites.updatePhpVersion(site.id, newVersion);
            if (result.error) {
                toast.error(`Failed to update PHP version: ${result.error}`);
            } else {
                site.php_version = newVersion;
                toast.success(`Updated ${site.domain} to PHP ${newVersion}`);
            }
        } catch (error) {
            console.error('Update PHP version error:', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            site.updatingPhp = false;
        }
    };

    const startNodeSite = async (site) => {
        site.loading = true;
        try {
            const result = await window.sysapi.sites.startNode(site.id);
            if (result.error) {
                toast.error(`Failed to start: ${result.error}`);
            } else {
                site.processRunning = true;
                toast.success(`${site.name} started!`);
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        } finally {
            site.loading = false;
        }
    };

    const stopNodeSite = async (site) => {
        site.loading = true;
        try {
            const result = await window.sysapi.sites.stopNode(site.id);
            if (result.error) {
                toast.error(`Failed to stop: ${result.error}`);
            } else {
                site.processRunning = false;
                toast.success(`${site.name} stopped!`);
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        } finally {
            site.loading = false;
        }
    };

    const deleteSite = async (site) => {
        if (!confirm(`Delete site "${site.domain}"? This will remove the config file.`)) {
            return false;
        }

        try {
            const result = await window.sysapi.sites.delete(site.id);
            if (result.error) {
                toast.error(`Failed to delete: ${result.error}`);
                return false;
            } else {
                toast.success(`${site.domain} deleted!`);
                await loadSites();
                return true;
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
            return false;
        }
    };

    const changeApacheRoot = async () => {
        try {
            const result = await window.sysapi.files.selectFolder();
            if (!result.path) return;

            if (!confirm(`Change Apache DocumentRoot to:\n${result.path}\n\nThis will rewrite httpd.conf!`)) return;

            isLoading.value = true;
            const updateResult = await window.sysapi.sites.updateApacheRoot(result.path);

            if (updateResult.error) {
                toast.error(`Failed to update: ${updateResult.error}`);
            } else {
                toast.success('Apache root updated successfully!');
            }
        } catch (error) {
            console.error('Change Apache root error:', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            isLoading.value = false;
            await loadSites();
        }
    };

    const changeNginxRoot = async () => {
        try {
            const result = await window.sysapi.files.selectFolder();
            if (!result.path) return;

            if (!confirm(`Change Nginx root to:\n${result.path}\n\nThis will rewrite nginx.conf!`)) return;

            isLoading.value = true;
            const updateResult = await window.sysapi.sites.updateNginxRoot(result.path);

            if (updateResult.error) {
                toast.error(`Failed to update: ${updateResult.error}`);
            } else {
                toast.success('Nginx root updated successfully!');
            }
        } catch (error) {
            console.error('Change Nginx root error:', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            isLoading.value = false;
            await loadSites();
        }
    };

    // Getters
    const filteredSites = computed(() => (searchQuery) => {
        return sites.value.filter(site => {
            const matchesTab = site.type === activeTab.value;
            const matchesSearch = !searchQuery ||
                site.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
                site.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesSearch;
        });
    });

    const getSiteCountForTab = (tabId) => {
        return sites.value.filter(site => site.type === tabId).length;
    };

    return {
        sites,
        webserver,
        isLoading,
        activeTab,
        phpVersions,
        loadSites,
        loadWebserver,
        loadPhpVersions,
        updatePhpVersion,
        startNodeSite,
        stopNodeSite,
        deleteSite,
        changeApacheRoot,
        changeNginxRoot,
        filteredSites,
        getSiteCountForTab
    };
});
