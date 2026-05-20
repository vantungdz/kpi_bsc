<script setup lang="ts">
import { KPI_CREATOR_LEGEND_ITEMS } from '@/utils/kpiCreatorRowBg'
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-white px-5 py-2.5"
    role="note"
    aria-label="KPI row color legend by creator role"
  >
    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
      Row color (creator):
    </span>
    <span
      v-for="item in KPI_CREATOR_LEGEND_ITEMS"
      :key="item.role"
      class="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600"
    >
      <span
        class="h-2.5 w-2.5 shrink-0 rounded-full"
        :class="item.dotClass"
        aria-hidden="true"
      />
      {{ item.label }}
    </span>
  </div>
</template>
