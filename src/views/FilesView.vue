<template>
  <div class="flex flex-col h-full bg-background text-foreground text-sm">
    <TooltipProvider>
      <!-- 1. Breadcrumb Bar -->
      <div
        class="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="goHome"
              ><Home class="w-3.5 h-3.5"
            /></Button>
          </TooltipTrigger>
          <TooltipContent>Home</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="goUp"
              ><ArrowUp class="w-3.5 h-3.5"
            /></Button>
          </TooltipTrigger>
          <TooltipContent>Go Up</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" class="h-5 mx-1" />

        <!-- Drive selector -->
        <Select v-model="selectedDrive" @update:model-value="onDriveChange">
          <SelectTrigger class="w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="drive in drives" :key="drive" :value="drive">{{
              drive
            }}</SelectItem>
          </SelectContent>
        </Select>

        <!-- Current path -->
        <div class="flex-1 overflow-x-auto px-2">
          <span
            class="text-xs text-muted-foreground font-mono select-text whitespace-nowrap"
          >
            {{ filesStore.currentPath }}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="refresh">
              <RefreshCw
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin': filesStore.loading }"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      <!-- 2. Toolbar -->
      <div
        class="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-card"
      >
        <Button
          variant="outline"
          class="text-xs"
          @click="showDownloadModal = true"
        >
          <Download class="w-3 h-3" /> Remote Download
        </Button>

        <Button
          variant="outline"
          class="text-xs text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10 hover:text-yellow-300"
          @click="showNewFolderModal = true"
        >
          <FolderPlus class="w-3 h-3" /> New Folder
        </Button>
        <Button
          variant="outline"
          class="text-xs"
          @click="showTerminalModal = true"
        >
          <Terminal class="w-3 h-3" /> Terminal
        </Button>

        <Button
          v-if="selectedFiles.length > 0"
          variant="destructive"
          class="text-xs"
          @click="deleteSelected"
        >
          <Trash2 class="w-3 h-3" /> Delete ({{ selectedFiles.length }})
        </Button>
      </div>

      <!-- 3. File Table -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <!-- Table header (fixed) -->
        <div class="contents">
          <Table>
            <TableHeader class="bg-muted/50">
              <TableRow class="hover:bg-transparent border-b border-border">
                <TableHead class="w-10 py-2 px-3">
                  <Checkbox
                    :model-value="isAllSelected"
                    @update:model-value="toggleSelectAll"
                  />
                </TableHead>
                <TableHead class="py-2 text-xs font-medium"
                  >File Name</TableHead
                >
                <TableHead class="w-28 py-2text-xs font-medium text-right"
                  >Permission</TableHead
                >
                <TableHead class="w-24 py-2 text-xs font-medium text-right"
                  >Size</TableHead
                >
                <TableHead class="w-40 py-2 text-xs font-medium text-right"
                  >Modified</TableHead
                >
                <TableHead class="w-24 py-2 text-xs font-medium text-right"
                  >Actions</TableHead
                >
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        <!-- Virtual rows -->
        <div class="flex-1 overflow-hidden relative">
          <div
            v-if="filesStore.loading"
            class="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
          >
            <RefreshCw class="w-4 h-4 animate-spin mr-2" /> Loading...
          </div>
          <div
            v-else-if="filesStore.files.length === 0"
            class="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
          >
            This folder is empty
          </div>
          <RecycleScroller
            v-else
            class="h-full"
            :items="filesStore.files"
            :item-size="45"
            key-field="name"
            v-slot="{ item: file }"
          >
            <div
              class="flex items-center h-[45px] border-b border-border/50 text-xs transition-colors cursor-pointer"
              :class="isSelected(file) ? 'bg-accent' : 'hover:bg-muted/50'"
              @dblclick="openItem(file)"
            >
              <!-- Checkbox -->
              <div class="w-10 flex justify-center shrink-0 px-3">
                <Checkbox
                  :model-value="isSelected(file)"
                  @update:model-value="toggleSelect(file)"
                  @click.stop
                />
              </div>

              <!-- File Name -->
              <div
                class="flex-1 flex items-center gap-2 overflow-hidden shrink-0"
              >
                <component
                  :is="getIconComponent(file)"
                  :class="getIconColor(file)"
                  class="w-4 h-4 shrink-0"
                />
                <span
                  class="truncate"
                  :class="
                    file.isDir
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  "
                  :title="file.name"
                >
                  {{ file.name }}
                </span>
              </div>

              <!-- Permission -->
              <div class="w-28 shrink-0 text-right">
                <Badge
                  v-if="file.perms"
                  variant="outline"
                  class="text-xs font-mono px-1 py-0"
                >
                  {{ file.perms }}
                </Badge>
              </div>

              <!-- Size -->
              <div
                class="w-24 text-right text-muted-foreground font-mono shrink-0"
              >
                {{ file.isDir ? "—" : formatBytes(file.size) }}
              </div>

              <!-- Modified -->
              <div class="w-40 text-muted-foreground shrink-0 text-right">
                {{ formatDate(file.mtime) }}
              </div>

              <!-- Actions -->
              <div class="w-24 flex justify-end gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6"
                      @click.stop="openRenameModal(file)"
                    >
                      <Edit2 class="w-3 h-3 text-blue-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6"
                      @click.stop="deleteFile(file)"
                    >
                      <Trash2 class="w-3 h-3 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </RecycleScroller>
        </div>
      </div>

      <!-- 4. Footer -->
      <div
        class="px-3 py-1.5 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground"
      >
        <span>
          {{ filesStore.files.filter((f) => f.isDir).length }} folders,
          {{ filesStore.files.filter((f) => !f.isDir).length }} files
          <span v-if="selectedFiles.length > 0" class="ml-2 text-foreground"
            >({{ selectedFiles.length }} selected)</span
          >
        </span>
      </div>

      <!-- Modals -->
      <FileDownloadModal
        v-if="showDownloadModal"
        :current-path="filesStore.currentPath"
        :progress="downloadProgress"
        :downloading="downloading"
        @close="onDownloadClose"
        @start-download="onStartDownload"
      />
      <FileNewFolderModal
        v-if="showNewFolderModal"
        @close="showNewFolderModal = false"
        @create="onCreateFolder"
      />
      <FileRenameModal
        v-if="showRenameModal"
        :file="renameTargetFile"
        @close="showRenameModal = false"
        @rename="onRename"
      />
      <FileTerminalModal
        v-if="showTerminalModal"
        :cwd="filesStore.currentPath"
        @close="showTerminalModal = false"
      />
    </TooltipProvider>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
} from "vue";
import { useFilesStore } from "../stores/files";
import {
  Home,
  ArrowUp,
  RefreshCw,
  Download,
  FolderPlus,
  Terminal,
  Folder,
  FileCode,
  FileJson,
  FileText,
  Image as ImageIcon,
  File,
  Edit2,
  Trash2,
} from "lucide-vue-next";
import { RecycleScroller } from "vue3-virtual-scroller";
import "vue3-virtual-scroller/dist/vue3-virtual-scroller.css";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatDate } from "../utils/helpers";

