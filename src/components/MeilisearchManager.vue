<template>
    <div class="flex flex-col h-full">
        <!-- Toolbar -->
        <div class="flex items-center justify-between p-3 bg-[#252526] border-b border-gray-700">
            <div class="flex items-center space-x-2">
                <BaseButton @click="showCreateIndexModal = true" variant="success" size="sm">
                    <template #icon>
                        <Plus class="w-3 h-3" />
                    </template>
                    New Index
                </BaseButton>

                <BaseButton @click="refreshAll" variant="secondary" size="sm" :disabled="loading">
                    <template #icon>
                        <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
                    </template>
                    Reload
                </BaseButton>

                <!-- Connection Status -->
                <div class="flex items-center space-x-1 h-8 px-3 bg-gray-700 rounded text-xs select-none">
                    <div class="w-2 h-2 rounded-full" :class="connected ? 'bg-green-500' : 'bg-red-500'"></div>
                    <span :class="connected ? 'text-green-400' : 'text-red-400'">
                        {{ connected ? 'Connected' : 'Disconnected' }}
                    </span>
                </div>
            </div>

            <div class="flex items-center space-x-2">
                <div class="relative">
                    <input v-model="searchQuery" @keyup.enter="doSearch" type="text"
                        placeholder="Search in current index..."
                        class="h-8 w-64 px-3 pr-8 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                    <button @click="doSearch"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                        <Search class="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex flex-1 overflow-hidden">
            <!-- Indexes Sidebar -->
            <div class="w-56 bg-background border-r border-gray-700 flex flex-col">
                <div class="px-3 py-2 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                    Indexes ({{ indexes.length }})
                </div>
                <div class="flex-1 overflow-auto">
                    <div v-if="loading && indexes.length === 0" class="flex items-center justify-center py-8">
                        <RefreshCw class="w-5 h-5 text-gray-500 animate-spin" />
                    </div>
                    <div v-else-if="indexes.length === 0" class="text-center py-8 text-gray-500 text-xs">
                        No indexes
                    </div>
                    <div v-for="idx in indexes" :key="idx.uid" @click="selectIndex(idx)"
                        class="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors group"
                        :class="selectedIndex?.uid === idx.uid
                            ? 'bg-purple-600/20 text-white border-l-2 border-purple-500'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'">
                        <div class="flex items-center space-x-2 min-w-0">
                            <Layers class="w-3.5 h-3.5 shrink-0 text-purple-400" />
                            <span class="text-xs truncate">{{ idx.uid }}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <span class="text-xs text-gray-500">{{ idx.numberOfDocuments ?? 0 }}</span>
                            <button @click.stop="confirmDeleteIndex(idx.uid)"
                                class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-0.5">
                                <Trash2 class="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Documents Area -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- No Index Selected -->
                <div v-if="!selectedIndex" class="flex-1 flex items-center justify-center">
                    <div class="text-center">
                        <Layers class="w-12 h-12 mx-auto text-gray-600 mb-3" />
                        <p class="text-gray-500 text-sm">Select an index to view documents</p>
                    </div>
                </div>

                <!-- Documents Table -->
                <template v-else>
                    <!-- Sub-toolbar -->
                    <div
                        class="flex items-center justify-between px-3 py-2 bg-background-darker border-b border-gray-800">
                        <div class="flex items-center space-x-2">
                            <span class="text-xs text-gray-400">
                                <span class="text-purple-400 font-medium">{{ selectedIndex.uid }}</span>
                                <span class="mx-1">·</span>
                                Primary Key: <span class="text-white">{{ selectedIndex.primaryKey || 'auto' }}</span>
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <BaseButton @click="openAddDocModal" variant="success" size="sm">
                                <template #icon>
                                    <Plus class="w-3 h-3" />
                                </template>
                                Add Document
                            </BaseButton>
                            <BaseButton @click="openSettingsModal" variant="secondary" size="sm">
                                <template #icon>
                                    <Settings class="w-3 h-3" />
                                </template>
                                Settings
                            </BaseButton>
                            <BaseButton v-if="documents.length > 0" @click="confirmDeleteAllDocs" variant="danger"
                                size="sm">
                                <template #icon>
                                    <Trash2 class="w-3 h-3" />
                                </template>
                                Delete All
                            </BaseButton>
                        </div>
                    </div>

                    <!-- Search Results indicator -->
                    <div v-if="isSearchMode"
                        class="px-3 py-1.5 bg-purple-600/10 border-b border-purple-500/30 flex items-center justify-between">
                        <span class="text-xs text-purple-300">
                            Search results for "<span class="font-medium">{{ searchQuery }}</span>"
                            · {{ searchResults.estimatedTotalHits ?? searchResults.hits?.length ?? 0 }} hits
                            · {{ searchResults.processingTimeMs }}ms
                        </span>
                        <button @click="clearSearch"
                            class="text-xs text-purple-400 hover:text-purple-300">Clear</button>
                    </div>

                    <!-- Table -->
                    <div class="flex-1 overflow-auto">
                        <table class="w-full text-xs">
                            <thead class="bg-[#252526] sticky top-0">
                                <tr class="text-gray-400">
                                    <th v-for="col in documentColumns" :key="col"
                                        class="px-3 py-2 text-left font-medium whitespace-nowrap">
                                        {{ col }}
                                    </th>
                                    <th class="px-3 py-2 text-center font-medium w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="loadingDocs && documents.length === 0">
                                    <td :colspan="documentColumns.length + 1"
                                        class="px-3 py-8 text-center text-gray-500">
                                        <div class="flex flex-col items-center space-y-2">
                                            <RefreshCw class="w-6 h-6 animate-spin" />
                                            <span>Loading documents...</span>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-else-if="documents.length === 0">
                                    <td :colspan="documentColumns.length + 1"
                                        class="px-3 py-8 text-center text-gray-500">
                                        <div class="flex flex-col items-center space-y-2">
                                            <FileText class="w-8 h-8" />
                                            <span>No documents</span>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-for="(doc, i) in documents" :key="i"
                                    class="border-b border-gray-800 hover:bg-gray-800/50">
                                    <td v-for="col in documentColumns" :key="col"
                                        class="px-3 py-2 text-gray-300 font-mono">
                                        <span class="truncate block max-w-xs" :title="formatCellValue(doc[col])">
                                            {{ truncateValue(formatCellValue(doc[col]), 60) }}
                                        </span>
                                    </td>
                                    <td class="px-3 py-2 text-center">
                                        <div class="flex items-center justify-center space-x-2">
                                            <button @click="viewDocument(doc)" class="text-blue-400 hover:text-blue-300"
                                                title="View">
                                                <Eye class="w-4 h-4" />
                                            </button>
                                            <button @click="confirmDeleteDoc(doc)"
                                                class="text-red-400 hover:text-red-300" title="Delete">
                                                <Trash2 class="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination Footer -->
                    <div
                        class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
                        <span>
                            Index: <span class="text-purple-400">{{ selectedIndex.uid }}</span>
                        </span>
                        <div class="flex items-center space-x-4">
                            <select v-model="pageSize" @change="onPageSizeChange"
                                class="h-7 px-2 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500">
                                <option :value="20">20 / page</option>
                                <option :value="50">50 / page</option>
                                <option :value="100">100 / page</option>
                            </select>

                            <div class="flex items-center space-x-2">
                                <button @click="prevPage" :disabled="currentPage <= 1"
                                    class="px-2 py-1 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    &lt;
                                </button>
                                <span class="px-2">{{ currentPage }}</span>
                                <button @click="nextPage" :disabled="!canGoNext"
                                    class="px-2 py-1 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    &gt;
                                </button>
                            </div>

                            <span>Total {{ totalDocuments }} documents</span>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- Create Index Modal -->
        <BaseModal :show="showCreateIndexModal" @close="showCreateIndexModal = false" max-width="450px"
            body-class="p-6">
            <template #title>Create Index</template>
            <div class="space-y-4">
                <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
                    <label class="text-gray-400 text-right text-xs">Index UID</label>
                    <BaseInput v-model="newIndexUid" placeholder="e.g. movies, products..." />
                </div>
                <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
                    <label class="text-gray-400 text-right text-xs">Primary Key</label>
                    <BaseInput v-model="newIndexPrimaryKey" placeholder="Optional (auto-detected)" />
                </div>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showCreateIndexModal = false">Cancel</BaseButton>
                    <BaseButton variant="success" size="sm" @click="createIndex" :disabled="!newIndexUid">
                        <template #icon>
                            <Loader2 v-if="loading" class="w-3 h-3 animate-spin" />
                        </template>
                        Create
                    </BaseButton>
                </div>
            </template>
        </BaseModal>

        <!-- Add Document Modal -->
        <BaseModal :show="showAddDocModal" @close="showAddDocModal = false" max-width="650px" body-class="p-6">
            <template #title>Add Document(s)</template>
            <div class="space-y-4">
                <div class="text-xs text-gray-500">Enter a JSON object or an array of JSON objects:</div>
                <textarea v-model="newDocJson" rows="12" placeholder='[{"id": 1, "title": "Example"}]'
                    class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
                <div v-if="docJsonError" class="text-xs text-red-400">{{ docJsonError }}</div>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showAddDocModal = false">Cancel</BaseButton>
                    <BaseButton variant="success" size="sm" @click="addDocuments" :disabled="!newDocJson">
                        <template #icon>
                            <Loader2 v-if="loading" class="w-3 h-3 animate-spin" />
                        </template>
                        Add
                    </BaseButton>
                </div>
            </template>
        </BaseModal>

        <!-- View Document Modal -->
        <BaseModal :show="showViewDocModal" @close="showViewDocModal = false" max-width="700px" body-class="p-6">
            <template #title>
                <div class="flex items-center space-x-2">
                    <span>Document Detail</span>
                </div>
            </template>
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <button @click="copyToClipboard(JSON.stringify(viewingDoc, null, 2))"
                        class="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1">
                        <Copy class="w-3 h-3" />
                        <span>Copy JSON</span>
                    </button>
                </div>
                <pre
                    class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 overflow-auto max-h-96 font-mono whitespace-pre-wrap">
            {{ JSON.stringify(viewingDoc, null, 2) }}</pre>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showViewDocModal = false">Close</BaseButton>
                </div>
            </template>
        </BaseModal>

        <!-- Index Settings Modal -->
        <BaseModal :show="showSettingsModal" @close="showSettingsModal = false" max-width="650px" body-class="p-6">
            <template #title>Index Settings — {{ selectedIndex?.uid }}</template>
            <div v-if="loadingSettings" class="flex items-center justify-center py-8">
                <RefreshCw class="w-6 h-6 text-gray-500 animate-spin" />
            </div>
            <div v-else class="space-y-4">
                <div v-for="(value, key) in editableSettings" :key="key">
                    <label class="text-xs text-gray-400 block mb-1">{{ formatSettingKey(key) }}</label>
                    <textarea v-model="editableSettings[key]" rows="2"
                        class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                        :placeholder="'e.g. [&quot;field1&quot;, &quot;field2&quot;]'"></textarea>
                </div>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showSettingsModal = false">Cancel</BaseButton>
                    <BaseButton variant="success" size="sm" @click="saveSettings" :disabled="loadingSettings">
                        <template #icon>
                            <Loader2 v-if="loadingSettings" class="w-3 h-3 animate-spin" />
                        </template>
                        Save
                    </BaseButton>
                </div>
            </template>
        </BaseModal>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Plus, RefreshCw, Search, Trash2, Eye, Layers, FileText, Settings, Loader2, Copy } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import BaseButton from './BaseButton.vue';
