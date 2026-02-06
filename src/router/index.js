import { createRouter, createWebHashHistory } from 'vue-router';

// Lazy load views for better initial bundle size
const HomeView = () => import('../views/HomeView.vue');
const TerminalView = () => import('../views/TerminalView.vue');
const FilesView = () => import('../views/FilesView.vue');
const AppStoreView = () => import('../views/AppStoreView.vue');
const LogsView = () => import('../views/LogsView.vue');
const HostsView = () => import('../views/HostsView.vue');
const SitesView = () => import('../views/SitesView.vue');
const SettingsView = () => import('../views/SettingsView.vue');
const DatabaseView = () => import('../views/DatabaseView.vue');

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
    },
    {
        path: '/logs',
        name: 'logs',
        component: LogsView
    },
    {
        path: '/hosts',
        name: 'hosts',
        component: HostsView
    },
    {
        path: '/sites',
        name: 'sites',
        component: SitesView
    },
    {
        path: '/settings',
        name: 'settings',
        component: SettingsView
    },
    {
        path: '/database',
        name: 'database',
        component: DatabaseView
    }
];

const router = createRouter({
    history: createWebHashHistory(), // Electron works best with Hash history
    routes
});

export default router;
