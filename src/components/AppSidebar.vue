<template>
  <aside class="w-60 bg-background-darker flex flex-col">
    <!-- IP Header -->
    <div class="p-4 flex items-center space-x-2 border-b border-gray-800">
      <div class="w-2 h-2 rounded-full bg-green-500"></div>
      <span class="font-bold text-white">{{ systemStore.ipAddress }}</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4">
      <div class="px-2 space-y-1">
        
        <router-link to="/" class="flex items-center space-x-3 px-3 py-2 rounded-md transition-colors" 
            :class="$route.path === '/' ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/50 text-gray-400'">
            <Home class="w-5 h-5" />
            <span>Home</span>
        </router-link>

        <router-link to="/terminal" class="flex items-center space-x-3 px-3 py-2 rounded-md transition-colors"
            :class="$route.path === '/terminal' ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/50 text-gray-400'">
            <TerminalSquare class="w-5 h-5" />
            <span>Terminal</span>
        </router-link>

        <router-link to="/files" class="flex items-center space-x-3 px-3 py-2 rounded-md transition-colors"
            :class="$route.path === '/files' ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/50 text-gray-400'">
            <Folder class="w-5 h-5" />
            <span>Files</span>
        </router-link>

        <router-link to="/apps" class="flex items-center space-x-3 px-3 py-2 rounded-md transition-colors"
            :class="$route.path === '/apps' ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/50 text-gray-400'">
            <Package class="w-5 h-5" />
            <span>App Store</span>
        </router-link>
      </div>
    </nav>

    <!-- Quit App -->
    <div class="p-4 border-t border-gray-800">
      <button @click="quitApp" class="flex items-center space-x-3 px-3 py-2 w-full hover:text-white transition-colors hover:bg-red-500/20 rounded-md text-gray-400">
        <Power class="w-5 h-5" />
        <span>Quit App</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useSystemStore } from '../stores/system';
import { 
    Home, TerminalSquare, Folder, Power, Package 
} from 'lucide-vue-next';

const systemStore = useSystemStore();

const quitApp = () => {
  if (window.sysapi && window.sysapi.quitApp) {
    window.sysapi.quitApp();
  }
};
</script>
