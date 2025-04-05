<template>
  <div class="not-found-container">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>Sorry, the page you are looking for does not exist.</p>
    <router-link :to="{ name: 'Dashboard' }">
      <button class="btn-primary">Go to Dashboard</button>
    </router-link>
  </div>
</template>

<script setup>
// Component đơn giản, không cần logic phức tạp
</script>

<style scoped>
.not-found-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  min-height: 60vh; /* Chiều cao tối thiểu */
  padding: 20px;
}

h1 {
  font-size: 6rem;
  font-weight: bold;
  color: #dc3545; /* Màu đỏ cảnh báo */
  margin-bottom: 0;
}

h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #6c757d; /* Màu xám */
}

p {
  margin-bottom: 1.5rem;
  color: #495057;
}

button {
    font-size: 1.1rem;
    padding: 10px 25px;
}
</style>