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
            <BaseCard title="Site Configuration">
                <div class="space-y-6">
                    <!-- Default PHP Version -->
                    <div class="space-y-2">
                        <BaseSelect v-model="settings.default_php_version" label="Default PHP Version"
                            placeholder="Select PHP Version"
                            :options="phpVersions.map(p => ({ label: `PHP ${p.installedVersion}`, value: p.installedVersion }))" />
                        <p v-if="phpVersions.length === 0" class="text-xs text-yellow-500 mt-1">
                            No PHP versions installed. Please install PHP from the dashboard.
                        </p>
                    </div>

                    <!-- Site Template -->
                    <div class="space-y-2">
                        <BaseInput v-model="settings.site_template" label="Default Site Template"
                            placeholder="[site].local"
                            hint="Pattern for default local domain. Use [site] as placeholder for the site name." />
                    </div>

                    <!-- Auto Create -->
                    <div
                        class="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                        <div class="space-y-1">
                            <span class="block text-sm font-medium text-white">Auto-create Sites</span>
                            <span class="block text-xs text-gray-500">Automatically create site base on root folder.
                                Only create as PHP site.</span>
                        </div>
                        <BaseSwitch v-model="settings.site_auto_create" />
                    </div>
                </div>
                <template #footer>
                    <BaseButton variant="success" :disabled="isSaving" @click="saveAllSettings">
                        <template #icon>
                            <Save class="w-4 h-4" />
                        </template>
                        {{ isSaving ? 'Saving...' : 'Save Settings' }}
                    </BaseButton>
                </template>
            </BaseCard>

            <!-- System Information -->
            <BaseCard title="System Information">
                <p class="text-sm text-gray-400 mb-4">View detailed information about your system and application.</p>
                <BaseButton variant="primary" :disabled="loadingSystemInfo" @click="openSystemInfo">
                    <template #icon>
                        <Monitor class="w-4 h-4" />
                    </template>
                    {{ loadingSystemInfo ? 'Loading...' : 'View System Info' }}
                </BaseButton>
            </BaseCard>

            <!-- SSL Certificate -->
            <BaseCard title="SSL Certificate">
                <p class="text-sm text-gray-400 mb-4">Manage SSL certificates for local HTTPS development.</p>

                <!-- CA Status -->
                <div class="mb-4 p-3 rounded-lg border"
                    :class="sslStatus.caInstalledInSystem ? 'bg-green-900/30 border-green-700/50' : 'bg-yellow-900/30 border-yellow-700/50'">
                    <div class="flex items-center space-x-2">
                        <div class="w-2 h-2 rounded-full"
                            :class="sslStatus.caInstalledInSystem ? 'bg-green-500' : 'bg-yellow-500'">
                        </div>
                        <span class="text-sm"
                            :class="sslStatus.caInstalledInSystem ? 'text-green-400' : 'text-yellow-400'">
                            {{ sslStatus.caInstalledInSystem
                                ? 'CA is installed in system trust store'
                                : 'CA is not installed - browsers will show warnings'
                            }}
                        </span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-3">
                    <BaseButton v-if="!sslStatus.caInstalledInSystem" variant="success" :disabled="installingCA"
                        @click="installCA">
                        <template #icon>
                            <ShieldCheck class="w-4 h-4" />
                        </template>
                        {{ installingCA ? 'Installing...' : 'Install CA to System' }}
                    </BaseButton>

                    <BaseButton variant="secondary" @click="refreshSSLStatus">
                        <template #icon>
                            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loadingSSL }" />
                        </template>
                        Refresh Status
                    </BaseButton>
                </div>

                <p v-if="sslStatus.caCertPath" class="text-xs text-gray-500 mt-3 break-all font-mono">
                    CA Path: {{ sslStatus.caCertPath }}
                </p>
            </BaseCard>
        </div>

        <!-- System Info Modal -->
        <BaseModal :show="showSystemInfoModal" maxWidth="800px" @close="showSystemInfoModal = false">
            <template #title>
                <div class="flex items-center space-x-2">
                    <Monitor class="w-5 h-5 text-blue-400" />
                    <span>System Information</span>
                </div>
            </template>

            <div class="h-[60vh] flex flex-col">
                <textarea v-model="systemInfoContent" readonly
                    class="w-full h-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 font-mono text-sm resize-none focus:outline-none custom-scrollbar"></textarea>
            </div>

            <template #footer>
                <BaseButton variant="secondary" @click="copySystemInfo">
                    <template #icon>
                        <Copy class="w-4 h-4" />
                    </template>
                    Copy
                </BaseButton>
                <BaseButton variant="primary" @click="showSystemInfoModal = false">
                    Close
                </BaseButton>
            </template>
        </BaseModal>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDatabaseStore } from '../stores/database';
import { Settings, Monitor, X, Copy, Save, ShieldCheck, RefreshCw } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import BaseCard from '../components/BaseCard.vue';
import BaseButton from '../components/BaseButton.vue';
import BaseModal from '../components/BaseModal.vue';
import BaseInput from '../components/BaseInput.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseSwitch from '../components/BaseSwitch.vue';
import { copyToClipboard } from '../utils/helpers';

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
const isSaving = ref(false);

// SSL
const sslStatus = ref({
    initialized: false,
    caExists: false,
    caInstalledInSystem: false,
    sslDir: null,
    caCertPath: null
});
const installingCA = ref(false);
const loadingSSL = ref(false);

const refreshSSLStatus = async () => {
    loadingSSL.value = true;
    try {
        const status = await window.sysapi.ssl.getStatus();
        sslStatus.value = status;
    } catch (error) {
        console.error('Failed to get SSL status:', error);
    } finally {
        loadingSSL.value = false;
    }
};

const installCA = async () => {
    installingCA.value = true;
    try {
        const result = await window.sysapi.ssl.installCA();
        if (result.success) {
            if (result.alreadyInstalled) {
                toast.info('CA is already installed in system');
            } else {
                toast.success('CA installed successfully!');
            }
            await refreshSSLStatus();
        } else {
            toast.error(`Failed to install CA: ${result.error || 'Cancelled by user'}`);
        }
    } catch (error) {
        console.error('Failed to install CA:', error);
        toast.error('Failed to install CA');
    } finally {
        installingCA.value = false;
    }
};

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
    await copyToClipboard(systemInfoContent.value, 'Copied to clipboard', 'Failed to copy');
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

    // Load SSL status
    await refreshSSLStatus();
});

const saveAllSettings = async () => {
    isSaving.value = true;
    try {
        // Special handling for site_template - update all existing sites
        const oldTemplate = dbStore.settings.site_template;
        if (oldTemplate && oldTemplate !== settings.value.site_template) {
            toast.info('Updating sites with new template...');
            const result = await window.sysapi.sites.updateTemplate(oldTemplate, settings.value.site_template);

            if (result.error) {
                toast.error(`Failed to update sites: ${result.error}`);
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

        // Local update for default_php_version with side effects (phpMyAdmin config)
        if (settings.value.default_php_version !== dbStore.settings.default_php_version) {
            const result = await window.sysapi.apps.updateDefaultPhp(settings.value.default_php_version);
            if (result.error) throw new Error(result.error);
        }

        await dbStore.saveSetting('site_template', settings.value.site_template);
        await dbStore.saveSetting('site_auto_create', settings.value.site_auto_create);

        // Reload settings to ensure store is in sync
        await dbStore.loadSettings();

        toast.success('Settings saved successfully!');
    } catch (error) {
        console.error('Save settings error:', error);
        toast.error('Failed to save settings');
    } finally {
        isSaving.value = false;
    }
};
</script>
