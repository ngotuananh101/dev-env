import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import './main.css'; // Import Tailwind CSS via main.css (or output.css if preferred)
import 'vue-sonner/lib/index.css'; // vue-sonner styles (imported here to bypass @tailwindcss/vite "style" exports condition)

const app = createApp(App);


app.use(createPinia());
app.use(router);

app.mount('#app');
