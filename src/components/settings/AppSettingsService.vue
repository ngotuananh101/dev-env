<template>
  <div class="h-full flex flex-col items-start space-y-4 p-1">
    <!-- Service Status Card -->
    <div class="w-full bg-[#1e1e1e] rounded-lg p-5 border border-gray-800 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-white text-base font-medium">Service Status</h3>
        <div class="flex items-center space-x-2 bg-[#141414] px-3 py-1 rounded-full border border-gray-800">
          <div :class="serviceRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'" class="w-2.5 h-2.5 rounded-full transition-all duration-300"></div>
          <span :class="serviceRunning ? 'text-green-400' : 'text-red-400'" class="text-sm font-medium transition-colors duration-300">
            {{ serviceRunning ? 'Running' : 'Stopped' }}
          </span>
        </div>
      </div>
      
      <div class="flex flex-wrap gap-3">
        <button
          @click="$emit('start')"
          :disabled="serviceRunning || loading"
          class="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium transition-all shadow-lg shadow-green-900/20 active:scale-[0.98]"
        >
          <div class="flex items-center justify-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Start</span>
          </div>
        </button>
        <button
          @click="$emit('stop')"
          :disabled="!serviceRunning || loading"
          class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium transition-all shadow-lg shadow-red-900/20 active:scale-[0.98]"
        >
          <div class="flex items-center justify-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Stop</span>
          </div>
        </button>
        <button
          @click="$emit('restart')"
          :disabled="!serviceRunning || loading"
          class="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white text-sm font-medium transition-all shadow-lg shadow-yellow-900/20 active:scale-[0.98]"
        >
          <div class="flex items-center justify-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            <span>Restart</span>
          </div>
        </button>
      </div>
      <p v-if="loading && loadingText" class="mt-3 text-blue-400 text-xs text-center animate-pulse">{{ loadingText }}</p>
    </div>
    
    <!-- Service Console Logs -->
    <div class="flex-1 flex flex-col min-h-0 w-full bg-[#1e1e1e] rounded-lg border border-gray-800 shadow-sm overflow-hidden">
      <div class="flex items-center justify-between p-3 border-b border-gray-800 bg-[#1a1a1a]">
        <h3 class="text-gray-300 text-xs font-semibold uppercase tracking-wider flex items-center">
          <svg class="w-3 h-3 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Console Output
        </h3>
        <button 
          @click="$emit('clearLogs')" 
          :disabled="logs.length === 0"
          class="px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded border border-gray-700 transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          Clear Output
        </button>
      </div>
      <pre 
        ref="logContainer"
        class="flex-1 overflow-auto p-4 text-xs font-mono bg-[#0d0d0d] text-gray-300 select-text whitespace-pre-wrap scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
      ><template v-if="logs.length === 0"><div class="h-full flex items-center justify-center text-gray-600 italic">No console output provided.</div></template><template v-else><div v-for="(log, idx) in logs" :key="idx" :class="getLogClass(log.type)" class="py-0.5 border-b border-gray-900/50 last:border-0"><span class="text-gray-600 select-none mr-2">[{{ formatTime(log.timestamp) }}]</span><span class="break-words">{{ log.message }}</span></div></template></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  serviceRunning: Boolean,
  loading: Boolean,
  loadingText: {
    type: String,
    default: ''
  },
  logs: {
    type: Array,
    default: () => []
  }
});

defineEmits(['start', 'stop', 'restart', 'clearLogs']);

const logContainer = ref(null);

watch(() => props.logs.length, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
});

const getLogClass = (type) => {
  switch (type) {
    case 'error': return 'text-red-400';
    case 'success': return 'text-green-400';
    case 'warning': return 'text-yellow-400';
    default: return 'text-gray-300';
  }
};

const formatTime = (ts) => {
  if (!ts) return '';
  // If ts is a string, try to parse it, or just return first part
  return ts.split('T')[1]?.split('.')[0] || ts;
};
</script>
