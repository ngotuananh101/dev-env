/**
 * useServiceControl - Composable for service start/stop/restart
 * Shared between AppStoreView and AppSettingsModal
 */

import { ref } from 'vue';
import { useToast } from 'vue-toastification';

export function useServiceControl() {
    const toast = useToast();

    /**
     * Start a service
     * @param {Object} app - App object with id, name, execPath
     * @param {string} args - Start arguments
     * @returns {Promise<boolean>} - Success status
     */
    const startService = async (app, args = '') => {
        if (!app?.execPath) return false;

        toast.info(`Starting ${app.name}...`);

        try {
            const result = await window.sysapi.apps.startService(app.id, app.execPath, args);
            if (result.error) {
                toast.error(`Failed to start ${app.name}: ${result.error}`);
                return false;
            }
            toast.success(`${app.name} started successfully!`);
            return true;
        } catch (error) {
            console.error('Start service error:', error);
            toast.error(`Error: ${error.message}`);
            return false;
        }
    };

    /**
     * Stop a service
     * @param {Object} app - App object with id, name, execPath
     * @param {string} stopArgs - Stop arguments
     * @returns {Promise<boolean>} - Success status
     */
    const stopService = async (app, stopArgs = '') => {
        if (!app?.execPath) return false;

        toast.info(`Stopping ${app.name}...`);

        try {
            const result = await window.sysapi.apps.stopService(app.id, app.execPath, stopArgs);
            if (result.error) {
                toast.error(`Failed to stop ${app.name}: ${result.error}`);
                return false;
            }
            toast.success(`${app.name} stopped!`);
            return true;
        } catch (error) {
            console.error('Stop service error:', error);
            toast.error(`Error: ${error.message}`);
            return false;
        }
    };

    /**
     * Restart a service
     * @param {Object} app - App object with id, name, execPath
     * @param {string} startArgs - Start arguments
     * @param {string} stopArgs - Stop arguments
     * @returns {Promise<boolean>} - Success status
     */
    const restartService = async (app, startArgs = '', stopArgs = '') => {
        if (!app?.execPath) return false;

        toast.info(`Restarting ${app.name}...`);

        try {
            const result = await window.sysapi.apps.restartService(app.id, app.execPath, startArgs, stopArgs);
            if (result.error) {
                toast.error(`Failed to restart ${app.name}: ${result.error}`);
                return false;
            }
            toast.success(`${app.name} restarted!`);
            return true;
        } catch (error) {
            console.error('Restart service error:', error);
            toast.error(`Error: ${error.message}`);
            return false;
        }
    };

    /**
     * Check service status
     * @param {Object} app - App object with id, execPath
     * @returns {Promise<boolean>} - Running status
     */
    const checkServiceStatus = async (app) => {
        if (!app?.execPath) return false;

        try {
            const result = await window.sysapi.apps.getServiceStatus(app.id, app.execPath);
            return result.running || false;
        } catch (e) {
            return false;
        }
    };

    return {
        startService,
        stopService,
        restartService,
        checkServiceStatus
    };
}
