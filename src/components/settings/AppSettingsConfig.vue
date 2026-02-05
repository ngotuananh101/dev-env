<template>
  <div class="h-full flex flex-col bg-[#1e1e1e] rounded-lg border border-gray-800 overflow-hidden shadow-sm">
    <!-- Toolbar -->
    <div class="flex items-center justify-between p-2 border-b border-gray-800 bg-[#1a1a1a]">
      <div class="flex items-center space-x-2 text-xs text-gray-400 px-2">
        <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z">
          </path>
        </svg>
        <span class="font-medium text-gray-300">{{ filename || 'Config Editor' }}</span>
        <span v-if="isDirty" class="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes"></span>
      </div>

      <div class="flex items-center space-x-2">
        <span v-if="message" class="text-xs mr-3 slide-in"
          :class="messageType === 'error' ? 'text-red-400' : 'text-green-400'">
          {{ message }}
        </span>

        <button @click="$emit('restore')" :disabled="loading || !hasBackup"
          class="flex items-center px-3 py-2 bg-gray-800 hover:bg-orange-900/40 text-gray-300 hover:text-orange-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded border border-gray-700 hover:border-orange-500/50 transition-all text-xs"
          title="Restore from backup">
          <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
            </path>
          </svg>
          Restore
        </button>

        <button @click="save" :disabled="loading"
          class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs font-medium shadow-md shadow-blue-900/20 transition-all">
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <svg v-else class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
          </svg>
          Save
        </button>
      </div>
    </div>

    <div ref="editorContainer" class="flex-1 relative"></div>

    <div class="px-3 py-1.5 bg-[#141414] border-t border-gray-800 text-[10px] text-gray-500 flex justify-between">
      <span>{{ modeText }} mode</span>
      <span>Lines: {{ lineCount }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/mode-pgsql';
import 'ace-builds/src-noconflict/mode-ini';
import 'ace-builds/src-noconflict/mode-apache_conf';
import 'ace-builds/src-noconflict/mode-php';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';

const props = defineProps({
  content: String,
  type: String, // 'nginx', 'apache', 'php', 'mysql', 'redis', 'postgresql', 'text', 'phpmyadmin'
  filename: String,
  loading: Boolean,
  hasBackup: Boolean,
  message: String,
  messageType: String
});

const emit = defineEmits(['save', 'restore', 'change']);

const editorContainer = ref(null);
let editor = null;
const isDirty = ref(false);
const lineCount = ref(0);

const modeText = computed(() => {
  switch (props.type) {
    case 'nginx': return 'Nginx';
    case 'mysql':
    case 'mariadb':
      return 'INI';
    case 'php': return 'INI';
    case 'apache': return 'Apache Conf';
    case 'postgresql': return 'PostgreSQL';
    case 'phpmyadmin': return 'PHP';
    default: return 'Text';
  }
});

const getAceMode = (type) => {
  switch (type) {
    case 'nginx': return 'ace/mode/nginx';
    case 'mysql':
    case 'mariadb':
      return 'ace/mode/ini';
    case 'php': return 'ace/mode/ini';
    case 'redis': return 'ace/mode/ini';
    case 'apache': return 'ace/mode/apache_conf';
    case 'postgresql': return 'ace/mode/pgsql';
    case 'phpmyadmin': return 'ace/mode/php';
    default: return 'ace/mode/text';
  }
};

const initEditor = () => {
  if (!editorContainer.value) return;

  editor = ace.edit(editorContainer.value, {
    mode: getAceMode(props.type),
    theme: 'ace/theme/monokai',
    value: props.content || '',
    fontSize: '13px',
    showPrintMargin: false,
    scrollPastEnd: 0.5,
    tabSize: 4,
    useSoftTabs: true
  });

  editor.on('change', () => {
    const val = editor.getValue();
    isDirty.value = val !== props.content;
    lineCount.value = editor.session.getLength();
    emit('change', val);
  });

  // Ctrl+S
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => save()
  });

  lineCount.value = editor.session.getLength();
};

const save = () => {
  emit('save', editor.getValue());
  isDirty.value = false;
};

watch(() => props.content, (newVal) => {
  if (editor && newVal !== editor.getValue()) {
    editor.setValue(newVal || '', -1); // -1 moves cursor to start
    isDirty.value = false;
    lineCount.value = editor.session.getLength();
  }
});

watch(() => props.type, (newType) => {
  if (editor) {
    editor.session.setMode(getAceMode(newType));
  }
});

onMounted(() => {
  initEditor();
});

onUnmounted(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>

<style scoped>
.slide-in {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(10px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
