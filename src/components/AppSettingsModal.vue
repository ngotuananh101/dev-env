<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
    <div class="bg-[#1a1a1a] rounded-lg shadow-2xl w-[900px] h-[600px] flex overflow-hidden border border-gray-700">
      <!-- Left Sidebar -->
      <div class="w-48 bg-[#141414] border-r border-gray-700 flex flex-col">
        <div class="p-4 border-b border-gray-700 h-14">
          <h2 class="text-md font-semibold text-white">{{ app?.name }}</h2>
        </div>
        <nav class="flex-1 py-2">
          <button
            v-for="item in menuItems"
            :key="item.id"
            @click="activePanel = item.id"
            class="w-full px-4 py-2 text-left text-sm transition-colors"
            :class="activePanel === item.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'"
          >
            {{ item.label }}
          </button>
        </nav>
      </div>

      <!-- Right Content -->
      <div class="flex-1 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-700 h-14">
          <span class="text-gray-400 text-sm">
            {{ currentMenuItem?.tip || '' }}
          </span>
          <button @click="close" class="text-gray-400 hover:text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-hidden p-4">
          <!-- Service Panel -->
          <div v-if="activePanel === 'service'" class="h-full flex flex-col items-start justify-center space-y-4">
            <div class="flex items-center space-x-2">
              <span class="text-gray-400">Status:</span>
              <span :class="serviceRunning ? 'text-green-400' : 'text-red-400'" class="font-medium">
                {{ serviceRunning ? 'Running' : 'Stopped' }}
              </span>
            </div>
            <div class="flex space-x-2">
              <button
                @click="startService"
                :disabled="serviceRunning || serviceLoading"
                class="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
              >
                Start
              </button>
              <button
                @click="stopService"
                :disabled="!serviceRunning || serviceLoading"
                class="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
              >
                Stop
              </button>
              <button
                @click="restartService"
                :disabled="!serviceRunning || serviceLoading"
                class="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
              >
                Restart
              </button>
            </div>
            <p v-if="serviceLoading" class="text-gray-400 text-sm">{{ serviceLoadingText }}</p>
            
            <!-- Service Console Logs -->
            <div class="flex-1 flex flex-col min-h-0 w-full">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-gray-400 text-sm font-medium">Console Output</h3>
                <button 
                  @click="clearServiceLogs" 
                  :disabled="serviceLogs.length === 0"
                  class="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <pre 
                ref="serviceLogContainer"
                class="flex-1 overflow-auto p-3 text-xs font-mono bg-black/50 text-gray-300 border border-gray-700 rounded select-text whitespace-pre-wrap"
              ><template v-if="serviceLogs.length === 0"><span class="text-gray-500">No console output yet. Start the service to see logs.</span></template><template v-else><div v-for="(log, idx) in serviceLogs" :key="idx" :class="getLogClass(log.type)"><span class="text-gray-500">[{{ log.timestamp }}]</span> {{ log.message }}</div></template></pre>
            </div>
          </div>

          <!-- Config Editor Panel -->
          <div v-if="currentMenuItem?.type === 'config'" class="h-full flex flex-col">
            <div ref="editorContainer" class="flex-1 border border-gray-700 rounded overflow-hidden"></div>
            
            <!-- Actions -->
            <div class="flex items-center justify-between mt-4">
              <div class="flex space-x-2">
                <button
                  @click="saveConfig"
                  :disabled="configLoading"
                  class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-white text-sm"
                >
                  Save
                </button>
                <button
                  @click="restoreConfig"
                  :disabled="configLoading || !hasBackup"
                  class="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 rounded text-white text-sm"
                >
                  Restore
                </button>
              </div>
              <span v-if="configMessage" :class="configMessageClass" class="text-sm">
                {{ configMessage }}
              </span>
            </div>

            <!-- Note -->
            <p class="mt-3 text-gray-500 text-xs">
              • This is the main configuration file. If you don't understand the rules, please don't modify it.
            </p>
          </div>

          <!-- Extensions Panel -->
          <div v-if="activePanel === 'extensions'" class="h-full flex flex-col">
             <div class="flex items-center justify-between mb-4">
               <h3 class="text-white font-medium">PHP Extensions</h3>
               <button 
                 @click="loadExtensions" 
                 :disabled="extensionsLoading"
                 class="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                 title="Refresh"
               >
                 <svg class="w-4 h-4" :class="{ 'animate-spin': extensionsLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                 </svg>
               </button>
             </div>
             
             <div v-if="extensionsLoading && extensions.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
               Loading extensions...
             </div>
             
             <div v-else class="flex-1 overflow-y-auto space-y-1 pr-2">
               <div v-for="ext in extensions" :key="ext.filename" 
                   class="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-gray-700 hover:border-gray-600 transition-colors">
                 <div class="flex flex-col">
                   <span class="text-white text-sm font-medium">{{ ext.name }}</span>
                   <span class="text-gray-500 text-xs">{{ ext.filename }}</span>
                 </div>
                 
                 <label class="relative inline-flex items-center cursor-pointer">
                   <input type="checkbox" :checked="ext.enabled" @change="toggleExtension(ext)" class="sr-only peer">
                   <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                 </label>
               </div>
               
               <div v-if="extensions.length === 0" class="text-center text-gray-500 py-8">
                 No extensions found in ext directory.
               </div>
             </div>
          </div>

          <!-- PHP Info Panel -->
          <div v-if="activePanel === 'phpinfo'" class="h-full flex flex-col">
             <div class="h-full bg-white rounded overflow-hidden">
               <div v-if="phpInfoLoading" class="h-full flex items-center justify-center text-gray-500 bg-[#1e1e1e]">
                 <div class="flex flex-col items-center space-y-2">
                   <svg class="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                     <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                     <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   <span>Loading PHP Info...</span>
                 </div>
               </div>
               <div v-else-if="phpInfoError" class="h-full flex items-center justify-center text-red-400 bg-[#1e1e1e] p-4 text-center">
                 {{ phpInfoError }}
               </div>
               <iframe v-else-if="phpInfoIsHtml" :srcdoc="phpInfoContent" class="w-full h-full border-none bg-white"></iframe>
               <pre v-else class="w-full h-full overflow-auto p-4 text-xs font-mono bg-[#1e1e1e] text-gray-300 select-text">{{ phpInfoContent }}</pre>
             </div>
          </div>

          <!-- Logs Panel -->
          <div v-if="activePanel === 'logs'" class="h-full flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center space-x-3">
                <select 
                  v-model="selectedLogFile" 
                  @change="loadLogContent"
                  class="bg-[#1e1e1e] border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select log file...</option>
                  <option v-for="file in logFiles" :key="file.name" :value="file.name">
                    {{ file.name }}
                  </option>
                </select>
                <span v-if="logSize" class="text-gray-500 text-xs">{{ formatLogSize(logSize) }}</span>
              </div>
              <div class="flex items-center space-x-2">
                <button 
                  @click="loadLogContent" 
                  :disabled="logsLoading || !selectedLogFile"
                  class="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50"
                  title="Refresh"
                >
                  <svg class="w-4 h-4" :class="{ 'animate-spin': logsLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </button>
                <button 
                  @click="clearLog" 
                  :disabled="logsLoading || !selectedLogFile"
                  class="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div v-if="logsLoading && !logContent" class="flex-1 flex items-center justify-center text-gray-500">
              Loading logs...
            </div>
            <div v-else-if="logFiles.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
              No log files found for this application.
            </div>
            <div v-else-if="!selectedLogFile" class="flex-1 flex items-center justify-center text-gray-500">
              Select a log file to view.
            </div>
            <pre 
              v-else
              ref="logContainer"
              class="flex-1 overflow-auto p-3 text-xs font-mono bg-black/50 text-gray-300 border border-gray-700 rounded select-text whitespace-pre-wrap"
            >{{ logContent || 'Log file is empty.' }}</pre>
          </div>

          <!-- NVM Versions Panel -->
          <div v-if="activePanel === 'versions'" class="h-full flex flex-col overflow-hidden">
             <!-- Tabs for list mode -->
             <div class="flex space-x-1 border-b border-gray-700 mb-4 pb-2">
               <button 
                 @click="nvmMode = 'installed'" 
                 class="px-4 py-1.5 text-sm rounded transition-colors"
                 :class="nvmMode === 'installed' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'"
               >
                 Installed
               </button>
               <button 
                 @click="nvmMode = 'available'" 
                 class="px-4 py-1.5 text-sm rounded transition-colors"
                 :class="nvmMode === 'available' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'"
               >
                 Available
               </button>
               
               <div class="flex-1"></div>
               
               <button 
                  @click="nvmMode === 'installed' ? loadNvmInstalled() : loadNvmAvailable()" 
                  :disabled="nvmLoading"
                  class="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                  title="Refresh"
                >
                  <svg class="w-4 h-4" :class="{ 'animate-spin': nvmLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </button>
             </div>

             <!-- Installed List -->
             <div v-if="nvmMode === 'installed'" class="flex-1 overflow-y-auto pr-2 space-y-2">
                <div v-for="ver in nvmInstalled" :key="ver" 
                     class="flex items-center justify-between p-3 rounded border transition-colors"
                     :class="ver === nvmCurrent ? 'bg-green-900/30 border-green-600' : 'bg-[#1e1e1e] border-gray-700 hover:border-gray-600'">
                  <div class="flex items-center space-x-3">
                    <span class="text-white font-mono text-sm">{{ ver }}</span>
                    <span v-if="ver === nvmCurrent" class="px-2 py-0.5 bg-green-600 text-white text-[10px] rounded uppercase font-bold tracking-wider">Current</span>
                  </div>
                  
                  <div class="flex space-x-2">
                    <button 
                      v-if="ver !== nvmCurrent"
                      @click="useNvmVersion(ver)"
                      :disabled="nvmLoading"
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
                    >
                      Use
                    </button>
                    <button 
                      v-if="ver !== nvmCurrent"
                      @click="uninstallNvmVersion(ver)"
                      :disabled="nvmLoading"
                      class="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
                    >
                      Uninstall
                    </button>
                  </div>
                </div>
                <div v-if="!nvmLoading && nvmInstalled.length === 0" class="text-center text-gray-500 py-8">
                   No versions installed.
                </div>
             </div>

             <!-- Available List -->
             <div v-else class="flex-1 flex flex-col overflow-hidden">
                <div class="flex space-x-4 mb-3 text-xs text-gray-400 border-b border-gray-800 pb-2">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" v-model="nvmFilter" value="lts" class="text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600">
                        <span>LTS Versions</span>
                    </label>
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" v-model="nvmFilter" value="current" class="text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600">
                        <span>Current Versions</span>
                    </label>
                </div>
                
                <div class="flex-1 overflow-y-auto pr-2 space-y-2">
                   <div v-for="ver in (nvmFilter === 'lts' ? nvmAvailableLts : nvmAvailableCurrent)" :key="ver.version" 
                        class="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-gray-700 hover:border-gray-600 transition-colors">
                     <div>
                       <div class="flex items-center space-x-2">
                         <span class="text-white font-mono text-sm">{{ ver.version }}</span>
                         <span v-if="ver.lts" class="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[10px] rounded">LTS: {{ ver.lts }}</span>
                       </div>
                       <div class="text-[10px] text-gray-500 mt-1">Released: {{ ver.date }}</div>
                     </div>
                     
                     <button 
                       v-if="isInstalled(ver.version)"
                       disabled
                       class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-xs cursor-not-allowed"
                     >
                       Installed
                     </button>
                     <button 
                       v-else
                       @click="installNvmVersion(ver.version)"
                       :disabled="nvmLoading"
                       class="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
                     >
                       Install
                     </button>
                   </div>
                   
                   <div v-if="!nvmLoading && (nvmFilter === 'lts' ? nvmAvailableLts : nvmAvailableCurrent).length === 0" class="text-center text-gray-500 py-8">
                       No versions found.
                   </div>
                </div>
             </div>

             <!-- status message -->
             <div v-if="nvmStatus" class="mt-2 text-xs text-center" :class="nvmStatusType === 'error' ? 'text-red-400' : 'text-blue-400'">
                {{ nvmStatus }}
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ace from 'ace-builds';

