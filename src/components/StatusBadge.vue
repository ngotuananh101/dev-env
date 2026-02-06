<template>
    <span :class="[
        'px-2 py-0.5 rounded text-[10px] font-medium border',
        colorClasses
    ]">
        <slot>{{ label }}</slot>
    </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    status: {
        type: String, // 'active', 'inactive', 'warning', 'danger', 'info', or custom keys like 'installed'
        default: 'default'
    },
    label: {
        type: String,
        default: ''
    },
    variant: {
        type: String,
        default: 'solid' // 'solid' or 'outline'
    }
});

const colorClasses = computed(() => {
    const map = {
        active: 'bg-green-500/10 text-green-400 border-green-500/20',
        running: 'bg-green-500/10 text-green-400 border-green-500/20',
        installed: 'bg-green-500/10 text-green-400 border-green-500/20',
        success: 'bg-green-500/10 text-green-400 border-green-500/20',

        inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        stopped: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        not_installed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        default: 'bg-gray-500/10 text-gray-400 border-gray-500/20',

        warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        updating: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',

        danger: 'bg-red-500/10 text-red-400 border-red-500/20',
        error: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    // Map input status to key if needed (e.g. normalize)
    const key = props.status.toLowerCase();
    return map[key] || map.default;
});
</script>
