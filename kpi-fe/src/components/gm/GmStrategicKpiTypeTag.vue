<script setup lang="ts">
import { computed } from 'vue'
import type { GmStrategicKpiKind } from '@/types/gm-workspace'

const props = withDefaults(
  defineProps<{
    type: GmStrategicKpiKind
    /** sm: bảng chật; md: card (mặc định) */
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const MAP: Record<
  GmStrategicKpiKind,
  { label: string; icon: string; pill: string }
> = {
  cascading: {
    label: 'Cascading',
    icon: 'fas fa-code-branch',
    pill: 'inline-flex w-max items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-bold text-blue-800',
  },
  individual: {
    label: 'Individual',
    icon: 'fas fa-crosshairs',
    pill: 'inline-flex w-max items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700',
  },
  promotion: {
    label: 'Promotion',
    icon: 'fas fa-user-plus',
    pill: 'inline-flex w-max items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 font-bold text-purple-800',
  },
}

const ui = computed(() => MAP[props.type])
const textClass = computed(() => (props.size === 'sm' ? 'text-[8px]' : 'text-[9px]'))
const iconClass = computed(() => (props.size === 'sm' ? 'text-[8px]' : 'text-[9px]'))
</script>

<template>
  <span :class="[ui.pill, textClass]">
    <i :class="[ui.icon, iconClass]" aria-hidden="true" />
    {{ ui.label }}
  </span>
</template>
