<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
    <div class="bg-[#1a1a1a] rounded-lg shadow-2xl w-[900px] h-[600px] flex overflow-hidden border border-gray-700">
      <!-- Left Sidebar -->
      <div class="w-48 bg-[#141414] border-r border-gray-700 flex flex-col">
        <div class="p-4 border-b border-gray-700 h-14">
          <h2 class="text-md font-semibold text-white">{{ app?.name }}</h2>
        </div>
        <nav class="flex-1 py-2">
          <button
            v-for="item in menuItems"
            :key="item.id"
            @click="activePanel = item.id"
            class="w-full px-4 py-2 text-left text-sm transition-colors"
            :class="activePanel === item.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'"
          >
            {{ item.label }}
          </button>
        </nav>
      </div>

      <!-- Right Content -->
      <div class="flex-1 flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-700 h-14">
          <span class="text-gray-400 text-sm">
            {{ currentMenuItem?.tip || '' }}
          </span>
          <button @click="close" class="text-gray-400 hover:text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-hidden p-4">
          <!-- Service Panel -->
          <div v-if="activePanel === 'service'" class="h-full flex flex-col items-center justify-center space-y-6">
            <div class="flex items-center space-x-4">
              <span class="text-gray-400">Status:</span>
              <span :class="serviceRunning ? 'text-green-400' : 'text-red-400'" class="font-medium">
                {{ serviceRunning ? 'Running' : 'Stopped' }}
              </span>
            </div>
            <div class="flex space-x-4">
              <button
                @click="startService"
                :disabled="serviceRunning || serviceLoading"
                class="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
              >
                Start
              </button>
              <button
                @click="stopService"
                :disabled="!serviceRunning || serviceLoading"
                class="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
              >
                Stop
              </button>
              <button
                @click="restartService"
                :disabled="!serviceRunning || serviceLoading"
                class="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
              >
                Restart
              </button>
            </div>
            <p v-if="serviceLoading" class="text-gray-400 text-sm">{{ serviceLoadingText }}</p>
          </div>

          <!-- Config Editor Panel -->
          <div v-if="activePanel === 'config'" class="h-full flex flex-col">
            <div ref="editorContainer" class="flex-1 border border-gray-700 rounded overflow-hidden"></div>
            
            <!-- Actions -->
            <div class="flex items-center justify-between mt-4">
              <div class="flex space-x-2">
                <button
                  @click="saveConfig"
                  :disabled="configLoading"
                  class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-white text-sm"
                >
                  Save
                </button>
                <button
                  @click="restoreConfig"
                  :disabled="configLoading || !hasBackup"
                  class="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 rounded text-white text-sm"
                >
                  Restore
                </button>
              </div>
              <span v-if="configMessage" :class="configMessageClass" class="text-sm">
                {{ configMessage }}
              </span>
            </div>

            <!-- Note -->
            <p class="mt-3 text-gray-500 text-xs">
              • This is the main configuration file. If you don't understand the rules, please don't modify it.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/theme-monokai';
import { useToast } from 'vue-toastification';

const toast = useToast();

const props = defineProps({
  show: Boolean,
  app: Object
});

const emit = defineEmits(['close']);

// Menu
const menuItems = [
  { id: 'service', label: 'Service', tip: 'Start, stop, or restart the service' },
  { id: 'config', label: 'Web server', tip: 'Tips: Ctrl+F Search, Ctrl+S Save, Ctrl+H Replace' }
];

const activePanel = ref('service');

const currentMenuItem = computed(() => menuItems.find(m => m.id === activePanel.value));

// Service state
const serviceRunning = ref(false);
const serviceLoading = ref(false);
const serviceLoadingText = ref('');

// Config state
const editorContainer = ref(null);
let editor = null;
const configContent = ref('');
const hasBackup = ref(false);
const configLoading = ref(false);
const configMessage = ref('');
const configMessageClass = ref('text-gray-400');

// Check service status
const checkServiceStatus = async () => {
  if (!props.app?.execPath) return;
  const result = await window.sysapi.apps.getServiceStatus(props.app.id, props.app.execPath);
  serviceRunning.value = result.running;
};

// Start service
const startService = async () => {
  serviceLoading.value = true;
  serviceLoadingText.value = 'Starting...';
  
  const startArgs = props.app.serviceCommands?.start || '';
  const result = await window.sysapi.apps.startService(
    props.app.id,
    props.app.execPath,
    startArgs
  );
  
  if (result.error) {
    serviceLoadingText.value = `Error: ${result.error}`;
    toast.error(`Start failed: ${result.error}`);
  } else {
    serviceLoadingText.value = 'Started successfully';
    toast.success('Service started successfully');
    await checkServiceStatus();
  }
  
  setTimeout(() => {
    serviceLoading.value = false;
    serviceLoadingText.value = '';
  }, 1500);
};

