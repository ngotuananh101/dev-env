<template>
  <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
    <!-- Header with Tabs -->
    <div class="bg-[#252526] border-b border-gray-700">
      <!-- Tabs -->
      <div class="flex items-center px-4 pt-3 space-x-1">
        <button v-for="tab in availableTabs" :key="tab.id" @click="activeTab = tab.id"
          class="px-4 py-2 text-sm rounded-t-md transition-colors border-t border-l border-r" :class="activeTab === tab.id
            ? 'bg-background text-white border-gray-700'
            : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'">
          {{ tab.name }}
        </button>
        <div v-if="availableTabs.length === 0" class="text-gray-500 text-sm py-2">
          No database apps installed
        </div>
      </div>

      <!-- Toolbar (hide for Redis/Meilisearch - they have their own) -->
      <div v-if="!isRedisTab && !isMeilisearchTab"
        class="flex items-center justify-between p-3 bg-background border-t border-gray-700">
        <div class="flex items-center space-x-2">
          <Button :disabled="loading || !activeTab" @click="openCreateModal" variant="success" size="sm">
            <Plus class="w-3 h-3" />
            Add Database
          </Button>

          <Button :disabled="loading || !activeTab" @click="refreshAll" variant="secondary" size="sm">
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
            Reload
          </Button>

          <!-- Database indicator -->
          <div v-if="currentDbApp" class="flex items-center space-x-1 h-8 px-3 bg-gray-700 rounded text-xs select-none">
            <Database class="w-3 h-3" :class="currentDbApp.iconColor || 'text-blue-400'" />
            <span class="text-green-400">
              {{ currentDbApp.name }} {{ currentDbApp.version }}
            </span>
          </div>

          <!-- pgAdmin Button -->
          <Button v-if="currentDbApp?.id === 'postgresql'" @click="openPgAdmin" size="sm" class="border border-blue-600"
            title="Open pgAdmin">
            <ExternalLink class="w-3 h-3" />
            pgAdmin
          </Button>

          <!-- phpMyAdmin Button -->
          <Button v-if="(currentDbApp?.id === 'mysql' || currentDbApp?.id === 'mariadb') && isPhpMyAdminInstalled"
            @click="openPhpMyAdmin" variant="secondary" size="sm"
            class="bg-yellow-600! hover:bg-yellow-500! border border-yellow-500" title="Open phpMyAdmin">
            <ExternalLink class="w-3 h-3" />
            phpMyAdmin
          </Button>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Sub-tabs: Databases / Users -->
          <div class="flex bg-gray-700 rounded overflow-hidden">
            <button @click="subTab = 'databases'"
              :class="subTab === 'databases' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'"
              class="px-3 py-1.5 text-xs">Databases</button>
            <button @click="subTab = 'users'"
              :class="subTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'"
              class="px-3 py-1.5 text-xs">Users</button>
          </div>
        </div>
      </div>
    </div>

    <!-- No Database Apps -->
    <div v-if="availableTabs.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <Database class="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <p class="text-gray-400 text-lg">No database applications installed</p>
        <p class="text-gray-500 text-sm mt-2">Install MySQL, MariaDB, PostgreSQL or Redis from the App Store</p>
      </div>
    </div>

    <!-- Redis Manager (separate view) -->
    <RedisManager v-else-if="isRedisTab" />

    <!-- Meilisearch Manager (separate view) -->
    <MeilisearchManager v-else-if="isMeilisearchTab" />

    <!-- Elasticsearch Manager (separate view) -->
    <ElasticsearchManager v-else-if="isElasticsearchTab" />

    <!-- Service Not Running (for SQL-type tabs) -->
    <div v-else-if="!serviceRunning" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <Database class="w-12 h-12 mx-auto text-gray-600 mb-3" />
        <p class="text-gray-400 text-sm">{{ currentDbApp?.name || 'Database' }} service is not running</p>
        <p class="text-gray-500 text-xs mt-1">Start the service from the home page to manage data</p>
        <button @click="refreshAll"
          class="mt-3 px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
          Retry
        </button>
      </div>
    </div>

    <!-- Databases Table (not for Redis/Meilisearch/Elasticsearch) -->
    <div v-else-if="!isRedisTab && !isMeilisearchTab && !isElasticsearchTab && subTab === 'databases'"
      class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#252526] sticky top-0">
          <tr class="text-gray-400">
            <th class="px-3 py-2 text-left font-medium">Database Name</th>
            <th class="px-3 py-2 text-left font-medium">Username</th>
            <th class="px-3 py-2 text-left font-medium">Password</th>
            <th class="px-3 py-2 text-left font-medium">Host</th>
            <th class="px-3 py-2 text-center font-medium w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && databases.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <RefreshCw class="w-6 h-6 animate-spin" />
                <span>Loading databases...</span>
              </div>
            </td>
          </tr>
          <tr v-else-if="databases.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <Database class="w-8 h-8" />
                <span>No databases found</span>
                <span class="text-xs">Make sure the database service is running</span>
              </div>
            </td>
          </tr>
          <tr v-for="db in databases" :key="db.name" class="border-b border-gray-800 hover:bg-gray-800/50">
            <td class="px-3 py-2">
              <div class="flex items-center space-x-2">
                <Database class="w-4 h-4 text-blue-400" />
                <span class="text-white font-medium">{{ db.name }}</span>
              </div>
            </td>
            <td class="px-3 py-2 text-gray-400 text-xs">
              {{ db.username || '-' }}
            </td>
            <td class="px-3 py-2 text-gray-400 text-xs font-mono">
              <div class="flex items-center space-x-2">
                <span>{{ db.password ? '******' : '-' }}</span>
                <button v-if="db.password" @click="copyToClipboard(db.password, 'Password copied to clipboard')"
                  class="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                  title="Copy Password">
                  <Copy class="w-3 h-3" />
                </button>
              </div>
            </td>
            <td class="px-3 py-2 text-gray-400 text-xs">
              {{ db.host || 'localhost' }}
            </td>
            <td class="px-3 py-2 text-center">
              <button @click="confirmDropDb(db.name)" class="text-red-400 hover:text-red-300 hover:underline text-xs">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Users Table (not for Redis/Meilisearch/Elasticsearch) -->
    <div v-else-if="!isRedisTab && !isMeilisearchTab && !isElasticsearchTab && subTab === 'users'"
      class="flex-1 overflow-auto">
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
          <tr v-for="user in users" :key="user.user + user.host" class="border-b border-gray-800 hover:bg-gray-800/50">
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
                <div class="w-32">
                  <Input v-model="userPasswords[user.user]" type="password" placeholder="New password"
                    class="h-8 text-xs" />
                </div>
                <Button @click="changePassword(user.user, user.host)" :disabled="!userPasswords[user.user]" size="sm"
                  class="h-8 px-2">Change</Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer (not for Redis/Meilisearch - they have their own) -->
    <div v-if="!isRedisTab && !isMeilisearchTab && !isElasticsearchTab && availableTabs.length > 0"
      class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div>
        Total {{ subTab === 'databases' ? databases.length + ' databases' : users.length + ' users' }}
      </div>
      <div>
        {{ currentDbApp?.name || 'No database selected' }}
      </div>
    </div>

    <!-- Create Database Modal -->
    <Dialog v-model:open="showCreateModal">
      <DialogContent class="max-w-[450px] bg-[#252526] border-gray-700 text-gray-200">
        <DialogHeader>
          <DialogTitle>Add Database</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
            <label class="text-gray-400 text-right text-xs">Database name</label>
            <Input v-model="newDbName" placeholder="New database name" />
          </div>

          <div
            v-if="currentDbApp?.id !== 'redis' && currentDbApp?.id !== 'meilisearch' && currentDbApp?.id !== 'elasticsearch'"
            class="grid grid-cols-[100px_1fr] gap-4 items-center">
            <label class="text-gray-400 text-right text-xs">Username</label>
            <Input v-model="newUsername" placeholder="Database user" />
          </div>

          <div
            v-if="currentDbApp?.id !== 'redis' && currentDbApp?.id !== 'meilisearch' && currentDbApp?.id !== 'elasticsearch'"
            class="grid grid-cols-[100px_1fr] gap-4 items-center">
            <label class="text-gray-400 text-right text-xs">Password</label>
            <div class="relative">
              <Input v-model="newPassword" type="text" placeholder="Password" class="pr-9" />
              <button @click="regenPassword"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white transition-colors"
                title="Generate Password">
                <RefreshCw class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" @click="showCreateModal = false">Cancel</Button>
          <Button variant="success" size="sm" @click="createDatabase" :disabled="loading || !newDbName">
            <Loader2 v-if="loading" class="w-3 h-3 animate-spin" />
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { Plus, RefreshCw, Database, User, X, Loader2, Copy, ExternalLink, Trash2, Users, Save } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import RedisManager from '../components/RedisManager.vue';
import MeilisearchManager from '../components/MeilisearchManager.vue';
import ElasticsearchManager from '../components/ElasticsearchManager.vue';
import { generatePassword, copyToClipboard } from '../utils/helpers';
import { useDatabaseStore } from '../stores/database';

