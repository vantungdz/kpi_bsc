<template>
  <div class="loading-overlay" v-if="visible">
    <div class="double-ring-spinner" role="progressbar" aria-label="Loading">
      <div class="ring outer"></div>
      <div class="ring inner"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: true }
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  z-index: 9999;
  inset: 0;
  background: rgba(255,255,255,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
}
.double-ring-spinner {
  position: relative;
  width: 80px;
  height: 80px;
}
.double-ring-spinner .ring {
  box-sizing: border-box;
  position: absolute;
  border: 6px solid transparent;
  border-top-color: #3a86ff;
  border-radius: 50%;
}
.double-ring-spinner .ring.outer {
  width: 80px;
  height: 80px;
  animation: spin 1.5s linear infinite;
  border-left-color: #1e5dbf;
}
.double-ring-spinner .ring.inner {
  width: 56px;
  height: 56px;
  top: 12px;
  left: 12px;
  border-top-color: #0057b8;
  border-right-color: #1e5dbf;
  animation: spinReverse 1.2s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}
@keyframes spinReverse {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(-360deg);}
}
</style>