// Import ace modes and themes explicitly for bundling
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/mode-pgsql';
import 'ace-builds/src-noconflict/mode-ini';
import 'ace-builds/src-noconflict/mode-apache_conf';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';
import { useToast } from 'vue-toastification';

const toast = useToast();

const props = defineProps({
  show: Boolean,
  app: Object
});

const emit = defineEmits(['close']);

// Menu
const baseMenuItems = [{ id: 'service', label: 'Service', tip: 'Start, stop, or restart the service' }];

const menuItemAvailable = {
  config: { tip: 'Tips: Ctrl+S Save' },
  nginx: { tip: 'Tips: Ctrl+S Save, Nginx Configuration' },
  apache: { tip: 'Tips: Ctrl+S Save, Apache Configuration' },
  php: { tip: 'Tips: Ctrl+S Save, PHP.ini' },
  mysql: { tip: 'Tips: Ctrl+S Save, my.ini' },
  redis: { tip: 'Tips: Ctrl+S Save, redis.conf' },
  postgresql: { tip: 'Tips: Ctrl+S Save' }
};

const menuItems = computed(() => {
  // Special case for NVM: Only show Versions tab
  if (props.app?.id === 'nvm') {
      return [{
          id: 'versions',
          label: 'Versions',
          tip: 'Manage Node.js versions',
          type: 'versions'
      }];
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
        type: 'config' // Internal type for panel switching
      });
    });
  }

  // Add Logs tab for all installed apps (file-based logs)
  items.push({
    id: 'logs',
    label: 'Logs',
    tip: 'View runtime logs (access, error)',
    type: 'logs'
  });

  // Add Extensions and PHP Info tabs for PHP apps
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
      tip: 'View PHP Configuration (phpinfo)',
      type: 'phpinfo'
    });
  }
  
  return items;
});

