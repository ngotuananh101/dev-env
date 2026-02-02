<template>
  <div class="flex flex-col h-full bg-[#1e1e1e] text-gray-300 font-sans text-sm">
    <!-- 1. Breadcrumb Bar -->
    <div class="flex items-center space-x-2 p-2 border-b border-gray-700 bg-[#252526]">
        <button class="p-1 hover:bg-gray-700 rounded" @click="goHome" title="Go Home">
             <Home class="w-4 h-4" />
        </button>
        <button class="p-1 hover:bg-gray-700 rounded" @click="goUp" title="Go Up">
             <ArrowUp class="w-4 h-4" />
        </button>
        <select v-model="selectedDrive" @change="onDriveChange" class="bg-[#333] border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
            <option v-for="drive in drives" :key="drive" :value="drive">{{ drive }}</option>
        </select>
        <div class="flex items-center space-x-1 overflow-x-auto whitespace-nowrap mask-linear px-2">
             <span class="text-white font-medium select-text">{{ filesStore.currentPath }}</span>
        </div>
        <div class="flex-1"></div>
        <button class="p-1 hover:bg-gray-700 rounded" @click="refresh">
            <RefreshCw class="w-4 h-4" />
        </button>
    </div>

    <!-- 2. Toolbar -->
    <div class="flex items-center space-x-2 p-2 border-b border-gray-700 bg-[#252526]">
        <button @click="openDownloadModal" class="flex items-center space-x-1 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded border border-gray-600 text-xs">
            <Download class="w-3 h-3" />
            <span>Remote Download</span>
        </button>
        <div class="h-6 w-px bg-gray-600 mx-2"></div>
        <button class="flex items-center space-x-1 px-3 py-1.5 bg-[#eab308]/10 text-[#eab308] hover:bg-[#eab308]/20 rounded border border-[#eab308]/30 text-xs" @click="openNewFolderModal">
            <FolderPlus class="w-3 h-3" />
            <span>New</span>
        </button>
         <button class="flex items-center space-x-1 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded border border-gray-600 text-xs" @click="openTerminalModal">
            <Terminal class="w-3 h-3" />
            <span>Terminal</span>
        </button>
        <!-- Delete Selected Button -->
        <button v-if="selectedFiles.length > 0" @click="deleteSelected" class="flex items-center space-x-1 px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded border border-red-600/30 text-xs">
            <Trash2 class="w-3 h-3" />
            <span>Delete ({{ selectedFiles.length }})</span>
        </button>
    </div>

    <!-- 3. File Table -->
    <div class="flex-1 overflow-auto">
        <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-[#2d2d2d] z-10 text-xs text-gray-400 font-normal">
                <tr>
                    <th class="p-2 border-b border-gray-700 w-8">
                        <input type="checkbox" class="rounded bg-gray-700 border-gray-600 cursor-pointer" 
                            :checked="isAllSelected" @change="toggleSelectAll">
                    </th>
                    <th class="p-2 border-b border-gray-700">File Name</th>
                    <th class="p-2 border-b border-gray-700 w-32">Protected</th>
                    <th class="p-2 border-b border-gray-700 w-32">Permission</th>
                    <th class="p-2 border-b border-gray-700 w-24 text-right">Size</th>
                    <th class="p-2 border-b border-gray-700 w-40">Modified Time</th>
                    <th class="p-2 border-b border-gray-700 w-24 text-center">Operation</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
                <tr v-if="filesStore.loading">
                    <td colspan="7" class="p-8 text-center text-gray-500">Loading...</td>
                </tr>
                <tr v-else v-for="file in filesStore.files" :key="file.name" 
                    class="hover:bg-[#2a2d3e] group cursor-pointer transition-colors min-h-[50px] h-[50px]"
                    @dblclick="openItem(file)">
                    
                    <td class="px-2 py-1.5 text-center align-middle">
                        <input type="checkbox" class="rounded bg-gray-700 border-gray-600 cursor-pointer" 
                            :checked="isSelected(file)" @change="toggleSelect(file)">
                    </td>
                    <td class="px-2 py-1.5 align-middle">
                        <div class="flex items-center space-x-2">
                            <component :is="getIconComponent(file)" :class="getColor(file)" class="w-4 h-4" />
                            <span :class="file.isDir ? 'text-white font-medium' : 'text-gray-300'">{{ file.name }}</span>
                        </div>
                    </td>
                    <td class="px-2 py-1.5 text-gray-500 align-middle">
                        <div class="flex items-center space-x-1">
                             <span>Unprotected</span>
                             <Unlock class="w-3 h-3 opacity-50" />
                        </div>
                    </td>
                    <td class="px-2 py-1.5 text-gray-400 font-mono text-xs align-middle">{{ file.perms }}</td>
                    <td class="px-2 py-1.5 text-right text-gray-400 font-mono text-xs align-middle">{{ formatSize(file.size) }}</td>
                    <td class="px-2 py-1.5 text-gray-400 text-xs align-middle">{{ formatDate(file.mtime) }}</td>
                    <td class="px-2 py-1.5 text-center align-middle">
                        <div class="flex items-center justify-center">
                            <button class="text-blue-400 hover:text-blue-300 mx-1" title="Edit" @click.stop="openRenameModal(file)">
                                <Edit2 class="w-3 h-3" />
                            </button>
                            <button class="text-red-400 hover:text-red-300 mx-1" title="Delete" @click.stop="deleteFile(file)">
                                <Trash2 class="w-3 h-3" />
                            </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <!-- 4. Footer -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
        <div>
            Total {{ filesStore.files.filter(f => f.isDir).length }} directories, {{ filesStore.files.filter(f => !f.isDir).length }} files
        </div>
        <div class="flex items-center space-x-2">
            <button class="p-1 hover:bg-gray-700 rounded"><ChevronLeft class="w-3 h-3" /></button>
            <span class="bg-gray-700 px-2 py-0.5 rounded text-white">1</span>
            <button class="p-1 hover:bg-gray-700 rounded"><ChevronRight class="w-3 h-3" /></button>
        </div>
    </div>

    <!-- 5. Download Modal -->
    <BaseModal :show="showDownloadModal" @close="closeDownloadModal" max-width="500px" :close-on-overlay="!downloading">
        <template #title>Download File</template>
        
        <div class="space-y-4">
            <div class="flex items-center space-x-4">
                <label class="w-24 text-right text-gray-400">URL Address</label>
                <input v-model="downloadUrl" type="text" placeholder="http://" class="flex-1 bg-[#1e1e1e] border border-gray-600 rounded px-3 py-1.5 focus:border-blue-500 focus:outline-none text-gray-200">
            </div>
            <div class="flex items-center space-x-4">
                <label class="w-24 text-right text-gray-400">Download To</label>
                <input :value="filesStore.currentPath" type="text" disabled class="flex-1 bg-[#1e1e1e] border border-gray-600 rounded px-3 py-1.5 text-gray-500 cursor-not-allowed">
            </div>
            <div class="flex items-center space-x-4">
                <label class="w-24 text-right text-gray-400">File Name</label>
                <input v-model="downloadFileName" type="text" placeholder="Please Input" class="flex-1 bg-[#1e1e1e] border border-gray-600 rounded px-3 py-1.5 focus:border-blue-500 focus:outline-none text-gray-200">
            </div>
        </div>
        
        <template #footer>
            <div class="w-full">
                <div v-if="downloading" class="mb-3">
                    <div class="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Downloading...</span>
                        <span>{{ downloadProgress }}%</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-1.5">
                        <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300" :style="{ width: downloadProgress + '%' }"></div>
                    </div>
                </div>
                <div class="flex justify-end space-x-2">
                    <button @click="closeDownloadModal" class="px-4 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs">Cancel</button>
                    <button @click="startDownload" class="px-4 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white text-xs" :disabled="downloading">
                        <span v-if="downloading">Downloading...</span>
                        <span v-else>Confirm</span>
                    </button>
                </div>
            </div>
        </template>
    </BaseModal>

    <!-- 6. New Folder Modal -->
    <BaseModal :show="showNewFolderModal" @close="showNewFolderModal = false">
        <template #title>New Folder</template>
        
        <div class="space-y-2">
            <label class="block text-gray-400 text-xs">Folder Name</label>
            <input v-model="newFolderName" @keyup.enter="createFolder" type="text" placeholder="Enter folder name" class="w-full bg-[#1e1e1e] border border-gray-600 rounded px-3 py-1.5 focus:border-blue-500 focus:outline-none text-gray-200" autofocus>
        </div>
        
        <template #footer>
            <button @click="showNewFolderModal = false" class="px-4 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs">Cancel</button>
            <button @click="createFolder" class="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs">Create</button>
        </template>
    </BaseModal>

    <!-- 7. Rename Modal -->
    <BaseModal :show="showRenameModal" @close="showRenameModal = false" max-width="450px">
        <template #title>Rename Item</template>
        
        <div class="p-4 w-full">
            <div class="mb-2">
                <label class="block text-gray-400 text-xs mb-1">New Name</label>
                <input 
                    v-model="renameNewName" 
                    @keyup.enter="performRename" 
                    type="text" 
                    class="w-full bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none" 
                    autofocus
                >
            </div>
        </div>
        
        <template #footer>
            <div class="flex justify-end space-x-2 w-full">
                <button @click="showRenameModal = false" class="px-3 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs border border-gray-500">Cancel</button>
                <button @click="performRename" class="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs text-center min-w-[60px]">Rename</button>
            </div>
        </template>
    </BaseModal>

    <!-- 8. Terminal Modal -->
    <BaseModal :show="showTerminalModal" @close="closeTerminalModal" max-width="900px" :close-on-overlay="false" body-class="p-2 pr-0 bg-black">
        <template #title>Terminal - {{ filesStore.currentPath }}</template>
        <div ref="terminalModalContainer" class="bg-black overflow-hidden h-[400px]"></div>
    </BaseModal>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useFilesStore } from '../stores/files';
