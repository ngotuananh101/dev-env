<template>
    <div v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
        <div
            class="bg-[#141414] rounded-xl shadow-2xl w-[1000px] h-[700px] max-w-full max-h-[90vh] flex overflow-hidden border border-gray-800 ring-1 ring-white/10">

            <!-- Left Sidebar -->
            <AppSettingsSidebar :app="app" :menu-items="menuItems" :active-panel="activePanel"
                @update:activePanel="activePanel = $event" />

            <!-- Right Content -->
            <div class="flex-1 flex flex-col min-w-0 bg-[#0f0f0f]">
                <!-- Header -->
                <div class="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-[#141414]">
                    <div class="flex flex-col">
                        <h3 class="text-white font-medium tracking-wide text-sm uppercase">{{ currentMenuItem?.label ||
                            'Settings' }}</h3>
                        <span class="text-gray-500 text-xs mt-0.5" v-if="currentMenuItem?.tip">
                            {{ currentMenuItem.tip }}
                        </span>
                    </div>
                    <button @click="close"
                        class="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-full">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Content Area -->
                <div class="flex-1 overflow-hidden p-6 relative">
                    <Transition name="fade" mode="out-in">
                        <div :key="activePanel" class="h-full">
                            <!-- Service Panel -->
                            <AppSettingsService v-if="activePanel === 'service'" :service-running="serviceRunning"
                                :loading="serviceLoading" :loading-text="serviceLoadingText" :logs="serviceLogs"
                                @start="startService" @stop="stopService" @restart="restartService"
                                @clearLogs="clearServiceLogs" />

                            <!-- Config Editor Panel -->
                            <AppSettingsConfig v-else-if="currentMenuItem?.type === 'config'" :content="configContent"
                                :type="currentMenuItem.configType || 'text'" :filename="currentMenuItem.file"
                                :loading="configLoading" :has-backup="hasBackup" :message="configMessage"
                                :message-type="configMessageClass.includes('red') ? 'error' : 'success'"
                                @save="saveConfig" @restore="restoreConfig" @change="val => configContent = val" />

                            <!-- Extensions Panel -->
                            <AppSettingsExtensions v-else-if="activePanel === 'extensions'" :app="app" />

                            <!-- PHP Info Panel -->
                            <AppSettingsPhpInfo v-else-if="activePanel === 'phpinfo'" :app="app" />

                            <!-- Logs Panel -->
                            <AppSettingsLogs v-else-if="activePanel === 'logs'" :app="app" />

                            <!-- NVM Versions Panel -->
                            <AppSettingsNvm v-else-if="activePanel === 'versions'" :app="app" />

                            <!-- pyenv Versions Panel -->
                            <AppSettingsPyenv v-else-if="activePanel === 'pyenv-versions'" :app="app" />
                        </div>
                    </Transition>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'vue-toastification';

// Import sub-components
import AppSettingsSidebar from './settings/AppSettingsSidebar.vue';
import AppSettingsService from './settings/AppSettingsService.vue';
import AppSettingsConfig from './settings/AppSettingsConfig.vue';
import AppSettingsLogs from './settings/AppSettingsLogs.vue';
import AppSettingsExtensions from './settings/AppSettingsExtensions.vue';
import AppSettingsPhpInfo from './settings/AppSettingsPhpInfo.vue';
import AppSettingsNvm from './settings/AppSettingsNvm.vue';
import AppSettingsPyenv from './settings/AppSettingsPyenv.vue';

const toast = useToast();

const props = defineProps({
    show: Boolean,
    app: Object
});

const emit = defineEmits(['close']);

const close = () => {
    emit('close');
};

// Menu Items Configuration
const baseMenuItems = [{ id: 'service', label: 'Service', tip: 'Start, stop, or restart the service' }];

const menuItemAvailable = {
    config: { tip: 'Tips: Ctrl+S Save' },
    nginx: { tip: 'Tips: Ctrl+S Save, Nginx Configuration' },
    apache: { tip: 'Tips: Ctrl+S Save, Apache Configuration' },
    php: { tip: 'Tips: Ctrl+S Save, PHP.ini' },
    mysql: { tip: 'Tips: Ctrl+S Save, my.ini' },
    redis: { tip: 'Tips: Ctrl+S Save, redis.conf' },
    postgresql: { tip: 'Tips: Ctrl+S Save' },
    phpmyadmin: { tip: 'Tips: Ctrl+S Save' }
};