const activePanel = ref(props.app?.id === 'nvm' ? 'versions' : 'service');

// Watch for tab changes to load data when user switches tabs
watch(activePanel, async (newPanel) => {
    if (newPanel === 'logs') {
        await loadLogFiles();
    } else if (newPanel === 'extensions') {
        await loadExtensions();
    } else if (newPanel === 'phpinfo') {
        await loadPhpInfo();
    } else if (newPanel === 'versions' && props.app?.id === 'nvm') {
        if (nvmInstalled.value.length === 0) await loadNvmInstalled();
    }
});

// Load initial data on mount
onMounted(async () => {
    // For NVM, load versions immediately
    if (props.app?.id === 'nvm') {
        await loadNvmInstalled();
    } else if (props.app?.execPath) {
        // For other apps, check service status
        await checkServiceStatus();
    }
});

const currentMenuItem = computed(() => menuItems.value.find(m => m.id === activePanel.value));

// Service state
const serviceRunning = ref(false);
const serviceLoading = ref(false);
const serviceLoadingText = ref('');

// Config state
const editorContainer = ref(null);
let editor = null;
const configContent = ref('');
const hasBackup = ref(false);
const configLoading = ref(false);
const configMessage = ref('');
const configMessageClass = ref('text-gray-400');

// Service logs state
const serviceLogs = ref([]);
const serviceLogContainer = ref(null);
let serviceLogUnsubscribe = null;



