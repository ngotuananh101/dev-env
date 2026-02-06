<template>
    <label class="relative inline-flex items-center"
        :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'">
        <input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)"
            class="sr-only peer" :disabled="disabled">
        <div
            class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
        </div>
        <span v-if="label" class="ml-3 text-sm font-medium text-gray-300">{{ label }}</span>
    </label>
</template>

<script setup>
defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

defineEmits(['update:modelValue']);
</script>
