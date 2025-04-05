<template>
  <div class="auth-layout">
    <router-view />
  </div>
</template>

<script setup>
// Layout đơn giản cho trang login, register...
</script>

<style scoped>
.auth-layout {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #e9ecef; /* Ví dụ màu nền khác */
}
</style>