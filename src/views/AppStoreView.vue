<template>
  <div
    class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm"
  >
    <!-- 1. Header - Search -->
    <div
      class="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]"
    >
      <div class="flex items-center space-x-2">
        <span class="text-gray-400">Search App</span>
        <div class="relative w-96">
          <Search
            class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            placeholder="Supports fuzzy search by application name, field"
            class="pl-8"
          />
        </div>
      </div>
      <Button
        :disabled="appsStore.isUpdating"
        @click="appsStore.updateAppList"
        size="sm"
      >
        <RefreshCw
          class="w-3 h-3"
          :class="{ 'animate-spin': appsStore.isUpdating }"
        />
        {{ appsStore.isUpdating ? "Updating..." : "Update App List" }}
      </Button>
    </div>

    <!-- 2. Recently Used -->
    <div
      class="flex items-center space-x-4 p-3 border-b border-gray-700 bg-[#252526]"
    >
      <span class="text-gray-500 text-xs">Recently used</span>
      <div class="flex items-center space-x-3">
        <div
          v-for="app in recentlyUsed"
          :key="app.id"
          class="flex items-center space-x-1.5 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer text-xs"
        >
          <img
            v-if="app.iconContent"
            :src="app.iconContent"
            class="w-5 h-5"
            :alt="app.name"
          />
          <component
            v-else
            :is="getAppIcon(app.icon)"
            class="w-5 h-5"
            :class="app.iconColor"
          />
          <span>{{ app.name }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Category Tabs -->
    <div
      class="flex items-center space-x-1 p-2 border-b border-gray-700 bg-[#252526]"
    >
      <span class="text-gray-500 text-xs mr-2">App Sort</span>
      <button
        v-for="cat in categories"
        :key="cat.id"
        @click="appsStore.activeCategory = cat.id"
        :class="[
          'px-3 py-1 rounded text-xs transition-colors',
          appsStore.activeCategory === cat.id
            ? 'bg-blue-600 text-white'
            : 'bg-[#333] text-gray-300 hover:bg-[#444]',
        ]"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- 4. App Table -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <!-- Table Header -->
      <div
        class="bg-background-secondary flex text-xs text-gray-400 font-normal border-b border-gray-700"
      >
        <div class="p-2 w-40 min-w-40">Software name</div>
        <div class="p-2 w-24 min-w-24">Developer</div>
        <div class="p-2 flex-1 min-w-40">Instructions</div>
        <div class="p-2 w-20 min-w-20 text-center">Location</div>
        <div class="p-2 w-16 min-w-16 text-center">Status</div>
        <div class="p-2 w-24 min-w-24 text-center">Add to PATH</div>
        <div class="p-2 w-32 min-w-32 text-center">Operate</div>
      </div>

      <!-- Virtual Scroller for Apps -->
      <RecycleScroller
        class="flex-1"
        :items="filteredApps"
        :item-size="50"
        key-field="id"
        v-slot="{ item: app }"
      >
        <div
          class="flex items-center hover:bg-[#2a2d3e] transition-colors h-12.5 border-b border-gray-800"
        >
          <!-- Software name -->
          <div class="px-2 py-2 w-40 min-w-40">
            <div class="flex items-center space-x-3">
              <img
                v-if="app.iconContent"
                :src="app.iconContent"
                class="w-5 h-5"
                alt="app icon"
              />
              <component
                v-else
                :is="getAppIcon(app.icon)"
                class="w-5 h-5"
                :class="app.iconColor"
              />
              <span class="text-white font-normal">{{ app.name }}</span>
            </div>
          </div>
          <!-- Developer -->
          <div class="px-2 py-2 w-24 min-w-24 text-yellow-500">
            {{ app.developer }}
          </div>
          <!-- Instructions -->
          <div class="px-2 py-2 flex-1 min-w-40 text-gray-400 text-xs truncate">
            {{ app.description }}
          </div>
          <!-- Location -->
          <div class="px-2 py-2 w-20 min-w-20 text-center">
            <div
              v-if="app.status === 'installed'"
              class="flex items-center justify-center cursor-pointer"
              @click="openLocation(app)"
            >
              <Folder class="w-4 h-4 text-yellow-500" />
            </div>
            <span v-else class="text-gray-500">--</span>
          </div>
          <!-- Status -->
          <div class="px-2 py-2 w-16 min-w-16 text-center">
            <div
              v-if="
                app.status === 'installed' &&
                app.execPath &&
                !['nvm', 'phpmyadmin', 'pyenv'].includes(app.id)
              "
              class="flex items-center justify-center space-x-1"
            >
              <!-- Service is running -->
              <template v-if="app.serviceRunning">
                <button
                  @click="stopService(app)"
                  :disabled="app.serviceLoading"
                  class="p-1 hover:bg-red-500/20 rounded transition-colors"
                  title="Stop Service"
                >
                  <Square class="w-4 h-4 text-red-500" />
                </button>
                <button
                  @click="restartService(app)"
                  :disabled="app.serviceLoading"
                  class="p-1 hover:bg-yellow-500/20 rounded transition-colors"
                  title="Restart Service"
                >
                  <RotateCw
                    class="w-4 h-4 text-yellow-500"
                    :class="{ 'animate-spin': app.serviceLoading }"
                  />
                </button>
              </template>
              <!-- Service is not running -->
              <template v-else>
                <button
                  @click="startService(app)"
                  :disabled="app.serviceLoading"
                  class="p-1 hover:bg-green-500/20 rounded transition-colors"
                  title="Start Service"
                >
                  <Play
                    v-if="!app.serviceLoading"
                    class="w-4 h-4 text-green-500"
                  />
                  <RotateCw
                    v-else
                    class="w-4 h-4 text-green-500 animate-spin"
                  />
                </button>
              </template>
            </div>
            <span v-else class="text-gray-500">--</span>
          </div>
          <!-- Add to PATH -->
          <div class="px-2 py-2 w-24 min-w-24 text-center">
            <template
              v-if="
                app.status === 'installed' &&
                app.execPath &&
                !['nvm', 'phpmyadmin', 'pyenv'].includes(app.id)
              "
            >
              <Switch
                :modelValue="app.inPath"
                @update:modelValue="appsStore.togglePath(app)"
              />
            </template>
            <span v-else class="text-gray-500">--</span>
          </div>
          <!-- Operate -->
          <div class="px-2 py-2 w-32 min-w-32 text-center">
            <div class="flex items-center justify-center space-x-2">
              <template v-if="app.status === 'installed'">
                <button
                  class="text-blue-400 hover:text-blue-300 text-xs"
                  @click="openSettings(app)"
                >
                  Setting
                </button>
                <button
                  class="text-red-400 hover:text-red-300 text-xs"
                  @click="appsStore.uninstallApp(app)"
                >
                  Uninstall
                </button>
              </template>
              <button
                v-else
                class="text-green-400 hover:text-green-300 text-xs"
                @click="installApp(app)"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </RecycleScroller>
    </div>

    <!-- 5. Footer with Pagination -->
    <div
      class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400"
    >
      <div>
        Total {{ allFilteredApps.length }} apps ({{ installedCount }} installed)
      </div>
      <div class="flex items-center space-x-2">
        <span class="mr-2">Items per page:</span>
        <select
          v-model="itemsPerPage"
          class="bg-[#333] border border-gray-600 rounded px-2 py-0.5 text-gray-200"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="-1">All</option>
        </select>
        <template v-if="itemsPerPage !== -1">
          <button
            @click="prevPage"
            :disabled="currentPage === 1"
            class="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft class="w-3 h-3" />
          </button>
          <span class="bg-gray-700 px-2 py-0.5 rounded text-white">{{
            currentPage
          }}</span>
          <span>/ {{ totalPages }}</span>
          <button
            @click="nextPage"
            :disabled="currentPage === totalPages"
            class="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight class="w-3 h-3" />
          </button>
        </template>
        <span v-else class="text-green-400">Virtual Scroll Enabled</span>
      </div>
    </div>

    <!-- Install Modal -->
    <Dialog v-model:open="showInstallModal">
      <DialogContent
        class="max-w-[500px] bg-[#252526] border-gray-700 text-gray-200 p-0"
        @interactOutside="
          (e) => {
            if (isInstalling) e.preventDefault();
          }
        "
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between p-4 border-b border-gray-700"
        >
          <div class="flex items-center space-x-3">
            <img
              v-if="installingApp?.iconContent"
              :src="installingApp.iconContent"
              class="w-6 h-6"
              :alt="installingApp?.name"
            />
            <component
              v-else
              :is="getAppIcon(installingApp?.icon)"
              class="w-6 h-6"
              :class="installingApp?.iconColor"
            />
            <div>
              <h3 class="text-white font-medium">
                Install {{ installingApp?.name }}
              </h3>
              <p class="text-gray-400 text-xs">Select version to install</p>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="p-4">
          <!-- Version Selection -->
          <div v-if="!isInstalling" class="space-y-3">
            <div
              v-if="isLoadingVersions"
              class="flex flex-col items-center justify-center p-8 space-y-3"
            >
              <RotateCw class="w-8 h-8 text-blue-500 animate-spin" />
              <span class="text-gray-400">Loading versions...</span>
            </div>
            <div
              v-else-if="
                !installingApp?.versions || installingApp?.versions.length === 0
              "
              class="text-center p-8 text-gray-500"
            >
              No versions available for this application.
            </div>
            <div v-else>
              <label class="text-gray-300 text-sm">Select Version:</label>
              <div class="space-y-2 max-h-48 overflow-y-auto mt-2">
                <label
                  v-for="ver in installingApp?.versions"
                  :key="ver.version"
                  class="flex items-center space-x-3 p-3 bg-background rounded cursor-pointer hover:bg-[#333] border border-transparent"
                  :class="{
                    'border-blue-500 bg-[#333]':
                      selectedVersion?.version === ver.version,
                  }"
                >
                  <input
                    type="radio"
                    :value="ver"
                    v-model="selectedVersion"
                    class="text-blue-500"
                  />
                  <div class="flex-1">
                    <span class="text-white">{{ ver.version }}</span>
                    <span
                      v-if="ver.size > 0"
                      class="text-gray-500 text-xs ml-2"
                      >{{ formatBytes(ver.size) }}</span
                    >
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
              <div
                v-for="(log, index) in installLogs"
                :key="index"
                class="text-gray-400 whitespace-nowrap"
              >
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
          <Button
            variant="secondary"
            :disabled="isCancelling"
            @click="isInstalling ? cancelInstall() : closeInstallModal()"
          >
            {{
              isCancelling ? "Cancelling..." : isInstalling ? "Cancel" : "Close"
            }}
          </Button>
          <Button
            variant="success"
            :disabled="!selectedVersion || isInstalling || isLoadingVersions"
            @click="confirmInstall"
          >
            {{ isInstalling ? "Installing..." : "Install" }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- App Settings Modal -->
    <AppSettingsModal
      v-if="showSettingsModal"
      :show="showSettingsModal"
      :app="settingsApp"
      @close="closeSettings"
    />
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  defineAsyncComponent,
} from "vue";
import {
  Search,
  Shield,
  Database,
  Server,
  Globe,
  Box,
  Activity,
  Folder,
  Play,
  Settings,
  Terminal,
  HardDrive,
  Cpu,
  FileCode,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Square,
  RotateCw,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useAppsStore } from "@/stores/apps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDebouncedRef } from "@/composables/useDebouncedRef";
