<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="onOverlayClick">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/60"></div>
        
        <!-- Modal Content -->
        <div class="relative bg-[#252526] rounded-lg shadow-xl border border-gray-700 w-full" :style="{ maxWidth: maxWidth }">
          <!-- Header -->
          <div class="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 class="font-medium text-gray-200">
              <slot name="title">Modal Title</slot>
            </h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-white transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Body -->
          <div :class="bodyClass ?? 'p-6'">
            <slot></slot>
          </div>
          
          <!-- Footer (optional) -->
          <div v-if="$slots.footer" class="p-3 border-t border-gray-700 bg-[#2b2b2b] rounded-b-lg flex justify-end space-x-2">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { X } from 'lucide-vue-next';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  maxWidth: {
    type: String,
    default: '400px'
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  },
  bodyClass: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close']);

const onOverlayClick = () => {
  if (props.closeOnOverlay) {
    emit('close');
  }
};
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
