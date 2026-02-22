<template>
    <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
        <!-- 1. Breadcrumb Bar -->
        <div class="flex items-center space-x-2 p-2 border-b border-gray-700 bg-[#252526]">
            <Button variant="ghost" size="icon-sm" @click="goHome" title="Go Home">
                <Home class="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" @click="goUp" title="Go Up">
                <ArrowUp class="w-4 h-4" />
            </Button>
            <select v-model="selectedDrive" @change="onDriveChange"
                class="bg-[#333] border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
                <option v-for="drive in drives" :key="drive" :value="drive">{{ drive }}</option>
            </select>
            <div class="flex items-center space-x-1 overflow-x-auto whitespace-nowrap mask-linear px-2">
                <span class="text-white font-medium select-text">{{ filesStore.currentPath }}</span>
            </div>
            <div class="flex-1"></div>
            <Button variant="ghost" size="icon-sm" @click="refresh">
                <RefreshCw class="w-4 h-4" />
            </Button>
        </div>

        <!-- 2. Toolbar -->
        <div class="flex items-center space-x-2 p-2 border-b border-gray-700 bg-[#252526]">
            <Button variant="secondary" size="sm" @click="openDownloadModal">
                <Download class="w-3 h-3" />
                Remote Download
            </Button>
            <div class="h-6 w-px bg-gray-600 mx-2"></div>
            <Button variant="secondary" size="sm" @click="openNewFolderModal"
                class="bg-[#eab308]/10! text-[#eab308]! border-[#eab308]/30! hover:bg-[#eab308]/20!">
                <FolderPlus class="w-3 h-3" />
                New
            </Button>
            <Button variant="secondary" size="sm" @click="openTerminalModal">
                <Terminal class="w-3 h-3" />
                Terminal
            </Button>
            <!-- Delete Selected Button -->
            <Button v-if="selectedFiles.length > 0" variant="destructive" size="sm"
                class="bg-red-600/20! text-red-400! border-red-600/30! hover:bg-red-600/30!" @click="deleteSelected">
                <Trash2 class="w-3 h-3" />
                Delete ({{ selectedFiles.length }})
            </Button>
        </div>

        <!-- 3. File Table (Virtual Scroller) -->
        <div class="flex-1 overflow-hidden flex flex-col">
            <!-- Header -->
            <div
                class="flex items-center bg-background-secondary text-xs text-gray-400 font-normal border-b border-gray-700 h-[37px] shrink-0 pr-4">
                <div class="w-8 flex justify-center shrink-0">
                    <input type="checkbox" class="rounded bg-gray-700 border-gray-600 cursor-pointer"
                        :checked="isAllSelected" @change="toggleSelectAll">
                </div>
                <div class="flex-1 px-2 shrink-0">File Name</div>
                <div class="w-32 px-2 shrink-0">Protected</div>
                <div class="w-24 px-2 shrink-0">Permission</div>
                <div class="w-24 px-2 text-right shrink-0">Size</div>
                <div class="w-40 px-2 shrink-0">Modified Time</div>
                <div class="w-24 px-2 text-center shrink-0">Operation</div>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-hidden relative">
                <div v-if="filesStore.loading" class="absolute inset-0 flex items-center justify-center text-gray-500">
                    Loading...
                </div>
                <RecycleScroller v-else class="h-full" :items="filesStore.files" :item-size="50" key-field="name"
                    v-slot="{ item: file }">
                    <div class="flex items-center hover:bg-[#2a2d3e] group cursor-pointer transition-colors h-12.5 border-b border-gray-800/50 text-xs"
                        @dblclick="openItem(file)" :class="{ 'bg-[#2a2d3e]': isSelected(file) }">
                        <!-- Checkbox -->
                        <div class="w-8 flex justify-center shrink-0">
                            <input type="checkbox" class="rounded bg-gray-700 border-gray-600 cursor-pointer"
                                :checked="isSelected(file)" @change="toggleSelect(file)">
                        </div>

                        <!-- File Name -->
                        <div class="flex-1 px-2 flex items-center space-x-2 overflow-hidden shrink-0 text-sm">
                            <component :is="getIconComponent(file)" :class="getColor(file)" class="w-4 h-4 shrink-0" />
                            <span :class="['truncate', file.isDir ? 'text-white font-medium' : 'text-gray-300']"
                                :title="file.name">
                                {{ file.name }}
                            </span>
                        </div>

                        <!-- Protected -->
                        <div class="w-32 px-2 text-gray-500 flex items-center space-x-1 shrink-0">
                            <span>Unprotected</span>
                            <Unlock class="w-3 h-3 opacity-50" />
                        </div>

                        <!-- Permission -->
                        <div class="w-24 px-2 text-gray-400 font-mono text-xs shrink-0 truncate">
                            {{ file.perms }}
                        </div>

                        <!-- Size -->
                        <div class="w-24 px-2 text-right text-gray-400 font-mono text-xs shrink-0 truncate">
                            {{ formatBytes(file.size) }}
                        </div>

                        <!-- Modified Time -->
                        <div class="w-40 px-2 text-gray-400 text-xs shrink-0 truncate">
                            {{ formatDate(file.mtime) }}
                        </div>

                        <!-- Operation -->
                        <div class="w-24 px-2 flex justify-center shrink-0">
                            <div class="flex items-center justify-center">
                                <button class="text-blue-400 hover:text-blue-300 mx-1" title="Edit"
                                    @click.stop="openRenameModal(file)">
                                    <Edit2 class="w-3 h-3" />
                                </button>
                                <button class="text-red-400 hover:text-red-300 mx-1" title="Delete"
                                    @click.stop="deleteFile(file)">
                                    <Trash2 class="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </RecycleScroller>
            </div>
        </div>

        <!-- 4. Footer -->
        <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
            <div>
                Total {{filesStore.files.filter(f => f.isDir).length}} directories, {{filesStore.files.filter(f =>
                    !f.isDir).length}} files
            </div>
            <div class="flex items-center space-x-2">
                <button class="p-1 hover:bg-gray-700 rounded">
                    <ChevronLeft class="w-3 h-3" />
                </button>
                <span class="bg-gray-700 px-2 py-0.5 rounded text-white">1</span>
                <button class="p-1 hover:bg-gray-700 rounded">
                    <ChevronRight class="w-3 h-3" />
                </button>
            </div>
        </div>

        <!-- 5. Download Modal -->
        <Dialog v-model:open="showDownloadModal">
            <DialogContent class="max-w-[500px] bg-[#252526] border-gray-700 text-gray-200">
                <DialogHeader>
                    <DialogTitle>Download File</DialogTitle>
                </DialogHeader>

                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label>URL Address</Label>
                        <Input v-model="downloadUrl" placeholder="http://" />
                    </div>
                    <div class="space-y-2">
                        <Label>Download To</Label>
                        <Input :model-value="filesStore.currentPath" disabled />
                    </div>
                    <div class="space-y-2">
                        <Label>File Name</Label>
                        <Input v-model="downloadFileName" placeholder="Please Input" />
                    </div>
                </div>

                <div v-if="downloading" class="mt-3">
                    <div class="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Downloading...</span>
                        <span>{{ downloadProgress }}%</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-1.5">
                        <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            :style="{ width: downloadProgress + '%' }"></div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" size="sm" @click="closeDownloadModal">Cancel</Button>
                    <Button variant="success" size="sm" @click="startDownload" :disabled="downloading">
                        {{ downloading ? 'Downloading...' : 'Confirm' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- 6. New Folder Modal -->
        <Dialog v-model:open="showNewFolderModal">
            <DialogContent class="max-w-[400px] bg-[#252526] border-gray-700 text-gray-200">
                <DialogHeader>
                    <DialogTitle>New Folder</DialogTitle>
                </DialogHeader>

                <div class="space-y-2">
                    <Label>Folder Name</Label>
                    <Input v-model="newFolderName" placeholder="Enter folder name" @keyup.enter="createFolder"
                        autofocus />
                </div>

                <DialogFooter>
                    <Button variant="secondary" size="sm" @click="showNewFolderModal = false">Cancel</Button>
                    <Button size="sm" @click="createFolder">Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- 7. Rename Modal -->
        <Dialog v-model:open="showRenameModal">
            <DialogContent class="max-w-[450px] bg-[#252526] border-gray-700 text-gray-200">
                <DialogHeader>
                    <DialogTitle>Rename Item</DialogTitle>
                </DialogHeader>

                <div class="space-y-2">
                    <Label>New Name</Label>
                    <Input v-model="renameNewName" @keyup.enter="performRename" autofocus />
                </div>

                <DialogFooter>
                    <Button variant="secondary" size="sm" @click="showRenameModal = false">Cancel</Button>
                    <Button size="sm" @click="performRename">Rename</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- 8. Terminal Modal -->
        <Dialog v-model:open="showTerminalModal">
            <DialogContent class="max-w-[900px] bg-[#252526] border-gray-700 text-gray-200 p-0"
                @interactOutside="(e) => e.preventDefault()">
                <DialogHeader class="p-3 border-b border-gray-700">
                    <DialogTitle>Terminal - <span class="text-xs">{{ filesStore.currentPath }}</span></DialogTitle>
                </DialogHeader>
                <div ref="terminalModalContainer" class="bg-black overflow-hidden h-[400px] p-2"></div>
            </DialogContent>
        </Dialog>
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
import { RecycleScroller } from 'vue3-virtual-scroller';
import 'vue3-virtual-scroller/dist/vue3-virtual-scroller.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatBytes, formatDate } from '../utils/helpers';
import 'xterm/css/xterm.css';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';


const filesStore = useFilesStore();

// Drives State
const drives = ref([]);
const selectedDrive = ref('');

const loadDrives = async () => {
    drives.value = await filesStore.getDrives();
    // Set selected drive from current path
    if (filesStore.currentPath) {
        const match = filesStore.currentPath.match(/^([A-Z]:)/i);
        if (match) {
            selectedDrive.value = match[1].toUpperCase();
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

    const confirmMsg = `Are you sure you want to delete ${selectedFiles.value.length} selected items?`;
    if (!confirm(confirmMsg)) return;

    let errorCount = 0;
    for (const file of selectedFiles.value) {
        const result = await filesStore.deletePath(file.path);
        if (result.error) errorCount++;
    }

    selectedFiles.value = [];
    refresh();

    if (errorCount > 0) {
        alert(`${errorCount} errors occurred during deletion.`);
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

    const result = await filesStore.createFolder(newFolderName.value);

    if (result.error) {
        alert("Error creating folder: " + result.error);
    } else {
        showNewFolderModal.value = false;
    }
};

// Delete Logic
const deleteFile = async (file) => {
    if (confirm(`Are you sure you want to delete "${file.name}"? This cannot be undone.`)) {
        const result = await filesStore.deletePath(file.path);
        if (result.error) {
            alert("Error deleting: " + result.error);
        } else {
            refresh();
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

    const result = await filesStore.renamePath(renameTargetFile.value.path, renameNewName.value);

    if (result.error) {
        alert("Error renaming: " + result.error);
    } else {
        showRenameModal.value = false;
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

// Watch showTerminalModal to handle close from Dialog's internal close button
watch(showTerminalModal, (newVal) => {
    if (!newVal) {
        closeTerminalModal();
    }
});

const initModalTerminal = () => {
    if (!terminalModalContainer.value) return;

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
        if (confirm("Confirm cancel download?")) {
            filesStore.cancelDownload();
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
    filesStore.startDownload(downloadUrl.value, downloadFileName.value);
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
        const result = await filesStore.openFile(file.path);
        if (result.error) {
            alert('Unable to open file: ' + result.error);
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

// Lifecycle
onMounted(async () => {
    await filesStore.loadDirectory();
    await loadDrives();
});
</script>