// Stop service
const stopService = async () => {
  serviceLoading.value = true;
  serviceLoadingText.value = 'Stopping...';
  
  const stopArgs = props.app.serviceCommands?.stop || '';
  const result = await window.sysapi.apps.stopService(
    props.app.id,
    props.app.execPath,
    stopArgs
  );
  
  if (result.error) {
    serviceLoadingText.value = `Error: ${result.error}`;
    toast.error(`Stop failed: ${result.error}`);
  } else {
    serviceLoadingText.value = 'Stopped successfully';
    toast.success('Service stopped successfully');
    // Wait a bit for the process to fully stop before checking status
    await new Promise(resolve => setTimeout(resolve, 500));
    await checkServiceStatus();
  }
  
  setTimeout(() => {
    serviceLoading.value = false;
    serviceLoadingText.value = '';
  }, 1500);
};

// Restart service
const restartService = async () => {
  serviceLoading.value = true;
  serviceLoadingText.value = 'Restarting...';
  
  // For full restart (stop then start), we must use the START command args, not restart args (which are usually -s reload)
  const startArgs = props.app.serviceCommands?.start || '';
  const stopArgs = props.app.serviceCommands?.stop || '';

  // Use dedicated atomic restart handler
  const result = await window.sysapi.apps.restartService(
    props.app.id,
    props.app.execPath,
    startArgs,
    stopArgs
  );
  
  if (result.error) {
    serviceLoadingText.value = `Error: ${result.error}`;
    toast.error(`Restart failed: ${result.error}`);
  } else {
    serviceLoadingText.value = 'Restarted successfully';
    toast.success('Service restarted successfully');
    await checkServiceStatus();
  }
  
  setTimeout(() => {
    serviceLoading.value = false;
    serviceLoadingText.value = '';
  }, 1500);
};

// Load config
const loadConfig = async () => {
  if (!props.app?.configFile || !props.app?.execPath) return;
  
  // Get app directory from execPath (parent directory of executable)
  const appDir = props.app.execPath.substring(0, props.app.execPath.lastIndexOf('\\'));
  
  configLoading.value = true;
  const result = await window.sysapi.apps.readConfig(appDir, props.app.configFile);
  
  if (result.error) {
    configMessage.value = `Error: ${result.error}`;
    configMessageClass.value = 'text-red-400';
  } else {
    configContent.value = result.content;
    hasBackup.value = result.hasBackup;
    
    if (editor) {
      editor.setValue(result.content);
    }
  }
  configLoading.value = false;
};

// Save config
const saveConfig = async () => {
  if (!editor || !props.app?.configFile || !props.app?.execPath) return;
  
  const appDir = props.app.execPath.substring(0, props.app.execPath.lastIndexOf('\\'));
  
  configLoading.value = true;
  configMessage.value = 'Saving...';
  configMessageClass.value = 'text-gray-400';
  
  const content = editor.getValue();
  const result = await window.sysapi.apps.saveConfig(appDir, props.app.configFile, content);
  
  if (result.error) {
    configMessage.value = `Error: ${result.error}`;
    configMessageClass.value = 'text-red-400';
    toast.error(`Save failed: ${result.error}`);
  } else {
    configMessage.value = 'Saved successfully!';
    configMessageClass.value = 'text-green-400';
    hasBackup.value = result.hasBackup;
    toast.success('Config saved successfully');
  }
  
  configLoading.value = false;
  setTimeout(() => configMessage.value = '', 3000);
};

// Restore config
const restoreConfig = async () => {
  if (!props.app?.configFile || !props.app?.execPath) return;
  
  const appDir = props.app.execPath.substring(0, props.app.execPath.lastIndexOf('\\'));
  
  configLoading.value = true;
  configMessage.value = 'Restoring...';
  configMessageClass.value = 'text-gray-400';
  
  const result = await window.sysapi.apps.restoreConfig(appDir, props.app.configFile);
  
  if (result.error) {
    configMessage.value = `Error: ${result.error}`;
    configMessageClass.value = 'text-red-400';
    toast.error(`Restore failed: ${result.error}`);
  } else {
    configMessage.value = 'Restored successfully!';
    configMessageClass.value = 'text-green-400';
    toast.success('Config restored successfully');
    
    if (editor && result.content) {
      editor.setValue(result.content);
    }
  }
  
  configLoading.value = false;
  setTimeout(() => configMessage.value = '', 3000);
};

// Initialize Ace editor
const initEditor = async () => {
  await nextTick();
  
  if (!editorContainer.value || editor) return;
  
  editor = ace.edit(editorContainer.value, {
    mode: 'ace/mode/nginx',
    theme: 'ace/theme/monokai',
    fontSize: 13,
    showPrintMargin: false,
    wrap: true,
    tabSize: 4,
    useSoftTabs: true
  });
  
  editor.setValue(configContent.value, -1);
  
  // Ctrl+S to save
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => saveConfig()
  });
};

// Watch for panel change to init editor
watch(activePanel, async (newPanel) => {
  if (newPanel === 'config') {
    await loadConfig();
    await initEditor();
  }
});

// Watch for modal open
watch(() => props.show, async (isShow) => {
  if (isShow) {
    activePanel.value = 'service';
    await checkServiceStatus();
  } else {
    // Cleanup editor
    if (editor) {
      editor.destroy();
      editor = null;
    }
  }
});

const close = () => {
  emit('close');
};

onUnmounted(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>
