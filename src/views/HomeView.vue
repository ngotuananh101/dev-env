<template>
    <div class="flex-1 overflow-y-auto p-6 animate-fade-in">
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-background-secondary rounded-lg p-4 flex items-center space-x-4">
                <div class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Box class="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <div class="text-2xl font-bold text-white">{{ installedAppsCount }}</div>
                    <div class="text-sm text-gray-400">Apps Installed</div>
                </div>
            </div>
            <div class="bg-background-secondary rounded-lg p-4 flex items-center space-x-4">
                <div class="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Globe class="w-6 h-6 text-green-400" />
                </div>
                <div>
                    <div class="text-2xl font-bold text-white">{{ sitesCount }}</div>
                    <div class="text-sm text-gray-400">Sites Configured</div>
                </div>
            </div>
            <div class="bg-background-secondary rounded-lg p-4 flex items-center space-x-4">
                <div class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Database class="w-6 h-6 text-purple-400" />
                </div>
                <div>
                    <div class="text-2xl font-bold text-white">{{ databasesCount }}</div>
                    <div class="text-sm text-gray-400">Databases</div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            <!-- CPU Load -->
            <BaseCard title="CPU Load" class="flex flex-col items-center justify-between min-h-[280px]">
                <div class="relative w-32 h-32 flex items-center justify-center mx-auto mt-4">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#374151" stroke-width="8" fill="transparent" />
                        <circle cx="64" cy="64" r="56" stroke="#3b82f6" stroke-width="8" fill="transparent"
                            stroke-dasharray="351.8"
                            :stroke-dashoffset="351.8 - ((systemStore.cpuLoad || 0) / 100 * 351.8)"
                            stroke-linecap="round" class="transition-all duration-500 ease-out" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                        {{ systemStore.cpuLoad.toFixed(1) }}%
                    </div>
                </div>
                <div class="mt-4 text-center text-gray-400 text-sm">{{ systemStore.cpuCores }} Core(s)</div>
            </BaseCard>

            <!-- RAM Usage -->
            <BaseCard title="RAM Usage" class="flex flex-col items-center justify-between min-h-[280px]">
                <div class="relative w-32 h-32 flex items-center justify-center mx-auto mt-4">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#374151" stroke-width="8" fill="transparent" />
                        <circle cx="64" cy="64" r="56" stroke="#8b5cf6" stroke-width="8" fill="transparent"
                            stroke-dasharray="351.8"
                            :stroke-dashoffset="351.8 - (systemStore.mem.total > 0 ? ((systemStore.mem.active / systemStore.mem.total) * 351.8) : 0)"
                            stroke-linecap="round" class="transition-all duration-500 ease-out" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                        {{ systemStore.mem.total > 0 ? (((systemStore.mem.active ?? 0) / systemStore.mem.total) *
                            100).toFixed(1) : '0' }}%
                    </div>
                </div>
                <div class="mt-4 text-center text-gray-400 text-sm">
                    {{ formatBytes(systemStore.mem.active, 0) }} / {{ formatBytes(systemStore.mem.total, 0) }}
                </div>
            </BaseCard>

            <!-- Disk Usage -->
            <BaseCard title="Disk Usage" class="flex flex-col min-h-[280px]">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <div class="text-3xl font-bold text-green-500">{{ totalDiskPercent }}%</div>
                        <div class="text-sm text-gray-400 mt-1">{{ totalUsedGB }} / {{ totalSizeGB }}</div>
                    </div>

                    <!-- Concentric Chart -->
                    <div class="relative w-24 h-24 flex items-center justify-center">
                        <svg class="w-full h-full transform -rotate-90">
                            <!-- Tracks -->
                            <circle cx="48" cy="48" r="40" stroke="#374151" stroke-width="6" fill="transparent"
                                class="opacity-50" />
                            <circle cx="48" cy="48" r="32" stroke="#374151" stroke-width="6" fill="transparent"
                                class="opacity-50" />
                            <circle cx="48" cy="48" r="24" stroke="#374151" stroke-width="6" fill="transparent"
                                class="opacity-50" />

                            <!-- Rings -->
                            <circle v-for="(disk, idx) in topDisks" :key="disk.mount" cx="48" cy="48"
                                :r="getRadius(idx)" :stroke="getDiskColor(idx)" stroke-width="6" fill="transparent"
                                :stroke-dasharray="getCircumference(idx)" :stroke-dashoffset="getOffset(idx, disk.use)"
                                stroke-linecap="round" class="transition-all duration-500 ease-out" />
                        </svg>
                    </div>
                </div>

                <!-- List -->
                <div class="flex-1 overflow-y-auto max-h-40 pr-2 custom-scrollbar space-y-2">
                    <div v-for="(disk, idx) in displayDisks" :key="disk.mount"
                        class="flex items-center justify-between text-xs p-2 rounded bg-gray-800/50">
                        <div class="flex items-center space-x-3">
                            <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: getDiskColor(idx) }"></div>
                            <div class="flex flex-col">
                                <span class="text-white font-medium truncate max-w-[80px]">{{ disk.mount }}</span>
                                <span class="text-gray-500 text-[10px]">{{ disk.fs }}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-white font-medium">{{ disk.use.toFixed(1) }}%</div>
                            <div class="text-[10px] text-gray-500">
                                {{ formatBytes(disk.used, 1) }} used
                            </div>
                        </div>
                    </div>
                </div>
            </BaseCard>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useSystemStore } from '../stores/system';
import { useAppsStore } from '../stores/apps';
import { useSitesStore } from '../stores/sites';
import BaseCard from '../components/BaseCard.vue';
import { formatBytes } from '../utils/helpers';
import { Box, Globe, Database } from 'lucide-vue-next';

const systemStore = useSystemStore();
const appsStore = useAppsStore();
const sitesStore = useSitesStore();

// Stats
const databasesCount = ref(0);

const installedAppsCount = computed(() =>
    appsStore.apps.filter(app => app.status === 'installed').length
);

const sitesCount = computed(() => sitesStore.sites.length);

// Load databases count
const loadDatabasesCount = async () => {
    try {
        // First, check which database apps are installed
        const result = await window.sysapi.db.query(
            "SELECT * FROM installed_apps WHERE app_id IN ('mysql', 'mariadb', 'postgresql')"
        );

        if (!result || !Array.isArray(result) || result.length === 0) {
            databasesCount.value = 0;
            return;
        }

        // Count databases from ALL installed database apps
        let totalCount = 0;

        for (const dbApp of result) {
            try {
                const dbs = await window.sysapi.database.listDatabases(dbApp.app_id);
                if (dbs && !dbs.error && Array.isArray(dbs.databases)) {
                    totalCount += dbs.databases.length;
                }
            } catch (e) {
                console.error(`Failed to list databases for ${dbApp.app_id}:`, e);
            }
        }

        databasesCount.value = totalCount;
    } catch (e) {
        console.error('Load databases count error:', e);
        databasesCount.value = 0;
    }
};

onMounted(async () => {
    systemStore.startPolling();

    // Load apps if not already loaded
    if (appsStore.apps.length === 0) {
        await appsStore.loadApps();
    }

    // Load sites if not already loaded
    if (sitesStore.sites.length === 0) {
        await sitesStore.loadSites();
    }

    // Load databases count
    await loadDatabasesCount();
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
const totalUsedGB = computed(() => formatBytes(totalUsed.value, 2));
const totalSizeGB = computed(() => formatBytes(totalSize.value, 2));

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
