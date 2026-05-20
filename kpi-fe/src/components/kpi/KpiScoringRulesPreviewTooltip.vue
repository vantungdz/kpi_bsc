<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import { formatScoringRulesDisplayText } from '@/utils/kpiScoringRulesDsl'

const props = defineProps<{
  targetDescription?: string | null
}>()

const triggerRef = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const panelStyle = ref<Record<string, string>>({})

const scoringRulesText = computed(() => formatScoringRulesDisplayText(props.targetDescription))
const hasContent = computed(() => scoringRulesText.value.length > 0)

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
  if (!hasContent.value) return
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
    v-if="hasContent"
    class="inline-flex shrink-0 mt-[-5px]"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focusin="showTooltip"
    @focusout="hideTooltip"
  >
    <button
      ref="triggerRef"
      type="button"
      class="cursor-help rounded p-0.5 text-slate-400 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-300"
      aria-label="Scoring rules"
      @click.stop
    >
      <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-700 cursor-pointer">
        ?
      </span>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        role="tooltip"
        :style="panelStyle"
        class="pointer-events-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left shadow-lg"
      >
        <p class="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Scoring rules
        </p>
        <p class="whitespace-pre-line text-[10px] font-medium leading-snug text-slate-700">
          {{ scoringRulesText }}
        </p>
      </div>
    </Teleport>
  </span>
</template>
