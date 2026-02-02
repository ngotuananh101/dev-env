<template>
  <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
    <!-- Header with Tabs -->
    <div class="bg-[#252526] border-b border-gray-700">
      <!-- Tabs -->
      <div class="flex items-center px-4 pt-3 space-x-1">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm rounded-t-md transition-colors"
          :class="activeTab === tab.id 
            ? 'bg-background text-white border-t border-l border-r border-gray-700' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'"
        >
          {{ tab.name }}
        </button>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between p-3 bg-background border-t border-gray-700">
        <div class="flex items-center space-x-2">
          <button 
            @click="showAddModal = true"
            class="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-white text-xs"
          >
            <Plus class="w-3 h-3" />
            <span>Add site</span>
          </button>

          <button 
            v-if="activeTab === 'php' && webserver.apache"
            @click="changeApacheRoot"
            class="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs border border-gray-600"
            title="Change Apache Root"
          >
            <FolderCog class="w-3 h-3 text-yellow-500" />
          </button>
          
          <button 
            v-if="activeTab === 'php' && webserver.nginx && !webserver.apache"
            @click="changeNginxRoot"
            class="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs border border-gray-600"
            title="Change Nginx Root"
          >
            <FolderCog class="w-3 h-3 text-yellow-500" />
          </button>
          <!-- Webserver indicator -->
          <div class="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 rounded text-xs">
            <Server class="w-3 h-3 text-yellow-400" />
            <span v-if="webserver.nginx && webserver.nginx.installed_version" class="text-green-400">
              Nginx {{ webserver.nginx.installed_version }}
            </span>
            <span v-else-if="webserver.nginx">Nginx</span>
            
            <template v-else-if="webserver.apache">
              <span v-if="webserver.apache.installed_version" class="text-green-400">
                Apache {{ webserver.apache.installed_version }}
              </span>
              <span v-else>Apache</span>
            </template>
            
            <span v-else class="text-gray-400">No webserver</span>
          </div>

          <button 
            @click="loadSites"
            class="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoading }" />
            <span>Reload</span>
          </button>
        </div>

        <div class="flex items-center space-x-2">
          <div class="relative">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Search domain..."
              class="pl-9 pr-4 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 w-48"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#252526] sticky top-0">
          <tr class="text-gray-400">
            <th class="px-3 py-2 text-left font-medium">Site name</th>
            <th class="px-3 py-2 text-center font-medium w-20">Status</th>
            <th class="px-3 py-2 text-center font-medium w-28">Quick action</th>
            <th class="px-3 py-2 text-center font-medium w-32">Created</th>
            <th class="px-3 py-2 text-center font-medium w-40">Operate</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredSites.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <Globe2 class="w-8 h-8" />
                <span>No {{ activeTabName }} sites found</span>
                <button @click="showAddModal = true" class="text-green-400 hover:underline">
                  Add your first site
                </button>
              </div>
            </td>
          </tr>
          <tr 
            v-for="site in filteredSites" 
            :key="site.id"
            class="border-b border-gray-800 hover:bg-gray-800/50"
          >
            <!-- Site name -->
            <td class="px-3 py-2">
              <div class="flex items-center space-x-2">
                <component :is="getTypeIcon(site.type)" class="w-4 h-4" :class="getTypeColor(site.type)" />
                <div>
                  <div class="flex items-center space-x-1">
                    <span class="text-white font-medium">{{ site.domain }}</span>
                    <ExternalLink 
                      class="w-3 h-3 text-gray-400 hover:text-blue-400 cursor-pointer" 
                      @click="openInBrowser(site.domain)"
                    />
                  </div>
                  <div class="text-gray-500 text-[10px]">{{ site.name }}</div>
                </div>
              </div>
            </td>

            <!-- Status -->
            <td class="px-3 py-2 text-center">
              <template v-if="site.type === 'node'">
                <div class="flex items-center justify-center space-x-1">
                  <div 
                    class="w-2 h-2 rounded-full"
                    :class="site.processRunning ? 'bg-green-500' : 'bg-gray-500'"
                  ></div>
                  <span :class="site.processRunning ? 'text-green-400' : 'text-gray-400'">
                    {{ site.processRunning ? 'Running' : 'Stopped' }}
                  </span>
                </div>
              </template>
              <template v-else-if="site.type === 'php'">
                <div class="inline-block text-left">
                  <select 
                    :value="site.php_version" 
                    @change="changePhpVersion(site, $event.target.value)"
                    :disabled="site.updatingPhp"
                    class="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-4"
                  >
                    <option v-for="ver in phpVersions" :key="ver" :value="ver">{{ ver }}</option>
                  </select>
                  <div class="pointer-events-none inset-y-0 right-0 flex items-center px-1.5 text-gray-400">
                    <RotateCw v-if="site.updatingPhp" class="h-3 w-3 animate-spin" />
                  </div>
                </div>
              </template>
              <template v-else>
                <span class="text-gray-500">--</span>
              </template>
            </td>

            <!-- Quick action -->
            <td class="px-3 py-2 text-center">
              <div class="flex items-center justify-center space-x-2">
                <!-- Node: Start/Stop -->
                <template v-if="site.type === 'node'">
                  <button 
                    v-if="!site.processRunning"
                    @click="startNodeSite(site)"
                    :disabled="site.loading"
                    class="p-1 hover:bg-green-500/20 rounded"
                    title="Start"
                  >
                    <Play class="w-3.5 h-3.5 text-green-500" />
                  </button>
                  <button 
                    v-else
                    @click="stopNodeSite(site)"
                    :disabled="site.loading"
                    class="p-1 hover:bg-red-500/20 rounded"
                    title="Stop"
                  >
                    <Square class="w-3.5 h-3.5 text-red-500" />
                  </button>
                </template>

                <!-- Open folder -->
                <button 
                  v-if="site.root_path"
                  @click="openFolder(site.root_path)"
                  class="p-1 hover:bg-yellow-500/20 rounded"
                  title="Open folder"
                >
                  <Folder class="w-3.5 h-3.5 text-yellow-500" />
                </button>

                <!-- Open in browser -->
                <button 
                  @click="openInBrowser(site.domain)"
                  class="p-1 hover:bg-blue-500/20 rounded"
                  title="Open in browser"
                >
                  <Globe class="w-3.5 h-3.5 text-blue-500" />
                </button>
              </div>
            </td>

            <!-- Created -->
            <td class="px-3 py-2 text-center text-gray-400">
              {{ formatDate(site.created_at) }}
            </td>

            <!-- Operate -->
            <td class="px-3 py-2 text-center">
              <div class="flex items-center justify-center space-x-2">
                <button 
                  @click="openConfig(site)"
                  class="text-blue-400 hover:text-blue-300 text-xs"
                >
                  Conf
                </button>
                <button 
                  @click="showLogs(site)"
                  class="text-green-400 hover:text-green-300 text-xs"
                >
                  Logs
                </button>
                <button 
                  @click="deleteSite(site)"
                  class="text-red-400 hover:text-red-300 text-xs"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div>
        Total {{ filteredSites.length }} sites
      </div>
      <div>
        {{ activeTabName }}
      </div>
    </div>

    <!-- Add Site Modal -->
    <AddSiteModal 
      v-if="showAddModal" 
      :type="activeTab"
      :webserver="webserver"
      @close="showAddModal = false"
      @created="onSiteCreated"
    />

    <!-- Site Config Modal -->
    <SiteConfigModal 
      v-if="showConfigModal" 
      :site="selectedSite"
      @close="showConfigModal = false"
      @saved="loadSites"
    />

    <!-- Site Logs Modal -->
    <SiteLogsModal 
      v-if="showLogsModal" 
      :site="selectedSite"
      @close="showLogsModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  Plus, RefreshCw, Search, Server, Globe2, Globe, ExternalLink,
  Folder, Play, Square, FileCode, Terminal, ArrowRightLeft, FolderCog,
  ChevronDown, RotateCw
} from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import AddSiteModal from '../components/AddSiteModal.vue';
import SiteConfigModal from '../components/SiteConfigModal.vue';
import SiteLogsModal from '../components/SiteLogsModal.vue';

