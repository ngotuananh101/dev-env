<template>
  <Dialog :open="true" @update:open="(v) => { if (!v) $emit('close') }">
    <DialogContent class="max-w-[900px] bg-[#252526] border-gray-700 text-gray-200 p-0 flex flex-col h-[660px]"
      @interactOutside="(e) => e.preventDefault()">
      <DialogHeader class="p-3 border-b border-gray-700">
        <DialogTitle class="flex items-center justify-between w-full">
          <div class="flex items-center space-x-2">
            <FileText class="w-5 h-5 text-blue-400" />
            <span class="text-sm">Logs: {{ site.domain }}</span>
          </div>

          <div class="flex items-center space-x-2">
            <!-- Log Type Selector -->
            <div class="flex bg-gray-700 rounded p-0.5">
              <button v-for="type in ['error', 'access']" :key="type" @click="currentLogType = type"
                class="px-3 py-1 text-xs rounded transition-colors uppercase"
                :class="currentLogType === type ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'">
                {{ type }}
              </button>
            </div>

            <div class="h-4 w-px bg-gray-600 mx-2"></div>

            <button @click="refreshLog" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Refresh">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            </button>

            <button @click="clearLog" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
              title="Clear Log">
              <Trash2 class="w-4 h-4" />
            </button>

            <button @click="$emit('close')" class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Close">
              <X class="w-4 h-4" />
            </button>
          </div>
        </DialogTitle>
      </DialogHeader>

      <!-- Content -->
      <div class="flex-1 overflow-hidden relative bg-background">
        <!-- Loading overlay -->
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <RefreshCw class="w-6 h-6 animate-spin mr-2 text-white" />
        </div>
        <div ref="editorContainer" class="w-full h-full"></div>
      </div>

      <div class="flex items-center justify-between w-full p-3 border-t border-gray-700 text-xs text-gray-500">
        <span>{{ lineCount }} lines</span>
        <span>{{ currentFilename }}</span>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { FileText, RefreshCw, Trash2, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/mode-text';

const props = defineProps({
  site: { type: Object, required: true }
});

const emit = defineEmits(['close']);

const currentLogType = ref('error');
const logContent = ref('');
const isLoading = ref(false);
const editorContainer = ref(null);
let editor = null;

const currentFilename = computed(() => `${props.site.domain}.${currentLogType.value}.log`);
const lineCount = computed(() => !logContent.value ? 0 : logContent.value.split('\n').length);

const initEditor = () => {
  if (!editorContainer.value) return;
  editor = ace.edit(editorContainer.value);
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/text');
  editor.setReadOnly(true);
  editor.setShowPrintMargin(false);
  editor.setOptions({
    fontSize: '12px', fontFamily: 'Consolas, Monaco, monospace',
    showGutter: true, highlightActiveLine: false, wrap: true, scrollPastEnd: 0.5
  });
};

const updateEditor = () => {
  if (editor) {
    editor.setValue(logContent.value || '// Empty log file', -1);
    editor.scrollToLine(editor.session.getLength(), true, true, () => { });
  }
};

const loadLog = async () => {
  isLoading.value = true;
  try {
    const result = await window.sysapi.logs.readFile(currentFilename.value);
    if (result.error) {
      logContent.value = `// Log file not found: ${currentFilename.value}\n// It will be created when the server generates logs.`;
    } else { logContent.value = result.content || ''; }
    await nextTick();
    updateEditor();
  } catch (error) { console.error('Failed to load log:', error); toast.error('Failed to load logs'); }
  finally { isLoading.value = false; }
};

const refreshLog = async () => { await loadLog(); };

const clearLog = async () => {
  if (!confirm(`Clear ${currentFilename.value}?`)) return;
  try {
    const result = await window.sysapi.logs.clearFile(currentFilename.value);
    if (result.error) { toast.error(`Failed to clear: ${result.error}`); }
    else { toast.success('Log cleared'); await loadLog(); }
  } catch (error) { toast.error(error.message); }
};

watch(currentLogType, () => { loadLog(); });
onMounted(async () => { await nextTick(); initEditor(); await loadLog(); });
onBeforeUnmount(() => { if (editor) { editor.destroy(); editor = null; } });
</script>
