<template>
  <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
    <!-- 1. Header - Search -->
    <div class="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]">
      <div class="flex items-center space-x-2">
        <span class="text-gray-400">Search App</span>
        <div class="w-96">
          <BaseInput v-model="searchQuery" placeholder="Supports fuzzy search by application name, field">
            <template #prepend>
              <Search class="w-4 h-4" />
            </template>
          </BaseInput>
        </div>
      </div>
      <BaseButton :disabled="appsStore.isUpdating" @click="appsStore.updateAppList" size="sm">
        <template #icon>
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': appsStore.isUpdating }" />
        </template>
        {{ appsStore.isUpdating ? 'Updating...' : 'Update App List' }}
      </BaseButton>
    </div>

    <!-- 2. Recently Used -->
    <div class="flex items-center space-x-4 p-3 border-b border-gray-700 bg-[#252526]">
      <span class="text-gray-500 text-xs">Recently used</span>
      <div class="flex items-center space-x-3">
        <div v-for="app in recentlyUsed" :key="app.id"
          class="flex items-center space-x-1.5 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer text-xs">
          <img v-if="app.iconContent" :src="app.iconContent" class="w-4 h-4" :alt="app.name" />
          <component v-else :is="getAppIcon(app.icon)" class="w-4 h-4" :class="app.iconColor" />
          <span>{{ app.name }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Category Tabs -->
    <div class="flex items-center space-x-1 p-2 border-b border-gray-700 bg-[#252526]">
      <span class="text-gray-500 text-xs mr-2">App Sort</span>
      <button v-for="cat in categories" :key="cat.id" @click="appsStore.activeCategory = cat.id" :class="[
        'px-3 py-1 rounded text-xs transition-colors',
        appsStore.activeCategory === cat.id
          ? 'bg-blue-600 text-white'
          : 'bg-[#333] text-gray-300 hover:bg-[#444]'
      ]">
        {{ cat.name }}
      </button>
    </div>

    <!-- 4. App Table -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <!-- Table Header -->
      <div class="bg-background-secondary flex text-xs text-gray-400 font-normal border-b border-gray-700">
        <div class="p-2 w-40 min-w-40">Software name</div>
        <div class="p-2 w-24 min-w-24">Developer</div>
        <div class="p-2 flex-1 min-w-40">Instructions</div>
        <div class="p-2 w-20 min-w-20 text-center">Location</div>
        <div class="p-2 w-16 min-w-16 text-center">Status</div>
        <div class="p-2 w-24 min-w-24 text-center">Add to PATH</div>
        <div class="p-2 w-32 min-w-32 text-center">Operate</div>
      </div>

      <!-- Virtual Scroller for Apps -->
      <RecycleScroller class="flex-1" :items="filteredApps" :item-size="50" key-field="id" v-slot="{ item: app }">
        <div class="flex items-center hover:bg-[#2a2d3e] transition-colors h-12.5 border-b border-gray-800">
          <!-- Software name -->
          <div class="px-2 py-2 w-40 min-w-40">
            <div class="flex items-center space-x-2">
              <img v-if="app.iconContent" :src="app.iconContent" class="w-4 h-4" alt="app icon" />
              <component v-else :is="getAppIcon(app.icon)" class="w-4 h-4" :class="app.iconColor" />
              <span class="text-white font-medium">{{ app.name }}</span>
            </div>
          </div>
          <!-- Developer -->
          <div class="px-2 py-2 w-24 min-w-24 text-yellow-500">{{ app.developer }}</div>
          <!-- Instructions -->
          <div class="px-2 py-2 flex-1 min-w-40 text-gray-400 text-xs truncate">
            {{ app.description }}
          </div>
          <!-- Location -->
          <div class="px-2 py-2 w-20 min-w-20 text-center">
            <div v-if="app.status === 'installed'" class="flex items-center justify-center cursor-pointer"
              @click="openLocation(app)">
              <Folder class="w-4 h-4 text-yellow-500" />
            </div>
            <span v-else class="text-gray-500">--</span>
          </div>
          <!-- Status -->
          <div class="px-2 py-2 w-16 min-w-16 text-center">
            <div v-if="app.status === 'installed' && app.execPath && !['nvm', 'phpmyadmin', 'pyenv'].includes(app.id)"
              class="flex items-center justify-center space-x-1">
              <!-- Service is running -->
              <template v-if="app.serviceRunning">
                <button @click="stopService(app)" :disabled="app.serviceLoading"
                  class="p-1 hover:bg-red-500/20 rounded transition-colors" title="Stop Service">
                  <Square class="w-4 h-4 text-red-500" />
                </button>
                <button @click="restartService(app)" :disabled="app.serviceLoading"
                  class="p-1 hover:bg-yellow-500/20 rounded transition-colors" title="Restart Service">
                  <RotateCw class="w-4 h-4 text-yellow-500" :class="{ 'animate-spin': app.serviceLoading }" />
                </button>
              </template>
              <!-- Service is not running -->
              <template v-else>
                <button @click="startService(app)" :disabled="app.serviceLoading"
                  class="p-1 hover:bg-green-500/20 rounded transition-colors" title="Start Service">
                  <Play v-if="!app.serviceLoading" class="w-4 h-4 text-green-500" />
                  <RotateCw v-else class="w-4 h-4 text-green-500 animate-spin" />
                </button>
              </template>
            </div>
            <span v-else class="text-gray-500">--</span>
          </div>
          <!-- Add to PATH -->
          <div class="px-2 py-2 w-24 min-w-24 text-center">
            <label v-if="app.status === 'installed' && app.installPath && app.id !== 'phpmyadmin' && app.id !== 'pyenv'"
              class="relative inline-flex items-center cursor-pointer" @click.prevent="appsStore.togglePath(app)">
              <input type="checkbox" :checked="app.inPath" class="sr-only peer">
              <div
                class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600">
              </div>
            </label>
            <span v-else class="text-gray-500">--</span>
          </div>
          <!-- Operate -->
          <div class="px-2 py-2 w-32 min-w-32 text-center">
            <ActionButtonGroup>
              <template v-if="app.status === 'installed'">
                <button class="text-blue-400 hover:text-blue-300 text-xs" @click="openSettings(app)">Setting</button>
                <button class="text-red-400 hover:text-red-300 text-xs"
                  @click="appsStore.uninstallApp(app)">Uninstall</button>
              </template>
              <button v-else class="text-green-400 hover:text-green-300 text-xs"
                @click="installApp(app)">Install</button>
            </ActionButtonGroup>
          </div>
        </div>
      </RecycleScroller>
    </div>

    <!-- 5. Footer with Pagination -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div>
        Total {{ allFilteredApps.length }} apps ({{ installedCount }} installed)
      </div>
      <div class="flex items-center space-x-2">
        <span class="mr-2">Items per page:</span>
        <select v-model="itemsPerPage" class="bg-[#333] border border-gray-600 rounded px-2 py-0.5 text-gray-200">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="-1">All</option>
        </select>
        <template v-if="itemsPerPage !== -1">
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
        </template>
        <span v-else class="text-green-400">Virtual Scroll Enabled</span>
      </div>
    </div>

    <!-- Install Modal -->
    <div v-if="showInstallModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="closeInstallModal">
      <div class="bg-background-secondary rounded-lg shadow-xl w-125 max-w-[90vw]">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <div class="flex items-center space-x-3">
            <img v-if="installingApp?.iconContent" :src="installingApp.iconContent" class="w-6 h-6"
              :alt="installingApp?.name" />
            <component v-else :is="getAppIcon(installingApp?.icon)" class="w-6 h-6" :class="installingApp?.iconColor" />
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
            <div v-if="isLoadingVersions" class="flex flex-col items-center justify-center p-8 space-y-3">
              <RotateCw class="w-8 h-8 text-blue-500 animate-spin" />
              <span class="text-gray-400">Loading versions...</span>
            </div>
            <div v-else-if="!installingApp?.versions || installingApp?.versions.length === 0"
              class="text-center p-8 text-gray-500">
              No versions available for this application.
            </div>
            <div v-else>
              <label class="text-gray-300 text-sm">Select Version:</label>
              <div class="space-y-2 max-h-48 overflow-y-auto mt-2">
                <label v-for="ver in installingApp?.versions" :key="ver.version"
                  class="flex items-center space-x-3 p-3 bg-background rounded cursor-pointer hover:bg-[#333] border border-transparent"
                  :class="{ 'border-blue-500 bg-[#333]': selectedVersion?.version === ver.version }">
                  <input type="radio" :value="ver" v-model="selectedVersion" class="text-blue-500">
                  <div class="flex-1">
                    <span class="text-white">{{ ver.version }}</span>
                    <span v-if="ver.size > 0" class="text-gray-500 text-xs ml-2">{{ formatBytes(ver.size) }}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Progress & Logs -->
          <div v-else class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-300">{{ installStatus }}</span>
              <span class="text-gray-400">{{ installProgress }}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
              <div class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: installProgress + '%' }"></div>
            </div>

            <!-- Logs Container -->
            <div ref="logsContainer"
              class="mt-4 bg-black/50 rounded p-2 h-32 overflow-y-auto font-mono text-xs border border-gray-700">
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
          <BaseButton variant="secondary" :disabled="isCancelling"
            @click="isInstalling ? cancelInstall() : closeInstallModal()">
            {{ isCancelling ? 'Cancelling...' : (isInstalling ? 'Cancel' : 'Close') }}
          </BaseButton>
          <BaseButton variant="success" :disabled="!selectedVersion || isInstalling || isLoadingVersions"
            @click="confirmInstall">
            {{ isInstalling ? 'Installing...' : 'Install' }}
          </BaseButton>
        </div>
      </div>
    </div>
    <!-- App Settings Modal -->
    <AppSettingsModal v-if="showSettingsModal" :show="showSettingsModal" :app="settingsApp" @close="closeSettings" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue';
