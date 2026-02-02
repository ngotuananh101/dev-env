<template>
  <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
    <!-- Header with Tabs -->
    <div class="bg-[#252526] border-b border-gray-700">
      <!-- Tabs -->
      <div class="flex items-center px-4 pt-3 space-x-1">
        <button 
          v-for="tab in availableTabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm rounded-t-md transition-colors"
          :class="activeTab === tab.id 
            ? 'bg-background text-white border-t border-l border-r border-gray-700' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'"
        >
          {{ tab.name }}
        </button>
        <div v-if="availableTabs.length === 0" class="text-gray-500 text-sm py-2">
          No database apps installed
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between p-3 bg-background border-t border-gray-700">
        <div class="flex items-center space-x-2">
          <input 
            v-model="newDbName" 
            placeholder="New database name"
            class="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 w-48"
            @keyup.enter="createDatabase"
          />
          <button 
            @click="createDatabase"
            :disabled="loading"
            class="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-white text-xs"
          >
            <Plus class="w-3 h-3" />
            <span>Create</span>
          </button>

          <button 
            @click="refreshAll"
            :disabled="loading || !activeTab"
            class="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          </button>

          <!-- Database indicator -->
          <div v-if="currentDbApp" class="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 rounded text-xs">
            <Database class="w-3 h-3" :class="currentDbApp.iconColor || 'text-blue-400'" />
            <span class="text-green-400">
              {{ currentDbApp.name }} {{ currentDbApp.version }}
            </span>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Sub-tabs: Databases / Users -->
          <div class="flex bg-gray-700 rounded overflow-hidden">
            <button 
              @click="subTab = 'databases'"
              :class="subTab === 'databases' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'"
              class="px-3 py-1.5 text-xs"
            >Databases</button>
            <button 
              @click="subTab = 'users'"
              :class="subTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'"
              class="px-3 py-1.5 text-xs"
            >Users</button>
          </div>
        </div>
      </div>
    </div>

    <!-- No Database Apps -->
    <div v-if="availableTabs.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <Database class="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <p class="text-gray-400 text-lg">No database applications installed</p>
        <p class="text-gray-500 text-sm mt-2">Install MySQL, MariaDB, or PostgreSQL from the App Store</p>
      </div>
    </div>

    <!-- Databases Table -->
    <div v-else-if="subTab === 'databases'" class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#252526] sticky top-0">
          <tr class="text-gray-400">
            <th class="px-3 py-2 text-left font-medium">Database Name</th>
            <th class="px-3 py-2 text-center font-medium w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && databases.length === 0">
            <td colspan="2" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <RefreshCw class="w-6 h-6 animate-spin" />
                <span>Loading databases...</span>
              </div>
            </td>
          </tr>
          <tr v-else-if="databases.length === 0">
            <td colspan="2" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <Database class="w-8 h-8" />
                <span>No databases found</span>
                <span class="text-xs">Make sure the database service is running</span>
              </div>
            </td>
          </tr>
          <tr 
            v-for="db in databases" 
            :key="db"
            class="border-b border-gray-800 hover:bg-gray-800/50"
          >
            <td class="px-3 py-2">
              <div class="flex items-center space-x-2">
                <Database class="w-4 h-4 text-blue-400" />
                <span class="text-white font-medium">{{ db }}</span>
              </div>
            </td>
            <td class="px-3 py-2 text-center">
              <button 
                @click="dropDatabase(db)"
                class="text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Users Table -->
    <div v-else-if="subTab === 'users'" class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#252526] sticky top-0">
          <tr class="text-gray-400">
            <th class="px-3 py-2 text-left font-medium">Username</th>
            <th class="px-3 py-2 text-left font-medium">Host</th>
            <th class="px-3 py-2 text-center font-medium w-64">Change Password</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && users.length === 0">
            <td colspan="3" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <RefreshCw class="w-6 h-6 animate-spin" />
                <span>Loading users...</span>
              </div>
            </td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td colspan="3" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <User class="w-8 h-8" />
                <span>No users found</span>
                <span class="text-xs">Make sure the database service is running</span>
              </div>
            </td>
          </tr>
          <tr 
            v-for="user in users" 
            :key="user.user + user.host"
            class="border-b border-gray-800 hover:bg-gray-800/50"
          >
            <td class="px-3 py-2">
              <div class="flex items-center space-x-2">
                <User class="w-4 h-4 text-green-400" />
                <span class="text-white font-medium">{{ user.user }}</span>
              </div>
            </td>
            <td class="px-3 py-2 text-gray-400">
              {{ user.host }}
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center justify-center space-x-2">
                <input 
                  v-model="userPasswords[user.user]" 
                  type="password"
                  placeholder="New password"
                  class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs w-32"
                />
                <button 
                  @click="changePassword(user.user, user.host)"
                  :disabled="!userPasswords[user.user]"
                  class="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded text-white text-xs"
                >Change</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div>
        Total {{ subTab === 'databases' ? databases.length + ' databases' : users.length + ' users' }}
      </div>
      <div>
        {{ currentDbApp?.name || 'No database selected' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Plus, RefreshCw, Database, User } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';

const toast = useToast();

// State
const dbApps = ref([]);
const activeTab = ref('');
const subTab = ref('databases');
const loading = ref(false);
const databases = ref([]);
const users = ref([]);
const newDbName = ref('');
const userPasswords = ref({});

// Available tabs based on installed DB apps
const availableTabs = computed(() => {
  return dbApps.value.map(app => ({
    id: app.id,
    name: app.name
  }));
});

// Current DB app info
const currentDbApp = computed(() => {
  return dbApps.value.find(app => app.id === activeTab.value);
});

// Load installed database apps
const loadDbApps = async () => {
  try {
    // Query installed_apps table directly
    const result = await window.sysapi.db.query(
      "SELECT * FROM installed_apps WHERE app_id IN ('mysql', 'mariadb', 'postgresql')"
    );
    
    if (result && Array.isArray(result)) {
      dbApps.value = result.map(app => ({
        id: app.app_id,
        name: app.app_id === 'mysql' ? 'MySQL' : 
              app.app_id === 'mariadb' ? 'MariaDB' : 'PostgreSQL',
        version: app.installed_version,
        iconColor: app.app_id === 'mysql' ? 'text-orange-500' : 
                   app.app_id === 'mariadb' ? 'text-cyan-500' : 'text-blue-600'
      }));
      
      // Auto-select first tab
      if (dbApps.value.length > 0 && !activeTab.value) {
        activeTab.value = dbApps.value[0].id;
      }
    }
  } catch (err) {
    console.error('Failed to load db apps:', err);
  }
};

const refreshAll = () => {
  loadDatabases();
  loadUsers();
};

const loadDatabases = async () => {
  if (!activeTab.value) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.listDatabases(activeTab.value);
    if (result.error) {
      toast.error(`Failed to load databases: ${result.error}`);
    } else {
      databases.value = result.databases || [];
    }
  } catch (err) {
    console.error('Load databases error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const createDatabase = async () => {
  console.log('Create requested:', { name: newDbName.value, tab: activeTab.value });
  if (!activeTab.value) { toast.warning('No active tab'); return; }
  if (!newDbName.value) { toast.warning('Please enter a database name'); return; }
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.createDatabase(activeTab.value, newDbName.value);
    if (result.error) {
      toast.error(`Failed to create database: ${result.error}`);
    } else {
      toast.success(`Database "${newDbName.value}" created`);
      newDbName.value = '';
      await loadDatabases();
    }
  } catch (err) {
    console.error('Create database error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const dropDatabase = async (dbName) => {
  if (!activeTab.value || !dbName) return;
  if (!confirm(`Delete database "${dbName}"? This action cannot be undone!`)) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.dropDatabase(activeTab.value, dbName);
    if (result.error) {
      toast.error(`Failed to delete database: ${result.error}`);
    } else {
      toast.success(`Database "${dbName}" deleted`);
      await loadDatabases();
    }
  } catch (err) {
    console.error('Drop database error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const loadUsers = async () => {
  if (!activeTab.value) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.listUsers(activeTab.value);
    if (result.error) {
      toast.error(`Failed to load users: ${result.error}`);
    } else {
      users.value = result.users || [];
      userPasswords.value = {};
    }
  } catch (err) {
    console.error('Load users error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const changePassword = async (username, host) => {
  if (!activeTab.value || !username || !userPasswords.value[username]) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.changePassword(
      activeTab.value, 
      username, 
      userPasswords.value[username], 
      host
    );
    if (result.error) {
      toast.error(`Failed to change password: ${result.error}`);
    } else {
      toast.success(`Password changed for "${username}"`);
      userPasswords.value[username] = '';
    }
  } catch (err) {
    console.error('Change password error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

// Watch tab change to reload data
watch(activeTab, (newTab) => {
  if (newTab) {
    databases.value = [];
    users.value = [];
    userPasswords.value = {};
    refreshAll();
  }
});

onMounted(async () => {
  await loadDbApps();
});
</script>