// Extension state
const extensions = ref([]);
const extensionsLoading = ref(false);

// PHP Info state
const phpInfoContent = ref('');
const phpInfoIsHtml = ref(false);
const phpInfoLoading = ref(false);
const phpInfoError = ref('');

// Logs state
const logFiles = ref([]);
const selectedLogFile = ref('');
const logContent = ref('');
const logSize = ref(0);
const logsLoading = ref(false);
const logContainer = ref(null);



// NVM State
const nvmMode = ref('installed'); // 'installed' | 'available'
const nvmFilter = ref('lts'); // 'lts' | 'current'
const nvmInstalled = ref([]);
const nvmCurrent = ref('');
const nvmAvailableLts = ref([]);
const nvmAvailableCurrent = ref([]);
const nvmLoading = ref(false);
const nvmStatus = ref('');
const nvmStatusType = ref('info');

// Watch nvmMode to load available versions when switching tabs
watch(nvmMode, async (mode) => {
    if (mode === 'available' && nvmAvailableLts.value.length === 0) {
        await loadNvmAvailable();
    }
});

const loadNvmInstalled = async () => {
    nvmLoading.value = true;
    nvmStatus.value = 'Checking installed versions...';
    nvmStatusType.value = 'info';
    try {
        const result = await window.sysapi.apps.nvmList();
        if (result.error) {
            nvmStatus.value = result.error;
            nvmStatusType.value = 'error';
        } else {
            nvmInstalled.value = result.installed || [];
            nvmCurrent.value = result.current || '';
            nvmStatus.value = '';
        }
    } catch (e) {
        nvmStatus.value = e.message;
        nvmStatusType.value = 'error';
    } finally {
        nvmLoading.value = false;
    }
};

