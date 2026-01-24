import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';
import App from './App.vue';
import router from './router';
import './main.css'; // Import Tailwind CSS via main.css (or output.css if preferred)

const app = createApp(App);

// Toast configuration
const toastOptions = {
    position: 'top-right',
    timeout: 4000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
    showCloseButtonOnHover: false,
    hideProgressBar: false,
    closeButton: 'button',
    icon: true,
    rtl: false,
    toastClassName: 'custom-toast',
};

app.use(createPinia());
app.use(router);
app.use(Toast, toastOptions);

app.mount('#app');