const dbStore = useDatabaseStore();
const router = useRouter();

// State
const dbApps = ref([]);
const activeTab = ref('');
const subTab = ref('databases');
const loading = ref(false);
const databases = ref([]);
const users = ref([]);
const newDbName = ref('');
const userPasswords = ref({});
const isPhpMyAdminInstalled = ref(false);

// Check if current tab is Redis or Meilisearch
const isRedisTab = computed(() => activeTab.value === 'redis');
const isMeilisearchTab = computed(() => activeTab.value === 'meilisearch');
const isElasticsearchTab = computed(() => activeTab.value === 'elasticsearch');

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
    const result = await window.sysapi.db.query(
      "SELECT * FROM installed_apps WHERE app_id IN ('mysql', 'mariadb', 'postgresql', 'redis', 'mongodb', 'meilisearch', 'elasticsearch')"
    );

    const pmaResult = await window.sysapi.db.query(
      "SELECT * FROM installed_apps WHERE app_id = 'phpmyadmin'"
    );
    isPhpMyAdminInstalled.value = pmaResult && pmaResult.length > 0;

    if (result && Array.isArray(result)) {
      dbApps.value = result.map(app => {
        const nameMap = {
          'mysql': 'MySQL', 'mariadb': 'MariaDB', 'postgresql': 'PostgreSQL',
          'redis': 'Redis', 'mongodb': 'MongoDB', 'meilisearch': 'Meilisearch',
          'elasticsearch': 'Elasticsearch'
        };
        const colorMap = {
          'mysql': 'text-orange-500', 'mariadb': 'text-cyan-500', 'postgresql': 'text-blue-600',
          'redis': 'text-red-500', 'mongodb': 'text-green-500', 'meilisearch': 'text-purple-500',
          'elasticsearch': 'text-yellow-500'
        };
        return {
          id: app.app_id, name: nameMap[app.app_id] || app.app_id,
          version: app.installed_version, installPath: app.install_path,
          execPath: app.exec_path, iconColor: colorMap[app.app_id] || 'text-gray-400'
        };
      });
      if (dbApps.value.length > 0 && !activeTab.value) {
        activeTab.value = dbApps.value[0].id;
      }
    }
  } catch (err) {
    console.error('Failed to load db apps:', err);
  }
};