const loadNvmAvailable = async () => {
    if (nvmAvailableLts.value.length > 0) return; // Cache for session
    nvmLoading.value = true;
    nvmStatus.value = 'Fetching available versions...';
    nvmStatusType.value = 'info';
    try {
        const result = await window.sysapi.apps.nvmListAvailable();
        if (result.error) {
            nvmStatus.value = result.error;
            nvmStatusType.value = 'error';
        } else {
            nvmAvailableLts.value = result.lts || [];
            nvmAvailableCurrent.value = result.current || [];
            nvmStatus.value = '';
        }
    } catch (e) {
        nvmStatus.value = e.message;
        nvmStatusType.value = 'error';
    } finally {
        nvmLoading.value = false;
    }
};

const isInstalled = (ver) => {
    return nvmInstalled.value.includes(ver);
};

const installNvmVersion = async (version) => {
    if (nvmLoading.value) return;
    nvmLoading.value = true;
    nvmStatus.value = `Installing v${version}... This may take a while.`;
    nvmStatusType.value = 'info';
    
    try {
        const result = await window.sysapi.apps.nvmInstall(version);
        if (result.error) {
            nvmStatus.value = `Install failed: ${result.error}`;
            nvmStatusType.value = 'error';
            toast.error(`Failed to install Node.js v${version}`);
        } else {
            nvmStatus.value = `Successfully installed v${version}`;
            nvmStatusType.value = 'success';
            toast.success(`Node.js v${version} installed`);
            await loadNvmInstalled();
            // Switch back to installed view to see it
            nvmMode.value = 'installed';
        }
    } catch (e) {
        nvmStatus.value = `Error: ${e.message}`;
        nvmStatusType.value = 'error';
    } finally {
        nvmLoading.value = false;
    }
};

const uninstallNvmVersion = async (version) => {
    if (!confirm(`Are you sure you want to uninstall Node.js v${version}?`)) return;
    
    nvmLoading.value = true;
    nvmStatus.value = `Uninstalling v${version}...`;
    try {
        const result = await window.sysapi.apps.nvmUninstall(version);
        if (result.error) {
            nvmStatus.value = `Uninstall failed: ${result.error}`;
            nvmStatusType.value = 'error';
            toast.error(`Failed to uninstall v${version}`);
        } else {
            nvmStatus.value = `Uninstalled v${version}`;
            nvmStatusType.value = 'success';
            toast.success(`Node.js v${version} uninstalled`);
            await loadNvmInstalled();
        }
    } catch (e) {
        nvmStatus.value = `Error: ${e.message}`;
        nvmStatusType.value = 'error';
    } finally {
        nvmLoading.value = false;
    }
};

const useNvmVersion = async (version) => {
    nvmLoading.value = true;
    nvmStatus.value = `Switching to v${version}... (Admin might be required)`;
    nvmStatusType.value = 'info';
    
    try {
        const result = await window.sysapi.apps.nvmUse(version);
        if (result.error) {
            nvmStatus.value = `Switch failed: ${result.error}`;
            nvmStatusType.value = 'error';
            toast.error(`Failed to switch to v${version}: ${result.error}`);
        } else {
            nvmStatus.value = `Now using v${version}`;
            nvmStatusType.value = 'success';
            toast.success(`Switched to Node.js v${version}`);
            await loadNvmInstalled();
        }
    } catch (e) {
        nvmStatus.value = `Error: ${e.message}`;
        nvmStatusType.value = 'error';
    } finally {
        nvmLoading.value = false;
    }
};

const loadPhpInfo = async () => {
    if (!props.app?.id) return;
    
    phpInfoLoading.value = true;
    phpInfoError.value = '';
    
    try {
        const result = await window.sysapi.apps.getPhpInfo(props.app.id);
        if (result.error) {
            phpInfoError.value = `Failed to load PHP Info: ${result.error}`;
        } else {
            phpInfoContent.value = result.content;
            phpInfoIsHtml.value = result.isHtml;
        }
    } catch (err) {
        console.error('PHP Info error:', err);
        phpInfoError.value = err.message;
    } finally {
        phpInfoLoading.value = false;
    }
};

// Logs methods
const loadLogFiles = async () => {
  if (!props.app?.id) return;
  
  logsLoading.value = true;
  logFiles.value = [];
  selectedLogFile.value = '';
  logContent.value = '';
  logSize.value = 0;
  
  try {
    const result = await window.sysapi.apps.getAppLogs(props.app.id);
    if (result.error) {
      toast.error(`Failed to load logs: ${result.error}`);
    } else {
      logFiles.value = result.files || [];
      // Auto-select first log file if available
      if (logFiles.value.length > 0) {
        selectedLogFile.value = logFiles.value[0].name;
        await loadLogContent();
      }
    }
  } catch (err) {
    console.error('Load log files error:', err);
    toast.error(err.message);
  } finally {
    logsLoading.value = false;
  }
};

