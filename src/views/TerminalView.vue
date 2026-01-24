<template>
  <div class="h-full w-full bg-black p-2 flex flex-col">
    <div ref="terminalContainer" class="flex-1 w-full rounded overflow-hidden"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

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
    const { Terminal } = require('xterm');
    const { FitAddon } = require('xterm-addon-fit');
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
/* Import via main.js or here if loader supports it. 
   For Electron+Vite, CSS imports usually work in script or style tag */
@import 'xterm/css/xterm.css'; 
</style>
