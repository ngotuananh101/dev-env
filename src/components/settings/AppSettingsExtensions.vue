<template>
  <div class="h-full flex flex-col bg-[#1e1e1e] rounded-lg border border-gray-800 overflow-hidden shadow-sm">
    <div class="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1a1a1a]">
      <div>
        <h3 class="text-white font-medium">PHP Extensions</h3>
        <p class="text-xs text-gray-500 mt-1">Enable or disable PHP extensions</p>
      </div>
      <button @click="loadExtensions" :disabled="loading"
        class="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors border border-transparent hover:border-gray-600"
        title="Refresh">
        <svg class="w-5 h-5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
          </path>
        </svg>
      </button>
    </div>

    <div v-if="loading && extensions.length === 0" class="flex-1 flex items-center justify-center text-gray-500">
      <div class="flex flex-col items-center">
        <svg class="w-8 h-8 animate-spin text-blue-500 mb-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
          </path>
        </svg>
        Loading extensions...
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-4 custom-scrollbar">
      <div v-if="extensions.length === 0" class="text-center text-gray-500 py-12">
        No extensions found in ext directory.
      </div>

      <div v-else class="grid grid-cols-1 gap-2">
        <div v-for="ext in extensions" :key="ext.filename"
          class="flex items-center justify-between p-3 bg-[#252525] rounded border border-gray-800 hover:border-gray-600 transition-all duration-200 group">
          <div class="flex flex-col">
            <span class="text-gray-200 text-sm font-medium group-hover:text-white transition-colors">{{ ext.name
            }}</span>
            <span class="text-gray-500 text-[10px]">{{ ext.filename }}</span>
          </div>

          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" :checked="ext.enabled" @change="toggleExtension(ext)" class="sr-only peer"
              :disabled="loading">
            <div
              class="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600">
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'vue-toastification';

const toast = useToast();
const props = defineProps({
  app: Object
});

const extensions = ref([]);
const loading = ref(false);

const loadExtensions = async () => {
  if (!props.app?.id) return;

  loading.value = true;
  try {
    const result = await window.sysapi.apps.getExtensions(props.app.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      extensions.value = result.extensions || [];
    }
  } catch (err) {
    console.error('PHP extensions error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

const toggleExtension = async (ext) => {
  loading.value = true;

  try {
    const extData = { name: ext.name, filename: ext.filename };
    const result = await window.sysapi.apps.toggleExtension(props.app.id, extData, !ext.enabled);
    if (result.error) {
      toast.error(result.error);
      // Revert visually if failed (reload)
      await loadExtensions();
    } else {
      ext.enabled = !ext.enabled;
      toast.success(`${ext.name} ${ext.enabled ? 'enabled' : 'disabled'}`);
    }
  } catch (err) {
    console.error('Toggle extension error:', err);
    toast.error(err.message);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadExtensions();
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>
