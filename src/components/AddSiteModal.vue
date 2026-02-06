<template>
  <BaseModal :show="true" @close="$emit('close')" max-width="500px" body-class="p-6">
    <template #title>Add {{ typeName }} Site</template>

    <div class="space-y-4">
      <!-- Site Name -->
      <BaseInput v-model="form.name" label="Site Name" placeholder="My Website" />

      <!-- Domain -->
      <BaseInput v-model="form.domain" label="Domain" placeholder="example.local"
        hint="Add this domain to your hosts file manually" />

      <!-- Webserver -->
      <BaseSelect v-model="form.webserver" label="Web Server">
        <option v-if="webserver.nginx" value="nginx">Nginx</option>
        <option v-if="webserver.apache" value="apache">Apache</option>
        <option v-if="!webserver.nginx && !webserver.apache" value="" disabled>No webserver installed</option>
      </BaseSelect>

      <!-- PHP Project: Root Path -->
      <template v-if="type === 'php'">
        <div>
          <label class="block text-gray-400 text-sm mb-1">Root Directory</label>
          <div class="flex space-x-2">
            <BaseInput v-model="form.root_path" placeholder="D:\www\mysite" class="flex-1" />
            <BaseButton @click="selectFolder" variant="secondary" size="md">Browse</BaseButton>
          </div>
        </div>

        <BaseSelect v-model="form.php_version" label="PHP Version" :options="phpVersionOptions"
          placeholder="Select PHP Version" :error="phpVersions.length === 0 ? 'No PHP versions installed.' : ''" />
      </template>

      <!-- Node Project: Root Path + Script + Port -->
      <template v-if="type === 'node'">
        <div>
          <label class="block text-gray-400 text-sm mb-1">Project Directory</label>
          <div class="flex space-x-2">
            <BaseInput v-model="form.root_path" placeholder="D:\projects\myapp" class="flex-1" />
            <BaseButton @click="selectFolder" variant="secondary">Browse</BaseButton>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.node_script" label="Entry Script" placeholder="index.js" />
          <BaseInput v-model.number="form.port" label="Port" type="number" placeholder="3000" />
        </div>
      </template>

      <!-- Proxy Project: Target URL -->
      <template v-if="type === 'proxy'">
        <BaseInput v-model="form.proxy_target" label="Proxy Target URL" placeholder="http://localhost:8080" />
      </template>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="$emit('close')">Cancel</BaseButton>
      <BaseButton variant="success" @click="createSite" :disabled="isCreating || !isValid">
        {{ isCreating ? 'Creating...' : 'Create' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { useDatabaseStore } from '../stores/database';
import BaseModal from './BaseModal.vue';
import BaseButton from './BaseButton.vue';
import BaseInput from './BaseInput.vue';
import BaseSelect from './BaseSelect.vue';

const props = defineProps({
  type: String,
  webserver: Object
});

const emit = defineEmits(['close', 'created']);
const toast = useToast();
const dbStore = useDatabaseStore();

const form = ref({
  name: '',
  domain: '',
  webserver: props.webserver?.nginx ? 'nginx' : (props.webserver?.apache ? 'apache' : ''),
  root_path: '',
  port: 3000,
  node_script: 'index.js',
  proxy_target: '',
  php_version: ''
});

const phpVersions = ref([]);
const phpVersionOptions = computed(() => {
  return phpVersions.value.map(p => ({
    label: `PHP ${p.installedVersion}`,
    value: p.installedVersion
  }));
});

onMounted(async () => {
  // Load installed PHP versions
  try {
    const result = await window.sysapi.apps.getList();
    if (result.apps) {
      phpVersions.value = result.apps.filter(app => app.id.startsWith('php') && app.status === 'installed');
      // Sort by version desc
      phpVersions.value.sort((a, b) => b.installedVersion.localeCompare(a.installedVersion, undefined, { numeric: true }));
    }
  } catch (error) {
    console.error('Failed to load apps:', error);
  }

  if (props.type === 'php') {
    await dbStore.loadSettings();
    const defaultVer = dbStore.settings.default_php_version;
    // Check if default version is installed
    const isInstalled = phpVersions.value.some(p => p.installedVersion === defaultVer);

    if (isInstalled) {
      form.value.php_version = defaultVer;
    } else if (phpVersions.value.length > 0) {
      // Fallback to first available
      form.value.php_version = phpVersions.value[0].installedVersion;
    }
  }
});

const isCreating = ref(false);

const typeName = computed(() => {
  switch (props.type) {
    case 'php': return 'PHP';
    case 'node': return 'Node';
    case 'proxy': return 'Proxy';
    default: return '';
  }
});

const isValid = computed(() => {
  if (!form.value.name || !form.value.domain || !form.value.webserver) return false;

  if (props.type === 'php' && !form.value.root_path) return false;
  if (props.type === 'node' && (!form.value.root_path || !form.value.port)) return false;
  if (props.type === 'proxy' && !form.value.proxy_target) return false;

  return true;
});

const selectFolder = async () => {
  try {
    const result = await window.sysapi.files.selectFolder();
    if (result.path) {
      form.value.root_path = result.path;
    }
  } catch (error) {
    console.error('Select folder error:', error);
  }
};

const createSite = async () => {
  if (!isValid.value) return;

  isCreating.value = true;
  try {
    const siteData = {
      name: form.value.name,
      domain: form.value.domain,
      type: props.type,
      webserver: form.value.webserver,
      root_path: form.value.root_path,
      port: form.value.port,
      php_version: form.value.php_version,
      node_script: form.value.node_script,
      proxy_target: form.value.proxy_target
    };

    const result = await window.sysapi.sites.create(siteData);
    if (result.error) {
      toast.error(`Failed to create site: ${result.error}`);
    } else {
      toast.success(`Site "${form.value.domain}" created!`);
      emit('created');
    }
  } catch (error) {
    toast.error(`Error: ${error.message}`);
  } finally {
    isCreating.value = false;
  }
};
</script>
