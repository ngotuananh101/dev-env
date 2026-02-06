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
