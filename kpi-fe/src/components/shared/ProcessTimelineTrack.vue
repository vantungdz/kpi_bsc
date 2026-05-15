<script setup lang="ts">
export type ProcessTimelineMilestoneStatus = 'complete' | 'active' | 'upcoming'

defineProps<{
  trackBarStyle: Record<string, string>
  progressFillStyle: Record<string, string>
  nowMarkerPositionStyle: Record<string, string>
  nowMarkerLabel: string
  milestones: { idx: number; outerClass: string; status: ProcessTimelineMilestoneStatus }[]
  /** Year-end-only mode: milestone positions (%) on the track, keyed by `milestones[].idx`. */
  milestoneLeftPcts?: (number | undefined)[]
  /** false: hide the “today” marker so it does not cover the tick. Default true. */
  showNowMarker?: boolean
}>()
</script>

<template>
  <div
    class="relative min-h-[2.25rem] w-full min-w-0"
    :class="milestoneLeftPcts ? 'block' : 'grid grid-cols-3 items-center'"
  >
    <div
      class="pointer-events-none absolute z-0 h-[3px] rounded-full bg-slate-200"
      :style="trackBarStyle"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute z-[1] h-[3px] min-w-[3px] rounded-full bg-sky-500 shadow-sm transition-[width] duration-300 ease-out"
      :style="progressFillStyle"
      aria-hidden="true"
    />

    <!-- “Today” marker: center via absolute positioning (avoids flex subpixel drift) -->
    <div
      v-if="showNowMarker !== false"
      class="pointer-events-none absolute z-[14]"
      :style="nowMarkerPositionStyle"
      role="img"
      :aria-label="nowMarkerLabel"
    >
      <span
        class="box-border block h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500 shadow-md ring-2 ring-sky-300/90"
        :title="nowMarkerLabel"
      />
    </div>

    <template v-if="milestoneLeftPcts">
      <div
        v-for="m in milestones"
        :key="m.idx"
        class="absolute top-1/2 z-[18] -translate-x-1/2 -translate-y-1/2"
        :style="{ left: `${milestoneLeftPcts[m.idx] ?? 50}%` }"
      >
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="m.outerClass">
          <i
            v-if="m.status === 'complete'"
            class="fas fa-check text-[15px] text-white"
            aria-hidden="true"
          />
          <span
            v-else-if="m.status === 'active'"
            class="flex h-6 w-6 items-center justify-center rounded-full border-2"
            :class="m.idx === 0 ? 'border-emerald-600' : 'border-blue-500'"
            aria-hidden="true"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="m.idx === 0 ? 'bg-emerald-600' : 'bg-blue-500'"
            />
          </span>
          <span v-else class="h-2 w-2 rounded-full bg-slate-400/90" aria-hidden="true" />
        </div>
      </div>
    </template>
    <template v-else>
      <div v-for="m in milestones" :key="m.idx" class="relative z-[18] flex justify-center">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="m.outerClass">
          <i
            v-if="m.status === 'complete'"
            class="fas fa-check text-[15px] text-white"
            aria-hidden="true"
          />
          <span
            v-else-if="m.status === 'active'"
            class="flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white"
            :class="m.idx === 0 ? 'border-emerald-600' : 'border-blue-500'"
            aria-hidden="true"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="m.idx === 0 ? 'bg-emerald-600' : 'bg-blue-500'"
            />
          </span>
          <span v-else class="h-2 w-2 rounded-full bg-slate-400/90" aria-hidden="true" />
        </div>
      </div>
    </template>
  </div>
</template>
