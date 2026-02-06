import { ref, watch } from 'vue';

/**
 * Creates a debounced ref - the debouncedValue updates after delay ms
 * @param {any} initialValue - Initial value
 * @param {number} delay - Debounce delay in ms (default 300)
 * @returns {{ value: Ref, debouncedValue: Ref }}
 */
export function useDebouncedRef(initialValue = '', delay = 300) {
    const value = ref(initialValue);
    const debouncedValue = ref(initialValue);
    let timeout;

    watch(value, (newVal) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            debouncedValue.value = newVal;
        }, delay);
    });

    return { value, debouncedValue };
}