import {
  Search, Shield, Database, Server, Globe, Box, Activity,
  Folder, Play, Settings, Terminal, HardDrive, Cpu, FileCode,
  ChevronLeft, ChevronRight, RefreshCw, Square, RotateCw
} from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import { useAppsStore } from '@/stores/apps';
import BaseButton from '../components/BaseButton.vue';
import ActionButtonGroup from '../components/ActionButtonGroup.vue';
import BaseInput from '../components/BaseInput.vue';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { formatBytes } from '@/utils/helpers';
import { RecycleScroller } from 'vue3-virtual-scroller';
import 'vue3-virtual-scroller/dist/vue3-virtual-scroller.css';

// Lazy load heavy modal component
const AppSettingsModal = defineAsyncComponent(() =>
  import('../components/AppSettingsModal.vue')
);

const toast = useToast();
const appsStore = useAppsStore();

// Categories
const categories = [
  { id: 'all', name: 'ALL' },
  { id: 'installed', name: 'Installed' },
  { id: 'deployment', name: 'Deployment' },
  { id: 'tools', name: 'Tools' },
  { id: 'plugins', name: 'Plug-ins' },
  { id: 'professional', name: 'Professional' }
];

// Debounced search for better performance
const { value: searchQuery, debouncedValue: debouncedSearchQuery } = useDebouncedRef('', 300);

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
  await appsStore.loadApps();

  // Initial service status check
  await checkServiceStatuses();

  // Check service status every 5 seconds
  statusCheckInterval = setInterval(checkServiceStatuses, 5000);
});

