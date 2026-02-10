<template>
    <div class="h-full flex flex-col">
        <!-- Master Key Section -->
        <div class="mb-6">
            <h4 class="text-sm font-medium text-white mb-3">Master Key</h4>
            <div class="flex items-center space-x-2 bg-gray-800 rounded-lg p-3">
                <code class="flex-1 text-xs font-mono text-gray-300 select-all">
          {{ showMasterKey ? masterKey : '••••••••••••••••••••••••••••••••••••' }}
        </code>
                <button @click="showMasterKey = !showMasterKey"
                    class="text-gray-400 hover:text-white transition-colors p-1"
                    :title="showMasterKey ? 'Hide' : 'Show'">
                    <Eye v-if="!showMasterKey" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                </button>
                <button @click="copyToClipboard(masterKey)" class="text-gray-400 hover:text-white transition-colors p-1"
                    title="Copy">
                    <Copy class="w-4 h-4" />
                </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">This key has full access to all Meilisearch endpoints.</p>
        </div>

        <!-- API Keys Section -->
        <div class="flex-1 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-white">API Keys</h4>
                <div class="flex items-center space-x-2">
                    <button @click="loadKeys" class="text-gray-400 hover:text-white transition-colors p-1"
                        title="Refresh">
                        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
                    </button>
                    <button @click="showCreateModal = true"
                        class="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors">
                        <Plus class="w-3 h-3" />
                        <span>Create Key</span>
                    </button>
                </div>
            </div>

            <!-- Keys Table -->
            <div class="flex-1 overflow-auto rounded-lg border border-gray-700">
                <table class="w-full text-xs">
                    <thead class="bg-gray-800 sticky top-0">
                        <tr class="text-gray-400">
                            <th class="px-3 py-2 text-left font-medium">Description</th>
                            <th class="px-3 py-2 text-left font-medium">Key</th>
                            <th class="px-3 py-2 text-left font-medium">Actions</th>
                            <th class="px-3 py-2 text-center font-medium">Expires</th>
                            <th class="px-3 py-2 text-center font-medium w-20"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading && keys.length === 0">
                            <td colspan="5" class="px-3 py-6 text-center text-gray-500">
                                <RefreshCw class="w-5 h-5 animate-spin mx-auto" />
                            </td>
                        </tr>
                        <tr v-else-if="!connected">
                            <td colspan="5" class="px-3 py-6 text-center text-gray-500">
                                Meilisearch is not running
                            </td>
                        </tr>
                        <tr v-else-if="keys.length === 0">
                            <td colspan="5" class="px-3 py-6 text-center text-gray-500">
                                No API keys
                            </td>
                        </tr>
                        <tr v-for="key in keys" :key="key.uid" class="border-b border-gray-800 hover:bg-gray-800/50">
                            <td class="px-3 py-2 text-gray-300">{{ key.description || key.name || '-' }}</td>
                            <td class="px-3 py-2">
                                <div class="flex items-center space-x-1">
                                    <code
                                        class="text-xs font-mono text-gray-400 truncate max-w-[200px]">{{ key.key }}</code>
                                    <button @click="copyToClipboard(key.key)"
                                        class="text-gray-500 hover:text-white shrink-0">
                                        <Copy class="w-3 h-3" />
                                    </button>
                                </div>
                            </td>
                            <td class="px-3 py-2 text-gray-400">
                                <div class="flex flex-wrap gap-1">
                                    <span v-for="action in (key.actions || []).slice(0, 3)" :key="action"
                                        class="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded text-[10px]">
                                        {{ action }}
                                    </span>
                                    <span v-if="(key.actions || []).length > 3" class="text-gray-500 text-[10px]">
                                        +{{ key.actions.length - 3 }}
                                    </span>
                                </div>
                            </td>
                            <td class="px-3 py-2 text-center text-gray-400">
                                {{ key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never' }}
                            </td>
                            <td class="px-3 py-2 text-center">
                                <button @click="confirmDeleteKey(key)" class="text-red-400 hover:text-red-300"
                                    title="Delete">
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Create Key Modal -->
        <BaseModal :show="showCreateModal" @close="showCreateModal = false" max-width="500px" body-class="p-6">
            <template #title>Create API Key</template>
            <div class="space-y-4">
                <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
                    <label class="text-gray-400 text-right text-xs">Description</label>
                    <BaseInput v-model="newKeyDescription" placeholder="My API Key" />
                </div>
                <div class="grid grid-cols-[100px_1fr] gap-4 items-start">
                    <label class="text-gray-400 text-right text-xs pt-2">Actions</label>
                    <div class="space-y-2">
                        <div class="flex flex-wrap gap-2">
                            <label v-for="action in availableActions" :key="action"
                                class="flex items-center space-x-1 text-xs text-gray-300">
                                <input type="checkbox" :value="action" v-model="newKeyActions"
                                    class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 w-3 h-3" />
                                <span>{{ action }}</span>
                            </label>
                        </div>
                        <button @click="newKeyActions = [...availableActions]"
                            class="text-xs text-blue-400 hover:text-blue-300">
                            Select All
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
                    <label class="text-gray-400 text-right text-xs">Indexes</label>
                    <BaseInput v-model="newKeyIndexes" placeholder='["*"] or ["movies","books"]' />
                </div>
                <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
                    <label class="text-gray-400 text-right text-xs">Expires At</label>
                    <BaseInput v-model="newKeyExpiresAt" type="datetime-local" />
                </div>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showCreateModal = false">Cancel</BaseButton>
                    <BaseButton variant="success" size="sm" @click="createKey"
                        :disabled="loading || newKeyActions.length === 0">
                        Create
                    </BaseButton>
                </div>
            </template>
        </BaseModal>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Plus, RefreshCw, Trash2, Eye, EyeOff, Copy } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import BaseModal from '../BaseModal.vue';
import BaseButton from '../BaseButton.vue';
import BaseInput from '../BaseInput.vue';

const toast = useToast();
const api = window.sysapi.database.meilisearch;

const props = defineProps({
    app: Object
});

// State
const loading = ref(false);
const connected = ref(false);
const masterKey = ref('');
const showMasterKey = ref(false);
const keys = ref([]);

// Create modal
const showCreateModal = ref(false);
const newKeyDescription = ref('');
const newKeyActions = ref([]);
const newKeyIndexes = ref('["*"]');
const newKeyExpiresAt = ref('');

const availableActions = [
    'search', 'documents.add', 'documents.get', 'documents.delete',
    'indexes.create', 'indexes.get', 'indexes.update', 'indexes.delete',
    'indexes.swap', 'tasks.get', 'tasks.cancel', 'tasks.delete',
    'settings.get', 'settings.update', 'stats.get',
    'dumps.create', 'snapshots.create', 'version', 'keys.get', 'keys.create', 'keys.update', 'keys.delete'
];

// Load master key from DB
const loadMasterKey = async () => {
    try {
        const result = await window.sysapi.db.query(
            "SELECT extra_info FROM installed_apps WHERE app_id = 'meilisearch'"
        );
        if (result && result.length > 0 && result[0].extra_info) {
            const info = JSON.parse(result[0].extra_info);
            masterKey.value = info.master_key || '';
        }
    } catch (err) {
        console.error('Failed to load master key:', err);
    }
};

// Load API keys
const loadKeys = async () => {
    loading.value = true;
    try {
        const result = await api.getKeys();
        if (result.error) {
            connected.value = false;
            return;
        }
        connected.value = true;
        keys.value = result.results || [];
    } catch (err) {
        connected.value = false;
    } finally {
        loading.value = false;
    }
};

// Create key
const createKey = async () => {
    loading.value = true;
    try {
        let indexes;
        try {
            indexes = JSON.parse(newKeyIndexes.value);
        } catch {
            indexes = ['*'];
        }

        const keyData = {
            description: newKeyDescription.value,
            actions: newKeyActions.value,
            indexes: indexes,
            expiresAt: newKeyExpiresAt.value ? new Date(newKeyExpiresAt.value).toISOString() : null
        };

        const result = await api.createKey(keyData);
        if (result.error) {
            toast.error(`Failed to create key: ${result.error}`);
        } else {
            toast.success('API key created');
            showCreateModal.value = false;
            newKeyDescription.value = '';
            newKeyActions.value = [];
            newKeyExpiresAt.value = '';
            await loadKeys();
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Delete key
const confirmDeleteKey = async (key) => {
    if (!confirm(`Delete API key "${key.description || key.uid}"?`)) return;
    loading.value = true;
    try {
        const result = await api.deleteKey(key.uid);
        if (result.error) {
            toast.error(`Failed to delete key: ${result.error}`);
        } else {
            toast.success('API key deleted');
            await loadKeys();
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Copy
const copyToClipboard = async (text) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    } catch {
        toast.error('Failed to copy');
    }
};

onMounted(async () => {
    await loadMasterKey();
    await loadKeys();
});
</script>
