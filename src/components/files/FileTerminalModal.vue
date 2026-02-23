<template>
    <Dialog v-model:open="open" @update:open="onOpenChange">
        <DialogContent class="max-w-[900px] bg-[#252526] border-gray-700 text-gray-200 p-0 gap-0"
            @interactOutside="(e) => e.preventDefault()">
            <DialogHeader class="p-3 border-b border-gray-700">
                <DialogTitle class="text-sm">Terminal</DialogTitle>
            </DialogHeader>
            <div ref="containerRef" class="bg-black overflow-hidden h-[400px] p-2"></div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import 'xterm/css/xterm.css';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const props = defineProps({
    cwd: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const open = ref(true);
const containerRef = ref(null);

let term = null;
let fitAddon = null;
let cleanupData = null;
let resizeObserver = null;

const onOpenChange = (v) => {
    if (!v) emit('close');
};

const initTerminal = () => {
    if (!containerRef.value) return;

    term = new XTerminal({
        theme: { background: '#000000', foreground: '#d4d4d4', cursor: '#d4d4d4' },
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        fontSize: 14,
        cursorBlink: true
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.value);

    resizeObserver = new ResizeObserver(() => {
        if (fitAddon && term) {
            fitAddon.fit();
            if (window.sysapi) window.sysapi.resizeTerminal({ cols: term.cols, rows: term.rows });
        }
    });
    resizeObserver.observe(containerRef.value);

    if (window.sysapi) {
        window.sysapi.initTerminal({ cwd: props.cwd });
        term.onData(data => window.sysapi.writeTerminal(data));
        cleanupData = window.sysapi.onTerminalData(data => term.write(data));
    }

    setTimeout(() => {
        if (fitAddon) fitAddon.fit();
        if (term) term.focus();
    }, 100);
};

const destroyTerminal = () => {
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (cleanupData) { cleanupData(); cleanupData = null; }
    if (term) { term.dispose(); term = null; }
};

onMounted(async () => {
    await new Promise(r => setTimeout(r, 100));
    initTerminal();
});

onUnmounted(() => destroyTerminal());

watch(open, (v) => { if (!v) destroyTerminal(); });
</script>
