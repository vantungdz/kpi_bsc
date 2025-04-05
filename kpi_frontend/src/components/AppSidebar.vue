<template>
  <a-layout-sider collapsible>
    <a-menu theme="dark" mode="inline" class="menu-list">
      <a-menu-item key="1">
        <router-link to="/">Dashboard</router-link>
      </a-menu-item>
      <a-menu-item key="2">
        <router-link to="/kpi-list">Danh sách KPI</router-link>
      </a-menu-item>
    </a-menu>
  </a-layout-sider>
</template>

<script setup>
// Không cần thêm code gì nếu không có logic đặc biệt
</script>

<style scoped>
.menu-list {
  margin-top: 64px; /* Căn chỉnh với phần nội dung */
}
</style>
