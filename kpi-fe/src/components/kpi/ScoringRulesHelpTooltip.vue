<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { SCORING_RULES_EXAMPLE_TOOLTIP } from '@/utils/kpiScoringRulesDsl'

withDefaults(
  defineProps<{
    ariaLabel?: string
  }>(),
  { ariaLabel: 'Scoring rules syntax example' },
)

const triggerRef = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const panelStyle = ref<Record<string, string>>({})

const TOOLTIP_MAX_W = 320
const GAP = 6

function updatePanelPosition() {
  const el = triggerRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(TOOLTIP_MAX_W, vw - 16)

  let left = r.left
  if (left + width > vw - 8) left = Math.max(8, vw - width - 8)
  if (left < 8) left = 8

  const spaceBelow = vh - r.bottom - GAP
  const showAbove = spaceBelow < 140 && r.top > 80

  if (showAbove) {
    panelStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      bottom: `${vh - r.top + GAP}px`,
      width: `${width}px`,
      zIndex: '9999',
    }
  } else {
    panelStyle.value = {
      position: 'fixed',
      top: `${r.bottom + GAP}px`,
      left: `${left}px`,
      width: `${width}px`,
      zIndex: '9999',
    }
  }
}

async function showTooltip() {
  open.value = true
  await nextTick()
  updatePanelPosition()
}

function hideTooltip() {
  open.value = false
}

function onViewportChange() {
  if (open.value) updatePanelPosition()
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  } else {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <span
    class="inline-flex shrink-0"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focusin="showTooltip"
    @focusout="hideTooltip"
  >
    <button
      ref="triggerRef"
      type="button"
      class="cursor-help rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-300"
      :aria-label="ariaLabel"
    >
      <i class="fas fa-circle-question text-[12px]" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        role="tooltip"
        :style="panelStyle"
        class="pointer-events-none whitespace-pre-line rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[10px] font-medium leading-snug text-slate-700 shadow-lg"
      >
        {{ SCORING_RULES_EXAMPLE_TOOLTIP }}
      </div>
    </Teleport>
  </span>
</template>