import { formatBytes } from "@/utils/helpers";
import { RecycleScroller } from "vue3-virtual-scroller";
import "vue3-virtual-scroller/dist/vue3-virtual-scroller.css";

// Lazy load heavy modal component
const AppSettingsModal = defineAsyncComponent(
  () => import("../components/AppSettingsModal.vue"),
);

const appsStore = useAppsStore();

// Categories
const categories = [
  { id: "all", name: "ALL" },
  { id: "installed", name: "Installed" },
  { id: "deployment", name: "Deployment" },
  { id: "tools", name: "Tools" },
  { id: "plugins", name: "Plug-ins" },
  { id: "professional", name: "Professional" },
];

// Debounced search for better performance
const { value: searchQuery, debouncedValue: debouncedSearchQuery } =
  useDebouncedRef("", 300);

// Recently Used (from localStorage)
const recentlyUsed = ref([]);

onMounted(async () => {
  const saved = localStorage.getItem("recentlyUsedApps");
  if (saved) {
    recentlyUsed.value = JSON.parse(saved);
  }

  await appsStore.loadApps();
  await checkServiceStatuses();
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
const installStatus = ref("");
const installLogs = ref([]);
let progressCleanup = null;
const logsContainer = ref(null);

// Settings Modal State
const showSettingsModal = ref(false);
const settingsApp = ref(null);

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(10);

watch([() => appsStore.activeCategory, debouncedSearchQuery], () => {
  currentPage.value = 1;
});

const allFilteredApps = computed(() =>
  appsStore.allFilteredApps(debouncedSearchQuery.value),
);

const filteredApps = computed(() => {
  if (itemsPerPage.value === -1) return allFilteredApps.value;
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return allFilteredApps.value.slice(start, end);
});

const totalPages = computed(() => {
  if (itemsPerPage.value === -1) return 1;
  return Math.max(
    1,
    Math.ceil(allFilteredApps.value.length / itemsPerPage.value),
  );
});
const installedCount = computed(
  () => appsStore.apps.filter((a) => a.status === "installed").length,
);

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--;
};
const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++;
};

