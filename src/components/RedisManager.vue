<template>
  <div class="flex flex-col h-full">
    <!-- DB Tabs (DB0-DB15) -->
    <div class="bg-[#252526] border-b border-gray-700 px-2 py-2">
      <div class="flex flex-wrap gap-1">
        <button v-for="i in 16" :key="i - 1" @click="selectDb(i - 1)"
          class="px-3 py-1.5 text-xs rounded transition-colors border" :class="activeDb === i - 1
            ? 'bg-gray-700 text-white border-gray-600'
            : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'">
          DB{{ i - 1 }}({{ dbSizes[i - 1] || 0 }})
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between p-3 bg-[#252526] border-b border-gray-700">
      <div class="flex items-center space-x-2">
        <BaseButton @click="openAddKeyModal" variant="success" size="sm">
          <template #icon>
            <Plus class="w-3 h-3" />
          </template>
          Add Key
        </BaseButton>

        <BaseButton @click="refreshKeys" variant="secondary" size="sm" :disabled="loading">
          <template #icon>
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          </template>
          Reload
        </BaseButton>

        <BaseButton v-if="selectedKeys.length > 0" @click="deleteSelectedKeys" variant="danger" size="sm">
          <template #icon>
            <Trash2 class="w-3 h-3" />
          </template>
          Delete ({{ selectedKeys.length }})
        </BaseButton>
      </div>

      <div class="flex items-center space-x-2">
        <div class="relative">
          <input v-model="searchPattern" @keyup.enter="refreshKeys" type="text" placeholder="Search key..."
            class="h-8 w-56 px-3 pr-8 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <button @click="refreshKeys" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <Search class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Keys Table -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#252526] sticky top-0">
          <tr class="text-gray-400">
            <th class="px-3 py-2 text-left font-medium w-10">
              <input type="checkbox" :checked="selectedKeys.length > 0 && selectedKeys.length === keys.length"
                @change="toggleSelectAll"
                class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
            </th>
            <th class="px-3 py-2 text-left font-medium">Key</th>
            <th class="px-3 py-2 text-left font-medium w-96">Value</th>
            <th class="px-3 py-2 text-center font-medium w-24">Data Type</th>
            <th class="px-3 py-2 text-center font-medium w-24">Length</th>
            <th class="px-3 py-2 text-center font-medium w-24">TTL</th>
            <th class="px-3 py-2 text-center font-medium w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && keys.length === 0">
            <td colspan="7" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <RefreshCw class="w-6 h-6 animate-spin" />
                <span>Loading keys...</span>
              </div>
            </td>
          </tr>
          <tr v-else-if="keys.length === 0">
            <td colspan="7" class="px-3 py-8 text-center text-gray-500">
              <div class="flex flex-col items-center space-y-2">
                <Database class="w-8 h-8" />
                <span>No Data</span>
              </div>
            </td>
          </tr>
          <tr v-for="keyData in keys" :key="keyData.key" class="border-b border-gray-800 hover:bg-gray-800/50">
            <td class="px-3 py-2">
              <input type="checkbox" :checked="selectedKeys.includes(keyData.key)"
                @change="toggleSelectKey(keyData.key)"
                class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center space-x-2">
                <Key class="w-4 h-4 text-red-400" />
                <span class="text-white font-mono">{{ keyData.key }}</span>
              </div>
            </td>
            <td class="px-3 py-2 text-gray-400 font-mono text-xs">
              <div class="flex items-center space-x-2">
                <span class="truncate block max-w-xs">
                  {{ truncateValue(keyData.value, 50) }}
                </span>
                <button v-if="keyData.value && String(keyData.value).length > 50" @click="viewKeyDetail(keyData)"
                  class="text-blue-400 hover:text-blue-300 text-xs whitespace-nowrap" title="View full value">
                  [view]
                </button>
              </div>
            </td>
            <td class="px-3 py-2 text-center">
              <span class="px-2 py-0.5 rounded text-xs" :class="getTypeClass(keyData.type)">
                {{ keyData.type }}
              </span>
            </td>
            <td class="px-3 py-2 text-center text-gray-400">
              {{ keyData.length }}
            </td>
            <td class="px-3 py-2 text-center text-gray-400">
              {{ formatTtl(keyData.ttl) }}
            </td>
            <td class="px-3 py-2 text-center">
              <div class="flex items-center justify-center space-x-2">
                <button @click="viewKeyDetail(keyData)" class="text-blue-400 hover:text-blue-300" title="View">
                  <Eye class="w-4 h-4" />
                </button>
                <button @click="deleteKey(keyData.key)" class="text-red-400 hover:text-red-300" title="Delete">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer with Pagination -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div class="flex items-center space-x-2">
        <input type="checkbox" :checked="selectedKeys.length > 0 && selectedKeys.length === keys.length"
          @change="toggleSelectAll"
          class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
        <span v-if="selectedKeys.length > 0">
          {{ selectedKeys.length }} selected
        </span>
        <span v-else>Select keys to delete</span>
      </div>
      <div class="flex items-center space-x-4">
        <!-- Page Size Selector -->
        <div class="flex items-center space-x-2">
          <select v-model="pageSize" @change="onPageSizeChange"
            class="h-7 px-2 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500">
            <option :value="20">20 / page</option>
            <option :value="50">50 / page</option>
            <option :value="100">100 / page</option>
          </select>
        </div>

        <!-- Pagination Controls -->
        <div class="flex items-center space-x-2">
          <button @click="prevPage" :disabled="!canGoPrev"
            class="px-2 py-1 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
            &lt;
          </button>
          <span class="px-2">{{ currentPage }}</span>
          <button @click="nextPage" :disabled="!canGoNext"
            class="px-2 py-1 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
            &gt;
          </button>
        </div>

        <!-- Total Info -->
        <span>Total {{ totalKeys }} keys</span>
      </div>
    </div>

    <!-- Add/Edit Key Modal -->
    <BaseModal :show="showAddKeyModal" @close="showAddKeyModal = false" max-width="550px" body-class="p-6">
      <template #title>{{ editingKey ? 'Edit Key' : 'Add Key' }}</template>

      <div class="space-y-4">
        <!-- Key Name -->
        <div class="grid grid-cols-[80px_1fr] gap-4 items-center">
          <label class="text-gray-400 text-right text-xs">Key</label>
          <BaseInput v-model="newKeyName" placeholder="Key name" :disabled="!!editingKey" />
        </div>

        <!-- Data Type (only for new keys) -->
        <div v-if="!editingKey" class="grid grid-cols-[80px_1fr] gap-4 items-center">
          <label class="text-gray-400 text-right text-xs">Type</label>
          <select v-model="newKeyType"
            class="h-9 px-3 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500">
            <option value="string">String</option>
            <option value="list">List</option>
            <option value="set">Set</option>
            <option value="zset">Sorted Set</option>
            <option value="hash">Hash</option>
          </select>
        </div>

        <!-- String Value -->
        <div v-if="newKeyType === 'string'" class="grid grid-cols-[80px_1fr] gap-4 items-start">
          <label class="text-gray-400 text-right text-xs pt-2">Value</label>
          <textarea v-model="newKeyValue" placeholder="Value" rows="5"
            class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
        </div>

        <!-- List Value -->
        <div v-else-if="newKeyType === 'list'" class="grid grid-cols-[80px_1fr] gap-4 items-start">
          <label class="text-gray-400 text-right text-xs pt-2">Items</label>
          <div class="space-y-2">
            <textarea v-model="newKeyValue" placeholder="One item per line" rows="5"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
            <div class="text-xs text-gray-500">Enter one item per line</div>
          </div>
        </div>

        <!-- Set Value -->
        <div v-else-if="newKeyType === 'set'" class="grid grid-cols-[80px_1fr] gap-4 items-start">
          <label class="text-gray-400 text-right text-xs pt-2">Members</label>
          <div class="space-y-2">
            <textarea v-model="newKeyValue" placeholder="One member per line" rows="5"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
            <div class="text-xs text-gray-500">Enter one member per line (duplicates will be ignored)</div>
          </div>
        </div>

        <!-- Sorted Set Value -->
        <div v-else-if="newKeyType === 'zset'" class="grid grid-cols-[80px_1fr] gap-4 items-start">
          <label class="text-gray-400 text-right text-xs pt-2">Members</label>
          <div class="space-y-2">
            <textarea v-model="newKeyValue" placeholder="score member&#10;1 item1&#10;2 item2" rows="5"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
            <div class="text-xs text-gray-500">Format: score member (one per line)</div>
          </div>
        </div>

        <!-- Hash Value -->
        <div v-else-if="newKeyType === 'hash'" class="grid grid-cols-[80px_1fr] gap-4 items-start">
          <label class="text-gray-400 text-right text-xs pt-2">Fields</label>
          <div class="space-y-2">
            <textarea v-model="newKeyValue" placeholder="field value&#10;name John&#10;age 30" rows="5"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
            <div class="text-xs text-gray-500">Format: field value (one per line)</div>
          </div>
        </div>

        <!-- TTL -->
        <div class="grid grid-cols-[80px_1fr] gap-4 items-center">
          <label class="text-gray-400 text-right text-xs">TTL (s)</label>
          <BaseInput v-model.number="newKeyTtl" type="number" placeholder="-1 for no expiry" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end space-x-2">
          <BaseButton variant="secondary" size="sm" @click="showAddKeyModal = false">Cancel</BaseButton>
          <BaseButton variant="success" size="sm" @click="saveKey" :disabled="loading || !newKeyName">
            <template #icon>
              <Loader2 v-if="loading" class="w-3 h-3 animate-spin" />
            </template>
            Save
          </BaseButton>
        </div>
      </template>
    </BaseModal>

    <!-- View Key Detail Modal -->
    <BaseModal :show="showDetailModal" @close="showDetailModal = false" max-width="700px" body-class="p-6">
      <template #title>
        <div class="flex items-center space-x-2">
          <span>Key Detail</span>
          <span class="px-2 py-0.5 rounded text-xs" :class="getTypeClass(viewingKey?.type)">
            {{ viewingKey?.type }}
          </span>
        </div>
      </template>

      <div class="space-y-4">
        <!-- Key Name -->
        <div class="grid grid-cols-[80px_1fr] gap-4 items-center">
          <label class="text-gray-400 text-right text-xs">Key</label>
          <div class="flex items-center space-x-2">
            <code class="text-white font-mono text-sm bg-gray-800 px-2 py-1 rounded">{{ viewingKey?.key }}</code>
            <button @click="copyToClipboard(viewingKey?.key)" class="text-gray-400 hover:text-white" title="Copy key">
              <Copy class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- TTL & Length -->
        <div class="grid grid-cols-[80px_1fr] gap-4 items-center">
          <label class="text-gray-400 text-right text-xs">Info</label>
          <div class="flex items-center space-x-4 text-sm">
            <span class="text-gray-400">TTL: <span class="text-white">{{ formatTtl(viewingKey?.ttl) }}</span></span>
            <span class="text-gray-400">Length: <span class="text-white">{{ viewingKey?.length }}</span></span>
          </div>
        </div>

        <!-- Value Section - Different display based on type -->
        <div class="grid grid-cols-[80px_1fr] gap-4 items-start">
          <label class="text-gray-400 text-right text-xs pt-2">Value</label>

          <!-- String Type -->
          <div v-if="viewingKey?.type === 'string'" class="space-y-2">
            <div class="flex items-center space-x-2">
              <button @click="copyToClipboard(viewingKey?.value)" class="text-xs text-blue-400 hover:text-blue-300">
                Copy Value
              </button>
            </div>
            <pre
              class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 overflow-auto max-h-80 font-mono whitespace-pre-wrap break-all">
          {{ viewingKey?.value }}</pre>
          </div>

          <!-- List Type -->
          <div v-else-if="viewingKey?.type === 'list'" class="space-y-2">
            <div class="text-xs text-gray-500">List items (showing first 100):</div>
            <div class="w-full max-h-80 overflow-auto bg-gray-800 border border-gray-700 rounded">
              <div v-for="(item, index) in parseListValue(viewingKey?.value)" :key="index"
                class="flex items-center px-3 py-1.5 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                <span class="text-gray-500 w-10 text-xs">{{ index }}</span>
                <span class="text-gray-300 font-mono text-xs break-all">{{ item }}</span>
              </div>
            </div>
          </div>

          <!-- Set Type -->
          <div v-else-if="viewingKey?.type === 'set'" class="space-y-2">
            <div class="text-xs text-gray-500">Set members:</div>
            <div class="w-full max-h-80 overflow-auto bg-gray-800 border border-gray-700 rounded">
              <div v-for="(member, index) in parseListValue(viewingKey?.value)" :key="index"
                class="flex items-center px-3 py-1.5 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                <span class="text-gray-300 font-mono text-xs break-all">{{ member }}</span>
              </div>
            </div>
          </div>

          <!-- Sorted Set (zset) Type -->
          <div v-else-if="viewingKey?.type === 'zset'" class="space-y-2">
            <div class="text-xs text-gray-500">Sorted set members with scores:</div>
            <div class="w-full max-h-80 overflow-auto bg-gray-800 border border-gray-700 rounded">
              <table class="w-full text-xs">
                <thead class="bg-gray-700 sticky top-0">
                  <tr>
                    <th class="px-3 py-1.5 text-left text-gray-400">Member</th>
                    <th class="px-3 py-1.5 text-right text-gray-400 w-24">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in parseZsetValue(viewingKey?.value)" :key="index"
                    class="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                    <td class="px-3 py-1.5 text-gray-300 font-mono break-all">{{ item.member }}</td>
                    <td class="px-3 py-1.5 text-right text-blue-400">{{ item.score }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Hash Type -->
          <div v-else-if="viewingKey?.type === 'hash'" class="space-y-2">
            <div class="text-xs text-gray-500">Hash fields:</div>
            <div class="w-full max-h-80 overflow-auto bg-gray-800 border border-gray-700 rounded">
              <table class="w-full text-xs">
                <thead class="bg-gray-700 sticky top-0">
                  <tr>
                    <th class="px-3 py-1.5 text-left text-gray-400">Field</th>
                    <th class="px-3 py-1.5 text-left text-gray-400">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in parseHashValue(viewingKey?.value)" :key="index"
                    class="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                    <td class="px-3 py-1.5 text-yellow-400 font-mono">{{ item.field }}</td>
                    <td class="px-3 py-1.5 text-gray-300 font-mono break-all">{{ item.value }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Stream or Unknown Type -->
          <div v-else class="space-y-2">
            <pre
              class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 overflow-auto max-h-80 font-mono whitespace-pre-wrap">
          {{ viewingKey?.value }}</pre>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end space-x-2">
          <BaseButton variant="secondary" size="sm" @click="showDetailModal = false">Close</BaseButton>
          <BaseButton v-if="viewingKey?.type === 'string'" variant="primary" size="sm" @click="editFromDetail">
            Edit
          </BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { Plus, RefreshCw, Search, Trash2, Eye, Key, Database, Loader2, Copy } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import BaseButton from './BaseButton.vue';
import BaseModal from './BaseModal.vue';
import BaseInput from './BaseInput.vue';

const toast = useToast();

// State
const loading = ref(false);
const activeDb = ref(0);
const dbSizes = ref({});
const keys = ref([]);
const selectedKeys = ref([]);
const searchPattern = ref('*');
const currentPage = ref(1);
const pageSize = ref(20);
const totalKeys = ref(0);
const cursors = ref([0]); // Store cursors for pagination

// Modal state
const showAddKeyModal = ref(false);
const showDetailModal = ref(false);
const editingKey = ref(null);
const viewingKey = ref(null);
const newKeyName = ref('');
const newKeyType = ref('string');
const newKeyValue = ref('');
const newKeyTtl = ref(-1);

// Computed
const canGoPrev = ref(false);
const canGoNext = ref(false);

// Load Redis info (db sizes)
const loadRedisInfo = async () => {
  try {
    const result = await window.sysapi.database.redis.getInfo();
    if (result.error) {
      toast.error(`Failed to get Redis info: ${result.error}`);
      return;
    }
    dbSizes.value = result.dbSizes || {};
  } catch (err) {
    console.error('Load Redis info error:', err);
  }
};

// Select database
const selectDb = (index) => {
  activeDb.value = index;
  currentPage.value = 1;
  cursors.value = [0];
  selectedKeys.value = [];
  refreshKeys();
};

// Refresh keys
const refreshKeys = async () => {
  loading.value = true;
  selectedKeys.value = [];

  try {
    const pattern = searchPattern.value || '*';
    const cursor = cursors.value[currentPage.value - 1] || 0;

    const result = await window.sysapi.database.redis.getKeys(activeDb.value, pattern, cursor, pageSize.value);

    if (result.error) {
      toast.error(`Failed to load keys: ${result.error}`);
      keys.value = [];
      return;
    }

    // Get key info for each key
    const keyInfos = await Promise.all(
      result.keys.map(key => window.sysapi.database.redis.getKeyInfo(activeDb.value, key))
    );

    keys.value = keyInfos.filter(k => !k.error);

    // Update pagination
    if (result.nextCursor !== 0) {
      cursors.value[currentPage.value] = result.nextCursor;
      canGoNext.value = true;
    } else {
      canGoNext.value = false;
    }
    canGoPrev.value = currentPage.value > 1;

    // Update total from dbSizes
    totalKeys.value = dbSizes.value[activeDb.value] || keys.value.length;
  } catch (err) {
    console.error('Load keys error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

// Pagination
const nextPage = () => {
  if (canGoNext.value) {
    currentPage.value++;
    refreshKeys();
  }
};

const prevPage = () => {
  if (canGoPrev.value) {
    currentPage.value--;
    refreshKeys();
  }
};

// Handle page size change
const onPageSizeChange = () => {
  currentPage.value = 1;
  cursors.value = [0];
  refreshKeys();
};

// Selection
const toggleSelectAll = () => {
  if (selectedKeys.value.length === keys.value.length) {
    selectedKeys.value = [];
  } else {
    selectedKeys.value = keys.value.map(k => k.key);
  }
};

const toggleSelectKey = (key) => {
  const index = selectedKeys.value.indexOf(key);
  if (index === -1) {
    selectedKeys.value.push(key);
  } else {
    selectedKeys.value.splice(index, 1);
  }
};

// Add key modal
const openAddKeyModal = () => {
  editingKey.value = null;
  newKeyName.value = '';
  newKeyType.value = 'string';
  newKeyValue.value = '';
  newKeyTtl.value = -1;
  showAddKeyModal.value = true;
};

// Save key
const saveKey = async () => {
  if (!newKeyName.value) {
    toast.warning('Please enter a key name');
    return;
  }

  loading.value = true;
  try {
    // Use editing key's type if editing, otherwise use selected type
    const dataType = editingKey.value ? 'string' : newKeyType.value;

    const result = await window.sysapi.database.redis.setKey(
      activeDb.value,
      newKeyName.value,
      newKeyValue.value,
      newKeyTtl.value > 0 ? newKeyTtl.value : -1,
      dataType
    );

    if (result.error) {
      toast.error(`Failed to save key: ${result.error}`);
    } else {
      toast.success(`Key "${newKeyName.value}" saved`);
      showAddKeyModal.value = false;
      await refreshKeys();
      await loadRedisInfo();
    }
  } catch (err) {
    console.error('Save key error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

// Delete single key
const deleteKey = async (key) => {
  if (!confirm(`Delete key "${key}"?`)) return;

  loading.value = true;
  try {
    const result = await window.sysapi.database.redis.deleteKey(activeDb.value, key);

    if (result.error) {
      toast.error(`Failed to delete key: ${result.error}`);
    } else {
      toast.success(`Key "${key}" deleted`);
      await refreshKeys();
      await loadRedisInfo();
    }
  } catch (err) {
    console.error('Delete key error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

// Delete selected keys
const deleteSelectedKeys = async () => {
  if (selectedKeys.value.length === 0) return;
  if (!confirm(`Delete ${selectedKeys.value.length} selected keys?`)) return;

  loading.value = true;
  try {
    const result = await window.sysapi.database.redis.deleteKeys(activeDb.value, selectedKeys.value);

    if (result.error) {
      toast.error(`Failed to delete keys: ${result.error}`);
    } else {
      toast.success(`${result.deleted} keys deleted`);
      selectedKeys.value = [];
      await refreshKeys();
      await loadRedisInfo();
    }
  } catch (err) {
    console.error('Delete keys error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

// View key detail
const viewKeyDetail = (keyData) => {
  viewingKey.value = keyData;
  showDetailModal.value = true;
};

// Edit from detail modal
const editFromDetail = () => {
  if (!viewingKey.value) return;
  editingKey.value = viewingKey.value.key;
  newKeyName.value = viewingKey.value.key;
  newKeyValue.value = viewingKey.value.value;
  newKeyTtl.value = viewingKey.value.ttl > 0 ? viewingKey.value.ttl : -1;
  showDetailModal.value = false;
  showAddKeyModal.value = true;
};

// Helpers
const truncateValue = (value, maxLength = 50) => {
  if (!value) return '-';
  const str = String(value);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

// Parse list/set value (newline separated)
const parseListValue = (value) => {
  if (!value) return [];
  return String(value).split('\n').filter(item => item.trim());
};

// Parse zset value (alternating member/score lines from ZRANGE WITHSCORES)
const parseZsetValue = (value) => {
  if (!value) return [];
  const lines = String(value).split('\n').filter(item => item.trim());
  const result = [];
  for (let i = 0; i < lines.length; i += 2) {
    result.push({
      member: lines[i] || '',
      score: lines[i + 1] || '0'
    });
  }
  return result;
};

// Parse hash value (alternating field/value lines from HGETALL)
const parseHashValue = (value) => {
  if (!value) return [];
  const lines = String(value).split('\n').filter(item => item.trim());
  const result = [];
  for (let i = 0; i < lines.length; i += 2) {
    result.push({
      field: lines[i] || '',
      value: lines[i + 1] || ''
    });
  }
  return result;
};

// Copy to clipboard
const copyToClipboard = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch (err) {
    console.error('Copy failed:', err);
    toast.error('Failed to copy');
  }
};

const formatTtl = (ttl) => {
  if (ttl === -1) return 'No expiry';
  if (ttl === -2) return 'Expired';
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
  return `${Math.floor(ttl / 86400)}d`;
};

const getTypeClass = (type) => {
  const classes = {
    string: 'bg-green-600/30 text-green-400',
    list: 'bg-blue-600/30 text-blue-400',
    set: 'bg-purple-600/30 text-purple-400',
    zset: 'bg-orange-600/30 text-orange-400',
    hash: 'bg-yellow-600/30 text-yellow-400',
    stream: 'bg-pink-600/30 text-pink-400',
  };
  return classes[type] || 'bg-gray-600/30 text-gray-400';
};

// Watch activeDb changes
watch(activeDb, () => {
  currentPage.value = 1;
  cursors.value = [0];
});

// Initialize
onMounted(async () => {
  await loadRedisInfo();
  await refreshKeys();
});
</script>
