<script setup lang="ts">
import {computed, reactive} from "vue";
import type {LeaderKpiInformationResponse} from "@/types/kpi";

const props = defineProps<{
  member: LeaderMember | null;
  data: LeaderKpiInformationResponse | null;
}>();

const openMemberEvidence = reactive<Record<string, boolean>>({});

function toggleMemberEvidence(lineId: string) {
  openMemberEvidence[lineId] = !openMemberEvidence[lineId];
}

function isMemberEvidenceOpen(lineId: string) {
  return !!openMemberEvidence[lineId];
}

const totalWeight = computed(() => {
  let sum = 0;
  if (props.data?.categories) {
    props.data.categories.forEach(cat => {
      cat.assignments.forEach(assign => {
        sum += assign.weight || 0;
      });
    });
  }
  return sum;
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="!data?.categories?.length" class="p-8 text-center text-slate-500">
      Chưa có dữ liệu KPI Promotion.
    </div>

    <template v-for="(category, catIndex) in data?.categories" :key="catIndex">
      <div class="sticky top-0 z-10 bg-violet-50/80 border-y border-violet-100 px-5 py-2">
        <p class="text-xs font-bold text-violet-800 uppercase tracking-wider">
          {{ category.name || 'Mock Category' }} (Promotion)
        </p>
      </div>

      <div v-for="(assign, assignIndex) in category.assignments" :key="assign.assignmentId"
           class="border-b border-slate-100 bg-white">
        <div class="flex items-start justify-between gap-3 px-5 py-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-2 cursor-pointer" @click="toggleMemberEvidence(assign.assignmentId)">
              <span class="mt-0.5 shrink-0 text-[10px] font-bold text-slate-400">{{ assignIndex + 1 }}</span>
              <div>
                <p class="font-bold text-slate-900 text-sm">{{ assign.kpiCode }} {{
                    assign.kpiName || 'Mock KPI Name'
                  }}</p>
                <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {{ assign.targetDescription || 'Mock Target Description' }}</p>
              </div>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <span
                            class="inline-block min-w-[2.2rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold text-slate-700">
                            {{ assign.weight || 0 }}
                        </span>

            <button type="button"
                    class="inline-flex max-w-36 items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold shadow-sm transition-colors bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                    @click="toggleMemberEvidence(assign.assignmentId)">
                            <span class="flex min-w-0 items-center gap-1.5">
                                <i class="fas fa-file-alt shrink-0 text-xs"/>
                                <span class="truncate">Mock Evidence</span>
                            </span>
              <i class="fas fa-chevron-down shrink-0 text-[10px] text-slate-400 transition-transform"
                 :class="isMemberEvidenceOpen(assign.assignmentId) ? 'rotate-180' : ''"/>
            </button>

            <span
                class="inline-block min-w-10 rounded-lg bg-slate-100 px-2 py-1.5 text-center text-sm font-bold text-slate-700">
                            {{ assign.endSelfScore ?? 0 }}
                        </span>
          </div>
        </div>

        <div v-show="isMemberEvidenceOpen(assign.assignmentId)"
             class="border-t px-5 py-3 border-purple-100 bg-purple-50/40">
          <p class="mb-2 flex items-center gap-1.5 text-xs font-bold text-purple-900">
            <i class="fas fa-star text-xs"/>
            Mock Evidence Detail Title
          </p>
          <div class="overflow-x-auto rounded-lg border border-purple-200">
            <table class="w-full text-xs">
              <thead>
              <tr class="border-b border-purple-200 bg-purple-50 text-purple-900">
                <th class="px-3 py-2 font-bold text-left">Mock Header 1</th>
                <th class="px-3 py-2 font-bold text-left">Mock Header 2</th>
              </tr>
              </thead>
              <tbody class="bg-white">
              <tr class="border-b border-slate-100">
                <td class="px-3 py-2 text-slate-700">Mock Data Row 1 Col 1</td>
                <td class="px-3 py-2 text-slate-700">Mock Data Row 1 Col 2</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <div class="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between text-sm mt-auto">
      <span class="font-bold text-slate-700">Tổng trọng số Promotion:</span>
      <span class="font-bold text-slate-900">{{ totalWeight }} pts</span>
    </div>
  </div>
</template>