const getAppIcon = (iconName) => {
  const icons = {
    Shield,
    Database,
    Server,
    Globe,
    Box,
    Activity,
    Folder,
    Play,
    Settings,
    Terminal,
    HardDrive,
    Cpu,
    FileCode,
  };
  return icons[iconName] || Box;
};

const installApp = (app) => {
  openInstallModal(app);
};

const openInstallModal = (app) => {
  if (app.id === "phpmyadmin") {
    const phpInstalled = appsStore.apps.some(
      (a) => a.id.startsWith("php") && a.status === "installed",
    );
    const webServerInstalled = appsStore.apps.some(
      (a) =>
        (a.id === "apache" || a.id === "nginx") && a.status === "installed",
    );
    if (!phpInstalled || !webServerInstalled) {
      const missing = [];
      if (!phpInstalled) missing.push("PHP");
      if (!webServerInstalled) missing.push("Web Server (Apache/Nginx)");
      toast.error(
        `Cannot install phpMyAdmin. Missing dependencies: ${missing.join(", ")}`,
      );
      return;
    }
  }

  installingApp.value = app;
  showInstallModal.value = true;
  installProgress.value = 0;
  installStatus.value = "";
  installLogs.value = [];
  isInstalling.value = false;
  isCancelling.value = false;
  selectedVersion.value = null;

  if (
    [
      "mariadb",
      "redis",
      "nginx",
      "postgresql",
      "apache",
      "mysql",
      "mongodb",
      "meilisearch",
      "elasticsearch",
    ].includes(app.id) ||
    (app.id.startsWith("php") && app.id !== "phpmyadmin")
  ) {
    isLoadingVersions.value = true;
    installingApp.value = { ...app, versions: [] };

    window.sysapi.apps
      .getVersions(app.id)
      .then((versions) => {
        if (installingApp.value && installingApp.value.id === app.id) {
          installingApp.value.versions = versions;
          if (versions.length > 0) selectedVersion.value = versions[0];
        }
      })
      .catch((err) => {
        console.error("Failed to fetch versions:", err);
        toast.error("Failed to fetch versions");
      })
      .finally(() => {
        isLoadingVersions.value = false;
      });
  } else {
    isLoadingVersions.value = false;
    selectedVersion.value =
      app.versions && app.versions.length > 0 ? app.versions[0] : null;
  }
};