import BaseModal from './BaseModal.vue';
import BaseInput from './BaseInput.vue';

const toast = useToast();
const api = window.sysapi.database.meilisearch;

// State
const loading = ref(false);
const loadingDocs = ref(false);
const connected = ref(false);
const indexes = ref([]);
const selectedIndex = ref(null);
const documents = ref([]);
const totalDocuments = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const searchQuery = ref('');
const isSearchMode = ref(false);
const searchResults = ref({});

// Create Index modal
const showCreateIndexModal = ref(false);
const newIndexUid = ref('');
const newIndexPrimaryKey = ref('');

// Add Document modal
const showAddDocModal = ref(false);
const newDocJson = ref('');
const docJsonError = ref('');

// View Document modal
const showViewDocModal = ref(false);
const viewingDoc = ref(null);

// Settings modal
const showSettingsModal = ref(false);
const loadingSettings = ref(false);
const editableSettings = ref({});

// Computed
const canGoNext = computed(() => {
    return (currentPage.value * pageSize.value) < totalDocuments.value;
});

const documentColumns = computed(() => {
    if (documents.value.length === 0) return [];
    // Get all unique keys from first few documents
    const keys = new Set();
    documents.value.slice(0, 10).forEach(doc => {
        Object.keys(doc).forEach(k => keys.add(k));
    });
    return Array.from(keys);
});

