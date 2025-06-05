// axios-interceptor.js
import router from '@/core/router';
import axios from 'axios';

// Add a response interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 404) {
      // Only auto-redirect to 404 for detail/data routes, not for all API calls
      // You can customize this logic as needed
      router.push({ name: 'PageNotFound' });
    }
    return Promise.reject(error);
  }
);

export default axios;
