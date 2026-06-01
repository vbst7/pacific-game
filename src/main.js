import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // or your router file
import './style.css';

const app = createApp(App)
app.use(router) // This line is required for useRouter() to work
app.mount('#app')

