<template>
  <div class="flex flex-col h-full bg-[#1e1e1e] text-gray-300 font-sans text-sm">
    <!-- 1. Header - Search -->
    <div class="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]">
      <div class="flex items-center space-x-2">
        <span class="text-gray-400">Search App</span>
        <div class="relative">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Supports fuzzy search by application name, field" 
            class="w-96 bg-[#1e1e1e] border border-gray-600 rounded px-3 py-1.5 pl-8 focus:border-blue-500 focus:outline-none text-gray-200"
          >
          <Search class="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
      </div>
      <button 
        @click="updateAppList"
        :disabled="isUpdating"
        class="flex items-center space-x-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs"
      >
        <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isUpdating }" />
        <span>{{ isUpdating ? 'Updating...' : 'Update App List' }}</span>
      </button>
    </div>

    <!-- 2. Recently Used -->
    <div class="flex items-center space-x-4 p-3 border-b border-gray-700 bg-[#252526]">
      <span class="text-gray-500 text-xs">Recently used</span>
      <div class="flex items-center space-x-3">
        <div v-for="app in recentlyUsed" :key="app.id" 
            class="flex items-center space-x-1.5 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer text-xs">
          <component :is="getAppIcon(app.icon)" class="w-4 h-4" :class="app.iconColor" />
          <span>{{ app.name }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Category Tabs -->
    <div class="flex items-center space-x-1 p-2 border-b border-gray-700 bg-[#252526]">
      <span class="text-gray-500 text-xs mr-2">App Sort</span>
      <button 
        v-for="cat in categories" :key="cat.id"
        @click="activeCategory = cat.id"
        :class="[
          'px-3 py-1 rounded text-xs transition-colors',
          activeCategory === cat.id 
            ? 'bg-blue-600 text-white' 
            : 'bg-[#333] text-gray-300 hover:bg-[#444]'
        ]"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- 4. App Table -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 bg-[#2d2d2d] z-10 text-xs text-gray-400 font-normal">
          <tr>
            <th class="p-2 border-b border-gray-700">Software name</th>
            <th class="p-2 border-b border-gray-700 w-24">Developer</th>
            <th class="p-2 border-b border-gray-700">Instructions</th>
            <th class="p-2 border-b border-gray-700 w-20">Location</th>
            <th class="p-2 border-b border-gray-700 w-16 text-center">Status</th>
            <th class="p-2 border-b border-gray-700 w-24 text-center">Display on dashboard</th>
            <th class="p-2 border-b border-gray-700 w-32 text-center">Operate</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          <tr v-for="app in filteredApps" :key="app.id" 
              class="hover:bg-[#2a2d3e] transition-colors min-h-[50px] h-[50px]">
            <td class="px-2 py-2">
              <div class="flex items-center space-x-2">
                <component :is="getAppIcon(app.icon)" class="w-4 h-4" :class="app.iconColor" />
                <span class="text-white font-medium">{{ app.name }}</span>
              </div>
            </td>
            <td class="px-2 py-2 text-yellow-500">{{ app.developer }}</td>
            <td class="px-2 py-2 text-gray-400 text-xs truncate max-w-md">
              {{ app.description }}
              <a v-if="app.helpLink" href="#" class="text-blue-400 hover:underline ml-1">>> Help</a>
            </td>
            <td class="px-2 py-2 text-gray-500 text-center">
              <div v-if="app.status === 'installed'" class="flex items-center justify-center space-x-1 cursor-pointer" @click="openLocation(app)">
                <Folder class="w-4 h-4 text-yellow-500" />
              </div>
              <span v-else class="text-gray-500">--</span>
            </td>
            <td class="px-2 py-2 text-center">
              <div v-if="app.status === 'installed'" class="flex items-center justify-center space-x-1">
                <Play class="w-4 h-4 text-green-500" />
              </div>
              <span v-else class="text-gray-500">--</span>
            </td>
            <td class="px-2 py-2 text-center">
              <label v-if="app.status === 'installed'" class="relative inline-flex items-center cursor-pointer" @click.prevent="toggleDashboard(app)">
                <input type="checkbox" :checked="app.showOnDashboard" class="sr-only peer">
                <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
              </label>
              <span v-else class="text-gray-500">--</span>
            </td>
            <td class="px-2 py-2 text-center">
              <div class="flex items-center justify-center space-x-2">
                <template v-if="app.status === 'installed'">
                  <button class="text-blue-400 hover:text-blue-300 text-xs">Setting</button>
                  <button class="text-red-400 hover:text-red-300 text-xs" @click="uninstallApp(app)">Uninstall</button>
                </template>
                <button v-else class="text-green-400 hover:text-green-300 text-xs" @click="installApp(app)">Install</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 5. Footer with Pagination -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div>
        Total {{ filteredApps.length }} apps ({{ installedCount }} installed)
      </div>
      <div class="flex items-center space-x-2">
        <span class="mr-2">Items per page:</span>
        <select v-model="itemsPerPage" class="bg-[#333] border border-gray-600 rounded px-2 py-0.5 text-gray-200">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
        <button @click="prevPage" :disabled="currentPage === 1" 
            class="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronLeft class="w-3 h-3" />
        </button>
        <span class="bg-gray-700 px-2 py-0.5 rounded text-white">{{ currentPage }}</span>
        <span>/ {{ totalPages }}</span>
        <button @click="nextPage" :disabled="currentPage === totalPages" 
            class="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronRight class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Install Modal -->
    <div v-if="showInstallModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="closeInstallModal">
      <div class="bg-[#2d2d2d] rounded-lg shadow-xl w-[500px] max-w-[90vw]">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <div class="flex items-center space-x-3">
            <component :is="getAppIcon(installingApp?.icon)" class="w-6 h-6" :class="installingApp?.iconColor" />
            <div>
              <h3 class="text-white font-medium">Install {{ installingApp?.name }}</h3>
              <p class="text-gray-400 text-xs">Select version to install</p>
            </div>
          </div>
          <button @click="closeInstallModal" class="text-gray-400 hover:text-white" :disabled="isInstalling">
            <span class="text-xl">&times;</span>
          </button>
        </div>
        
        <!-- Body -->
        <div class="p-4">
          <!-- Version Selection -->
          <div v-if="!isInstalling" class="space-y-3">
            <label class="text-gray-300 text-sm">Select Version:</label>
            <div class="space-y-2 max-h-48 overflow-y-auto">
              <label 
                v-for="ver in installingApp?.versions" 
                :key="ver.version"
                class="flex items-center space-x-3 p-3 bg-[#1e1e1e] rounded cursor-pointer hover:bg-[#333] border border-transparent"
                :class="{ 'border-blue-500 bg-[#333]': selectedVersion?.version === ver.version }"
              >
                <input 
                  type="radio" 
                  :value="ver" 
                  v-model="selectedVersion"
                  class="text-blue-500"
                >
                <div class="flex-1">
                  <span class="text-white">v{{ ver.version }}</span>
                  <span class="text-gray-500 text-xs ml-2">{{ formatSize(ver.size) }}</span>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Progress & Logs -->
          <div v-else class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-300">{{ installStatus }}</span>
              <span class="text-gray-400">{{ installProgress }}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
              <div 
                class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: installProgress + '%' }"
              ></div>
            </div>
            
            <!-- Logs Container -->
            <div 
              ref="logsContainer"
              class="mt-4 bg-black/50 rounded p-2 h-32 overflow-y-auto font-mono text-xs border border-gray-700"
            >
              <div v-for="(log, index) in installLogs" :key="index" class="text-gray-400 whitespace-nowrap">
                {{ log }}
              </div>
              <div v-if="installLogs.length === 0" class="text-gray-600 italic">
                Waiting for logs...
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="flex justify-end space-x-3 p-4 border-t border-gray-700">
          <button 
            @click="isInstalling ? cancelInstall() : closeInstallModal()" 
            class="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm"
            :disabled="isCancelling"
          >
            {{ isCancelling ? 'Cancelling...' : (isInstalling ? 'Cancel' : 'Close') }}
          </button>
          <button 
            @click="confirmInstall" 
            class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm"
            :disabled="!selectedVersion || isInstalling"
          >
            {{ isInstalling ? 'Installing...' : 'Install' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { 
  Search, Shield, Database, Server, Globe, Box, Activity,
  Folder, Play, Settings, Terminal, HardDrive, Cpu, FileCode,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-vue-next';

// Categories
const categories = [
  { id: 'all', name: 'ALL' },
  { id: 'installed', name: 'Installed' },
  { id: 'deployment', name: 'Deployment' },
  { id: 'tools', name: 'Tools' },
  { id: 'plugins', name: 'Plug-ins' },
  { id: 'professional', name: 'Professional' }
];

const activeCategory = ref('all');
const searchQuery = ref('');

// Recently Used (from localStorage)
const recentlyUsed = ref([]);

onMounted(async () => {
  const saved = localStorage.getItem('recentlyUsedApps');
  if (saved) {
    recentlyUsed.value = JSON.parse(saved);
  } else {
    // Demo data
    recentlyUsed.value = [
      { id: 'webhook', name: 'WebHook', icon: 'Globe', iconColor: 'text-blue-400' },
      { id: 'postgresql', name: 'PostgreSQL Manager', icon: 'Database', iconColor: 'text-blue-400' },
      { id: 'log-cleanup', name: 'Log cleanup', icon: 'FileCode', iconColor: 'text-green-400' },
      { id: 'nodejs', name: 'Node.js version manager', icon: 'Terminal', iconColor: 'text-green-400' },
      { id: 'linux-tools', name: 'Linux Tools', icon: 'Terminal', iconColor: 'text-purple-400' }
    ];
  }
  
  // Load apps from JSON file
  await loadApps();
});

// Apps Data (loaded from JSON)
const apps = ref([]);
const isUpdating = ref(false);
const appListVersion = ref('');

// Install Modal State
const showInstallModal = ref(false);
const installingApp = ref(null);
const selectedVersion = ref(null);
const isInstalling = ref(false);
const isCancelling = ref(false);
const installProgress = ref(0);
const installStatus = ref('');
const installLogs = ref([]);
let progressCleanup = null;
const logsContainer = ref(null); // Reference for auto-scrolling

// Load apps from local JSON file
const loadApps = async () => {
  try {
    const result = await window.sysapi.apps.getList();
    if (result.error) {
      console.error('Failed to load apps:', result.error);
      return;
    }
    apps.value = result.apps || [];
    appListVersion.value = result.version || '';
  } catch (error) {
    console.error('Error loading apps:', error);
  }
};

// Update apps list from remote XML
const updateAppList = async () => {
  if (isUpdating.value) return;
  
  isUpdating.value = true;
  try {
    const result = await window.sysapi.apps.updateList();
    if (result.error) {
      alert(`Failed to update app list: ${result.error}`);
      return;
    }
    if (result.success && result.data) {
      apps.value = result.data.apps || [];
      appListVersion.value = result.data.version || '';
      alert(`App list updated successfully! (${result.updatedCount || 0} apps updated)`);
    }
  } catch (error) {
    console.error('Error updating apps:', error);
    alert(`Error: ${error.message}`);
  } finally {
    isUpdating.value = false;
  }
};

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Reset page when filter changes
watch([activeCategory, searchQuery], () => {
  currentPage.value = 1;
});

// Filtered Apps (before pagination)
const allFilteredApps = computed(() => {
  let result = apps.value;
  
  // Filter by category
  if (activeCategory.value === 'installed') {
    result = result.filter(app => app.status === 'installed');
  } else if (activeCategory.value !== 'all') {
    result = result.filter(app => app.category === activeCategory.value);
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(app => 
      app.name.toLowerCase().includes(query) || 
      app.description.toLowerCase().includes(query)
    );
  }
  
  return result;
});

// Paginated Apps
const filteredApps = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return allFilteredApps.value.slice(start, end);
});

const totalPages = computed(() => Math.max(1, Math.ceil(allFilteredApps.value.length / itemsPerPage.value)));
const installedCount = computed(() => apps.value.filter(a => a.status === 'installed').length);

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--;
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++;
};