import { 
    Home, ArrowUp, RefreshCw, Upload, Download, FolderPlus, Terminal, 
    ChevronLeft, ChevronRight, Folder, FileCode, FileJson, 
    FileText, Image as ImageIcon, File, Unlock, Edit2, Trash2, X 
} from 'lucide-vue-next';
import BaseModal from '../components/BaseModal.vue';

const filesStore = useFilesStore();

// Drives State
const drives = ref([]);
const selectedDrive = ref('');

const loadDrives = async () => {
    if (window.sysapi && window.sysapi.files && window.sysapi.files.getDrives) {
        drives.value = await window.sysapi.files.getDrives();
        // Set selected drive from current path
        if (filesStore.currentPath) {
            const match = filesStore.currentPath.match(/^([A-Z]:)/i);
            if (match) {
                selectedDrive.value = match[1].toUpperCase();
            }
        }
    }
};

const onDriveChange = () => {
    if (selectedDrive.value) {
        filesStore.loadDirectory(selectedDrive.value + '\\');
    }
};

// Selection State
const selectedFiles = ref([]);

const isSelected = (file) => {
    return selectedFiles.value.some(f => f.path === file.path);
};

const toggleSelect = (file) => {
    const idx = selectedFiles.value.findIndex(f => f.path === file.path);
    if (idx === -1) {
        selectedFiles.value.push(file);
    } else {
        selectedFiles.value.splice(idx, 1);
    }
};

