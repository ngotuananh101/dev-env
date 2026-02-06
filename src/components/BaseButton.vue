<template>
    <button :class="[
        'flex items-center justify-center space-x-2 rounded transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
        variantClasses,
        sizeClasses,
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    ]" :disabled="disabled" @click="$emit('click', $event)">
        <slot name="icon"></slot>
        <span>
            <slot></slot>
        </span>
    </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    variant: {
        type: String,
        default: 'primary',
        validator: (value) => ['primary', 'secondary', 'danger', 'success', 'ghost'].includes(value)
    },
    size: {
        type: String,
        default: 'sm',
        validator: (value) => ['sm', 'md', 'lg'].includes(value)
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

defineEmits(['click']);

const variantClasses = computed(() => {
    switch (props.variant) {
        case 'primary':
            return 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500';
        case 'secondary':
            return 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500';
        case 'success':
            return 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500';
        case 'danger':
            return 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
        case 'ghost':
            return 'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white';
        default:
            return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
});

const sizeClasses = computed(() => {
    switch (props.size) {
        case 'sm':
            return 'h-8 px-3 text-xs';
        case 'lg':
            return 'h-12 px-6 text-lg';
        default: // md
            return 'h-10 px-4 text-sm';
    }
});
</script>
