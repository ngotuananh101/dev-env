<template>
  <div class="flex flex-col h-full bg-background text-foreground text-sm">
    <!-- Header with Tabs + Toolbar -->
    <div class="bg-card border-b border-border">
      <!-- Tabs -->
      <div class="flex items-center px-4 pt-3 gap-1">
        <button
          v-for="tab in availableTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm rounded-t-md transition-colors border-t border-l border-r"
          :class="
            activeTab === tab.id
              ? 'bg-background text-foreground border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted border-transparent'
          "
        >
          {{ tab.name }}
        </button>
        <div
          v-if="availableTabs.length === 0"
          class="text-muted-foreground text-sm py-2"
        >
          No database apps installed
        </div>
      </div>

      <!-- Toolbar (hide for Redis/Meilisearch) -->
      <div
        v-if="!isRedisTab && !isMeilisearchTab"
        class="flex items-center justify-between px-3 py-2 bg-background border-t border-border"
      >
        <div class="flex items-center gap-2">
          <Button
            :disabled="loading || !activeTab"
            @click="openCreateModal"
            variant="success"
            size="sm"
            class="text-xs"
          >
            <Plus class="w-3 h-3" /> Add Database
          </Button>

          <Button
            :disabled="loading || !activeTab"
            @click="refreshAll"
            variant="outline"
            size="sm"
            class="text-xs"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
            Reload
          </Button>

          <!-- Database indicator -->
          <Button
            v-if="currentDbApp"
            variant="outline"
            size="sm"
            disabled
            class="text-xs gap-1.5 opacity-100! cursor-default!"
          >
            <Database
              class="w-3 h-3"
              :class="currentDbApp.iconColor || 'text-blue-400'"
            />
            <span class="text-green-400"
              >{{ currentDbApp.name }} {{ currentDbApp.version }}</span
            >
          </Button>

          <!-- pgAdmin -->
          <Button
            v-if="currentDbApp?.id === 'postgresql'"
            @click="openPgAdmin"
            variant="outline"
            size="sm"
            class="border-blue-600 text-blue-400 hover:bg-blue-500/10"
          >
            <ExternalLink class="w-3 h-3" /> pgAdmin
          </Button>

          <!-- phpMyAdmin -->
          <Button
            v-if="
              (currentDbApp?.id === 'mysql' ||
                currentDbApp?.id === 'mariadb') &&
              isPhpMyAdminInstalled
            "
            @click="openPhpMyAdmin"
            variant="outline"
            size="sm"
            class="text-xs border-yellow-600 text-yellow-400 hover:bg-yellow-500/10"
          >
            <ExternalLink class="w-3 h-3" /> phpMyAdmin
          </Button>
        </div>

        <!-- Sub-tabs: Databases / Users -->
        <div class="flex gap-1">
          <Button
            @click="subTab = 'databases'"
            size="sm"
            :variant="subTab === 'databases' ? 'default' : 'ghost'"
            class="text-xs h-7"
            >Databases</Button
          >
          <Button
            @click="subTab = 'users'"
            size="sm"
            :variant="subTab === 'users' ? 'default' : 'ghost'"
            class="text-xs h-7"
            >Users</Button
          >
        </div>
      </div>
    </div>

    <!-- No Database Apps -->
    <div
      v-if="availableTabs.length === 0"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center space-y-2">
        <Database class="w-16 h-16 mx-auto text-muted-foreground/40" />
        <p class="text-muted-foreground text-lg">
          No database applications installed
        </p>
        <p class="text-muted-foreground/60 text-sm">
          Install MySQL, MariaDB, PostgreSQL or Redis from the App Store
        </p>
      </div>
    </div>

    <!-- Redis / Meilisearch / Elasticsearch managers -->
    <RedisManager v-else-if="isRedisTab" />
    <MeilisearchManager v-else-if="isMeilisearchTab" />
    <ElasticsearchManager v-else-if="isElasticsearchTab" />

    <!-- Service Not Running -->
    <div
      v-else-if="!serviceRunning"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center space-y-2">
        <Database class="w-12 h-12 mx-auto text-muted-foreground/40" />
        <p class="text-muted-foreground text-sm">
          {{ currentDbApp?.name || "Database" }} service is not running
        </p>
        <p class="text-muted-foreground/60 text-xs">
          Start the service from the home page to manage data
        </p>
        <Button @click="refreshAll" variant="outline" size="sm" class="mt-2">
          <RefreshCw class="w-3 h-3" /> Retry
        </Button>
      </div>
    </div>

    <!-- Databases Table -->
    <div
      v-else-if="
        !isRedisTab &&
        !isMeilisearchTab &&
        !isElasticsearchTab &&
        subTab === 'databases'
      "
      class="flex-1 overflow-auto"
    >
      <Table>
        <TableHeader class="bg-muted/50 sticky top-0">
          <TableRow class="hover:bg-transparent">
            <TableHead class="text-xs font-medium">Database Name</TableHead>
            <TableHead class="text-xs font-medium">Username</TableHead>
            <TableHead class="text-xs font-medium">Password</TableHead>
            <TableHead class="text-xs font-medium">Host</TableHead>
            <TableHead class="text-xs font-medium text-right w-28"
              >Actions</TableHead
            >
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-if="loading && databases.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              colspan="5"
              class="py-10 text-center text-muted-foreground"
            >
              <div class="flex flex-col items-center gap-2">
                <RefreshCw class="w-5 h-5 animate-spin" />
                <span>Loading databases...</span>
              </div>
            </TableCell>
          </TableRow>
          <TableRow
            v-else-if="databases.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              colspan="5"
              class="py-10 text-center text-muted-foreground"
            >
              <div class="flex flex-col items-center gap-2">
                <Database class="w-8 h-8 opacity-40" />
                <span>No databases found</span>
                <span class="text-xs opacity-60"
                  >Make sure the database service is running</span
                >
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-for="db in databases" :key="db.name" class="text-xs">
            <TableCell>
              <div class="flex items-center gap-2">
                <Database class="w-4 h-4 text-blue-400" />
                <span class="font-medium">{{ db.name }}</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              db.username || "—"
            }}</TableCell>
            <TableCell class="font-mono text-muted-foreground">
              <div class="flex items-center gap-2">
                <span>{{ db.password ? "••••••" : "—" }}</span>
                <Button
                  v-if="db.password"
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click="copyToClipboard(db.password, 'Password copied')"
                  title="Copy Password"
                >
                  <Copy class="w-3 h-3" />
                </Button>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              db.host || "localhost"
            }}</TableCell>
            <TableCell class="text-right">
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive text-xs h-6"
                @click="confirmDropDb(db.name)"
              >
                <Trash2 class="w-3 h-3" /> Delete
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Users Table -->
    <div
      v-else-if="
        !isRedisTab &&
        !isMeilisearchTab &&
        !isElasticsearchTab &&
        subTab === 'users'
      "
      class="flex-1 overflow-auto"
    >
      <Table>
        <TableHeader class="bg-muted/50 sticky top-0">
          <TableRow class="hover:bg-transparent">
            <TableHead class="text-xs font-medium">Username</TableHead>
            <TableHead class="text-xs font-medium">Host</TableHead>
            <TableHead class="text-xs font-medium text-right w-64"
              >Change Password</TableHead
            >
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-if="loading && users.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              colspan="3"
              class="py-10 text-center text-muted-foreground"
            >
              <div class="flex flex-col items-center gap-2">
                <RefreshCw class="w-5 h-5 animate-spin" />
                <span>Loading users...</span>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-else-if="users.length === 0" class="hover:bg-transparent">
            <TableCell
              colspan="3"
              class="py-10 text-center text-muted-foreground"
            >
              <div class="flex flex-col items-center gap-2">
                <User class="w-8 h-8 opacity-40" />
                <span>No users found</span>
                <span class="text-xs opacity-60"
                  >Make sure the database service is running</span
                >
              </div>
            </TableCell>
          </TableRow>
          <TableRow
            v-for="user in users"
            :key="user.user + user.host"
            class="text-xs"
          >
            <TableCell>
              <div class="flex items-center gap-2">
                <User class="w-4 h-4 text-green-400" />
                <span class="font-medium">{{ user.user }}</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">{{ user.host }}</TableCell>
            <TableCell>
              <div class="flex items-center justify-end gap-2">
                <Input
                  v-model="userPasswords[user.user]"
                  type="password"
                  placeholder="New password"
                  class="h-7 text-xs w-36"
                />
                <Button
                  @click="changePassword(user.user, user.host)"
                  :disabled="!userPasswords[user.user]"
                  size="sm"
                  class="h-7 text-xs"
                  >Change</Button
                >
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Footer -->
    <div
      v-if="
        !isRedisTab &&
        !isMeilisearchTab &&
        !isElasticsearchTab &&
        availableTabs.length > 0
      "
      class="px-3 py-1.5 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground"
    >
      <span
        >Total
        {{
          subTab === "databases"
            ? databases.length + " databases"
            : users.length + " users"
        }}</span
      >
      <span>{{ currentDbApp?.name || "No database selected" }}</span>
    </div>

    <!-- Create Database Modal -->
    <Dialog v-model:open="showCreateModal">
      <DialogContent class="max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add Database</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="grid grid-cols-[110px_1fr] gap-3 items-center">
            <Label class="text-right text-xs">Database name</Label>
            <Input v-model="newDbName" placeholder="my_database" />
          </div>
          <template
            v-if="
              currentDbApp?.id !== 'redis' &&
              currentDbApp?.id !== 'meilisearch' &&
              currentDbApp?.id !== 'elasticsearch'
            "
          >
            <div class="grid grid-cols-[110px_1fr] gap-3 items-center">
              <Label class="text-right text-xs">Username</Label>
              <Input v-model="newUsername" placeholder="db_user" />
            </div>
            <div class="grid grid-cols-[110px_1fr] gap-3 items-center">
              <Label class="text-right text-xs">Password</Label>
              <div class="relative">
                <Input
                  v-model="newPassword"
                  type="text"
                  placeholder="Password"
                  class="pr-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  class="absolute inset-y-0 right-0 h-full w-9 rounded-l-none"
                  @click="regenPassword"
                  title="Generate Password"
                >
                  <RefreshCw class="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </template>
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" @click="showCreateModal = false"
            >Cancel</Button
          >
          <Button
            variant="success"
            size="sm"
            @click="createDatabase"
            :disabled="loading || !newDbName"
          >
            <Loader2 v-if="loading" class="w-3 h-3 animate-spin" /> Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import {
  Plus,
  RefreshCw,
  Database,
  User,
  Loader2,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import RedisManager from "../components/RedisManager.vue";
import MeilisearchManager from "../components/MeilisearchManager.vue";
import ElasticsearchManager from "../components/ElasticsearchManager.vue";
import { generatePassword, copyToClipboard } from "../utils/helpers";
import { useDatabaseStore } from "../stores/database";

const dbStore = useDatabaseStore();
const router = useRouter();

// State
const dbApps = ref([]);
const activeTab = ref("");
const subTab = ref("databases");
const loading = ref(false);
const databases = ref([]);
const users = ref([]);
const newDbName = ref("");
const userPasswords = ref({});
const isPhpMyAdminInstalled = ref(false);

const isRedisTab = computed(() => activeTab.value === "redis");
const isMeilisearchTab = computed(() => activeTab.value === "meilisearch");
const isElasticsearchTab = computed(() => activeTab.value === "elasticsearch");

const availableTabs = computed(() =>
  dbApps.value.map((app) => ({ id: app.id, name: app.name })),
);
const currentDbApp = computed(() =>
  dbApps.value.find((app) => app.id === activeTab.value),
);

const loadDbApps = async () => {
  try {
    const result = await window.sysapi.db.query(
      "SELECT * FROM installed_apps WHERE app_id IN ('mysql', 'mariadb', 'postgresql', 'redis', 'mongodb', 'meilisearch', 'elasticsearch')",
    );
    const pmaResult = await window.sysapi.db.query(
      "SELECT * FROM installed_apps WHERE app_id = 'phpmyadmin'",
    );
    isPhpMyAdminInstalled.value = pmaResult?.length > 0;

    if (result && Array.isArray(result)) {
      const nameMap = {
        mysql: "MySQL",
        mariadb: "MariaDB",
        postgresql: "PostgreSQL",
        redis: "Redis",
        mongodb: "MongoDB",
        meilisearch: "Meilisearch",
        elasticsearch: "Elasticsearch",
      };
      const colorMap = {
        mysql: "text-orange-500",
        mariadb: "text-cyan-500",
        postgresql: "text-blue-600",
        redis: "text-red-500",
        mongodb: "text-green-500",
        meilisearch: "text-purple-500",
        elasticsearch: "text-yellow-500",
      };
      dbApps.value = result.map((app) => ({
        id: app.app_id,
        name: nameMap[app.app_id] || app.app_id,
        version: app.installed_version,
        installPath: app.install_path,
        execPath: app.exec_path,
        iconColor: colorMap[app.app_id] || "text-gray-400",
      }));
      if (dbApps.value.length > 0 && !activeTab.value)
        activeTab.value = dbApps.value[0].id;
    }
  } catch (err) {
    console.error("Failed to load db apps:", err);
  }
};

const refreshAll = () => {
  loadDatabases();
  loadUsers();
};
const serviceRunning = ref(true);

const checkServiceRunning = async (appId) => {
  const app = dbApps.value.find((a) => a.id === appId);
  if (!app?.execPath) return false;
  try {
    const status = await window.sysapi.apps.getServiceStatus(
      appId,
      app.execPath,
    );
    return status?.running === true;
  } catch {
    return false;
  }
};

const loadDatabases = async () => {
  if (!activeTab.value) return;
  const running = await checkServiceRunning(activeTab.value);
  serviceRunning.value = running;
  if (!running) {
    databases.value = [];
    return;
  }
  loading.value = true;
  try {
    const result = await dbStore.getDatabases(activeTab.value);
    if (result.error) toast.error(`Failed to load databases: ${result.error}`);
    else databases.value = result;
  } catch (err) {
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const showCreateModal = ref(false);
const newUsername = ref("");
const newPassword = ref("");

const openCreateModal = () => {
  newDbName.value = "";
  newUsername.value = "";
  newPassword.value = generatePassword();
  showCreateModal.value = true;
};

const regenPassword = () => {
  newPassword.value = generatePassword();
};

const createDatabase = async () => {
  if (!activeTab.value) {
    toast.warning("No active tab");
    return;
  }
  if (!newDbName.value) {
    toast.warning("Please enter a database name");
    return;
  }
  if (!newUsername.value)
    newUsername.value = newDbName.value.replace(/[^a-zA-Z0-9_]/g, "_");
  loading.value = true;
  try {
    const result = await dbStore.createDatabase(
      activeTab.value,
      newDbName.value,
      newUsername.value,
      newPassword.value,
    );
    if (result.error) toast.error(`Failed to create database: ${result.error}`);
    else {
      toast.success(`Database "${newDbName.value}" created`);
      showCreateModal.value = false;
      await loadDatabases();
      if (newUsername.value) await loadUsers();
    }
  } catch (err) {
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const confirmDropDb = async (dbName) => {
  if (!confirm(`Drop database "${dbName}"? This cannot be undone.`)) return;
  loading.value = true;
  try {
    const result = await dbStore.deleteDatabase(activeTab.value, dbName);
    if (result.error) toast.error(`Failed to drop: ${result.error}`);
    else {
      toast.success(`Database "${dbName}" dropped`);
      await loadDatabases();
    }
  } catch (err) {
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const openPgAdmin = async () => {
  if (!currentDbApp.value?.installPath) {
    toast.error("PostgreSQL path not found");
    return;
  }
  try {
    const findResult = await window.sysapi.files.findFile(
      currentDbApp.value.installPath,
      "pgAdmin4.exe",
    );
    if (findResult.error || !findResult.path)
      toast.warning("pgAdmin is not installed");
    else await window.sysapi.files.openFile(findResult.path);
  } catch {
    toast.error("Failed to open pgAdmin");
  }
};

const openPhpMyAdmin = async () => {
  const r = await window.sysapi.db.query(
    "SELECT * FROM installed_apps WHERE app_id = 'phpmyadmin'",
  );
  if (r?.length > 0)
    await window.sysapi.sites.openBrowser("http://localhost/phpmyadmin/");
  else toast.warning("phpMyAdmin is not installed");
};

const loadUsers = async () => {
  if (!activeTab.value) return;
  const running = await checkServiceRunning(activeTab.value);
  serviceRunning.value = running;
  if (!running) {
    users.value = [];
    return;
  }
  loading.value = true;
  try {
    const result = await dbStore.getUsers(activeTab.value);
    if (result.error) toast.error(`Failed to load users: ${result.error}`);
    else {
      users.value = result || [];
      userPasswords.value = {};
    }
  } catch (err) {
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const changePassword = async (username, host) => {
  if (!activeTab.value || !username || !userPasswords.value[username]) return;
  loading.value = true;
  try {
    const result = await dbStore.changePassword(
      activeTab.value,
      username,
      host,
      userPasswords.value[username],
    );
    if (result.error) toast.error(`Failed to change password: ${result.error}`);
    else {
      toast.success(`Password changed for "${username}"`);
      userPasswords.value[username] = "";
    }
  } catch (err) {
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

watch(activeTab, (newTab) => {
  if (
    newTab &&
    newTab !== "redis" &&
    newTab !== "meilisearch" &&
    newTab !== "elasticsearch"
  ) {
    databases.value = [];
    users.value = [];
    userPasswords.value = {};
    serviceRunning.value = true;
    refreshAll();
  }
});

onMounted(async () => {
  await loadDbApps();
});
</script>