const isAllSelected = computed(() => {
    return filesStore.files.length > 0 && selectedFiles.value.length === filesStore.files.length;
});

const toggleSelectAll = () => {
    if (isAllSelected.value) {
        selectedFiles.value = [];
    } else {
        selectedFiles.value = [...filesStore.files];
    }
};

const deleteSelected = async () => {
    if (selectedFiles.value.length === 0) return;
    
    const confirmMsg = `Bạn có chắc muốn xóa ${selectedFiles.value.length} mục đã chọn không?`;
    if (!confirm(confirmMsg)) return;
    
    if (window.sysapi && window.sysapi.files && window.sysapi.files.deletePath) {
        let errorCount = 0;
        for (const file of selectedFiles.value) {
            const result = await window.sysapi.files.deletePath(file.path);
            if (result.error) errorCount++;
        }
        
        selectedFiles.value = [];
        refresh();
        
        if (errorCount > 0) {
            alert(`Có ${errorCount} lỗi khi xóa.`);
        }
    }
};

// Download State
const showDownloadModal = ref(false);
const downloadUrl = ref('');
const downloadFileName = ref('');
const downloading = ref(false);
const downloadProgress = ref(0);

// New Folder State
const showNewFolderModal = ref(false);
const newFolderName = ref('');

const openNewFolderModal = () => {
    showNewFolderModal.value = true;
    newFolderName.value = '';
};

