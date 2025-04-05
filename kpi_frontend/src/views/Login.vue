<template>
  <div class="login-container">
    <div class="login-box">
      <img src="/logo.png" alt="Logo" class="login-logo">
      <h2>KPI System Login</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" v-model="username" required :disabled="loading">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" v-model="password" required :disabled="loading">
        </div>
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </form>
      </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';

const username = ref('');
const password = ref('');
const store = useStore();
const router = useRouter();
const route = useRoute();

// Lấy trạng thái loading và error từ store auth
const loading = computed(() => store.getters['auth/authStatus'] === 'loading');
const error = computed(() => store.state.auth.error); // Lấy trực tiếp state error để hiển thị

const handleLogin = async () => {
  // Gọi action login từ store
  const success = await store.dispatch('auth/login', {
    username: username.value,
    password: password.value,
  });

  if (success) {
    // Đăng nhập thành công, điều hướng đến trang dashboard hoặc trang đã lưu trước đó
    const redirectPath = route.query.redirect || '/';
    router.push(redirectPath);
  }
  // Nếu thất bại, error message sẽ tự động cập nhật từ store qua computed property
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh; /* Đảm bảo nó nằm trong AuthLayout */
  padding: 20px;
}

.login-box {
  background-color: #fff;
  padding: 40px 30px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-logo {
  max-height: 60px;
  margin-bottom: 20px;
}

.login-box h2 {
  margin-bottom: 25px;
  color: #343a40;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
   /* Kế thừa style input chung */
  border: 1px solid #ced4da;
  border-radius: 4px;
  box-sizing: border-box;
}
.form-group input:disabled {
    background-color: #e9ecef;
    cursor: not-allowed;
}

.btn-login {
  width: 100%;
  padding: 12px;
  font-size: 1.1em;
  /* Kế thừa style button primary */
  color: #fff;
  background-color: #0d6efd;
  border-color: #0d6efd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-login:hover:not(:disabled) {
  background-color: #0b5ed7;
  border-color: #0a58ca;
}
.btn-login:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c2c7;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 0.9em;
  text-align: center;
}
</style>