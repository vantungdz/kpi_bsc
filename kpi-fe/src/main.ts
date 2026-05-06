import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast, { PluginOptions, POSITION } from "vue-toastification";
import App from './App.vue'
import router from './router'
import './assets/main.css'
import "vue-toastification/dist/index.css";

const app = createApp(App)

const option: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 4000,
  newestOnTop: true,
  maxToasts: 6,
  hideProgressBar: false,
  toastClassName: 'kpi-toast',
}

app.use(createPinia())
app.use(router)
app.use(Toast, option);

// Handle session expiry across the app
window.addEventListener('app:session-expired', () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  router.push({ name: 'login' })
})
  
app.mount('#app')