const toast = useToast();

// Tabs
const tabs = [
  { id: 'php', name: 'PHP Project' },
  { id: 'node', name: 'Node Project' },
  { id: 'proxy', name: 'Proxy Project' }
];
const activeTab = ref('php');

const activeTabName = computed(() => tabs.find(t => t.id === activeTab.value)?.name || 'PHP');

// State
const sites = ref([]);
const webserver = ref({ nginx: null, apache: null });
const isLoading = ref(false);
const searchQuery = ref('');
const showAddModal = ref(false);
const showConfigModal = ref(false);
const showLogsModal = ref(false);
const selectedSite = ref(null);
const phpVersions = ref([]);

// Filtered sites by tab and search
const filteredSites = computed(() => {
  return sites.value.filter(site => {
    const matchesTab = site.type === activeTab.value;
    const matchesSearch = !searchQuery.value || 
      site.domain.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      site.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchesTab && matchesSearch;
  });
});

// Get type icon
const getTypeIcon = (type) => {
  switch (type) {
    case 'php': return FileCode;
    case 'node': return Terminal;
    case 'proxy': return ArrowRightLeft;
    default: return Globe;
  }
};

// Get type color
const getTypeColor = (type) => {
  switch (type) {
    case 'php': return 'text-purple-400';
    case 'node': return 'text-green-400';
    case 'proxy': return 'text-blue-400';
    default: return 'text-gray-400';
  }
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
};

