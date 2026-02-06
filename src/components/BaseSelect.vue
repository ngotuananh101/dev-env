<template>
    <div class="w-full">
        <label v-if="label" class="block text-gray-400 text-sm mb-1">{{ label }}</label>
        <div class="relative">
            <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)" v-bind="$attrs"
                :class="[
                    'w-full border rounded text-white focus:outline-none transition-colors bg-background appearance-none',
                    sizeClasses,
                    error
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-600 focus:border-blue-500',
                    disabled ? 'opacity-50 cursor-not-allowed bg-gray-800' : ''
                ]" :disabled="disabled">
                <option v-if="placeholder" value="" disabled selected>{{ placeholder }}</option>
                <slot>
                    <!-- Render options from prop if provided, otherwise slot -->
                    <option v-for="option in normalizedOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </slot>
            </select>

            <!-- Custom Chevron Icon -->
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </div>
        </div>
        <p v-if="error" class="text-red-500 text-xs mt-1">{{ error }}</p>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: {
        type: [String, Number],
        default: ''
    },
    label: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: ''
    },
    options: {
        type: Array,
        default: () => [] // Array of strings or objects {label, value}
    },
    error: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    },
    size: {
        type: String,
        default: 'sm',
        validator: (value) => ['sm', 'md', 'lg'].includes(value)
    }
});

defineEmits(['update:modelValue']);

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

// Normalize options to {label, value} format
const normalizedOptions = computed(() => {
    if (!props.options || props.options.length === 0) return [];
    return props.options.map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return {
                label: opt.label || opt.name || opt.value,
                value: opt.value !== undefined ? opt.value : opt.id
            };
        }
        return { label: opt, value: opt };
    });
});
</script>

<script>
export default {
    inheritAttrs: false
}
</script>