const closeInstallModal = () => {
  if (isInstalling.value) return;
  showInstallModal.value = false;
  installingApp.value = null;
  selectedVersion.value = null;
  installLogs.value = [];
  if (progressCleanup) {
    progressCleanup();
    progressCleanup = null;
  }
};

const openSettings = (app) => {
  settingsApp.value = {
    ...app,
    execPath: app.execPath || null,
    configFile: app.config_file || null,
    serviceCommands: app.service_commands || null,
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
  installStatus.value = "Cancelling...";
  installLogs.value.push(
    `[${new Date().toLocaleTimeString()}] Cancelling installation...`,
  );

  try {
    const result = await appsStore.cancelInstall(installingApp.value.id);
    if (result.success) {
      installLogs.value.push(
        `[${new Date().toLocaleTimeString()}] Installation cancelled.`,
      );
      installStatus.value = "Cancelled";
      isInstalling.value = false;
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
    console.error("Failed to cancel:", err);
    installLogs.value.push(
      `[${new Date().toLocaleTimeString()}] [ERROR] Failed to cancel: ${err.message}`,
    );
    isCancelling.value = false;
  }
};

const confirmInstall = async () => {
  if (!selectedVersion.value || !installingApp.value) return;
  isInstalling.value = true;
  installProgress.value = 0;
  installStatus.value = "Starting...";
  installLogs.value.push(
    `[${new Date().toLocaleTimeString()}] Starting installation of ${installingApp.value.name}...`,
  );

  progressCleanup = window.sysapi.apps.onInstallProgress((data) => {
    if (data.appId === installingApp.value.id) {
      if (data.logDetail) {
        const lastLog = installLogs.value[installLogs.value.length - 1];
        if (installStatus.value === data.status && lastLog) {
          installLogs.value[installLogs.value.length - 1] =
            `[${new Date().toLocaleTimeString()}] ${data.logDetail}`;
        } else {
          installLogs.value.push(
            `[${new Date().toLocaleTimeString()}] ${data.logDetail}`,
          );
        }
        if (logsContainer.value)
          setTimeout(() => {
            logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
          }, 0);
      } else {
        if (installStatus.value !== data.status) {
          installLogs.value.push(
            `[${new Date().toLocaleTimeString()}] ${data.status}`,
          );
          if (logsContainer.value)
            setTimeout(() => {
              logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
            }, 0);
        }
      }
      installProgress.value = data.progress;
      installStatus.value = data.status;
    }
  });

  try {
    const app = installingApp.value;
    const ver = selectedVersion.value;
    const result = await appsStore.installApp(app, ver);

    if (result.error) {
      if (result.cancelled) {
        installStatus.value = "Cancelled";
        installLogs.value.push(
          `[${new Date().toLocaleTimeString()}] Installation cancelled.`,
        );
        isInstalling.value = false;
        setTimeout(() => {
          showInstallModal.value = false;
          installingApp.value = null;
          selectedVersion.value = null;
          installLogs.value = [];
        }, 1000);
        return;
      }
      console.error("Install result error:", result.error);
      installStatus.value = "Installation Failed";
      installLogs.value.push(
        `[${new Date().toLocaleTimeString()}] [ERROR] ${result.error}`,
      );
      toast.error(result.error);
      isInstalling.value = false;
      if (logsContainer.value)
        setTimeout(() => {
          logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
        }, 0);
      return;
    }

    if (app.autostart && app.execPath) {
      installLogs.value.push(
        `[${new Date().toLocaleTimeString()}] Auto-starting service...`,
      );
      installStatus.value = "Starting service...";
      const startResult = await appsStore.startService(app);
      if (startResult.success) {
        installLogs.value.push(
          `[${new Date().toLocaleTimeString()}] Service started successfully!`,
        );
        app.serviceRunning = true;
      } else {
        installLogs.value.push(
          `[${new Date().toLocaleTimeString()}] [WARNING] Failed to start service: ${startResult.error}`,
        );
      }
    }

    await checkServiceStatuses();
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
    console.error("Install error:", error);
    alert(`Error: ${error.message}`);
    isInstalling.value = false;
  }
};

const openLocation = async (app) => {
  if (!app.installPath || app.installPath === "--") return;
  try {
    const result = await window.sysapi.files.openFile(app.installPath);
    if (result.error) alert(`Failed to open location: ${result.error}`);
  } catch (error) {
    console.error("Open location error:", error);
  }
};

let statusCheckInterval = null;

const checkServiceStatuses = async () => {
  const installedApps = appsStore.apps.filter(
    (app) =>
      app.status === "installed" && app.execPath && !["nvm"].includes(app.id),
  );
  await Promise.all(
    installedApps.map(async (app) => {
      try {
        const status = await window.sysapi.apps.getServiceStatus(
          app.id,
          app.execPath,
        );
        app.serviceRunning = status.running;
      } catch (e) {
        /* ignore */
      }
    }),
  );
};

const startService = async (app) => {
  await appsStore.startService(app);
};
const stopService = async (app) => {
  await appsStore.stopService(app);
};
const restartService = async (app) => {
  await appsStore.restartService(app);
};

onUnmounted(() => {
  if (statusCheckInterval) clearInterval(statusCheckInterval);
});
</script>