const FileDownloadModal = defineAsyncComponent(
  () => import("../components/files/FileDownloadModal.vue"),
);
const FileNewFolderModal = defineAsyncComponent(
  () => import("../components/files/FileNewFolderModal.vue"),
);
const FileRenameModal = defineAsyncComponent(
  () => import("../components/files/FileRenameModal.vue"),
);
const FileTerminalModal = defineAsyncComponent(
  () => import("../components/files/FileTerminalModal.vue"),
);

const filesStore = useFilesStore();

// Drive State
const drives = ref([]);
const selectedDrive = ref("");

const loadDrives = async () => {
  drives.value = await filesStore.getDrives();
  if (filesStore.currentPath) {
    const match = filesStore.currentPath.match(/^([A-Z]:)/i);
    if (match) selectedDrive.value = match[1].toUpperCase();
  }
};

const onDriveChange = (val) => {
  if (val) filesStore.loadDirectory(val + "\\");
};

// Selection
const selectedFiles = ref([]);
const isSelected = (file) =>
  selectedFiles.value.some((f) => f.path === file.path);

const toggleSelect = (file) => {
  const idx = selectedFiles.value.findIndex((f) => f.path === file.path);
  if (idx === -1) selectedFiles.value.push(file);
  else selectedFiles.value.splice(idx, 1);
};

