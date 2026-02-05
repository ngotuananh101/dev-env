<template>
    <div class="bg-gray-800/50 rounded-lg border border-gray-700/50 backdrop-blur-sm p-6">
        <div v-if="$slots.header || title" class="mb-2 flex items-center justify-between">
            <h3 v-if="title" class="text-lg font-semibold text-white">{{ title }}</h3>
            <slot name="header"></slot>
        </div>
        <div class="text-gray-300 grow">
            <slot></slot>
        </div>
        <div v-if="$slots.footer" class="mt-6 pt-4 border-t border-gray-700/50">
            <slot name="footer"></slot>
        </div>
    </div>
</template>

<script setup>
defineProps({
    title: {
        type: String,
        default: ''
    }
});
</script>
