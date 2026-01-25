<template>
  <div class="flex flex-col h-full bg-background text-gray-300 font-sans text-sm">
    <!-- Header -->
    <div class="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]">
      <div class="flex items-center space-x-3">
        <FileText class="w-5 h-5 text-blue-400" />
        <span class="text-white font-medium">Application Logs</span>
      </div>
      <div class="flex items-center space-x-2">
        <!-- Date Selector -->
        <select 
          v-model="selectedDate" 
          @change="loadLog"
          class="bg-[#333] border border-gray-600 rounded px-3 py-1.5 text-gray-200 text-sm"
        >
          <option v-for="date in availableDates" :key="date" :value="date">{{ date }}</option>
        </select>
        <button 
          @click="refreshLogs"
          class="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
        <button 
          @click="clearLog"
          class="flex items-center space-x-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-white text-xs"
        >
          <Trash2 class="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>
    </div>

    <!-- Log Content with Ace Editor -->
    <div class="flex-1 overflow-hidden relative">
      <!-- Loading overlay -->
      <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
        <RefreshCw class="w-6 h-6 animate-spin mr-2 text-white" />
        <span class="text-white">Loading logs...</span>
      </div>
      <!-- Editor always mounted -->
      <div ref="editorContainer" class="w-full h-full"></div>
    </div>

    <!-- Footer -->
    <div class="p-2 border-t border-gray-700 bg-[#252526] flex items-center justify-between text-xs text-gray-400">
      <div>
        {{ lineCount }} lines
      </div>
      <div v-if="selectedDate">
        Log file: logs/{{ selectedDate }}.log
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { FileText, RefreshCw, Trash2 } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/mode-text';

const toast = useToast();

const logContent = ref('');
const availableDates = ref([]);
const selectedDate = ref('');
const isLoading = ref(false);
const editorContainer = ref(null);
let editor = null;

// Line count
const lineCount = computed(() => {
  if (!logContent.value) return 0;
  return logContent.value.split('\n').filter(line => line.trim()).length;
});

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

// Load available log files from logs folder
const initDates = async () => {
  try {
    const result = await window.sysapi.logs.list();
    if (result.files && result.files.length > 0) {
      availableDates.value = result.files;
      selectedDate.value = result.files[0]; // Most recent
    } else {
      // No logs yet, show today as option
      availableDates.value = [getTodayDate()];
      selectedDate.value = getTodayDate();
    }
  } catch (error) {
    console.error('Failed to list logs:', error);
    availableDates.value = [getTodayDate()];
    selectedDate.value = getTodayDate();
  }
};

// Initialize Ace Editor
const initEditor = () => {
  if (!editorContainer.value) return;
  
  editor = ace.edit(editorContainer.value);
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/text');
  editor.setReadOnly(true);
  editor.setShowPrintMargin(false);
  editor.setOptions({
    fontSize: '12px',
    fontFamily: 'Consolas, Monaco, monospace',
    showGutter: true,
    highlightActiveLine: false,
    wrap: false,
    scrollPastEnd: 0.5
  });
  
  // Custom highlighting for log types
  editor.session.setUseWorker(false);
};

// Update editor content
const updateEditor = () => {
  if (editor) {
    editor.setValue(logContent.value || '// No logs found for this date', -1);
    // Scroll to bottom to see latest logs
    editor.scrollToLine(editor.session.getLength(), true, true, () => {});
  }
};

// Load log file
const loadLog = async () => {
  if (!selectedDate.value) return;
  
  isLoading.value = true;
  try {
    const result = await window.sysapi.logs.read(selectedDate.value);
    if (result.error) {
      logContent.value = '';
    } else {
      logContent.value = result.content || '';
    }
    await nextTick();
    updateEditor();
  } catch (error) {
    console.error('Failed to load log:', error);
    logContent.value = '';
  } finally {
    isLoading.value = false;
  }
};

// Refresh logs
const refreshLogs = async () => {
  await loadLog();
  toast.success('Logs refreshed');
};

// Clear current log
const clearLog = async () => {
  if (!confirm(`Clear log for ${selectedDate.value}?`)) return;
  
  try {
    const result = await window.sysapi.logs.clear(selectedDate.value);
    if (result.error) {
      toast.error(`Failed to clear log: ${result.error}`);
    } else {
      logContent.value = '';
      updateEditor();
      toast.success('Log cleared');
    }
  } catch (error) {
    toast.error(`Error: ${error.message}`);
  }
};

// Watch for loading state to init/update editor
watch(isLoading, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    await nextTick();
    if (!editor) {
      initEditor();
    }
    updateEditor();
  }
});

onMounted(async () => {
  await initDates();
  await loadLog();
  await nextTick();
  initEditor();
  updateEditor();
});

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>