const menuItems = computed(() => {
    // Special case for NVM
    if (props.app?.id === 'nvm') {
        return [{
            id: 'versions',
            label: 'Versions',
            tip: 'Manage Node.js versions',
            type: 'versions'
        }];
    }

    // Special case for pyenv
    if (props.app?.id === 'pyenv') {
        return [{
            id: 'pyenv-versions',
            label: 'Versions',
            tip: 'Manage Python versions',
            type: 'pyenv-versions'
        }];
    }

    // Special case for phpMyAdmin
    if (props.app?.id === 'phpmyadmin') {
        const configItems = [];
        if (props.app?.configs) {
            props.app.configs.forEach(conf => {
                configItems.push({
                    id: conf.id,
                    label: conf.name,
                    tip: 'Manage ' + conf.name,
                    file: conf.file,
                    type: 'config',
                    configType: conf.type || 'php'
                });
            });
        }
        return configItems;
    }

    const items = [...baseMenuItems];

    // Add config files
    if (props.app?.configs) {
        props.app.configs.forEach(conf => {
            const typeInfo = menuItemAvailable[conf.type] || menuItemAvailable.config;
            items.push({
                id: conf.id,
                label: conf.name,
                tip: typeInfo.tip,
                file: conf.file,
                type: 'config',
                configType: conf.type
            });
        });
    }

    // Add Logs tab
    items.push({
        id: 'logs',
        label: 'Logs',
        tip: 'View runtime logs',
        type: 'logs'
    });

    // Add Extensions and PHP Info for PHP apps
    if (props.app?.id && props.app.id.startsWith('php')) {
        items.push({
            id: 'extensions',
            label: 'Extensions',
            tip: 'Enable or disable PHP extensions',
            type: 'extensions'
        });
        items.push({
            id: 'phpinfo',
            label: 'PHP Info',
            tip: 'View PHP Configuration',
            type: 'phpinfo'
        });
    }

    return items;
});

const activePanel = ref('service');
const currentMenuItem = computed(() => menuItems.value.find(m => m.id === activePanel.value));

// Init panel selection
watch(() => props.app?.id, () => {
    if (props.app?.id === 'phpmyadmin') {
        activePanel.value = props.app.configs?.[0]?.id || 'phpmyadmin_config';
    } else if (props.app?.id === 'nvm') {
        activePanel.value = 'versions';
    } else if (props.app?.id === 'pyenv') {
        activePanel.value = 'pyenv-versions';
    } else {
        activePanel.value = 'service';
    }
}, { immediate: true });

// --------------------------------------------------------------------------
// Service Control Logic
// --------------------------------------------------------------------------
const serviceRunning = ref(false);
const serviceLoading = ref(false);
const serviceLoadingText = ref('');
const serviceLogs = ref([]);
let serviceLogUnsubscribe = null;

const checkServiceStatus = async () => {
    if (!props.app?.id || props.app?.id === 'nvm' || props.app?.id === 'phpmyadmin' || props.app?.id === 'pyenv') return;

    // Initial status check
    try {
        const status = await window.sysapi.apps.getServiceStatus(props.app.id, props.app.execPath);
        serviceRunning.value = status.running;
    } catch {
        serviceRunning.value = false;
    }

    // Subscribe to logs/status updates
    if (serviceLogUnsubscribe) serviceLogUnsubscribe();
    serviceLogUnsubscribe = window.sysapi.apps.onServiceLog(props.app.id, (data) => {
        if (data.type === 'status') {
            serviceRunning.value = data.running;
        } else {
            serviceLogs.value.push(data);
        }
    });
};

const startService = async () => {
    if (serviceLoading.value) return;
    serviceLoading.value = true;
    serviceLoadingText.value = 'Starting service...';

    const args = props.app.service_commands?.start || props.app.default_args || '';

    try {
        await window.sysapi.apps.startService(props.app.id, props.app.execPath, args);
        await checkServiceStatus();
    } catch (err) {
        toast.error(`Start failed: ${err.message}`);
    } finally {
        serviceLoading.value = false;
        serviceLoadingText.value = '';
    }
};

const stopService = async () => {
    if (serviceLoading.value) return;
    serviceLoading.value = true;
    serviceLoadingText.value = 'Stopping service...';

    const args = props.app.service_commands?.stop || '';

    try {
        await window.sysapi.apps.stopService(props.app.id, props.app.execPath, args);
        await checkServiceStatus();
    } catch (err) {
        toast.error(`Stop failed: ${err.message}`);
    } finally {
        serviceLoading.value = false;
        serviceLoadingText.value = '';
    }
};

