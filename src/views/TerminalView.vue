<template>
    <div class="h-full w-full bg-black p-2 flex flex-col">
        <div ref="terminalContainer" class="flex-1 w-full rounded overflow-hidden"></div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const terminalContainer = ref(null);
let term = null;
let fitAddon = null;
let cleanupTerminalData = null;

onMounted(async () => {
    await initTerminal();
});

onUnmounted(() => {
    if (term) {
        term.dispose();
        term = null;
    }
    if (cleanupTerminalData) {
        cleanupTerminalData();
    }
});

async function initTerminal() {
    // Ensure styles are loaded via global or <style>

    term = new Terminal({
        theme: {
            background: '#000000',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4'
        },
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        fontSize: 14,
        cursorBlink: true
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalContainer.value);

    // Resize Observer to handle fit
    const resizeObserver = new ResizeObserver(() => {
        if (fitAddon && term) {
            fitAddon.fit();
            if (window.sysapi) window.sysapi.resizeTerminal({ cols: term.cols, rows: term.rows });
        }
    });
    resizeObserver.observe(terminalContainer.value);

    // Init Backend
    if (window.sysapi) {
        window.sysapi.initTerminal();

        term.onData(data => window.sysapi.writeTerminal(data));
        // Capture cleanup function
        cleanupTerminalData = window.sysapi.onTerminalData(data => term.write(data));
    }

    // Initial Fit
    setTimeout(() => {
        fitAddon.fit();
        term.focus();
    }, 100);
}
</script>

<style>
/* CSS imported in script */
</style>
