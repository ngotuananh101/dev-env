import { useToast } from 'vue-toastification';

/**
 * Generates a random password
 * @param {number} length 
 * @returns {string}
 */
export const generatePassword = (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < length; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    return pass;
};

/**
 * Copies text to clipboard and shows toast
 * @param {string} text 
 * @param {string} successMessage 
 * @param {string} errorMessage 
 */
export const copyToClipboard = async (text, successMessage = 'Copied to clipboard', errorMessage = 'Failed to copy') => {
    const toast = useToast();
    try {
        await navigator.clipboard.writeText(text);
        toast.success(successMessage);
        return true;
    } catch (err) {
        toast.error(errorMessage);
        console.error('Copy error:', err);
        return false;
    }
};

/**
 * Formats bytes to human readable string
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Formats date string to local string
 * @param {string|Date} date 
 * @returns {string}
 */
export const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString();
};

/**
 * Debounce function - delays execution until after wait ms have elapsed since last call
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function}
 */
export const debounce = (fn, wait = 300) => {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
};

/**
 * Throttle function - limits function execution to once per wait ms
 * @param {Function} fn - Function to throttle
 * @param {number} wait - Minimum time between calls in milliseconds
 * @returns {Function}
 */
export const throttle = (fn, wait = 300) => {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= wait) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
};

