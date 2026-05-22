<script setup lang="ts">
/**
 * Căn giữa value trong ô bảng; icon gợi ý (?) nằm bên phải, không đẩy lệch value.
 * Dùng chung tab KPI Personal & Promotion (PmPersonalKpiTab).
 */
</script>

<template>
  <div class="pm-kpi-aligned-value-cell">
    <span class="pm-kpi-aligned-value-cell__value">
      <slot />
    </span>
    <span class="pm-kpi-aligned-value-cell__hint" aria-hidden="true">
      <slot name="hint" />
    </span>
  </div>
</template>

<style scoped>
.pm-kpi-aligned-value-cell {
  display: grid;
  min-width: 0;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  text-align: center;
}

.pm-kpi-aligned-value-cell__value {
  grid-column-start: 2;
}

.pm-kpi-aligned-value-cell__hint {
  grid-column-start: 3;
  margin-left: 0.375rem;
  display: inline-flex;
  justify-self: start;
  align-self: center;
  min-width: 1.25rem;
  min-height: 1rem;
}
</style>
