<script setup lang="ts">
import { computed } from 'vue'
import { formatScoreDisplayOrDash } from '@/utils/formatScoreDisplay'
import { gmScoreChangeTooltip, gmScoreChangedFromFields } from '@/utils/pmGmScoreDiff'

const props = defineProps<{
  displayScore?: number | string | null
  endPmScore?: number | string | null
  endGmScore?: number | string | null
  /** Class khi chưa bị GM sửa (vd. màu theo mức điểm trên bảng PM). */
  unchangedClass?: string
}>()

const changed = computed(() =>
  gmScoreChangedFromFields(props.endPmScore, props.endGmScore),
)

const tooltip = computed(() =>
  gmScoreChangeTooltip(props.endPmScore, props.endGmScore, props.displayScore),
)
</script>

<template>
  <span
    class="text-xs font-bold tabular-nums"
    :class="unchangedClass || 'text-slate-600'"
    :title="tooltip"
  >
    {{ formatScoreDisplayOrDash(displayScore) }}
  </span>
</template>
