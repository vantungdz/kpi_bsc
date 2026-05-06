<script setup lang="ts">
import { computed } from 'vue'
import type { GmTimelineDepartmentGroup, GmTimelineIssueDetail, GmTimelineKpiGroup } from '@/types/gm-workspace'
import { assigneeIsSectionPmSameUser, gmDrawerEmployeeRowKey } from '@/utils/gm-drawer-assignee-keys'
import GmTimelineDrawerAssigneeTreeItem from '@/components/gm/GmTimelineDrawerAssigneeTreeItem.vue'

const props = withDefaults(
  defineProps<{
    item: GmTimelineIssueDetail
    kg: GmTimelineKpiGroup
    dg: GmTimelineDepartmentGroup
    idx: number | string
    expandedEmployeeRowKey: string | null
    kgBlockerSummary: string
    /** `card`: avatar + role + reason pill (timeline issue drawer). */
    variant?: 'tree' | 'card'
  }>(),
  { variant: 'tree' },
)

const emit = defineEmits<{
  toggle: [key: string]
}>()

/** {@code roles.code} from API; placeholder when missing. */
const assigneeRoleLabel = computed(() => {
  const c = (props.item.roleCode ?? '').trim()
  if (c.length) return c
  return '—'
})

const assigneeContextNote = computed(() => {
  if (!assigneeIsSectionPmSameUser(props.item)) return ''
  return 'KPI is assigned on the section head user account.'
})

const reasonPillText = computed(() => {
  const r = (props.item.reason ?? '').trim()
  return r.length > 120 ? `${r.slice(0, 117)}…` : r
})
</script>

<template>
  <li v-if="variant === 'card'" class="list-none">
    <div
      class="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-colors hover:border-zinc-300">
      <div class="min-w-0">
        <div class="flex items-start justify-between gap-2">
          <p class="truncate text-sm font-semibold text-zinc-900">{{ item.member }}</p>
          <span
            class="max-w-[50%] shrink-0 truncate rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600"
            :title="assigneeRoleLabel">
            {{ assigneeRoleLabel }}
          </span>
        </div>
        <p v-if="assigneeContextNote" class="mt-1 text-xs leading-relaxed text-zinc-500">
          {{ assigneeContextNote }}
        </p>
        <div
          v-if="reasonPillText"
          class="mt-2 inline-flex max-w-full rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-left text-xs font-medium text-amber-800">
          <span class="min-w-0 leading-snug">{{ reasonPillText }}</span>
        </div>
      </div>
    </div>
    <ul v-if="item.cascadeChildren?.length" class="mt-2 space-y-2 border-l-2 border-zinc-200/80 pl-3">
      <GmTimelineDrawerAssigneeTreeItem
        v-for="(ch, cidx) in item.cascadeChildren"
        :key="gmDrawerEmployeeRowKey(kg, dg, ch, `${idx}-${cidx}`)"
        :item="ch"
        :kg="kg"
        :dg="dg"
        :idx="`${idx}-${cidx}`"
        :expanded-employee-row-key="expandedEmployeeRowKey"
        :kg-blocker-summary="kgBlockerSummary"
        variant="card"
        @toggle="emit('toggle', $event)" />
    </ul>
  </li>

  <li v-else class="px-1">
    <button
      type="button"
      class="group gm-drawer-employee-toggle flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-[13px] leading-snug transition-colors duration-150 hover:bg-white active:bg-zinc-100/70"
      @click="emit('toggle', gmDrawerEmployeeRowKey(kg, dg, item, idx))">
      <div class="min-w-0 flex-1">
        <p class="font-medium text-zinc-900">{{ item.member }}</p>
        <p v-if="assigneeIsSectionPmSameUser(item)" class="mt-0.5 text-[10px] leading-4 text-zinc-400">
          Section head — KPI assigned on the section head user (distinct from member rows in this tree).
        </p>
        <p class="mt-0.5 text-[11px] leading-4 text-zinc-400">
          {{ kgBlockerSummary }}
        </p>
      </div>
      <span
        class="mt-0.5 shrink-0 select-none text-xs text-zinc-300 transition-colors group-hover:text-zinc-500"
        aria-hidden="true">
        {{ expandedEmployeeRowKey === gmDrawerEmployeeRowKey(kg, dg, item, idx) ? '▲' : '▼' }}
      </span>
    </button>
    <div
      v-show="expandedEmployeeRowKey === gmDrawerEmployeeRowKey(kg, dg, item, idx)"
      class="gm-drawer-row-detail mb-2 ml-1 mr-0.5 mt-0.5 text-[12px] leading-relaxed text-zinc-600">
      <p>
        <span class="text-zinc-400">Reason</span>
        <span class="font-medium text-zinc-700">: {{ item.reason }}</span>
      </p>
    </div>
    <ul
      v-if="item.cascadeChildren?.length"
      class="mt-1 space-y-0 border-l border-zinc-200/70 pb-1 pl-2.5 pt-0.5">
      <GmTimelineDrawerAssigneeTreeItem
        v-for="(ch, cidx) in item.cascadeChildren"
        :key="gmDrawerEmployeeRowKey(kg, dg, ch, `${idx}-${cidx}`)"
        :item="ch"
        :kg="kg"
        :dg="dg"
        :idx="`${idx}-${cidx}`"
        :expanded-employee-row-key="expandedEmployeeRowKey"
        :kg-blocker-summary="kgBlockerSummary"
        variant="tree"
        @toggle="emit('toggle', $event)" />
    </ul>
  </li>
</template>