const loadLogContent = async () => {
  if (!props.app?.id || !selectedLogFile.value) return;
  
  logsLoading.value = true;
  
  try {
    const result = await window.sysapi.apps.readAppLog(props.app.id, selectedLogFile.value);
    if (result.error) {
      toast.error(`Failed to read log: ${result.error}`);
      logContent.value = '';
    } else {
      logContent.value = result.content || '';
      logSize.value = result.size || 0;
      
      // Auto-scroll to bottom
      if (logContainer.value) {
        setTimeout(() => {
          logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }, 50);
      }
    }
  } catch (err) {
    console.error('Read log error:', err);
    toast.error(err.message);
  } finally {
    logsLoading.value = false;
  }
};

const clearLog = async () => {
  if (!props.app?.id || !selectedLogFile.value) return;
  if (!confirm(`Clear log file "${selectedLogFile.value}"?`)) return;
  
  logsLoading.value = true;
  
  try {
    const result = await window.sysapi.apps.clearAppLog(props.app.id, selectedLogFile.value);
    if (result.error) {
      toast.error(`Failed to clear log: ${result.error}`);
    } else {
      toast.success('Log cleared');
      logContent.value = '';
      logSize.value = 0;
    }
  } catch (err) {
    console.error('Clear log error:', err);
    toast.error(err.message);
  } finally {
    logsLoading.value = false;
  }
};

const formatLogSize = (bytes) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};



const loadExtensions = async () => {
  if (!props.app?.id) return;
  
  extensionsLoading.value = true;
  try {
    const result = await window.sysapi.apps.getExtensions(props.app.id);
    if (result.error) {
      toast.error(`Failed to load extensions: ${result.error}`);
    } else {
      extensions.value = result.extensions || [];
    }
  } catch (err) {
    console.error('Load extensions error:', err);
    toast.error(err.message);
  } finally {
    extensionsLoading.value = false;
  }
};

const toggleExtension = async (ext) => {
  if (extensionsLoading.value) return;
  
  // Optimistic update
  const originalState = ext.enabled;
  ext.enabled = !originalState;
  
  try {
    const extData = { name: ext.name, filename: ext.filename };
    const result = await window.sysapi.apps.toggleExtension(props.app.id, extData, ext.enabled);
    if (result.error) {
      // Revert on error
      ext.enabled = originalState;
      toast.error(`Failed to toggle extension: ${result.error}`);
    } else {
      toast.success(`${ext.name} ${ext.enabled ? 'enabled' : 'disabled'}`);
    }
  } catch (err) {
    // Revert on error
    ext.enabled = originalState;
    console.error('Toggle extension error:', err);
    toast.error(err.message);
  }
};

// Import service control composable
import { useServiceControl } from '../composables/useServiceControl';
const { 
  startService: startServiceApi, 
  stopService: stopServiceApi, 
  restartService: restartServiceApi, 
  checkServiceStatus: checkServiceStatusApi 
} = useServiceControl();

// Service logs methods
const loadServiceLogs = async () => {
  if (!props.app?.id) return;
  
  try {
    const result = await window.sysapi.apps.getServiceLogs(props.app.id);
    if (!result.error) {
      serviceLogs.value = result.logs || [];
      scrollServiceLogToBottom();
    }
  } catch (err) {
    console.error('Load service logs error:', err);
  }
};

const setupServiceLogListener = () => {
  if (!props.app?.id) return;
  
  // Unsubscribe previous listener
  if (serviceLogUnsubscribe) {
    serviceLogUnsubscribe();
  }
  
  // Subscribe to real-time logs
  serviceLogUnsubscribe = window.sysapi.apps.onServiceLog((data) => {
    if (data.appId === props.app.id) {
      serviceLogs.value.push({
        timestamp: data.timestamp,
        type: data.type,
        message: data.message
      });
      
      // Keep only last 100 logs
      if (serviceLogs.value.length > 100) {
        serviceLogs.value.shift();
      }
      
      scrollServiceLogToBottom();
    }
  });
};

