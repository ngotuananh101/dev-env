<template>
  <BaseModal :show="true" @close="$emit('close')" max-width="500px">
    <template #title>Add {{ typeName }} Site</template>

    <div class="space-y-4 p-6">
      <!-- Site Name -->
      <div>
        <label class="block text-gray-400 text-sm mb-1">Site Name</label>
        <input v-model="form.name" type="text" placeholder="My Website"
          class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <!-- Domain -->
      <div>
        <label class="block text-gray-400 text-sm mb-1">Domain</label>
        <input v-model="form.domain" type="text" placeholder="example.local"
          class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
        <p class="text-gray-500 text-xs mt-1">Add this domain to your hosts file manually</p>
      </div>

      <!-- Webserver -->
      <div>
        <label class="block text-gray-400 text-sm mb-1">Web Server</label>
        <select v-model="form.webserver"
          class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500">
          <option v-if="webserver.nginx" value="nginx">Nginx</option>
          <option v-if="webserver.apache" value="apache">Apache</option>
          <option v-if="!webserver.nginx && !webserver.apache" value="" disabled>No webserver installed</option>
        </select>
      </div>

      <!-- PHP Project: Root Path -->
      <template v-if="type === 'php'">
        <div>
          <label class="block text-gray-400 text-sm mb-1">Root Directory</label>
          <div class="flex space-x-2">
            <input v-model="form.root_path" type="text" placeholder="D:\www\mysite"
              class="flex-1 px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
            <BaseButton @click="selectFolder" variant="secondary" size="md">Browse</BaseButton>
          </div>
        </div>

        <div>
          <label class="block text-gray-400 text-sm mb-1">PHP Version</label>
          <select v-model="form.php_version"
            class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="" disabled>Select PHP Version</option>
            <option v-for="php in phpVersions" :key="php.id" :value="php.installedVersion">
              PHP {{ php.installedVersion }}
            </option>
          </select>
          <p v-if="phpVersions.length === 0" class="text-xs text-yellow-500 mt-1">
            No PHP versions installed.
          </p>
        </div>
      </template>

      <!-- Node Project: Root Path + Script + Port -->
      <template v-if="type === 'node'">
        <div>
          <label class="block text-gray-400 text-sm mb-1">Project Directory</label>
          <div class="flex space-x-2">
            <input v-model="form.root_path" type="text" placeholder="D:\projects\myapp"
              class="flex-1 px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
            <BaseButton @click="selectFolder" variant="secondary" size="md">Browse</BaseButton>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-gray-400 text-sm mb-1">Entry Script</label>
            <input v-model="form.node_script" type="text" placeholder="index.js"
              class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label class="block text-gray-400 text-sm mb-1">Port</label>
            <input v-model.number="form.port" type="number" placeholder="3000"
              class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>
      </template>

      <!-- Proxy Project: Target URL -->
      <template v-if="type === 'proxy'">
        <div>
          <label class="block text-gray-400 text-sm mb-1">Proxy Target URL</label>
          <input v-model="form.proxy_target" type="text" placeholder="http://localhost:8080"
            class="w-full px-3 py-2 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
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
