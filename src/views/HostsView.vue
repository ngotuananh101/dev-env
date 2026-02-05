<template>
  <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
    <!-- Header -->
    <div class="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]">
      <div class="flex items-center space-x-3">
        <Globe class="w-5 h-5 text-green-400" />
        <span class="text-white font-medium">Hosts File Manager</span>
        <span class="text-gray-500 text-xs">C:\Windows\System32\drivers\etc\hosts</span>
      </div>
      <div class="flex items-center space-x-2">
        <button @click="refreshHosts"
          class="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs">
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
        <button @click="saveHosts" :disabled="!hasChanges || isSaving"
          class="flex items-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-xs">
          <Save class="w-3 h-3" />
          <span>{{ isSaving ? 'Saving...' : 'Save' }}</span>
        </button>
        <button @click="openInExplorer"
          class="flex items-center space-x-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-xs">
          <FolderOpen class="w-3 h-3" />
          <span>Open Folder</span>
        </button>
      </div>
    </div>

    <!-- Info Banner -->
    <div
      class="px-4 py-2 bg-yellow-900/30 border-b border-yellow-700/50 text-yellow-300 text-xs flex items-center space-x-2">
      <AlertTriangle class="w-4 h-4" />
      <span>Editing hosts file requires Administrator privileges. Save may fail if app is not running as Admin.</span>
    </div>

    <!-- Editor -->
    <div class="flex-1 overflow-hidden relative">
      <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
        <RefreshCw class="w-6 h-6 animate-spin mr-2 text-white" />
        <span class="text-white">Loading hosts file...</span>
      </div>
      <div ref="editorContainer" class="w-full h-full"></div>
    </div>

    <!-- Footer -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div class="flex items-center space-x-4">
        <span>{{ lineCount }} lines</span>
        <span v-if="hasChanges" class="text-yellow-400">● Unsaved changes</span>
      </div>
      <div>
        Press Ctrl+S to save
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Globe, RefreshCw, Save, FolderOpen, AlertTriangle } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/mode-text';

const toast = useToast();

const hostsContent = ref('');
const originalContent = ref('');
const editorContent = ref(''); // Track editor content for reactivity
const isLoading = ref(false);
const isSaving = ref(false);
const editorContainer = ref(null);
let editor = null;

// Check if content has changed (now reactive)
const hasChanges = computed(() => {
  return editorContent.value !== originalContent.value;
});

// Line count
const lineCount = computed(() => {
  return editorContent.value.split('\n').length;
});

// Initialize Ace Editor
const initEditor = () => {
  if (!editorContainer.value) return;

  editor = ace.edit(editorContainer.value);
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/text');
  editor.setShowPrintMargin(false);
  editor.setOptions({
    fontSize: '13px',
    fontFamily: 'Consolas, Monaco, monospace',
    showGutter: true,
    highlightActiveLine: true,
    wrap: false,
    tabSize: 4,
    useSoftTabs: true
  });

  // Track changes for reactivity
  editor.session.on('change', () => {
    editorContent.value = editor.getValue();
  });

  // Add Ctrl+S shortcut
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
    exec: () => saveHosts()
  });
};

// Load hosts file
const loadHosts = async () => {
  isLoading.value = true;
  try {
    const result = await window.sysapi.hosts.read();
    if (result.error) {
      toast.error(`Failed to read hosts: ${result.error}`);
      hostsContent.value = '';
    } else {
      hostsContent.value = result.content || '';
      originalContent.value = result.content || '';
      editorContent.value = result.content || '';
    }
    await nextTick();
    if (editor) {
      editor.setValue(hostsContent.value, -1);
    }
  } catch (error) {
    console.error('Failed to load hosts:', error);
    toast.error(`Error: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

// Save hosts file
const saveHosts = async () => {
  if (!editor || !hasChanges.value) return;

  const content = editor.getValue();
  isSaving.value = true;

  try {
    const result = await window.sysapi.hosts.write(content);
    if (result.error) {
      toast.error(`Failed to save hosts: ${result.error}`);
    } else {
      originalContent.value = content;
      toast.success('Hosts file saved successfully!');
    }
  } catch (error) {
    console.error('Failed to save hosts:', error);
    toast.error(`Error: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

// Refresh hosts
const refreshHosts = async () => {
  if (hasChanges.value) {
    if (!confirm('You have unsaved changes. Reload anyway?')) {
      return;
    }
  }
  await loadHosts();
  toast.success('Hosts file reloaded');
};

// Open hosts folder in Explorer
const openInExplorer = async () => {
  try {
    await window.sysapi.files.openFile('C:\\Windows\\System32\\drivers\\etc');
  } catch (error) {
    toast.error(`Failed to open folder: ${error.message}`);
  }
};

onMounted(async () => {
  await nextTick();
  initEditor();
  await loadHosts();
});

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>
