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
                    <div v-for="idx in indexes" :key="idx.index" @click="selectIndex(idx)"
                        class="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors group"
                        :class="selectedIndex?.index === idx.index
                            ? 'bg-yellow-600/20 text-white border-l-2 border-yellow-500'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'">
                        <div class="flex items-center space-x-2 min-w-0">
                            <Layers class="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                            <span class="text-xs truncate">{{ idx.index }}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <span class="text-xs text-gray-500" title="Docs count">{{ idx['docs.count'] || 0 }}</span>
                            <button @click.stop="confirmDeleteIndex(idx.index)"
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
                                <span class="text-yellow-400 font-medium">{{ selectedIndex.index }}</span>
                                <span class="mx-1">·</span>
                                Status: <span
                                    :class="selectedIndex.health === 'green' ? 'text-green-400' : 'text-yellow-400'">{{
                                    selectedIndex.health }}</span>
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <BaseButton @click="openAddDocModal" variant="success" size="sm">
                                <template #icon>
                                    <Plus class="w-3 h-3" />
                                </template>
                                Add Document
                            </BaseButton>
                        </div>
                    </div>

                    <!-- Search Results indicator -->
                    <div v-if="isSearchMode"
                        class="px-3 py-1.5 bg-yellow-600/10 border-b border-yellow-500/30 flex items-center justify-between">
                        <span class="text-xs text-yellow-300">
                            Search results for "<span class="font-medium">{{ searchQuery }}</span>"
                            · {{ searchResults.hits?.total?.value ?? 0 }} hits
                            · {{ searchResults.took }}ms
                        </span>
                        <button @click="clearSearch"
                            class="text-xs text-yellow-400 hover:text-yellow-300">Clear</button>
                    </div>

                    <!-- Table -->
                    <div class="flex-1 overflow-auto">
                        <table class="w-full text-xs">
                            <thead class="bg-[#252526] sticky top-0">
                                <tr class="text-gray-400">
                                    <th
                                        class="px-3 py-2 text-left font-medium whitespace-nowrap w-32 border-r border-gray-700">
                                        _id</th>
                                    <th class="px-3 py-2 text-left font-medium whitespace-nowrap">_source</th>
                                    <th class="px-3 py-2 text-center font-medium w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="loadingDocs && documents.length === 0">
                                    <td colspan="3" class="px-3 py-8 text-center text-gray-500">
                                        <div class="flex flex-col items-center space-y-2">
                                            <RefreshCw class="w-6 h-6 animate-spin" />
                                            <span>Loading documents...</span>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-else-if="documents.length === 0">
                                    <td colspan="3" class="px-3 py-8 text-center text-gray-500">
                                        <div class="flex flex-col items-center space-y-2">
                                            <FileText class="w-8 h-8" />
                                            <span>No documents found</span>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-for="(doc, i) in documents" :key="i"
                                    class="border-b border-gray-800 hover:bg-gray-800/50">
                                    <td class="px-3 py-2 text-blue-400 font-mono align-top border-r border-gray-700">
                                        {{ doc._id }}
                                    </td>
                                    <td class="px-3 py-2 text-gray-300 font-mono align-top">
                                        <div class="line-clamp-3 text-xs opacity-90">
                                            {{ JSON.stringify(doc._source) }}
                                        </div>
                                    </td>
                                    <td class="px-3 py-2 text-center align-top">
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
                            Index: <span class="text-yellow-400">{{ selectedIndex.index }}</span>
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
                    <label class="text-gray-400 text-right text-xs">Index Name</label>
                    <BaseInput v-model="newIndexName" placeholder="e.g. logs-2024" />
                </div>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showCreateIndexModal = false">Cancel</BaseButton>
                    <BaseButton variant="success" size="sm" @click="createIndex" :disabled="!newIndexName">
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
            <template #title>Add Document</template>
            <div class="space-y-4">
                <div class="grid grid-cols-[100px_1fr] gap-4 items-center">
                    <label class="text-gray-400 text-right text-xs">Document ID</label>
                    <BaseInput v-model="newDocId" placeholder="Optional (leave empty to auto-generate)" />
                </div>
                <div class="space-y-1">
                    <div class="text-xs text-gray-500">Document Source (JSON):</div>
                    <textarea v-model="newDocJson" rows="12" placeholder='{"title": "Example", "count": 10}'
                        class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"></textarea>
                    <div v-if="docJsonError" class="text-xs text-red-400">{{ docJsonError }}</div>
                </div>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showAddDocModal = false">Cancel</BaseButton>
                    <BaseButton variant="success" size="sm" @click="addDocument" :disabled="!newDocJson">
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
                    <span class="text-xs text-gray-500 font-mono">{{ viewingDoc?._id }}</span>
                </div>
            </template>
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <button @click="copyToClipboard(JSON.stringify(viewingDoc?._source, null, 2))"
                        class="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1">
                        <Copy class="w-3 h-3" />
                        <span>Copy Source JSON</span>
                    </button>
                </div>
                <pre
                    class="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 overflow-auto max-h-96 font-mono whitespace-pre-wrap">
            {{ JSON.stringify(viewingDoc?._source, null, 2) }}</pre>
            </div>
            <template #footer>
                <div class="flex justify-end space-x-2">
                    <BaseButton variant="secondary" size="sm" @click="showViewDocModal = false">Close</BaseButton>
                </div>
            </template>
        </BaseModal>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Plus, RefreshCw, Search, Trash2, Eye, Layers, FileText, Loader2, Copy } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import BaseButton from './BaseButton.vue';
