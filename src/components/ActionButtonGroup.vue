<template>
    <div :class="[
        'flex items-center',
        justifyClass,
        'space-x-2'
    ]">
        <slot></slot>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    align: {
        type: String,
        default: 'center', // 'start', 'center', 'end'
        validator: v => ['start', 'center', 'end', 'between'].includes(v)
    }
});

const justifyClass = computed(() => {
    switch (props.align) {
        case 'start': return 'justify-start';
        case 'end': return 'justify-end';
        case 'between': return 'justify-between';
        default: return 'justify-center';
    }
});
</script>
