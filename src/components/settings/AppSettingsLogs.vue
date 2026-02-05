<template>
  <div class="h-full flex flex-col bg-[#1e1e1e] rounded-lg border border-gray-800 overflow-hidden shadow-sm">
    <div class="flex items-center justify-between p-3 border-b border-gray-800 bg-[#1a1a1a]">
      <div class="flex items-center space-x-3 flex-1">
        <select v-model="selectedLogFile" @change="loadLogContent"
          class="bg-[#242424] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all min-w-[200px]">
          <option value="" disabled>Select log file...</option>
          <option v-for="file in files" :key="file.name" :value="file.name">
            {{ file.name }}
          </option>
        </select>
        <span v-if="logSize"
          class="px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] rounded border border-gray-700 font-mono">{{
            formatLogSize(logSize) }}</span>
      </div>

      <div class="flex items-center space-x-2">
        <button @click="loadLogContent" :disabled="loading || !selectedLogFile"
          class="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50 transition-colors border border-gray-700"
          title="Refresh">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
            </path>
          </svg>
        </button>
        <button @click="clearLog" :disabled="loading || !selectedLogFile"
          class="flex items-center px-3 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-200 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded text-xs border border-red-900/30 hover:border-red-500/50 transition-all">
          <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
            </path>
          </svg>
          Clear
        </button>
      </div>
    </div>

    <div v-if="loading && !content" class="flex-1 flex items-center justify-center text-gray-500 bg-[#1a1a1a]">
      <div class="flex flex-col items-center">
        <svg class="w-8 h-8 animate-spin text-blue-500 mb-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
          </path>
        </svg>
        <span>Loading logs...</span>
      </div>
    </div>
    <div v-else-if="files.length === 0" class="flex-1 flex items-center justify-center text-gray-500 bg-[#1a1a1a]">
      <div class="text-center">
        <svg class="w-10 h-10 mx-auto mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
          </path>
        </svg>
        No log files found.
      </div>
    </div>
    <div v-else-if="!selectedLogFile" class="flex-1 flex items-center justify-center text-gray-500 bg-[#1a1a1a]">
      Select a log file to view its content.
    </div>
    <pre v-else ref="logContainer"
      class="flex-1 overflow-auto p-4 text-xs font-mono bg-[#0d0d0d] text-gray-300 select-text whitespace-pre-wrap scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent border-t border-gray-800">{{ content || 'Log file is empty.' }}</pre>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { useToast } from 'vue-toastification';

const toast = useToast();
const props = defineProps({
  app: Object
});

const files = ref([]);
const selectedLogFile = ref('');
const content = ref('');
const logSize = ref(0);
const loading = ref(false);
const logContainer = ref(null);

const loadLogFiles = async () => {
  if (!props.app?.id) return;

  loading.value = true;
  files.value = [];
  selectedLogFile.value = '';
  content.value = '';
  logSize.value = 0;

  try {
    const result = await window.sysapi.apps.getAppLogs(props.app.id);
    if (result.error) {
      toast.error(`Failed to load logs: ${result.error}`);
    } else {
      files.value = result.files || [];
      if (files.value.length > 0) {
        selectedLogFile.value = files.value[0].name;
        await loadLogContent();
      }
    }
  } catch (err) {
    console.error('Load log files error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const loadLogContent = async () => {
  if (!props.app?.id || !selectedLogFile.value) return;

  loading.value = true;

  try {
    const result = await window.sysapi.apps.readAppLog(props.app.id, selectedLogFile.value);
    if (result.error) {
      toast.error(`Failed to read log: ${result.error}`);
      content.value = '';
    } else {
      content.value = result.content || '';
      logSize.value = result.size || 0;

      nextTick(() => {
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
      });
    }
  } catch (err) {
    console.error('Read log error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const clearLog = async () => {
  if (!props.app?.id || !selectedLogFile.value) return;
  if (!confirm(`Clear log file "${selectedLogFile.value}"?`)) return;

  loading.value = true;

  try {
    const result = await window.sysapi.apps.clearAppLog(props.app.id, selectedLogFile.value);
    if (result.error) {
      toast.error(`Failed to clear log: ${result.error}`);
    } else {
      toast.success('Log cleared');
      content.value = '';
      logSize.value = 0;
    }
  } catch (err) {
    console.error('Clear log error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const formatLogSize = (bytes) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

onMounted(() => {
  loadLogFiles();
});
</script>
