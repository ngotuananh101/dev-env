import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import TerminalView from '../views/TerminalView.vue';
import FilesView from '../views/FilesView.vue';
import AppStoreView from '../views/AppStoreView.vue';

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomeView
    },
    {
        path: '/terminal',
        name: 'terminal',
        component: TerminalView
    },
    {
        path: '/files',
        name: 'files',
        component: FilesView
    },
    {
        path: '/apps',
        name: 'apps',
        component: AppStoreView
    }
];

const router = createRouter({
    history: createWebHashHistory(), // Electron works best with Hash history
    routes
});

export default router;
