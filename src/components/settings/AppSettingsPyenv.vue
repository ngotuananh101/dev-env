<template>
  <div class="h-full flex flex-col overflow-hidden bg-[#1e1e1e] rounded-lg border border-gray-800 shadow-sm">
     <!-- Tabs -->
     <div class="flex space-x-1 border-b border-gray-800 p-2 bg-[#1a1a1a]">
       <button
         @click="mode = 'installed'"
         class="px-5 py-2 text-sm rounded-md transition-all duration-200"
         :class="mode === 'installed' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'"
       >
         Installed Versions
       </button>
       <button
         @click="mode = 'available'"
         class="px-5 py-2 text-sm rounded-md transition-all duration-200"
         :class="mode === 'available' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'"
       >
         Available to Install
       </button>

       <div class="flex-1"></div>

       <button
          @click="mode === 'installed' ? loadInstalled() : loadAvailable()"
          :disabled="loading"
          class="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
     </div>

     <!-- Status Bar -->
     <div v-if="status" class="px-3 py-1.5 text-xs text-center border-b border-gray-800 transition-colors duration-300" :class="statusType === 'error' ? 'bg-red-900/20 text-red-300' : 'bg-blue-900/20 text-blue-300'">
        {{ status }}
     </div>

     <!-- Installed List -->
     <div v-if="mode === 'installed'" class="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div v-if="!loading && installed.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
            <svg class="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            <p>No Python versions installed.</p>
            <button @click="mode = 'available'" class="mt-2 text-blue-400 hover:text-blue-300 underline text-sm">Install one now</button>
        </div>

        <div v-else class="space-y-2">
            <div v-for="ver in installed" :key="ver"
                class="flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group"
                :class="ver === current ? 'bg-[#1a2e3a] border-blue-800/50 shadow-sm' : 'bg-[#252525] border-gray-800 hover:border-gray-600'">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center" :class="ver === current ? 'bg-blue-900/40 text-blue-400' : 'bg-gray-800 text-gray-400'">
                    <span class="font-mono text-xs font-bold">{{ ver.split('.')[0] }}</span>
                </div>
                <div class="flex flex-col">
                    <div class="flex items-center space-x-2">
                        <span class="text-white font-mono text-base font-medium">{{ ver }}</span>
                        <span v-if="ver === current" class="px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded uppercase font-bold tracking-wider shadow-sm">Global</span>
                    </div>
                </div>
            </div>

            <div class="flex space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                v-if="ver !== current"
                @click="setGlobal(ver)"
                :disabled="loading"
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs font-medium transition-colors"
                >
                Set Global
                </button>
                <button
                v-if="ver !== current"
                @click="uninstallVersion(ver)"
                :disabled="loading"
                class="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs font-medium transition-colors"
                >
                Uninstall
                </button>
            </div>
            </div>
        </div>
     </div>

     <!-- Available List -->
     <div v-else class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            <div v-if="loading && availableVersions.length === 0" class="flex justify-center py-10">
                <div class="flex flex-col items-center">
                    <svg class="w-8 h-8 animate-spin text-blue-500 mb-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span class="text-gray-500 text-sm">Fetching versions...</span>
                </div>
            </div>

            <div v-else-if="availableVersions.length === 0" class="text-center text-gray-500 py-10">
                No versions found.
            </div>

           <div v-else v-for="ver in availableVersions" :key="ver.version"
                class="flex items-center justify-between p-3 bg-[#252525] rounded-lg border border-gray-800 hover:border-gray-600 transition-all duration-200">
             <div>
               <div class="flex items-center space-x-3">
                 <span class="text-white font-mono text-sm font-bold">{{ ver.version }}</span>
               </div>
               <div class="text-[10px] text-gray-500 mt-1">Released: {{ formatDate(ver.date) }}</div>
             </div>

             <button
               v-if="isInstalled(ver.version)"
               disabled
               class="px-3 py-1.5 bg-gray-800 text-gray-500 border border-gray-700 rounded text-xs cursor-not-allowed font-medium"
             >
               Installed
             </button>
             <button
               v-else
               @click="installVersion(ver.version)"
               :disabled="loading"
               class="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs font-medium transition-colors shadow-sm shadow-blue-900/20"
             >
               Install
             </button>
           </div>
        </div>
     </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useToast } from 'vue-toastification';

