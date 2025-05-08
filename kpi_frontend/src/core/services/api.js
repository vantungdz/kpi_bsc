import axios from "axios";
import store from "../store"; 
import router from "../router"; 
import { notification } from 'ant-design-vue';
const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_URL || "/api", 
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});


apiClient.interceptors.request.use(
  (config) => {
    const token = store.getters["auth/token"];
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("API Request Setup Error:", error); 
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response, 
  (error) => {
    console.error("API Response Error:", error.response || error.message);

    if (error.response) {
      const status = error.response.status;
      const currentRouteName = router.currentRoute.value.name; 
      const loginRouteName = 'LoginPage'; 

      if (status === 401) {
        if (currentRouteName !== loginRouteName) {
             console.error("Unauthorized (401) or Token Expired. Logging out and redirecting...");
             store.commit('auth/LOGOUT'); 
             router.push({ name: loginRouteName, query: { sessionExpired: "true" } }); 

        } else {
            console.warn("Already on Login page, received 401.");
        }

      } else if (status === 403) {
        console.error("Forbidden (403). Access denied.");
      } else {
        console.error(`API Error ${status}:`, error.response.data);
      }
    } else if (error.request) {
      console.error("Network Error:", error.request);
      notification.error({
          message: 'Network Error',
          description: 'Unable to connect to the server. Please check your network connection.',
          duration: 5 
      });
    } else {
      console.error("Request Setup Error:", error.message);
       notification.error({
          message: 'Request Error',
          description: 'An error occurred while setting up the request.',
       });
    }
    return Promise.reject(error);
  }
);

export default apiClient;