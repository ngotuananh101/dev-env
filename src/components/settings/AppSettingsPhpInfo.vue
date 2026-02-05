<template>
  <div class="h-full flex flex-col bg-[#1e1e1e] rounded-lg border border-gray-800 overflow-hidden shadow-sm">
      <div v-if="loading" class="h-full flex items-center justify-center text-gray-500 bg-[#1e1e1e]">
        <div class="flex flex-col items-center space-y-2">
          <svg class="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-sm">Loading PHP Info...</span>
        </div>
      </div>
      <div v-else-if="error" class="h-full flex items-center justify-center text-red-400 bg-[#1e1e1e] p-6 text-center">
        <div class="max-w-md">
            <svg class="w-12 h-12 mx-auto mb-3 text-red-500 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <p>{{ error }}</p>
            <button @click="loadPhpInfo" class="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors">Retry</button>
        </div>
      </div>
      <iframe v-else-if="isHtml" :srcdoc="content" class="w-full h-full border-none bg-white"></iframe>
      <pre v-else class="w-full h-full overflow-auto p-4 text-xs font-mono bg-[#0d0d0d] text-gray-300 select-text">{{ content }}</pre>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  app: Object
});

const content = ref('');
const isHtml = ref(false);
const loading = ref(false);
const error = ref('');

const loadPhpInfo = async () => {
    if (!props.app?.id) return;
    
    loading.value = true;
    error.value = '';
    
    try {
        const result = await window.sysapi.apps.getPhpInfo(props.app.id);
        if (result.error) {
            error.value = `Failed to load PHP Info: ${result.error}`;
        } else {
            content.value = result.content;
            isHtml.value = result.isHtml;
        }
    } catch (err) {
        console.error('PHP Info error:', err);
        error.value = err.message;
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    loadPhpInfo();
});
</script>
