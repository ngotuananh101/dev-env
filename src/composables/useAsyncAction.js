import { ref } from 'vue';
import { useToast } from 'vue-toastification';

/**
 * useAsyncAction - Composable để xử lý async operations
 * @param {Function} actionFn - Hàm async cần thực thi
 * @param {Object} options - Tùy chọn
 * @param {string} options.successMessage - Thông báo khi thành công
 * @param {string} options.errorMessage - Thông báo khi thất bại (có thể là prefix)
 * @param {boolean} options.showError - Có hiện toast lỗi không (default: true)
 * @param {boolean} options.showSuccess - Có hiện toast thành công không (default: false)
 * @returns {Object} { execute, isLoading, error, result }
 */
export function useAsyncAction(actionFn, options = {}) {
    const {
        successMessage,
        errorMessage = 'Action failed',
        showError = true,
        showSuccess = false
    } = options;

    const isLoading = ref(false);
    const error = ref(null);
    const result = ref(null);
    const toast = useToast();

    const execute = async (...args) => {
        isLoading.value = true;
        error.value = null;
        result.value = null;

        try {
            const res = await actionFn(...args);

            // Kiểm tra lỗi từ backend trả về (dạng { error: '...' })
            if (res && res.error) {
                throw new Error(res.error);
            }

            result.value = res;

            if (showSuccess && successMessage) {
                toast.success(successMessage);
            }

            return res;
        } catch (err) {
            console.error(errorMessage, err);
            error.value = err;
            if (showError) {
                toast.error(`${errorMessage}: ${err.message}`);
            }
            // Return null or rethrow based on preference? 
            // For now, returning null/undefined usually signals failure in our pattern since result is void or object
            return undefined;
        } finally {
            isLoading.value = false;
        }
    };

    return {
        execute,
        isLoading,
        error,
        result
    };
}
