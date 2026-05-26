<script setup lang="ts">
import { computed } from 'vue'
import {
  assigneeHasEditsFromFields,
  formatAssigneeTargetDisplay,
  scoringRulesTextFromStored,
  type AssigneeEditDiffFields,
} from '@/utils/assigneeEditBaselineUi'

const props = defineProps<{
  diff: AssigneeEditDiffFields
}>()

const hasEdits = computed(() => assigneeHasEditsFromFields(props.diff))

const targetBefore = computed(() =>
  formatAssigneeTargetDisplay(props.diff.baselineTargetValue, props.diff.unitCode),
)
const targetAfter = computed(() =>
  formatAssigneeTargetDisplay(props.diff.targetValue, props.diff.unitCode),
)

const scoringBefore = computed(() =>
  scoringRulesTextFromStored(props.diff.baselineScoringDescription),
)
const scoringAfter = computed(() =>
  scoringRulesTextFromStored(props.diff.targetDescription),
)

const showTargetRow = computed(
  () => props.diff.targetChanged === true || (hasEdits.value && targetBefore.value !== targetAfter.value),
)
const showScoringBlock = computed(
  () =>
    props.diff.scoringChanged === true
    || (hasEdits.value && scoringBefore.value !== scoringAfter.value),
)
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border"
    :class="hasEdits ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50'"
  >
    <div
      class="flex items-center gap-2 border-b px-3 py-2"
      :class="hasEdits ? 'border-amber-100 bg-amber-50/80' : 'border-slate-100 bg-white'"
    >
      <i
        class="fas text-[13px]"
        :class="hasEdits ? 'fa-pen-to-square text-amber-700' : 'fa-circle-check text-slate-400'"
      />
      <span
        class="text-[11px] font-bold uppercase tracking-wide"
        :class="hasEdits ? 'text-amber-900' : 'text-slate-600'"
      >
        Assignee changes
      </span>
      <span
        v-if="hasEdits"
        class="ml-auto rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-800"
      >
        Modified
      </span>
    </div>

    <div class="space-y-2 px-3 py-3 text-sm">
      <p v-if="!hasEdits" class="text-xs text-slate-600">
        No changes to target or scoring scale compared to the version before assignee edit.
      </p>

      <template v-else>
        <div v-if="showTargetRow" class="rounded-md border border-white/80 bg-white px-3 py-2">
          <p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Target</p>
          <p class="mt-1 tabular-nums text-slate-800">
            <span class="text-slate-500 line-through">{{ targetBefore }}</span>
            <span class="mx-2 font-medium text-slate-400" aria-hidden="true">→</span>
            <span class="font-bold text-slate-900">{{ targetAfter }}</span>
          </p>
        </div>

        <div v-if="showScoringBlock" class="rounded-md border border-white/80 bg-white px-3 py-2">
          <p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Scoring scale</p>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p class="text-[10px] font-semibold text-slate-500">Before</p>
              <pre
                class="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-700"
              >{{ scoringBefore || '—' }}</pre>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-500">After</p>
              <pre
                class="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-700"
              >{{ scoringAfter || '—' }}</pre>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
