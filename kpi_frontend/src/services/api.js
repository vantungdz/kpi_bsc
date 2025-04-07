import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000', 
  headers: {
    'Content-Type': 'application/json', 
  },
});

apiClient.interceptors.response.use(
  (response) => response, 
  (error) => {
    console.error('API call error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;
