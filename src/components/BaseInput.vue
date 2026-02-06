<template>
    <div class="w-full">
        <label v-if="label" class="block text-gray-400 text-sm mb-1">{{ label }}</label>
        <div class="relative">
            <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" v-bind="$attrs" :class="[
                'w-full border rounded text-white focus:outline-none transition-colors bg-background',
                sizeClasses,
                error
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-600 focus:border-blue-500',
                disabled ? 'opacity-50 cursor-not-allowed bg-gray-800' : ''
            ]" :disabled="disabled" />
            <!-- Optional Icon slot if needed in future -->
        </div>
        <p v-if="error" class="text-red-500 text-xs mt-1">{{ error }}</p>
        <p v-if="hint" class="text-gray-500 text-xs mt-1">{{ hint }}</p>
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
    error: {
        type: String,
        default: ''
    },
    hint: {
        type: String, // Helper text below input
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
</script>

<script>
// Inherit attributes (placeholder, type, etc.)
export default {
    inheritAttrs: false
}
</script>