const refreshAll = () => { loadDatabases(); loadUsers(); };

const serviceRunning = ref(true);

const checkServiceRunning = async (appId) => {
  const app = dbApps.value.find(a => a.id === appId);
  if (!app || !app.execPath) return false;
  try {
    const status = await window.sysapi.apps.getServiceStatus(appId, app.execPath);
    return status?.running === true;
  } catch { return false; }
};

const loadDatabases = async () => {
  if (!activeTab.value) return;
  const running = await checkServiceRunning(activeTab.value);
  serviceRunning.value = running;
  if (!running) { databases.value = []; return; }

  loading.value = true;
  try {
    const result = await dbStore.getDatabases(activeTab.value);
    if (result.error) { toast.error(`Failed to load databases: ${result.error}`); }
    else { databases.value = result; }
  } catch (err) { console.error('Load databases error:', err); toast.error(err.message); }
  finally { loading.value = false; }
};

const showCreateModal = ref(false);
const newUsername = ref('');
const newPassword = ref('');

const openCreateModal = () => {
  newDbName.value = ''; newUsername.value = '';
  newPassword.value = generatePassword();
  showCreateModal.value = true;
};

const regenPassword = () => { newPassword.value = generatePassword(); };

const createDatabase = async () => {
  if (!activeTab.value) { toast.warning('No active tab'); return; }
  if (!newDbName.value) { toast.warning('Please enter a database name'); return; }
  if (!newUsername.value) { newUsername.value = newDbName.value.replace(/[^a-zA-Z0-9_]/g, '_'); }

  loading.value = true;
  try {
    const result = await dbStore.createDatabase(newDbName.value, newUsername.value, newPassword.value);
    if (result.error) { toast.error(`Failed to create database: ${result.error}`); }
    else {
      toast.success(`Database "${newDbName.value}" created`);
      showCreateModal.value = false;
      await loadDatabases();
      if (newUsername.value) await loadUsers();
    }
  } catch (err) { console.error('Create database error:', err); toast.error(err.message); }
  finally { loading.value = false; }
};