// Load sites
const loadSites = async () => {
  isLoading.value = true;
  try {
    const result = await window.sysapi.sites.list();
    if (result.error) {
      toast.error(`Failed to load sites: ${result.error}`);
    } else {
      sites.value = result.sites || [];
    }
  } catch (error) {
    console.error('Load sites error:', error);
    toast.error(`Error: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

// Load PHP versions
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

// Change PHP version
const changePhpVersion = async (site, newVersion) => {
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



// Load webserver info
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

// Open folder
const openFolder = async (path) => {
  try {
    await window.sysapi.files.openFile(path);
  } catch (error) {
    toast.error(`Failed to open folder: ${error.message}`);
  }
};

// Open in browser
const openInBrowser = async (domain) => {
  try {
    await window.sysapi.sites.openBrowser(domain);
  } catch (error) {
    toast.error(`Failed to open browser: ${error.message}`);
  }
};

// Start Node site
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

// Stop Node site
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

// Open config modal
const openConfig = (site) => {
  selectedSite.value = site;
  showConfigModal.value = true;
};

// Show logs modal
const showLogs = (site) => {
  selectedSite.value = site;
  showLogsModal.value = true;
};

// Delete site
const deleteSite = async (site) => {
  if (!confirm(`Delete site "${site.domain}"? This will remove the config file.`)) {
    return;
  }

  try {
    const result = await window.sysapi.sites.delete(site.id);
    if (result.error) {
      toast.error(`Failed to delete: ${result.error}`);
    } else {
      toast.success(`${site.domain} deleted!`);
      await loadSites();
    }
  } catch (error) {
    toast.error(`Error: ${error.message}`);
  }
};



// Change Apache Root
const changeApacheRoot = async () => {
  try {
    // Select new folder
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
  }
};

// Change Nginx Root
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
  }
};

// Site created callback
const onSiteCreated = async () => {
  showAddModal.value = false;
  await loadSites();
};

onMounted(async () => {
  await loadWebserver();
  await loadPhpVersions();
  await loadSites();
});
</script>
