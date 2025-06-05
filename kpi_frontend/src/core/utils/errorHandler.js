// Global error handler utility for Vue 3
import { useRouter } from 'vue-router';

export function setupGlobalErrorHandler(app) {
  app.config.errorHandler = (err) => {
    // You can log error here if needed
    // console.error('Global error:', err, info);
    const router = useRouter();
    // If error is a server error (500), redirect to 500 page
    if (err && (err.status === 500 || err.response?.status === 500)) {
      router.push({ name: 'PageServerError' });
    }
    // You can add more error type checks here if needed
  };
}