// Health check
const checkHealth = async () => {
    try {
        const result = await api.health();
        connected.value = result.status === 'available';
    } catch {
        connected.value = false;
    }
};

// Load indexes
const loadIndexes = async () => {
    loading.value = true;
    try {
        const result = await api.listIndexes();
        if (result.error) {
            toast.error(`Failed to load indexes: ${result.error}`);
            connected.value = false;
            return;
        }
        indexes.value = result.results || [];
        connected.value = true;

        // If selected index is gone, deselect
        if (selectedIndex.value && !indexes.value.find(i => i.uid === selectedIndex.value.uid)) {
            selectedIndex.value = null;
            documents.value = [];
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Select index
const selectIndex = (idx) => {
    selectedIndex.value = idx;
    currentPage.value = 1;
    isSearchMode.value = false;
    searchQuery.value = '';
    loadDocuments();
};

// Load documents
const loadDocuments = async () => {
    if (!selectedIndex.value) return;
    loadingDocs.value = true;
    try {
        const offset = (currentPage.value - 1) * pageSize.value;
        const result = await api.getDocuments(selectedIndex.value.uid, {
            limit: pageSize.value,
            offset: offset
        });
        if (result.error) {
            toast.error(`Failed to load documents: ${result.error}`);
            return;
        }
        documents.value = result.results || [];
        totalDocuments.value = result.total || 0;
    } catch (err) {
        toast.error(err.message);
    } finally {
        loadingDocs.value = false;
    }
};

// Search
const doSearch = async () => {
    if (!selectedIndex.value) {
        toast.warning('Select an index first');
        return;
    }
    if (!searchQuery.value.trim()) {
        clearSearch();
        return;
    }
    loadingDocs.value = true;
    isSearchMode.value = true;
    try {
        const result = await api.search(selectedIndex.value.uid, searchQuery.value, {
            limit: pageSize.value
        });
        if (result.error) {
            toast.error(`Search failed: ${result.error}`);
            return;
        }
        searchResults.value = result;
        documents.value = result.hits || [];
        totalDocuments.value = result.estimatedTotalHits || result.hits?.length || 0;
    } catch (err) {
        toast.error(err.message);
    } finally {
        loadingDocs.value = false;
    }
};

const clearSearch = () => {
    isSearchMode.value = false;
    searchQuery.value = '';
    searchResults.value = {};
    loadDocuments();
};

// Create index
const createIndex = async () => {
    if (!newIndexUid.value) return;
    loading.value = true;
    try {
        const result = await api.createIndex(newIndexUid.value, newIndexPrimaryKey.value || null);
        if (result.error) {
            toast.error(`Failed to create index: ${result.error}`);
        } else {
            toast.success(`Index "${newIndexUid.value}" creation enqueued`);
            showCreateIndexModal.value = false;
            newIndexUid.value = '';
            newIndexPrimaryKey.value = '';
            // Wait a moment for Meilisearch to process
            setTimeout(() => loadIndexes(), 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Delete index
const confirmDeleteIndex = async (uid) => {
    if (!confirm(`Delete index "${uid}" and all its documents?`)) return;
    loading.value = true;
    try {
        const result = await api.deleteIndex(uid);
        if (result.error) {
            toast.error(`Failed to delete index: ${result.error}`);
        } else {
            toast.success(`Index "${uid}" deletion enqueued`);
            if (selectedIndex.value?.uid === uid) {
                selectedIndex.value = null;
                documents.value = [];
            }
            setTimeout(() => loadIndexes(), 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Add documents
const openAddDocModal = () => {
    newDocJson.value = '';
    docJsonError.value = '';
    showAddDocModal.value = true;
};

const addDocuments = async () => {
    if (!selectedIndex.value || !newDocJson.value) return;

    // Validate JSON
    let parsed;
    try {
        parsed = JSON.parse(newDocJson.value);
        if (!Array.isArray(parsed)) parsed = [parsed];
        docJsonError.value = '';
    } catch (e) {
        docJsonError.value = `Invalid JSON: ${e.message}`;
        return;
    }

    loading.value = true;
    try {
        const result = await api.addDocuments(selectedIndex.value.uid, parsed);
        if (result.error) {
            toast.error(`Failed to add documents: ${result.error}`);
        } else {
            toast.success(`${parsed.length} document(s) addition enqueued`);
            showAddDocModal.value = false;
            setTimeout(() => {
                loadDocuments();
                loadIndexes();
            }, 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// View document
const viewDocument = (doc) => {
    viewingDoc.value = doc;
    showViewDocModal.value = true;
};

// Delete document
const confirmDeleteDoc = async (doc) => {
    if (!selectedIndex.value) return;
    const pk = selectedIndex.value.primaryKey || 'id';
    const docId = doc[pk];
    if (!docId && docId !== 0) {
        toast.error('Cannot determine document ID');
        return;
    }
    if (!confirm(`Delete document with ${pk}="${docId}"?`)) return;

    loading.value = true;
    try {
        const result = await api.deleteDocument(selectedIndex.value.uid, docId);
        if (result.error) {
            toast.error(`Failed to delete document: ${result.error}`);
        } else {
            toast.success('Document deletion enqueued');
            setTimeout(() => {
                loadDocuments();
                loadIndexes();
            }, 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Delete all documents
const confirmDeleteAllDocs = async () => {
    if (!selectedIndex.value) return;
    if (!confirm(`Delete ALL documents in index "${selectedIndex.value.uid}"?`)) return;

    loading.value = true;
    try {
        const result = await api.deleteAllDocuments(selectedIndex.value.uid);
        if (result.error) {
            toast.error(`Failed to delete documents: ${result.error}`);
        } else {
            toast.success('All documents deletion enqueued');
            setTimeout(() => {
                loadDocuments();
                loadIndexes();
            }, 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Settings
const openSettingsModal = async () => {
    if (!selectedIndex.value) return;
    showSettingsModal.value = true;
    loadingSettings.value = true;
    try {
        const result = await api.getSettings(selectedIndex.value.uid);
        if (result.error) {
            toast.error(`Failed to load settings: ${result.error}`);
            showSettingsModal.value = false;
            return;
        }
        // Convert arrays to editable strings
        const editable = {};
        const settingKeys = ['searchableAttributes', 'filterableAttributes', 'sortableAttributes', 'displayedAttributes', 'stopWords', 'synonyms'];
        settingKeys.forEach(key => {
            if (result[key] !== undefined) {
                editable[key] = JSON.stringify(result[key], null, 2);
            }
        });
        editableSettings.value = editable;
    } catch (err) {
        toast.error(err.message);
    } finally {
        loadingSettings.value = false;
    }
};

const saveSettings = async () => {
    if (!selectedIndex.value) return;
    loadingSettings.value = true;
    try {
        const settings = {};
        for (const [key, value] of Object.entries(editableSettings.value)) {
            try {
                settings[key] = JSON.parse(value);
            } catch (e) {
                toast.error(`Invalid JSON for ${key}: ${e.message}`);
                loadingSettings.value = false;
                return;
            }
        }
        const result = await api.updateSettings(selectedIndex.value.uid, settings);
        if (result.error) {
            toast.error(`Failed to update settings: ${result.error}`);
        } else {
            toast.success('Settings update enqueued');
            showSettingsModal.value = false;
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loadingSettings.value = false;
    }
};

// Pagination
const prevPage = () => {
    if (currentPage.value > 1) {
        currentPage.value--;
        if (isSearchMode.value) doSearch();
        else loadDocuments();
    }
};

const nextPage = () => {
    if (canGoNext.value) {
        currentPage.value++;
        if (isSearchMode.value) doSearch();
        else loadDocuments();
    }
};

const onPageSizeChange = () => {
    currentPage.value = 1;
    if (isSearchMode.value) doSearch();
    else loadDocuments();
};

// Refresh all
const refreshAll = async () => {
    await checkHealth();
    await loadIndexes();
    if (selectedIndex.value) {
        await loadDocuments();
    }
};

// Helpers
const truncateValue = (value, max = 60) => {
    if (value === null || value === undefined) return '-';
    const str = String(value);
    if (str.length <= max) return str;
    return str.substring(0, max) + '...';
};

const formatCellValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const formatSettingKey = (key) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
};

const copyToClipboard = async (text) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    } catch (err) {
        toast.error('Failed to copy');
    }
};

// Initialize
onMounted(async () => {
    await checkHealth();
    if (connected.value) {
        await loadIndexes();
    }
});
</script>
