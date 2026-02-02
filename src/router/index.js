import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import TerminalView from '../views/TerminalView.vue';
import FilesView from '../views/FilesView.vue';
import AppStoreView from '../views/AppStoreView.vue';
import LogsView from '../views/LogsView.vue';
import HostsView from '../views/HostsView.vue';
import SitesView from '../views/SitesView.vue';
import SettingsView from '../views/SettingsView.vue';
import DatabaseView from '../views/DatabaseView.vue';

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
