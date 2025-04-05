<template>
  <a-layout style="min-height: 100vh">
    <!-- Sidebar cố định bên trái -->
    <AppSidebar />
    
    <a-layout>
      <!-- Header (nếu có) -->
      <AppHeader />

      <!-- Nội dung bên phải thay đổi khi chọn các menu -->
      <a-layout-content style="margin: 16px; padding: 20px; background: #fff">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import AppHeader from './components/AppHeader.vue';
import AppSidebar from './components/AppSidebar.vue';
</script>

<style scoped>
/* Thêm style nếu cần */
</style>