// Icon mapping
const getAppIcon = (iconName) => {
  const icons = { Shield, Database, Server, Globe, Box, Activity, Folder, Play, Settings, Terminal, HardDrive, Cpu, FileCode };
  return icons[iconName] || Box;
};

// Actions - Using database
const installApp = (app) => {
  // Open modal for version selection
  openInstallModal(app);
};

const openInstallModal = (app) => {
  installingApp.value = app;
  selectedVersion.value = app.versions && app.versions.length > 0 ? app.versions[0] : null;
  showInstallModal.value = true;
  installProgress.value = 0;
  installStatus.value = '';
  installLogs.value = []; // Reset logs
  isInstalling.value = false;
  isCancelling.value = false;
};

const closeInstallModal = () => {
  if (isInstalling.value) return; // Don't close during installation
  showInstallModal.value = false;
  installingApp.value = null;
  selectedVersion.value = null;
  installLogs.value = [];
  if (progressCleanup) {
    progressCleanup();
    progressCleanup = null;
  }
};

const cancelInstall = async () => {
  if (!installingApp.value || isCancelling.value) return;
  
  isCancelling.value = true;
  installStatus.value = 'Cancelling...';
  installLogs.value.push(`[${new Date().toLocaleTimeString()}] Cancelling installation...`);
  
  try {
    const result = await window.sysapi.apps.cancelInstall(installingApp.value.id);
    if (result.success) {
      installLogs.value.push(`[${new Date().toLocaleTimeString()}] Installation cancelled.`);
      installStatus.value = 'Cancelled';
      isInstalling.value = false;
      
      // Close modal after a short delay
      setTimeout(() => {
        showInstallModal.value = false;
        installingApp.value = null;
        selectedVersion.value = null;
        installLogs.value = [];
        isCancelling.value = false;
        if (progressCleanup) {
          progressCleanup();
          progressCleanup = null;
        }
      }, 1000);
    } else {
      isCancelling.value = false;
    }
  } catch (err) {
    console.error('Failed to cancel:', err);
    installLogs.value.push(`[${new Date().toLocaleTimeString()}] [ERROR] Failed to cancel: ${err.message}`);
    isCancelling.value = false;
  }
};