const confirmDropDb = async (dbName) => {
  if (!confirm(`Are you sure you want to drop database "${dbName}"? This cannot be undone.`)) return;
  loading.value = true;
  try {
    const result = await dbStore.deleteDatabase(activeTab.value, dbName);
    if (result.error) { toast.error(`Failed to drop database: ${result.error}`); }
    else { toast.success(`Database "${dbName}" dropped`); await loadDatabases(); }
  } catch (err) { console.error('Drop database error:', err); toast.error(err.message); }
  finally { loading.value = false; }
};

const openPgAdmin = async () => {
  if (!currentDbApp.value || !currentDbApp.value.installPath) {
    toast.error('PostgreSQL installation path not found'); return;
  }
  try {
    const findResult = await window.sysapi.files.findFile(currentDbApp.value.installPath, 'pgAdmin4.exe');
    if (findResult.error || !findResult.path) { window.sysapi.openExternal('http://127.0.0.1:5432'); }
    else { await window.sysapi.files.openFile(findResult.path); }
  } catch (err) { window.sysapi.openExternal('http://127.0.0.1:5432'); }
};

const openPhpMyAdmin = async () => {
  const pmaResult = await window.sysapi.db.query("SELECT * FROM installed_apps WHERE app_id = 'phpmyadmin'");
  if (pmaResult && pmaResult.length > 0) { window.sysapi.openExternal('http://localhost/phpmyadmin'); }
  else { toast.warning('phpMyAdmin is not installed'); }
};

const loadUsers = async () => {
  if (!activeTab.value) return;
  const running = await checkServiceRunning(activeTab.value);
  serviceRunning.value = running;
  if (!running) { users.value = []; return; }

  loading.value = true;
  try {
    const result = await dbStore.getUsers(activeTab.value);
    if (result.error) { toast.error(`Failed to load users: ${result.error}`); }
    else { users.value = result || []; userPasswords.value = {}; }
  } catch (err) { console.error('Load users error:', err); toast.error(err.message); }
  finally { loading.value = false; }
};

const changePassword = async (username, host) => {
  if (!activeTab.value || !username || !userPasswords.value[username]) return;
  loading.value = true;
  try {
    const result = await dbStore.changePassword(activeTab.value, username, host, userPasswords.value[username]);
    if (result.error) { toast.error(`Failed to change password: ${result.error}`); }
    else { toast.success(`Password changed for "${username}"`); userPasswords.value[username] = ''; }
  } catch (err) { console.error('Change password error:', err); toast.error(err.message); }
  finally { loading.value = false; }
};

watch(activeTab, (newTab) => {
  if (newTab && newTab !== 'redis' && newTab !== 'meilisearch' && newTab !== 'elasticsearch') {
    databases.value = []; users.value = []; userPasswords.value = {};
    serviceRunning.value = true; refreshAll();
  }
});

onMounted(async () => { await loadDbApps(); });
</script>
