<template>
  <div class="flex h-screen bg-black text-white overflow-hidden">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden p-4 pb-0">
      <div class="flex-1 w-full rounded-lg border border-gray-700 overflow-hidden bg-background">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
      <!-- Footer -->
      <div class="h-10 w-full flex items-center justify-center text-xs text-gray-500 space-x-4 shrink-0">
        <span class="text-gray-400">DevEnv Panel</span>
        <span>©2026</span>
        <a href="#" class="text-yellow-500 hover:underline">DevEnv</a>
        <a href="#" class="text-gray-400 hover:text-white">ponta.dev</a>
        <span class="text-gray-600">|</span>
        <!-- <a href="#" class="hover:text-white">Forum</a>
        <a href="#" class="hover:text-white">Documentation</a> -->
        <span>Support:</span>
        <a href="#" class="text-blue-400 hover:underline flex items-center space-x-1">
          <span>◎</span><span>Telegram</span>
        </a>
        <a href="#" class="text-purple-400 hover:underline flex items-center space-x-1">
          <span>●</span><span>Discord</span>
        </a>
        <span class="text-gray-600">|</span>
        <span>Email: <a href="mailto:anhnt@ponta.dev" class="text-blue-400 hover:underline">anhnt@ponta.dev</a></span>
      </div>
    </main>
  </div>
</template>

<script setup>
import AppSidebar from './components/AppSidebar.vue';
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