// Install Modal State
const showInstallModal = ref(false);
const installingApp = ref(null);
const isLoadingVersions = ref(false);
const selectedVersion = ref(null);
const isInstalling = ref(false);
const isCancelling = ref(false);
const installProgress = ref(0);
const installStatus = ref('');
const installLogs = ref([]);
let progressCleanup = null;
const logsContainer = ref(null); // Reference for auto-scrolling

// Settings Modal State
const showSettingsModal = ref(false);
const settingsApp = ref(null);

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Reset page when filter changes - use debounced value
watch([() => appsStore.activeCategory, debouncedSearchQuery], () => {
  currentPage.value = 1;
});

// Filtered Apps (before pagination) - uses debounced search for better performance
const allFilteredApps = computed(() => appsStore.allFilteredApps(debouncedSearchQuery.value));

// Paginated Apps (or all when itemsPerPage is -1 for virtual scrolling)
const filteredApps = computed(() => {
  // If "All" is selected, return all items for virtual scrolling
  if (itemsPerPage.value === -1) {
    return allFilteredApps.value;
  }
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return allFilteredApps.value.slice(start, end);
});

const totalPages = computed(() => {
  if (itemsPerPage.value === -1) return 1;
  return Math.max(1, Math.ceil(allFilteredApps.value.length / itemsPerPage.value));
});
const installedCount = computed(() => appsStore.apps.filter(a => a.status === 'installed').length);

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
  // Check dependencies for phpMyAdmin
  if (app.id === 'phpmyadmin') {
    const phpInstalled = appsStore.apps.some(a => a.id.startsWith('php') && a.status === 'installed');
    const webServerInstalled = appsStore.apps.some(a => (a.id === 'apache' || a.id === 'nginx') && a.status === 'installed');

    if (!phpInstalled || !webServerInstalled) {
      const missing = [];
      if (!phpInstalled) missing.push('PHP');
      if (!webServerInstalled) missing.push('Web Server (Apache/Nginx)');

      toast.error(`Cannot install phpMyAdmin. Missing dependencies: ${missing.join(', ')}`);
      return;
    }
  }

  installingApp.value = app;
  showInstallModal.value = true;
  installProgress.value = 0;
  installStatus.value = '';
  installLogs.value = []; // Reset logs
  isInstalling.value = false;
  isCancelling.value = false;
  selectedVersion.value = null;

  // Check if we need to fetch versions (MariaDB, Redis, PHP, Nginx, or PostgreSQL)
  if (app.id === 'mariadb' || app.id === 'redis' || app.id.startsWith('php') || app.id === 'nginx' || app.id === 'postgresql') {
    isLoadingVersions.value = true;
    // Clear existing versions to avoid confusion
    installingApp.value = { ...app, versions: [] };

    window.sysapi.apps.getVersions(app.id)
      .then(versions => {
        if (installingApp.value && installingApp.value.id === app.id) {
          installingApp.value.versions = versions;
          if (versions.length > 0) {
            selectedVersion.value = versions[0];
          }
        }
      })
      .catch(err => {
        console.error('Failed to fetch versions:', err);
        toast.error('Failed to fetch versions');
      })
      .finally(() => {
        isLoadingVersions.value = false;
      });
  } else {
    isLoadingVersions.value = false;
    selectedVersion.value = app.versions && app.versions.length > 0 ? app.versions[0] : null;
  }
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