const createFolder = async () => {
    if (!newFolderName.value) return;
    
    if (window.sysapi && window.sysapi.files && window.sysapi.files.createDir) {
        const result = await window.sysapi.files.createDir({
            targetPath: filesStore.currentPath,
            name: newFolderName.value
        });
        
        if (result.error) {
            alert("Error creating folder: " + result.error);
        } else {
            showNewFolderModal.value = false;
            refresh();
        }
    }
};

// Delete Logic
const deleteFile = async (file) => {
    if (confirm(`Are you sure you want to delete "${file.name}"? This cannot be undone.`)) {
        if (window.sysapi && window.sysapi.files && window.sysapi.files.deletePath) {
             const result = await window.sysapi.files.deletePath(file.path);
             if (result.error) {
                 alert("Error deleting: " + result.error);
             } else {
                 refresh();
             }
        }
    }
};

// Rename Logic
const showRenameModal = ref(false);
const renameNewName = ref('');
const renameTargetFile = ref(null);

const openRenameModal = (file) => {
    renameTargetFile.value = file;
    renameNewName.value = file.name;
    showRenameModal.value = true;
};

const performRename = async () => {
    if (!renameNewName.value || !renameTargetFile.value) return;
    
    if (window.sysapi && window.sysapi.files && window.sysapi.files.renamePath) {
        const result = await window.sysapi.files.renamePath({
            oldPath: renameTargetFile.value.path,
            newName: renameNewName.value
        });
        
        if (result.error) {
             alert("Error renaming: " + result.error);
        } else {
            showRenameModal.value = false;
            refresh();
        }
    }
};

// Terminal Modal State
const showTerminalModal = ref(false);
const terminalModalContainer = ref(null);
let modalTerm = null;
let modalFitAddon = null;
let modalCleanupTerminalData = null;

const openTerminalModal = async () => {
    showTerminalModal.value = true;
    // Wait for next tick so the container is mounted
    await new Promise(r => setTimeout(r, 100));
    initModalTerminal();
};

const closeTerminalModal = () => {
    if (modalTerm) {
        modalTerm.dispose();
        modalTerm = null;
    }
    if (modalCleanupTerminalData) {
        modalCleanupTerminalData();
        modalCleanupTerminalData = null;
    }
    showTerminalModal.value = false;
};

const initModalTerminal = () => {
    if (!terminalModalContainer.value) return;
    
    const { Terminal: XTerminal } = require('xterm');
    const { FitAddon } = require('xterm-addon-fit');
    
    modalTerm = new XTerminal({
        theme: {
            background: '#000000',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4'
        },
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        fontSize: 14,
        cursorBlink: true
    });
    
    modalFitAddon = new FitAddon();
    modalTerm.loadAddon(modalFitAddon);
    modalTerm.open(terminalModalContainer.value);
    
    // ResizeObserver for fit
    const resizeObserver = new ResizeObserver(() => {
        if (modalFitAddon && modalTerm) {
            modalFitAddon.fit();
            if (window.sysapi) window.sysapi.resizeTerminal({ cols: modalTerm.cols, rows: modalTerm.rows });
        }
    });
    resizeObserver.observe(terminalModalContainer.value);
    
    // Init Backend with current path as cwd
    if (window.sysapi) {
        window.sysapi.initTerminal({ cwd: filesStore.currentPath });
        
        modalTerm.onData(data => window.sysapi.writeTerminal(data));
        modalCleanupTerminalData = window.sysapi.onTerminalData(data => modalTerm.write(data));
    }
    
    // Initial Fit & Focus
    setTimeout(() => {
        if (modalFitAddon) modalFitAddon.fit();
        if (modalTerm) modalTerm.focus();
    }, 100);
};

