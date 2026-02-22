<template>
  <Dialog :open="true" @update:open="(v) => { if (!v) $emit('close') }">
    <DialogContent class="max-w-[500px] bg-[#252526] border-gray-700 text-gray-200">
      <DialogHeader>
        <DialogTitle>Add {{ typeName }} Site</DialogTitle>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Site Name -->
        <div class="space-y-1.5">
          <Label>Site Name</Label>
          <Input v-model="form.name" placeholder="My Website" />
        </div>

        <!-- Domain -->
        <div class="space-y-1.5">
          <Label>Domain</Label>
          <Input v-model="form.domain" placeholder="example.local" />
          <p class="text-xs text-muted-foreground">Add this domain to your hosts file manually</p>
        </div>

        <!-- Webserver -->
        <div class="space-y-1.5">
          <Label>Web Server</Label>
          <Select v-model="form.webserver">
            <SelectTrigger>
              <SelectValue placeholder="Select Web Server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-if="webserver.nginx" value="nginx">Nginx</SelectItem>
              <SelectItem v-if="webserver.apache" value="apache">Apache</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="!webserver.nginx && !webserver.apache" class="text-xs text-red-400">No webserver installed</p>
        </div>

        <!-- PHP Project: Root Path -->
        <template v-if="type === 'php'">
          <div class="space-y-1.5">
            <Label>Root Directory</Label>
            <div class="flex space-x-2">
              <Input v-model="form.root_path" placeholder="D:\www\mysite" class="flex-1" />
              <Button @click="selectFolder" variant="secondary">Browse</Button>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label>PHP Version</Label>
            <Select v-model="form.php_version">
              <SelectTrigger>
                <SelectValue placeholder="Select PHP Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in phpVersionOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="phpVersions.length === 0" class="text-xs text-red-400">No PHP versions installed.</p>
          </div>
        </template>

        <!-- Node Project: Root Path + Script + Port -->
        <template v-if="type === 'node'">
          <div class="space-y-1.5">
            <Label>Project Directory</Label>
            <div class="flex space-x-2">
              <Input v-model="form.root_path" placeholder="D:\projects\myapp" class="flex-1" />
              <Button @click="selectFolder" variant="secondary">Browse</Button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <Label>Entry Script</Label>
              <Input v-model="form.node_script" placeholder="index.js" />
            </div>
            <div class="space-y-1.5">
              <Label>Port</Label>
              <Input v-model.number="form.port" type="number" placeholder="3000" />
            </div>
          </div>
        </template>

        <!-- Proxy Project: Target URL -->
        <template v-if="type === 'proxy'">
          <div class="space-y-1.5">
            <Label>Proxy Target URL</Label>
            <Input v-model="form.proxy_target" placeholder="http://localhost:8080" />
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="$emit('close')">Cancel</Button>
        <Button variant="success" @click="createSite" :disabled="isCreating || !isValid">
          {{ isCreating ? 'Creating...' : 'Create' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { useDatabaseStore } from '../stores/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const props = defineProps({
  type: String,
  webserver: Object
});

const emit = defineEmits(['close', 'created']);
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
  try {
    const result = await window.sysapi.apps.getList();
    if (result.apps) {
      phpVersions.value = result.apps.filter(app => app.id.startsWith('php') && app.status === 'installed');
      phpVersions.value.sort((a, b) => b.installedVersion.localeCompare(a.installedVersion, undefined, { numeric: true }));
    }
  } catch (error) {
    console.error('Failed to load apps:', error);
  }

  if (props.type === 'php') {
    await dbStore.loadSettings();
    const defaultVer = dbStore.settings.default_php_version;
    const isInstalled = phpVersions.value.some(p => p.installedVersion === defaultVer);

    if (isInstalled) {
      form.value.php_version = defaultVer;
    } else if (phpVersions.value.length > 0) {
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
    if (result.path) { form.value.root_path = result.path; }
  } catch (error) { console.error('Select folder error:', error); }
};

const createSite = async () => {
  if (!isValid.value) return;
  isCreating.value = true;
  try {
    const siteData = {
      name: form.value.name, domain: form.value.domain,
      type: props.type, webserver: form.value.webserver,
      root_path: form.value.root_path, port: form.value.port,
      php_version: form.value.php_version, node_script: form.value.node_script,
      proxy_target: form.value.proxy_target
    };
    const result = await window.sysapi.sites.create(siteData);
    if (result.error) { toast.error(`Failed to create site: ${result.error}`); }
    else { toast.success(`Site "${form.value.domain}" created!`); emit('created'); }
  } catch (error) { toast.error(`Error: ${error.message}`); }
  finally { isCreating.value = false; }
};
</script>