import BaseModal from './BaseModal.vue';
import BaseInput from './BaseInput.vue';

const toast = useToast();
const api = window.sysapi.database.elasticsearch;

// State
const loading = ref(false);
const loadingDocs = ref(false);
const connected = ref(false);
const indexes = ref([]);
const selectedIndex = ref(null);
const documents = ref([]);
const totalDocuments = ref(0); // Estimated
const currentPage = ref(1);
const pageSize = ref(20);
const searchQuery = ref('');
const isSearchMode = ref(false);
const searchResults = ref({});

// Create Index modal
const showCreateIndexModal = ref(false);
const newIndexName = ref('');

// Add Document modal
const showAddDocModal = ref(false);
const newDocId = ref('');
const newDocJson = ref('');
const docJsonError = ref('');

// View Document modal
const showViewDocModal = ref(false);
const viewingDoc = ref(null);

// Computed
const canGoNext = computed(() => {
    // Elasticsearch doesn't always return exact total, but we can guess
    return documents.value.length === pageSize.value;
});

// Health check
const checkHealth = async () => {
    try {
        const result = await api.health();
        connected.value = !result.error && result.status !== 'red';
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
        // Result is array of objects like { index: 'name', status: 'open', ... }
        // Sort by name
        indexes.value = (result || []).sort((a, b) => a.index.localeCompare(b.index));
        connected.value = true;

        if (selectedIndex.value && !indexes.value.find(i => i.index === selectedIndex.value.index)) {
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

// Load documents (using search match_all)
const loadDocuments = async () => {
    if (!selectedIndex.value) return;
    loadingDocs.value = true;
    try {
        const offset = (currentPage.value - 1) * pageSize.value;
        const result = await api.search(selectedIndex.value.index, null, {
            limit: pageSize.value,
            offset: offset
        });
        if (result.error) {
            toast.error(`Failed to load documents: ${result.error}`);
            return;
        }
        documents.value = result.hits?.hits || [];
        totalDocuments.value = result.hits?.total?.value || 0;
    } catch (err) {
        toast.error(err.message);
    } finally {
        loadingDocs.value = false;
    }
};

// Search (query_string or simple text)
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
        // Construct a simple query string query
        const query = {
            query_string: {
                query: searchQuery.value
            }
        };
        const result = await api.search(selectedIndex.value.index, query, {
            limit: pageSize.value,
            offset: 0
        });
        if (result.error) {
            toast.error(`Search failed: ${result.error}`);
            return;
        }
        searchResults.value = result;
        documents.value = result.hits?.hits || [];
        totalDocuments.value = result.hits?.total?.value || 0;
        currentPage.value = 1;
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
    if (!newIndexName.value) return;
    loading.value = true;
    try {
        const result = await api.createIndex(newIndexName.value);
        if (result.error) {
            toast.error(`Failed to create index: ${result.error}`);
        } else {
            toast.success(`Index "${newIndexName.value}" created`);
            showCreateIndexModal.value = false;
            newIndexName.value = '';
            setTimeout(() => loadIndexes(), 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// Delete index
const confirmDeleteIndex = async (indexName) => {
    if (!confirm(`Delete index "${indexName}" and all its documents?`)) return;
    loading.value = true;
    try {
        const result = await api.deleteIndex(indexName);
        if (result.error) {
            toast.error(`Failed to delete index: ${result.error}`);
        } else {
            toast.success(`Index "${indexName}" deleted`);
            if (selectedIndex.value?.index === indexName) {
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

// Add Document
const openAddDocModal = () => {
    newDocId.value = '';
    newDocJson.value = '';
    docJsonError.value = '';
    showAddDocModal.value = true;
};

const addDocument = async () => {
    if (!selectedIndex.value || !newDocJson.value) return;

    // Validate JSON
    let parsed;
    try {
        parsed = JSON.parse(newDocJson.value);
        docJsonError.value = '';
    } catch (e) {
        docJsonError.value = `Invalid JSON: ${e.message}`;
        return;
    }

    loading.value = true;
    try {
        // Treat as single doc for now. newDocId is optional
        const docId = newDocId.value ? newDocId.value : null;
        const result = await api.addDocument(selectedIndex.value.index, parsed, docId);

        if (result.error) {
            toast.error(`Failed to add document: ${result.error}`);
        } else {
            toast.success(`Document added`);
            showAddDocModal.value = false;
            setTimeout(() => {
                loadDocuments();
                // Index stats might update too
                if (Math.random() > 0.5) loadIndexes();
            }, 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
};

// View Document
const viewDocument = (doc) => {
    viewingDoc.value = doc;
    showViewDocModal.value = true;
};

// Delete Document
const confirmDeleteDoc = async (doc) => {
    if (!selectedIndex.value) return;
    const docId = doc._id;
    if (!docId) {
        toast.error('Cannot determine document ID');
        return;
    }
    if (!confirm(`Delete document "${docId}"?`)) return;

    loading.value = true;
    try {
        const result = await api.deleteDocument(selectedIndex.value.index, docId);
        if (result.error) {
            toast.error(`Failed to delete document: ${result.error}`);
        } else {
            toast.success('Document deleted');
            setTimeout(() => loadDocuments(), 1000);
        }
    } catch (err) {
        toast.error(err.message);
    } finally {
        loading.value = false;
    }
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

// Helper: Refresh
const refreshAll = async () => {
    await checkHealth();
    await loadIndexes();
    if (selectedIndex.value) {
        await loadDocuments();
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

// Initialize
onMounted(async () => {
    // Check if Elasticsearch service is running
    try {
        const apps = await window.sysapi.db.query("SELECT exec_path FROM installed_apps WHERE app_id = 'elasticsearch'");
        if (apps && apps.length > 0) {
            const status = await window.sysapi.apps.getServiceStatus('elasticsearch', apps[0].exec_path);
            if (!status?.running) {
                connected.value = false;
                return; // Don't try to load if service isn't likely running
            }
        }
    } catch (e) {
        console.error('Service check failed:', e);
    }

    await checkHealth();
    if (connected.value) {
        await loadIndexes();
    }
});
</script>