// Auto-extract filename from URL
watch(downloadUrl, (newUrl) => {
    if (!newUrl) return;
    try {
        const urlObj = new URL(newUrl);
        const pathname = urlObj.pathname;
        const name = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (name) {
            downloadFileName.value = name;
        }
    } catch (e) {
        // Invalid URL, ignore
    }
});

// Open Modal
const openDownloadModal = () => {
    showDownloadModal.value = true;
    downloadUrl.value = '';
    downloadFileName.value = '';
    downloading.value = false;
    downloadProgress.value = 0;
};

const closeDownloadModal = () => {
    if (downloading.value) {
        if(confirm("Confirm cancel download?")) {
            if (window.sysapi && window.sysapi.files && window.sysapi.files.cancelDownload) {
                window.sysapi.files.cancelDownload();
            }
            downloading.value = false;
            showDownloadModal.value = false;
        }
    } else {
        showDownloadModal.value = false;
    }
};

// Download Action
const startDownload = () => {
    if (!downloadUrl.value || !downloadFileName.value) {
        alert("Please enter URL and File Name");
        return;
    }

    downloading.value = true;
    downloadProgress.value = 0;

    // Trigger download
    if (window.sysapi && window.sysapi.files) {
         window.sysapi.files.download({
            url: downloadUrl.value,
            targetPath: filesStore.currentPath,
            fileName: downloadFileName.value
        });
    }
};

onMounted(() => {
    filesStore.loadDirectory();

    if (window.sysapi && window.sysapi.files) {
         window.sysapi.files.removeAllListeners();

        window.sysapi.files.onDownloadProgress((progress) => {
            downloadProgress.value = progress;
        });

        window.sysapi.files.onDownloadComplete((path) => {
            downloading.value = false;
            showDownloadModal.value = false;
            // alert(`Download Complete: ${path}`);
            refresh(); 
        });

        window.sysapi.files.onDownloadError((err) => {
            downloading.value = false;
            alert(`Download Error: ${err}`);
        });
    }
});

onUnmounted(() => {
    if (window.sysapi && window.sysapi.files) {
        window.sysapi.files.removeAllListeners();
    }
});

const refresh = () => {
    filesStore.loadDirectory(filesStore.currentPath);
};

const goHome = async () => {
    await filesStore.loadDirectory(); // No path = home dir
    await loadDrives();
};

const goUp = () => {
    filesStore.navigateUp();
};

const openItem = async (file) => {
    if (file.isDir) {
        selectedFiles.value = []; // Clear selection when navigating
        filesStore.loadDirectory(file.path);
    } else {
        // Open file with system default app
        if (window.sysapi && window.sysapi.files && window.sysapi.files.openFile) {
            const result = await window.sysapi.files.openFile(file.path);
            if (result.error) {
                alert('Không thể mở file: ' + result.error);
            }
        }
    }
};

// Utilities
const getIconComponent = (file) => {
    if (file.isDir) return Folder;
    if (file.name.endsWith('.js') || file.name.endsWith('.vue')) return FileCode;
    if (file.name.endsWith('.json')) return FileJson;
    if (file.name.endsWith('.md') || file.name.endsWith('.txt')) return FileText;
    if (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) return ImageIcon;
    return File;
};

const getColor = (file) => {
    if (file.isDir) return 'text-yellow-400 fill-yellow-400/20';
    return 'text-blue-400';
};

const formatSize = (bytes) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
};

// Lifecycle
onMounted(async () => {
    await filesStore.loadDirectory();
    await loadDrives();
});
</script>

