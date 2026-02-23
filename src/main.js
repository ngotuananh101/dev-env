import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import './main.css'; // Import Tailwind CSS via main.css (or output.css if preferred)
import 'vue-sonner/style.css'; // vue-sonner styles

const app = createApp(App);


app.use(createPinia());
app.use(router);

app.mount('#app');