const clearServiceLogs = async () => {
  if (!props.app?.id) return;
  
  try {
    await window.sysapi.apps.clearServiceLogs(props.app.id);
    serviceLogs.value = [];
  } catch (err) {
    console.error('Clear service logs error:', err);
  }
};

const scrollServiceLogToBottom = () => {
  if (serviceLogContainer.value) {
    setTimeout(() => {
      serviceLogContainer.value.scrollTop = serviceLogContainer.value.scrollHeight;
    }, 50);
  }
};

const getLogClass = (type) => {
  switch (type) {
    case 'stderr':
    case 'error':
      return 'text-red-400';
    case 'stdout':
      return 'text-green-300';
    default:
      return 'text-gray-300';
  }
};

// Check service status
const checkServiceStatus = async () => {
  if (!props.app?.execPath) return;
  serviceRunning.value = await checkServiceStatusApi(props.app);
};

// Start service
const startService = async () => {
  serviceLoading.value = true;
  serviceLoadingText.value = 'Starting...';
  
  const startArgs = props.app.serviceCommands?.start || '';
  const success = await startServiceApi(props.app, startArgs);
  
  if (success) {
    serviceLoadingText.value = 'Started successfully';
    await checkServiceStatus();
  } else {
    serviceLoadingText.value = 'Start failed';
  }
  
  setTimeout(() => {
    serviceLoading.value = false;
    serviceLoadingText.value = '';
  }, 1500);
};

// Stop service
const stopService = async () => {
  serviceLoading.value = true;
  serviceLoadingText.value = 'Stopping...';
  
  const stopArgs = props.app.serviceCommands?.stop || '';
  const success = await stopServiceApi(props.app, stopArgs);
  
  if (success) {
    serviceLoadingText.value = 'Stopped successfully';
    // Wait a bit for the process to fully stop before checking status
    await new Promise(resolve => setTimeout(resolve, 500));
    await checkServiceStatus();
  } else {
    serviceLoadingText.value = 'Stop failed';
  }
  
  setTimeout(() => {
    serviceLoading.value = false;
    serviceLoadingText.value = '';
  }, 1500);
};

// Restart service
const restartService = async () => {
  serviceLoading.value = true;
  serviceLoadingText.value = 'Restarting...';
  
  const startArgs = props.app.serviceCommands?.start || '';
  const stopArgs = props.app.serviceCommands?.stop || '';

  const success = await restartServiceApi(props.app, startArgs, stopArgs);
  
  if (success) {
    serviceLoadingText.value = 'Restarted successfully';
    await checkServiceStatus();
  } else {
    serviceLoadingText.value = 'Restart failed';
  }
  
  setTimeout(() => {
    serviceLoading.value = false;
    serviceLoadingText.value = '';
  }, 1500);
};

// Load config
const loadConfig = async () => {
  const menuItem = currentMenuItem.value;
  if (!menuItem || !menuItem.file || !props.app?.execPath) return;
  
  // Get app directory from execPath (parent directory of executable)
  const appDir = props.app.execPath.substring(0, props.app.execPath.lastIndexOf('\\'));
  
  configLoading.value = true;
  const result = await window.sysapi.apps.readConfig(appDir, menuItem.file);
  
  if (result.error) {
    configMessage.value = `Error: ${result.error}`;
    configMessageClass.value = 'text-red-400';
  } else {
    configContent.value = result.content;
    hasBackup.value = result.hasBackup;
    
    if (editor) {
      editor.setValue(result.content);
      editor.clearSelection();
    }
  }
  configLoading.value = false;
};

// Save config
const saveConfig = async () => {
  const menuItem = currentMenuItem.value;
  if (!editor || !menuItem || !menuItem.file || !props.app?.execPath) return;
  
  const appDir = props.app.execPath.substring(0, props.app.execPath.lastIndexOf('\\'));
  
  configLoading.value = true;
  configMessage.value = 'Saving...';
  configMessageClass.value = 'text-gray-400';
  
  const content = editor.getValue();
  const result = await window.sysapi.apps.saveConfig(appDir, menuItem.file, content);
  
  if (result.error) {
    configMessage.value = `Error: ${result.error}`;
    configMessageClass.value = 'text-red-400';
    toast.error(`Save failed: ${result.error}`);
  } else {
    configMessage.value = 'Saved successfully!';
    configMessageClass.value = 'text-green-400';
    hasBackup.value = result.hasBackup;
    toast.success('Config saved successfully');
  }
  
  configLoading.value = false;
  setTimeout(() => configMessage.value = '', 3000);
};

