<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
    <div class="bg-[#1a1a1a] rounded-lg shadow-2xl w-[800px] h-[500px] flex flex-col border border-gray-700">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h2 class="text-white font-medium">{{ site.domain }} - Configuration</h2>
          <p class="text-gray-500 text-xs">{{ configPath }}</p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Editor -->
      <div class="flex-1 overflow-hidden">
        <div v-if="isLoading" class="flex items-center justify-center h-full text-gray-500">
          <RefreshCw class="w-6 h-6 animate-spin mr-2" />
          Loading config...
        </div>
        <div v-else ref="editorContainer" class="w-full h-full"></div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-3 border-t border-gray-700">
        <div class="text-xs text-gray-500">
          {{ site.webserver === 'apache' ? 'Apache VirtualHost' : 'Nginx Server Block' }}
        </div>
        <div class="flex items-center space-x-2">
          <button 
            @click="$emit('close')"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
          >
            Cancel
          </button>
          <button 
            @click="saveConfig"
            :disabled="isSaving"
            class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-white text-sm"
          >
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { X, RefreshCw } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/mode-apache_conf';

const props = defineProps({
  site: Object
});

const emit = defineEmits(['close', 'saved']);
const toast = useToast();

const editorContainer = ref(null);
const configPath = ref('');
const isLoading = ref(true);
const isSaving = ref(false);
let editor = null;

// Load config
const loadConfig = async () => {
  isLoading.value = true;
  try {
    const result = await window.sysapi.sites.getConfig(props.site.id);
    if (result.error) {
      toast.error(`Failed to load config: ${result.error}`);
      emit('close');
      return;
    }
    
    configPath.value = result.path;
    isLoading.value = false;
    
    await nextTick();
    initEditor(result.content);
  } catch (error) {
    toast.error(`Error: ${error.message}`);
    emit('close');
    isLoading.value = false;
  }
};

// Initialize editor
const initEditor = (content) => {
  if (!editorContainer.value) return;

  editor = ace.edit(editorContainer.value);
  editor.setTheme('ace/theme/monokai');
  
  // Set mode based on webserver
  const mode = props.site.webserver === 'apache' ? 'ace/mode/apache_conf' : 'ace/mode/nginx';
  editor.session.setMode(mode);
  
  editor.setShowPrintMargin(false);
  editor.setOptions({
    fontSize: '13px',
    fontFamily: 'Consolas, Monaco, monospace',
    showGutter: true,
    highlightActiveLine: true,
    wrap: true,
    tabSize: 4,
    useSoftTabs: true
  });
  
  editor.setValue(content, -1);
  
  // Ctrl+S to save
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => saveConfig()
  });
};

// Save config
const saveConfig = async () => {
  if (!editor) return;
  
  isSaving.value = true;
  try {
    const content = editor.getValue();
    const result = await window.sysapi.sites.saveConfig(props.site.id, content);
    
    if (result.error) {
      toast.error(`Failed to save: ${result.error}`);
    } else {
      toast.success('Config saved!');
      emit('saved');
    }
  } catch (error) {
    toast.error(`Error: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

onMounted(() => {
  loadConfig();
});

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>
