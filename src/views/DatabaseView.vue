<template>
  <div class="h-full flex flex-col bg-background p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-white">Database Manager</h1>
      <div class="flex items-center space-x-3">
        <!-- Database App Selector -->
        <select 
          v-model="selectedApp" 
          class="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          @change="onAppChange"
        >
          <option value="">Select Database</option>
          <option v-for="app in dbApps" :key="app.id" :value="app.id">
            {{ app.name }} {{ app.version }}
          </option>
        </select>
        <button 
          @click="refreshAll" 
          :disabled="!selectedApp || loading"
          class="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
        >
          <svg class="w-5 h-5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- No App Selected -->
    <div v-if="!selectedApp" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
        </svg>
        <p class="text-gray-400 text-lg">Select a database application to manage</p>
        <p class="text-gray-500 text-sm mt-2">MySQL, MariaDB, or PostgreSQL must be installed and running</p>
      </div>
    </div>

    <!-- Database Content -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <!-- Tabs -->
      <div class="flex space-x-1 mb-4 border-b border-gray-700">
        <button 
          @click="activeTab = 'databases'" 
          :class="activeTab === 'databases' ? 'text-white border-b-2 border-blue-500 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'"
          class="px-4 py-2 rounded-t-lg text-sm font-medium transition-colors"
        >Databases</button>
        <button 
          @click="activeTab = 'users'" 
          :class="activeTab === 'users' ? 'text-white border-b-2 border-blue-500 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'"
          class="px-4 py-2 rounded-t-lg text-sm font-medium transition-colors"
        >Users</button>
      </div>
      
      <!-- Databases Tab -->
      <div v-if="activeTab === 'databases'" class="flex-1 flex flex-col min-h-0">
        <div class="flex items-center space-x-3 mb-4">
          <input 
            v-model="newDbName" 
            placeholder="Enter database name"
            class="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            @keyup.enter="createDatabase"
          />
          <button 
            @click="createDatabase"
            :disabled="!newDbName || loading"
            class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg text-white font-medium transition-colors"
          >Create Database</button>
        </div>
        
        <div v-if="loading && databases.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Loading databases...</span>
          </div>
        </div>
        <div v-else-if="databases.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
          No databases found. Make sure the database service is running.
        </div>
        <div v-else class="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div 
            v-for="db in databases" 
            :key="db" 
            class="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div class="flex items-center space-x-3">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
              </svg>
              <span class="text-white font-medium">{{ db }}</span>
            </div>
            <button 
              @click="dropDatabase(db)"
              class="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              title="Delete database"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="flex-1 flex flex-col min-h-0">
        <div v-if="loading && users.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Loading users...</span>
          </div>
        </div>
        <div v-else-if="users.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
          No users found. Make sure the database service is running.
        </div>
        <div v-else class="flex-1 overflow-y-auto space-y-2">
          <div 
            v-for="user in users" 
            :key="user.user + user.host" 
            class="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700"
          >
            <div class="flex items-center space-x-3">
              <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              <div>
                <span class="text-white font-medium">{{ user.user }}</span>
                <span class="text-gray-500 text-sm ml-2">@{{ user.host }}</span>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <input 
                v-model="userPasswords[user.user]" 
                type="password"
                placeholder="New password"
                class="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm w-40 focus:border-blue-500 focus:outline-none"
              />
              <button 
                @click="changePassword(user.user, user.host)"
                :disabled="!userPasswords[user.user]"
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded text-white text-sm font-medium transition-colors"
              >Change</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'vue-toastification';

const toast = useToast();

// State
const selectedApp = ref('');
const dbApps = ref([]);
const activeTab = ref('databases');
const loading = ref(false);
const databases = ref([]);
const users = ref([]);
const newDbName = ref('');
const userPasswords = ref({});

// Load installed database apps
const loadDbApps = async () => {
  try {
    const result = await window.sysapi.apps.getInstalled();
    if (!result.error && result.apps) {
      dbApps.value = result.apps.filter(app => 
        ['mysql', 'mariadb', 'postgresql'].includes(app.id)
      );
      // Auto-select first if only one
      if (dbApps.value.length === 1) {
        selectedApp.value = dbApps.value[0].id;
        onAppChange();
      }
    }
  } catch (err) {
    console.error('Failed to load db apps:', err);
  }
};

const onAppChange = () => {
  databases.value = [];
  users.value = [];
  userPasswords.value = {};
  if (selectedApp.value) {
    loadDatabases();
    loadUsers();
  }
};

const refreshAll = () => {
  loadDatabases();
  loadUsers();
};

const loadDatabases = async () => {
  if (!selectedApp.value) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.listDatabases(selectedApp.value);
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
  if (!selectedApp.value || !newDbName.value) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.createDatabase(selectedApp.value, newDbName.value);
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
  if (!selectedApp.value || !dbName) return;
  if (!confirm(`Delete database "${dbName}"? This action cannot be undone!`)) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.dropDatabase(selectedApp.value, dbName);
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
  if (!selectedApp.value) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.listUsers(selectedApp.value);
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
  if (!selectedApp.value || !username || !userPasswords.value[username]) return;
  
  loading.value = true;
  try {
    const result = await window.sysapi.database.changePassword(
      selectedApp.value, 
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

onMounted(() => {
  loadDbApps();
});
</script>