const isAllSelected = computed(
  () =>
    filesStore.files.length > 0 &&
    selectedFiles.value.length === filesStore.files.length,
);

const toggleSelectAll = (checked) => {
  selectedFiles.value = checked ? [...filesStore.files] : [];
};

const deleteSelected = async () => {
  if (!selectedFiles.value.length) return;
  if (!confirm(`Delete ${selectedFiles.value.length} selected items?`)) return;
  let errors = 0;
  for (const file of selectedFiles.value) {
    const r = await filesStore.deletePath(file.path);
    if (r.error) errors++;
  }
  selectedFiles.value = [];
  refresh();
  if (errors > 0) alert(`${errors} errors during deletion.`);
};

// Modal state
const showDownloadModal = ref(false);
const showNewFolderModal = ref(false);
const showRenameModal = ref(false);
const showTerminalModal = ref(false);
const renameTargetFile = ref(null);
const downloading = ref(false);
const downloadProgress = ref(0);

const onDownloadClose = ({ cancel } = {}) => {
  if (cancel && downloading.value) {
    if (!confirm("Cancel download?")) return;
    filesStore.cancelDownload();
    downloading.value = false;
  }
  showDownloadModal.value = false;
  downloading.value = false;
  downloadProgress.value = 0;
};

const onStartDownload = ({ url, fileName }) => {
  downloading.value = true;
  downloadProgress.value = 0;
  filesStore.startDownload(url, fileName);
};

const onCreateFolder = async (name) => {
  const r = await filesStore.createFolder(name);
  if (r.error) alert("Error: " + r.error);
  else showNewFolderModal.value = false;
};

const openRenameModal = (file) => {
  renameTargetFile.value = file;
  showRenameModal.value = true;
};

const onRename = async ({ file, newName }) => {
  const r = await filesStore.renamePath(file.path, newName);
  if (r.error) alert("Error: " + r.error);
  else showRenameModal.value = false;
};

const deleteFile = async (file) => {
  if (!confirm(`Delete "${file.name}"?`)) return;
  const r = await filesStore.deletePath(file.path);
  if (r.error) alert("Error: " + r.error);
  else refresh();
};

// Navigation
const refresh = () => filesStore.loadDirectory(filesStore.currentPath);
const goHome = async () => {
  await filesStore.loadDirectory();
  await loadDrives();
};
const goUp = () => filesStore.navigateUp();

const openItem = async (file) => {
  if (file.isDir) {
    selectedFiles.value = [];
    filesStore.loadDirectory(file.path);
  } else {
    const r = await filesStore.openFile(file.path);
    if (r.error) alert("Cannot open: " + r.error);
  }
};

// Icon helpers
const getIconComponent = (file) => {
  if (file.isDir) return Folder;
  const n = file.name;
  if (n.endsWith(".js") || n.endsWith(".vue") || n.endsWith(".ts"))
    return FileCode;
  if (n.endsWith(".json")) return FileJson;
  if (n.endsWith(".md") || n.endsWith(".txt")) return FileText;
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(n)) return ImageIcon;
  return File;
};

const getIconColor = (file) =>
  file.isDir ? "text-yellow-400 fill-yellow-400/20" : "text-blue-400";

// Lifecycle
onMounted(async () => {
  await filesStore.loadDirectory();
  await loadDrives();

  if (window.sysapi?.files) {
    window.sysapi.files.removeAllListeners();
    window.sysapi.files.onDownloadProgress((p) => {
      downloadProgress.value = p;
    });
    window.sysapi.files.onDownloadComplete(() => {
      downloading.value = false;
      showDownloadModal.value = false;
      refresh();
    });
    window.sysapi.files.onDownloadError((err) => {
      downloading.value = false;
      alert("Download error: " + err);
    });
  }
});

onUnmounted(() => {
  if (window.sysapi?.files) window.sysapi.files.removeAllListeners();
});
</script>
