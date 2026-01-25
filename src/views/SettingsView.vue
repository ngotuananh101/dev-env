<template>
    <div class="h-full flex flex-col p-6 animate-fade-in">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold text-white flex items-center space-x-2">
                <Settings class="w-6 h-6 text-blue-400" />
                <span>Settings</span>
            </h1>
        </div>

        <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50 backdrop-blur-sm w-full xl:w-1/2">
            <h2 class="text-lg font-semibold text-white mb-4">Site Configuration</h2>
            
            <div class="space-y-6">
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
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDatabaseStore } from '../stores/database';
import { Settings } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';

const dbStore = useDatabaseStore();
const toast = useToast();

const settings = ref({
    site_template: '',
    site_auto_create: false
});

onMounted(async () => {
    await dbStore.loadSettings();
    settings.value.site_template = dbStore.settings.site_template || '[site].local';
    // Convert string 'true'/'false' to boolean for checkbox
    settings.value.site_auto_create = dbStore.settings.site_auto_create === 'true' || dbStore.settings.site_auto_create === true;
});

const saveSetting = async (key, value) => {
    try {
        await dbStore.saveSetting(key, value);
        toast.success(`Saved ${key}`);
    } catch (error) {
        console.error(error);
        toast.error(`Failed to save ${key}`);
    }
};
</script>
