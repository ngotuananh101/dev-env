<template>
    <div class="h-full flex flex-col p-6 animate-fade-in overflow-auto">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold text-white flex items-center space-x-2">
                <Settings class="w-6 h-6 text-blue-400" />
                <span>Settings</span>
            </h1>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <!-- Site Configuration -->
            <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50 backdrop-blur-sm">
                <h2 class="text-lg font-semibold text-white mb-4">Site Configuration</h2>
                
                <div class="space-y-6">
                    <!-- Default PHP Version -->
                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-gray-400">Default PHP Version</label>
                        <div class="flex items-center space-x-2">
                            <select 
                                v-model="settings.default_php_version" 
                                class="flex-1 bg-gray-900 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-600 appearance-none"
                                @change="saveSetting('default_php_version', settings.default_php_version)"
                            >
                                <option value="" disabled>Select PHP Version</option>
                                <option v-for="php in phpVersions" :key="php.id" :value="php.installedVersion">
                                    PHP {{ php.installedVersion }}
                                </option>
                            </select>
                        </div>
                        <p v-if="phpVersions.length === 0" class="text-xs text-yellow-500">
                            No PHP versions installed. Please install PHP from the dashboard.
                        </p>
                    </div>

                    <!-- Site Template -->
                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-gray-400">Default Site Template</label>
                        <div class="flex items-center space-x-2">
                            <input 
                                v-model="settings.site_template" 
                                type="text" 
                                placeholder="[site].local"
                                class="flex-1 bg-gray-900 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-gray-600"
                                @change="saveSetting('site_template', settings.site_template)"
                            >
                        </div>
                        <p class="text-xs text-gray-500">
                            Pattern for default local domain. Use <code class="bg-gray-800 px-1 rounded text-gray-300">[site]</code> as placeholder for the site name.
                        </p>
                    </div>

                    <!-- Auto Create -->
                    <div class="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                        <div class="space-y-1">
                            <span class="block text-sm font-medium text-white">Auto-create Sites</span>
                            <span class="block text-xs text-gray-500">Automatically create site base on root folder. Only create as PHP site.</span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                v-model="settings.site_auto_create" 
                                class="sr-only peer"
                                @change="saveSetting('site_auto_create', settings.site_auto_create)"
                            >
                            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            <!-- System Information -->
            <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50 backdrop-blur-sm">
                <h2 class="text-lg font-semibold text-white mb-4">System Information</h2>
                <p class="text-sm text-gray-400 mb-4">View detailed information about your system and application.</p>
                <button 
                    @click="openSystemInfo"
                    :disabled="loadingSystemInfo"
                    class="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white rounded-lg transition-colors"
                >
                    <Monitor class="w-4 h-4" />
                    <span>{{ loadingSystemInfo ? 'Loading...' : 'View System Info' }}</span>
                </button>
            </div>
        </div>

        <!-- System Info Modal -->
        <div v-if="showSystemInfoModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" @click.self="showSystemInfoModal = false">
            <div class="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl mx-4">
                <div class="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 class="text-lg font-semibold text-white flex items-center space-x-2">
                        <Monitor class="w-5 h-5 text-blue-400" />
                        <span>System Information</span>
                    </h3>
                    <button @click="showSystemInfoModal = false" class="text-gray-400 hover:text-white transition-colors">
                        <X class="w-5 h-5" />
                    </button>
                </div>
                <div class="flex-1 overflow-hidden p-4 min-h-0">
                    <textarea 
                        v-model="systemInfoContent"
                        readonly
                        class="w-full h-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 font-mono text-sm resize-none focus:outline-none overflow-auto"
                    ></textarea>
                </div>
                <div class="flex justify-end p-4 border-t border-gray-700">
                    <button 
                        @click="copySystemInfo"
                        class="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors mr-2"
                    >
                        <Copy class="w-4 h-4" />
                        <span>Copy</span>
                    </button>
                    <button 
                        @click="showSystemInfoModal = false"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDatabaseStore } from '../stores/database';
import { Settings, Monitor, X, Copy } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';

const dbStore = useDatabaseStore();
const toast = useToast();

const settings = ref({
    site_template: '',
    site_auto_create: false,
    default_php_version: ''
});

const phpVersions = ref([]);

// System Info
const showSystemInfoModal = ref(false);
const loadingSystemInfo = ref(false);
const systemInfoContent = ref('');

const openSystemInfo = async () => {
    loadingSystemInfo.value = true;
    try {
        const result = await window.sysapi.getSystemInfo();
        if (result.success) {
            systemInfoContent.value = result.info;
            showSystemInfoModal.value = true;
        } else {
            toast.error(`Failed to get system info: ${result.error}`);
        }
    } catch (error) {
        console.error('Failed to get system info:', error);
        toast.error('Failed to get system info');
    } finally {
        loadingSystemInfo.value = false;
    }
};

const copySystemInfo = async () => {
    try {
        await navigator.clipboard.writeText(systemInfoContent.value);
        toast.success('Copied to clipboard');
    } catch (error) {
        toast.error('Failed to copy');
    }
};

onMounted(async () => {
    await dbStore.loadSettings();
    settings.value.site_template = dbStore.settings.site_template || '[site].local';
    settings.value.default_php_version = dbStore.settings.default_php_version || '';
    // Convert string 'true'/'false' to boolean for checkbox
    settings.value.site_auto_create = dbStore.settings.site_auto_create === 'true' || dbStore.settings.site_auto_create === true;

    // Load installed PHP versions
    try {
        const result = await window.sysapi.apps.getList();
        if (result.apps) {
            phpVersions.value = result.apps.filter(app => app.id.startsWith('php') && app.status === 'installed');
            // Sort by version desc
            phpVersions.value.sort((a, b) => b.installedVersion.localeCompare(a.installedVersion, undefined, { numeric: true }));
        }
    } catch (error) {
        console.error('Failed to load apps:', error);
    }
});

const saveSetting = async (key, value) => {
    try {
        // Special handling for site_template - update all existing sites
        if (key === 'site_template') {
            const oldTemplate = dbStore.settings.site_template;
            if (oldTemplate && oldTemplate !== value) {
                toast.info('Updating sites with new template...');
                const result = await window.sysapi.sites.updateTemplate(oldTemplate, value);
                
                if (result.error) {
                    toast.error(`Failed to update sites: ${result.error}`);
                    // Don't return - still save the setting so user can retry
                }
                
                if (result.updated && result.updated.length > 0) {
                    toast.success(`Updated ${result.updated.length} site(s) to new template`);
                }
                
                if (result.failed && result.failed.length > 0) {
                    const failedNames = result.failed.map(f => f.site).join(', ');
                    toast.warning(`${result.failed.length} site(s) could not be updated: ${failedNames}`);
                    console.warn('Failed sites:', result.failed);
                }
            }
        }
        
        // Always save the setting to database
        console.log(`Saving setting ${key} = ${value}`);
        await dbStore.saveSetting(key, value);
        
        // Update local state as well
        settings.value[key] = value;
        
        toast.success(`Saved ${key}`);
    } catch (error) {
        console.error('Save setting error:', error);
        toast.error(`Failed to save ${key}`);
    }
};
</script>