// Settings Modal Functions
const openSettings = (app) => {
  // Prepare app data with execPath and serviceCommands
  // execPath already comes from the database
  settingsApp.value = {
    ...app,
    execPath: app.execPath || null,
    configFile: app.config_file || null,
    serviceCommands: app.service_commands || null
  };
  showSettingsModal.value = true;
};

const closeSettings = () => {
  showSettingsModal.value = false;
  settingsApp.value = null;
};

const cancelInstall = async () => {
  if (!installingApp.value || isCancelling.value) return;

  isCancelling.value = true;
  installStatus.value = 'Cancelling...';
  installLogs.value.push(`[${new Date().toLocaleTimeString()}] Cancelling installation...`);

  try {
    const result = await appsStore.cancelInstall(installingApp.value.id);
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

    const result = await appsStore.installApp(app, ver);

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

      // Show toast error
      toast.error(result.error);

      isInstalling.value = false;
      // Scroll to bottom
      if (logsContainer.value) {
        setTimeout(() => {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
        }, 0);
      }
      return;
    }

    // Success (store updated app status already)
    // Auto-start service if autostart is enabled
    if (app.autostart && app.execPath) {
      installLogs.value.push(`[${new Date().toLocaleTimeString()}] Auto-starting service...`);
      installStatus.value = 'Starting service...';

      const startResult = await appsStore.startService(app);
      if (startResult.success) {
        installLogs.value.push(`[${new Date().toLocaleTimeString()}] Service started successfully!`);
        // Immediately update service status in list
        app.serviceRunning = true;
      } else {
        // Warning but not fatal
        installLogs.value.push(`[${new Date().toLocaleTimeString()}] [WARNING] Failed to start service: ${startResult.error}`);
      }
    }

    // Refresh service statuses to ensure UI is in sync
    await checkServiceStatuses();

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
// View -> LocalStorage on Mount.
// View needs to refresh `recentlyUsed` when install finishes.
// I can make `checkRecentlyUsed` function and call it after install.

// ========== Service Controls ==========
// Moved to store
// const {
//   startService: startServiceApi,
//   stopService: stopServiceApi,
//   restartService: restartServiceApi,
//   checkServiceStatus
// } = useServiceControl();

let statusCheckInterval = null;

// Check service statuses in parallel for better performance
const checkServiceStatuses = async () => {
  const installedApps = appsStore.apps.filter(
    app => app.status === 'installed' && app.execPath && !['nvm'].includes(app.id)
  );

  await Promise.all(installedApps.map(async (app) => {
    try {
      const status = await window.sysapi.apps.getServiceStatus(app.id, app.execPath);
      app.serviceRunning = status.running;
    } catch (e) { /* ignore */ }
  }));
};

// Start service (wrapper to handle loading state)
const startService = async (app) => {
  await appsStore.startService(app);
};

// Stop service (wrapper to handle loading state)
const stopService = async (app) => {
  await appsStore.stopService(app);
};

// Restart service (wrapper to handle loading state)
const restartService = async (app) => {
  await appsStore.restartService(app);
};



// Cleanup interval on unmount
onUnmounted(() => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
});
</script>