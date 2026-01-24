<template>
  <div class="flex-1 overflow-y-auto p-6">
    <!-- Top Status Row -->
    <div class="flex flex-col lg:flex-row gap-6 mb-6">
      <!-- CPU Load -->
      <div class="flex-1 bg-background-secondary rounded-lg p-6 flex flex-col items-center justify-between min-h-[280px] h-[280px]">
         <h3 class="text-white text-lg font-medium w-full">CPU Load</h3>
         
         <div class="relative w-32 h-32 flex items-center justify-center">
             <svg class="w-full h-full transform -rotate-90">
                 <circle cx="64" cy="64" r="56" stroke="#374151" stroke-width="8" fill="transparent" />
                 <circle 
                    cx="64" cy="64" r="56" stroke="#3b82f6" stroke-width="8" fill="transparent"
                    stroke-dasharray="351.8" :stroke-dashoffset="351.8 - ((systemStore.cpuLoad || 0) / 100 * 351.8)"
                    stroke-linecap="round" class="transition-all duration-500 ease-out"
                 />
             </svg>
             <div class="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                 {{ systemStore.cpuLoad.toFixed(1) }}%
             </div>
         </div>
         <div class="mt-4 text-gray-400 text-sm">{{ systemStore.cpuCores }} Core(s)</div>
      </div>

      <!-- RAM Usage -->
      <div class="flex-1 bg-background-secondary rounded-lg p-6 flex flex-col items-center justify-between min-h-[280px] h-[280px]">
         <h3 class="text-white text-lg font-medium w-full">RAM Usage</h3>
         
         <div class="relative w-32 h-32 flex items-center justify-center">
            <svg class="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#374151" stroke-width="8" fill="transparent" />
                <circle 
                   cx="64" cy="64" r="56" stroke="#8b5cf6" stroke-width="8" fill="transparent"
                   stroke-dasharray="351.8" :stroke-dashoffset="351.8 - (systemStore.mem.total > 0 ? ((systemStore.mem.active / systemStore.mem.total) * 351.8) : 0)"
                   stroke-linecap="round" class="transition-all duration-500 ease-out"
                />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                {{ systemStore.mem.total > 0 ? (((systemStore.mem.active ?? 0) / systemStore.mem.total) * 100).toFixed(1) : '0' }}%
            </div>
         </div>
         <div class="mt-4 text-gray-400 text-sm">
            {{ (systemStore.mem.active / 1024 / 1024).toFixed(0) }} / {{ (systemStore.mem.total / 1024 / 1024).toFixed(0) }}(MB)
         </div>
      </div>

      <!-- Disk Usage -->
      <div class="flex-1 bg-background-secondary rounded-lg p-6 flex flex-col min-h-[280px] h-full">
         <h3 class="text-white text-lg font-medium mb-4">Disk</h3>
         
         <div class="flex items-center justify-between mb-4">
             <div>
                 <div class="text-2xl font-bold text-green-500">{{ totalDiskPercent }}%</div>
                 <div class="text-sm text-gray-400">{{ totalUsedGB }}/{{ totalSizeGB }} GB</div>
             </div>
             
             <!-- Concentric Chart -->
             <div class="relative w-24 h-24 flex items-center justify-center">
                 <svg class="w-full h-full transform -rotate-90">
                     <!-- Tracks -->
                     <circle cx="48" cy="48" r="40" stroke="#4b5563" stroke-width="6" fill="transparent" class="opacity-30"/>
                     <circle cx="48" cy="48" r="32" stroke="#4b5563" stroke-width="6" fill="transparent" class="opacity-30"/>
                     <circle cx="48" cy="48" r="24" stroke="#4b5563" stroke-width="6" fill="transparent" class="opacity-30"/>
                     
                     <!-- Rings -->
                     <circle v-for="(disk, idx) in topDisks" :key="disk.mount"
                        cx="48" cy="48" :r="getRadius(idx)" :stroke="getDiskColor(idx)" stroke-width="6" fill="transparent"
                        :stroke-dasharray="getCircumference(idx)" 
                        :stroke-dashoffset="getOffset(idx, disk.use)" 
                        stroke-linecap="round" class="transition-all duration-500 ease-out"
                     />
                 </svg>
             </div>
         </div>

         <!-- List -->
         <div class="space-y-1 overflow-y-auto max-h-40 pr-2 custom-scrollbar">
             <div v-for="(disk, idx) in displayDisks" :key="disk.mount" class="flex items-center justify-between text-xs p-1">
                 <div class="flex items-center space-x-2">
                     <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: getDiskColor(idx) }"></div>
                     <span class="text-white font-medium truncate w-24">{{ disk.fs }} ({{ disk.mount }})</span>
                 </div>
                 <div class="text-gray-400 text-right">
                     <div>{{ disk.use.toFixed(1) }}%</div>
                     <div class="text-[10px] text-gray-500">
                         {{ (disk.used / 1024 / 1024 / 1024).toFixed(1) }}/{{ (disk.size / 1024 / 1024 / 1024).toFixed(1) }} GB
                     </div>
                 </div>
             </div>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useSystemStore } from '../stores/system';

const systemStore = useSystemStore();

onMounted(() => {
    systemStore.startPolling();
});

onUnmounted(() => {
    systemStore.stopPolling();
});

// Computed Properties for Disk Logic
const disks = computed(() => {
    // Filter legitimate disks > 1GB
    return systemStore.disks.filter(d => d.size > 1024 * 1024 * 1024);
});

const topDisks = computed(() => disks.value.slice(0, 3));
const displayDisks = computed(() => disks.value);

const totalUsed = computed(() => disks.value.reduce((acc, d) => acc + d.used, 0));
const totalSize = computed(() => disks.value.reduce((acc, d) => acc + d.size, 0));

const totalDiskPercent = computed(() => totalSize.value > 0 ? ((totalUsed.value / totalSize.value) * 100).toFixed(1) : 0);
const totalUsedGB = computed(() => (totalUsed.value / 1024 / 1024 / 1024).toFixed(2));
const totalSizeGB = computed(() => (totalSize.value / 1024 / 1024 / 1024).toFixed(2));

// Helper Functions
const getRadius = (idx) => idx === 0 ? 40 : (idx === 1 ? 32 : 24);
const getCircumference = (idx) => 2 * Math.PI * getRadius(idx);
const getOffset = (idx, percent) => {
    const c = getCircumference(idx);
    return c - (percent / 100) * c;
};
const getDiskColor = (idx) => {
    const table = ['#4ade80', '#60a5fa', '#f87171'];
    return table[idx] || '#9ca3af';
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #1f2937;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 2px;
}
</style>