const restartService = async () => {
    if (serviceLoading.value) return;
    serviceLoading.value = true;
    serviceLoadingText.value = 'Restarting service...';

    const startArgs = props.app.service_commands?.start || props.app.default_args || '';
    const stopArgs = props.app.service_commands?.stop || '';

    try {
        await window.sysapi.apps.restartService(props.app.id, props.app.execPath, startArgs, stopArgs);
        await checkServiceStatus();
    } catch (err) {
        toast.error(`Restart failed: ${err.message}`);
    } finally {
        serviceLoading.value = false;
        serviceLoadingText.value = '';
    }
};

const clearServiceLogs = () => {
    serviceLogs.value = [];
};

onMounted(() => {
    checkServiceStatus();
});

// Cleanup listener
const unwatchApp = watch(() => props.app?.id, () => {
    checkServiceStatus();
});

// --------------------------------------------------------------------------
// Config Logic
// --------------------------------------------------------------------------
const configContent = ref('');
const configLoading = ref(false);
const hasBackup = ref(false);
const configMessage = ref('');
const configMessageClass = ref('');

const loadConfig = async () => {
    // Only load if current item is a config
    if (currentMenuItem.value?.type !== 'config') return;
    const configFile = currentMenuItem.value.file;
    const lastBackslash = props.app.execPath.lastIndexOf('\\');
    const lastForwardSlash = props.app.execPath.lastIndexOf('/');
    const lastSlash = Math.max(lastBackslash, lastForwardSlash);
    const appDir = lastSlash > 0 ? props.app.execPath.substring(0, lastSlash) : props.app.execPath;
    configLoading.value = true;
    configMessage.value = '';

    try {
        const result = await window.sysapi.apps.readConfig(appDir, configFile);
        if (result.error) {
            toast.error(result.error);
        } else {
            configContent.value = result.content;
            hasBackup.value = result.hasBackup;
        }
    } catch (err) {
        toast.error(`Failed to load config: ${err.message}`);
    } finally {
        configLoading.value = false;
    }
};

const saveConfig = async (content) => {
    if (currentMenuItem.value?.type !== 'config') return;
    const configFile = currentMenuItem.value.file;
    const lastBackslash = props.app.execPath.lastIndexOf('\\');
    const lastForwardSlash = props.app.execPath.lastIndexOf('/');
    const lastSlash = Math.max(lastBackslash, lastForwardSlash);
    const appDir = lastSlash > 0 ? props.app.execPath.substring(0, lastSlash) : props.app.execPath;

    configLoading.value = true;
    configMessage.value = 'Saving...';
    configMessageClass.value = 'text-blue-400';

    try {
        const result = await window.sysapi.apps.saveConfig(appDir, configFile, content || configContent.value);
        if (result.error) {
            configMessage.value = 'Save failed';
            configMessageClass.value = 'text-red-400';
            toast.error(result.error);
        } else {
            configMessage.value = 'Saved successfully';
            configMessageClass.value = 'text-green-400';
            hasBackup.value = true;
            toast.success('Configuration saved');

            setTimeout(() => {
                if (configMessage.value === 'Saved successfully') {
                    configMessage.value = '';
                }
            }, 3000);
        }
    } catch (err) {
        configMessage.value = 'Error saving';
        configMessageClass.value = 'text-red-400';
        toast.error(err.message);
    } finally {
        configLoading.value = false;
    }
};

const restoreConfig = async () => {
    if (!confirm('Are you sure you want to restore the configuration from backup? Current changes will be lost.')) return;

    const configFile = currentMenuItem.value.file;
    const lastBackslash = props.app.execPath.lastIndexOf('\\');
    const lastForwardSlash = props.app.execPath.lastIndexOf('/');
    const lastSlash = Math.max(lastBackslash, lastForwardSlash);
    const appDir = lastSlash > 0 ? props.app.execPath.substring(0, lastSlash) : props.app.execPath;
    configLoading.value = true;

    try {
        const result = await window.sysapi.apps.restoreConfig(appDir, configFile);
        if (result.error) {
            toast.error(result.error);
        } else {
            configContent.value = result.content;
            toast.success('Configuration restored');
        }
    } catch (err) {
        toast.error(`Restore failed: ${err.message}`);
    } finally {
        configLoading.value = false;
    }
};

// Watch for tab changes to load specific data
watch(activePanel, (newPanel) => {
    const item = menuItems.value.find(m => m.id === newPanel);
    if (item && item.type === 'config') {
        loadConfig();
    }
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
    opacity: 0;
    transform: translateY(10px);
}

.fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>