const confirmInstall = async () => {
  if (!selectedVersion.value || !installingApp.value) return;
  
  isInstalling.value = true;
  installProgress.value = 0;
  installStatus.value = 'Starting...';
  installLogs.value.push(`[${new Date().toLocaleTimeString()}] Starting installation of ${installingApp.value.name}...`);
  
  // Listen for progress updates
  progressCleanup = window.sysapi.apps.onInstallProgress((data) => {
    if (data.appId === installingApp.value.id) {
      installProgress.value = data.progress;
      installStatus.value = data.status;
      
      // Add detailed log if available
      if (data.logDetail) {
        const lastLog = installLogs.value[installLogs.value.length - 1];
        // Update last log if same type, otherwise add new
        if (lastLog && lastLog.includes(data.status.replace('...', ''))) {
          // Replace last log with updated detail
          installLogs.value[installLogs.value.length - 1] = `[${new Date().toLocaleTimeString()}] ${data.logDetail}`;
        } else {
          installLogs.value.push(`[${new Date().toLocaleTimeString()}] ${data.logDetail}`);
        }
        // Auto scroll
        if (logsContainer.value) {
          setTimeout(() => {
            logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
          }, 0);
        }
      } else {
        // Fallback to status for logs without detail
        const lastLog = installLogs.value[installLogs.value.length - 1];
        if (!lastLog || !lastLog.includes(data.status)) {
          installLogs.value.push(`[${new Date().toLocaleTimeString()}] ${data.status}`);
          // Auto scroll
          if (logsContainer.value) {
            setTimeout(() => {
              logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
            }, 0);
          }
        }
      }
    }
  });
  
  try {
    const app = installingApp.value;
    const ver = selectedVersion.value;
    
    const result = await window.sysapi.apps.install(
      app.id,
      ver.version,
      ver.download_url,
      ver.filename,
      app.exec_file,
      app.group || null
    );
    
    if (result.error) {
      // Check if cancelled
      if (result.cancelled) {
        installStatus.value = 'Cancelled';
        installLogs.value.push(`[${new Date().toLocaleTimeString()}] Installation cancelled.`);
        isInstalling.value = false;
        setTimeout(() => {
          showInstallModal.value = false;
          installingApp.value = null;
          selectedVersion.value = null;
          installLogs.value = [];
        }, 1000);
        return;
      }
      
      console.error('Install result error:', result.error);
      installStatus.value = 'Installation Failed';
      installLogs.value.push(`[${new Date().toLocaleTimeString()}] [ERROR] ${result.error}`);
      isInstalling.value = false;
      // Scroll to bottom
      if (logsContainer.value) {
        setTimeout(() => {
            logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
        }, 0);
      }
      return;
    }
    
    // Update app status
    app.status = 'installed';
    app.installedVersion = ver.version;
    app.installPath = result.installPath;
    app.execPath = result.execPath;
    addToRecentlyUsed(app);
    
    // Close modal after short delay to show 100%
    setTimeout(() => {
      showInstallModal.value = false;
      installingApp.value = null;
      selectedVersion.value = null;
      isInstalling.value = false;
      if (progressCleanup) {
        progressCleanup();
        progressCleanup = null;
      }
    }, 1000);
    
  } catch (error) {
    console.error('Install error:', error);
    alert(`Error: ${error.message}`);
    isInstalling.value = false;
  }
};

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

