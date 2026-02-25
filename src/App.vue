<template>
  <div class="flex h-screen bg-black text-white overflow-hidden">
    <!-- Toast Notifications -->
    <Toaster position="top-right" :duration="4000" theme="dark" rich-colors />
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden p-4 pb-0">
      <div
        class="flex-1 w-full rounded-lg border border-gray-700 overflow-hidden bg-background flex flex-col relative"
      >
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
      <!-- Footer -->
      <div
        class="h-10 w-full flex items-center justify-center text-xs text-gray-500 space-x-4 shrink-0"
      >
        <span class="text-gray-400">DevEnv Panel</span>
        <span>©2026</span>
        <a
          href="#"
          @click.prevent="openLink('https://github.com/ngotuananh101/dev-env')"
          class="text-yellow-500 hover:underline"
          >DevEnv</a
        >
        <a
          href="#"
          @click.prevent="openLink('https://ponta.dev')"
          class="text-gray-400 hover:text-white"
          >ponta.dev</a
        >
        <span class="text-gray-600">|</span>
        <!-- <a href="#" class="hover:text-white">Forum</a>
        <a href="#" class="hover:text-white">Documentation</a> -->
        <span>Support:</span>
        <a
          href="#"
          @click.prevent="openLink('https://t.me/ngotuananh2101')"
          class="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
          title="Telegram"
        >
          <svg
            enable-background="new 0 0 24 24"
            height="512"
            viewBox="0 0 24 24"
            width="512"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
          >
            <circle cx="12" cy="12" fill="#039be5" r="12" />
            <path
              d="m5.491 11.74 11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953z"
              fill="#fff"
            />
          </svg>
        </a>
        <a
          href="#"
          @click.prevent="openLink('https://fb.me/ngotuananh2101')"
          class="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
          title="Facebook"
          ><svg
            id="Capa_1"
            enable-background="new 0 0 512 512"
            height="512"
            viewBox="0 0 512 512"
            width="512"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
          >
            <g>
              <path
                d="m512 256c0 127.78-93.62 233.69-216 252.89v-178.89h59.65l11.35-74h-71v-48.02c0-20.25 9.92-39.98 41.72-39.98h32.28v-63s-29.3-5-57.31-5c-58.47 0-96.69 35.44-96.69 99.6v56.4h-65v74h65v178.89c-122.38-19.2-216-125.11-216-252.89 0-141.38 114.62-256 256-256s256 114.62 256 256z"
                fill="#1877f2"
              />
              <path
                d="m355.65 330 11.35-74h-71v-48.021c0-20.245 9.918-39.979 41.719-39.979h32.281v-63s-29.296-5-57.305-5c-58.476 0-96.695 35.44-96.695 99.6v56.4h-65v74h65v178.889c13.034 2.045 26.392 3.111 40 3.111s26.966-1.066 40-3.111v-178.889z"
                fill="#fff"
              />
            </g>
          </svg>
        </a>
        <a
          href="#"
          @click.prevent="openLink('mailto:anhnt@ponta.dev')"
          class="text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
          title="Email: anhnt@ponta.dev"
        >
          <svg
            id="Layer_1"
            height="512"
            viewBox="0 0 512 512"
            width="512"
            xmlns="http://www.w3.org/2000/svg"
            data-name="Layer 1"
            class="w-4 h-4"
          >
            <circle cx="256" cy="256" fill="#ffc107" r="256" />
            <path
              d="m408.343 362.786a10.171 10.171 0 0 0 10.157-10.158v-191.858l-155.283 123.31a11.594 11.594 0 0 1 -14.436 0l-155.281-123.31v191.858a10.169 10.169 0 0 0 10.157 10.158zm-12.62-213.572-139.723 110.956-139.725-110.956z"
              fill="#fff"
              fill-rule="evenodd"
            />
          </svg>
        </a>
      </div>
    </main>
  </div>
</template>

<script setup>
import AppSidebar from "./components/AppSidebar.vue";
import { Toaster } from "vue-sonner";

const openLink = (url) => {
  if (url.startsWith("mailto:")) {
    window.location.href = url;
    return;
  }
  window.sysapi.sites.openBrowser(url);
};
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
