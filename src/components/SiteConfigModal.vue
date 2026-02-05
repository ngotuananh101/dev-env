<template>
  <BaseModal :show="true" @close="$emit('close')" max-width="800px" body-class="p-0 h-[500px] flex flex-col">
    <template #title>
      <div class="flex items-center justify-between w-full">
        <div>
          <span>{{ site.domain }} - Configuration</span>
          <p class="text-gray-500 text-xs font-normal mt-0.5">{{ configPath }}</p>
        </div>

        <!-- Rewrite Template Dropdown -->
        <div v-if="site.webserver !== 'apache' && site.type === 'php'" class="flex items-center space-x-2 mr-4">
          <span class="text-xs text-gray-400">Rewrite:</span>
          <select :value="currentTemplate" @change="changeTemplate($event.target.value)"
            class="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500">
            <option v-for="(tpl, key) in rewriteTemplates" :key="key" :value="key">{{ tpl.name }}</option>
          </select>
        </div>
      </div>
    </template>

    <!-- Editor -->
    <div class="flex-1 overflow-hidden relative">
      <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center text-gray-500">
        <RefreshCw class="w-6 h-6 animate-spin mr-2" />
        Loading config...
      </div>
      <div ref="editorContainer" class="w-full h-full"></div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div class="text-xs text-gray-500">
          {{ site.webserver === 'apache' ? 'Apache VirtualHost' : 'Nginx Server Block' }}
        </div>
        <div class="flex items-center space-x-2">
          <BaseButton variant="secondary" @click="$emit('close')">Cancel</BaseButton>
          <BaseButton variant="success" @click="saveConfig" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : 'Save' }}
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { X, RefreshCw } from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import BaseModal from './BaseModal.vue';
import BaseButton from './BaseButton.vue';
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

const rewriteTemplates = ref({});
const currentTemplate = ref(props.site.rewrite_template || 'default');
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

// Load rewrite templates
const loadRewriteTemplates = async () => {
  if (props.site.webserver === 'apache' || props.site.type !== 'php') return;

  try {
    const result = await window.sysapi.sites.getRewriteTemplates();
    if (result.templates) {
      rewriteTemplates.value = result.templates;
    }
  } catch (error) {
    console.error('Load rewrite templates error:', error);
  }
};

// Change template
const changeTemplate = async (newTemplate) => {
  if (currentTemplate.value === newTemplate) return;

  try {
    const result = await window.sysapi.sites.getTemplateContent(newTemplate);
    if (result.error) {
      toast.error(`Failed to get template content: ${result.error}`);
      return;
    }

    // Update editor content using regex
    if (editor) {
      const currentContent = editor.getValue();
      const content = result.content || '';
      const REWRITE_BLOCK_REGEX = /(# Rewrite Rules[\r\n]+)([\s\S]*?)([\r\n]+\s*# End Rewrite Rules)/;

      let newContent;
      if (REWRITE_BLOCK_REGEX.test(currentContent)) {
        newContent = currentContent.replace(REWRITE_BLOCK_REGEX, `$1${content}$3`);
      } else {
        // If block not found, append before end (fallback, unlikely if using standard template)
        // Or cleaner: insert before 'location ~ \.php$' check?
        // Simple fallback: append to end of server block?
        // Let's try to find index index.php... line
        if (currentContent.includes('index index.php index.html index.htm;')) {
          newContent = currentContent.replace('index index.php index.html index.htm;', `index index.php index.html index.htm;\n\n    # Rewrite Rules\n    ${content}\n    # End Rewrite Rules`);
        } else {
          newContent = currentContent; // No change if structure unknown
          toast.warning('Could not find location to insert rewrite rules automatically.');
        }
      }

      if (newContent !== currentContent) {
        editor.setValue(newContent, -1); // -1 moves cursor to start
        currentTemplate.value = newTemplate;
        toast.info(`Applied ${rewriteTemplates.value[newTemplate]?.name} rules. Click Save to persist.`);
      }
    }
  } catch (error) {
    console.error('Update rewrite rule error:', error);
    toast.error(`Error: ${error.message}`);
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

    // 1. Save file content
    const result = await window.sysapi.sites.saveConfig(props.site.id, content);

    if (result.error) {
      toast.error(`Failed to save config: ${result.error}`);
    } else {
      // 2. Save rewrite template setting if changed
      if (currentTemplate.value !== props.site.rewrite_template) {
        const dbResult = await window.sysapi.sites.updateRewrite(props.site.id, currentTemplate.value, true);
        if (!dbResult.error) {
          props.site.rewrite_template = currentTemplate.value;
        }
      }

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
  loadRewriteTemplates();
});

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});
</script>