const uninstallApp = async (app) => {
  if (!confirm(`Uninstall ${app.name}?`)) return;
  
  try {
    const result = await window.sysapi.apps.uninstall(app.id);
    if (result.error) {
      alert(`Failed to uninstall ${app.name}: ${result.error}`);
      return;
    }
    
    app.status = 'not_installed';
    app.showOnDashboard = false;
  } catch (error) {
    console.error('Uninstall error:', error);
    alert(`Error: ${error.message}`);
  }
};

const toggleDashboard = async (app) => {
  try {
    const newValue = !app.showOnDashboard;
    const result = await window.sysapi.apps.setDashboard(app.id, newValue);
    if (result.error) {
      alert(`Failed to update setting: ${result.error}`);
      // Revert the change
      app.showOnDashboard = !newValue;
      return;
    }
    app.showOnDashboard = newValue;
  } catch (error) {
    console.error('Toggle dashboard error:', error);
  }
};

const openLocation = async (app) => {
  if (!app.installPath || app.installPath === '--') return;
  
  try {
    const result = await window.sysapi.files.openFile(app.installPath);
    if (result.error) {
      alert(`Failed to open location: ${result.error}`);
    }
  } catch (error) {
    console.error('Open location error:', error);
  }
};

const addToRecentlyUsed = (app) => {
  const exists = recentlyUsed.value.find(a => a.id === app.id);
  if (!exists) {
    recentlyUsed.value.unshift({ id: app.id, name: app.name, icon: app.icon, iconColor: app.iconColor });
    if (recentlyUsed.value.length > 5) recentlyUsed.value.pop();
    localStorage.setItem('recentlyUsedApps', JSON.stringify(recentlyUsed.value));
  }
};
</script>
