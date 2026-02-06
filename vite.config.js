import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
    ],
    base: './', // Important for Electron relative paths
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Enable minification for production
        minify: 'esbuild',
        // CSS code splitting
        cssCodeSplit: true,
        // Rollup options for code splitting
        rollupOptions: {
            output: {
                // Manual chunks for better caching
                manualChunks: (id) => {
                    // Vue ecosystem
                    if (id.includes('node_modules/vue') ||
                        id.includes('node_modules/@vue') ||
                        id.includes('node_modules/pinia')) {
                        return 'vue-vendor';
                    }
                    // UI libraries
                    if (id.includes('node_modules/lucide-vue-next') ||
                        id.includes('node_modules/vue-toastification')) {
                        return 'ui-vendor';
                    }
                    // Ace editor - split by modes
                    if (id.includes('node_modules/ace-builds')) {
                        if (id.includes('mode-')) {
                            const mode = id.match(/mode-([^/]+)/)?.[1];
                            return mode ? `ace-mode-${mode}` : 'ace-modes';
                        }
                        if (id.includes('theme-')) {
                            return 'ace-theme';
                        }
                        return 'ace-core';
                    }
                    // Terminal
                    if (id.includes('node_modules/xterm')) {
                        return 'terminal';
                    }
                },
                // Asset file naming
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
            }
        },
        // Chunk size warning limit
        chunkSizeWarningLimit: 512,
        // Target modern browsers for smaller bundle
        target: 'esnext',
    },
    server: {
        watch: {
            ignored: ['**/apps/**', '**/logs/**']
        }
    },
    // Optimize deps for faster dev startup
    optimizeDeps: {
        include: ['vue', 'vue-router', 'pinia', 'lucide-vue-next']
    }
});
