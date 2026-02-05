<template>
  <div class="w-48 bg-[#141414] border-r border-gray-800 flex flex-col h-full">
    <div class="p-4 border-gray-800 h-16 flex items-center">
      <h2 class="text-lg font-semibold text-white tracking-wide truncate" :title="app?.name">{{ app?.name }}</h2>
    </div>
    <nav class="flex-1 py-3 space-y-1 overflow-y-auto custom-scrollbar">
      <button
        v-for="item in menuItems"
        :key="item.id"
        @click="$emit('update:activePanel', item.id)"
        class="w-full px-4 py-3 text-left text-sm transition-all duration-200 border-l-2"
        :class="activePanel === item.id 
          ? 'bg-[#1e1e1e] text-blue-400 border-blue-500 font-medium shadow-inner' 
          : 'border-transparent text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'"
      >
        {{ item.label }}
      </button>
    </nav>
  </div>
</template>

<script setup>
defineProps({
  app: Object,
  menuItems: Array,
  activePanel: String
});

defineEmits(['update:activePanel']);
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>