const toast = useToast();
const props = defineProps({
  app: Object
});

const mode = ref('installed'); // 'installed' | 'available'

const installed = ref([]);
const current = ref('');
const availableVersions = ref([]);

const loading = ref(false);
const status = ref('');
const statusType = ref('info');

const loadInstalled = async () => {
    loading.value = true;
    status.value = 'Checking installed versions...';
    statusType.value = 'info';
    try {
        const result = await window.sysapi.apps.pyenvList();
        if (result.error) {
            status.value = result.error;
            statusType.value = 'error';
        } else {
            installed.value = result.installed || [];
            current.value = result.current || '';
            status.value = '';
        }
    } catch (e) {
        status.value = e.message;
        statusType.value = 'error';
    } finally {
        loading.value = false;
    }
};

const loadAvailable = async () => {
    if (availableVersions.value.length > 0) return; // Cache
    loading.value = true;
    status.value = 'Fetching available versions...';
    statusType.value = 'info';
    try {
        const result = await window.sysapi.apps.pyenvListAvailable();
        if (result.error) {
            status.value = result.error;
            statusType.value = 'error';
        } else {
            availableVersions.value = result.versions || [];
            status.value = '';
        }
    } catch (e) {
        status.value = e.message;
        statusType.value = 'error';
    } finally {
        loading.value = false;
    }
};

const isInstalled = (ver) => {
    return installed.value.includes(ver);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    } catch {
        return dateStr;
    }
};

const installVersion = async (version) => {
    if (loading.value) return;
    loading.value = true;
    status.value = `Installing Python ${version}... This may take a while.`;
    statusType.value = 'info';

    try {
        const result = await window.sysapi.apps.pyenvInstall(version);
        if (result.error) {
            status.value = `Install failed: ${result.error}`;
            statusType.value = 'error';
            toast.error(`Failed to install Python ${version}`);
        } else {
            status.value = `Successfully installed Python ${version}`;
            statusType.value = 'success';
            toast.success(`Python ${version} installed`);
            await loadInstalled();
            mode.value = 'installed';
        }
    } catch (e) {
        status.value = `Error: ${e.message}`;
        statusType.value = 'error';
    } finally {
        loading.value = false;
    }
};

const uninstallVersion = async (version) => {
    if (!confirm(`Are you sure you want to uninstall Python ${version}?`)) return;

    loading.value = true;
    status.value = `Uninstalling Python ${version}...`;
    try {
        const result = await window.sysapi.apps.pyenvUninstall(version);
        if (result.error) {
            status.value = `Uninstall failed: ${result.error}`;
            statusType.value = 'error';
            toast.error(`Failed to uninstall Python ${version}`);
        } else {
            status.value = `Uninstalled Python ${version}`;
            statusType.value = 'success';
            toast.success(`Python ${version} uninstalled`);
            await loadInstalled();
        }
    } catch (e) {
        status.value = `Error: ${e.message}`;
        statusType.value = 'error';
    } finally {
        loading.value = false;
    }
};

const setGlobal = async (version) => {
    loading.value = true;
    status.value = `Setting Python ${version} as global...`;
    statusType.value = 'info';

    try {
        const result = await window.sysapi.apps.pyenvGlobal(version);
        if (result.error) {
            status.value = `Failed to set global: ${result.error}`;
            statusType.value = 'error';
            toast.error(`Failed to set Python ${version} as global: ${result.error}`);
        } else {
            status.value = `Python ${version} is now global`;
            statusType.value = 'success';
            toast.success(`Set Python ${version} as global`);
            await loadInstalled();
        }
    } catch (e) {
        status.value = `Error: ${e.message}`;
        statusType.value = 'error';
    } finally {
        loading.value = false;
    }
};

watch(mode, (newMode) => {
    if (newMode === 'installed') {
        if (installed.value.length === 0) loadInstalled();
    } else {
        if (availableVersions.value.length === 0) loadAvailable();
    }
});

onMounted(() => {
    loadInstalled();
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #1e1e1e;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>