// Restore config
const restoreConfig = async () => {
  const menuItem = currentMenuItem.value;
  if (!menuItem || !menuItem.file || !props.app?.execPath) return;
  
  const appDir = props.app.execPath.substring(0, props.app.execPath.lastIndexOf('\\'));
  
  configLoading.value = true;
  configMessage.value = 'Restoring...';
  configMessageClass.value = 'text-gray-400';
  
  const result = await window.sysapi.apps.restoreConfig(appDir, menuItem.file);
  
  if (result.error) {
    configMessage.value = `Error: ${result.error}`;
    configMessageClass.value = 'text-red-400';
    toast.error(`Restore failed: ${result.error}`);
  } else {
    configMessage.value = 'Restored successfully!';
    configMessageClass.value = 'text-green-400';
    toast.success('Config restored successfully');
    
    if (editor && result.content) {
      editor.setValue(result.content);
      editor.clearSelection();
    }
  }
  
  configLoading.value = false;
  setTimeout(() => configMessage.value = '', 3000);
};

// Editor mode mapping
const configModes = {
  nginx: 'ace/mode/nginx',
  postgres: 'ace/mode/ini',
  mysql: 'ace/mode/ini',
  php: 'ace/mode/ini',
  redis: 'ace/mode/ini',
  apache: 'ace/mode/apache_conf',
  default: 'ace/mode/text'
};

// Initialize Ace editor
const initEditor = async () => {
  await nextTick();
  
  if (!editorContainer.value || editor) return;
  
  // Determine mode based on config type
  const menuItem = currentMenuItem.value;
  // If we have a specific type in the menu item (from apps.json), use it. 
  // Otherwise fall back to text.
  // Note: apps.json 'type' fields used: nginx, apache, php, mysql, redis, postgresql
  let mode = configModes.default;
  
  if (menuItem && props.app?.configs) {
    // Find the config entry triggering this
    const config = props.app.configs.find(c => c.id === menuItem.id);
    if (config && config.type) {
       // Handle special case, or map directly if key exists
       // Our keys in apps.json are: nginx, apache, php, mysql, redis, postgresql
       // configModes keys: nginx, postgres(pgsql), mysql, php, redis, apache
       if (config.type === 'postgresql') mode = configModes.postgres;
       else if (configModes[config.type]) mode = configModes[config.type];
    }
  }

  editor = ace.edit(editorContainer.value, {
    mode: mode,
    theme: 'ace/theme/monokai',
    fontSize: 13,
    showPrintMargin: false,
    wrap: true,
    tabSize: 4,
    useSoftTabs: true
  });
  
  editor.setValue(configContent.value, -1);
  
  // Ctrl+S to save
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => saveConfig()
  });
};

// Watch for panel change to init editor
watch(activePanel, async (newPanel) => {
  configMessage.value = '';
  configMessageClass.value = '';
  // Check if the new panel is a config panel
  const menuItem = menuItems.value.find(m => m.id === newPanel);
  const isConfigPanel = menuItem && menuItem.type === 'config';

  if (isConfigPanel) {
    // Ensure we start fresh
    if (editor) {
      editor.destroy();
      editor = null;
    }
    await loadConfig();
    await initEditor();
  } else if (newPanel === 'extensions') {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    await loadExtensions();
  } else if (newPanel === 'phpinfo') {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    await loadPhpInfo();
  } else if (newPanel === 'logs') {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    await loadLogFiles();
  } else {
    // Clean up when leaving config panel
    if (editor) {
      editor.destroy();
      editor = null;
    }
  }
});

// Watch for modal open
watch(() => props.show, async (isShow) => {
  if (isShow) {
    activePanel.value = 'service';
    await checkServiceStatus();
    // Load and subscribe to service logs
    await loadServiceLogs();
    setupServiceLogListener();
  } else {
    // Cleanup editor and content
    configContent.value = '';
    configMessage.value = '';
    configMessageClass.value = '';
    if (editor) {
      editor.destroy();
      editor = null;
    }
  }
});

const close = () => {
  emit('close');
};

onUnmounted(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
  // Cleanup service log listener
  if (serviceLogUnsubscribe) {
    serviceLogUnsubscribe();
    serviceLogUnsubscribe = null;
  }
});
</script>
