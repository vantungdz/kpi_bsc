<script setup lang="ts">
import { reactive } from "vue";
import type { LeaderTeamMember } from "@/types/kpi";
import {
    type TeamMemberKpiPanelGroup,
} from "@/mocks/leaderDashboard.mock";

const props = defineProps<{
    member: LeaderTeamMember;
    groups: TeamMemberKpiPanelGroup[]; // Có thể đổi type sau khi có logic cụ thể cho Promotion
}>();

const openMemberEvidence = reactive<Record<string, boolean>>({});

function toggleMemberEvidence(lineId: string) {
    openMemberEvidence[lineId] = !openMemberEvidence[lineId];
}

function isMemberEvidenceOpen(lineId: string) {
    return !!openMemberEvidence[lineId];
}
</script>

<template>
    <div class="flex flex-col">
        <template v-for="group in groups" :key="group.label">
            <div class="sticky top-0 z-10 bg-violet-50/80 border-y border-violet-100 px-5 py-2">
                <p class="text-xs font-bold text-violet-800 uppercase tracking-wider">
                    {{ group.label }} (Promotion)
                </p>
            </div>

            <div v-for="row in group.rows" :key="row.lineId" class="border-b border-slate-100 bg-white">
                <div class="flex items-start justify-between gap-3 px-5 py-4">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-start gap-2 cursor-pointer" @click="toggleMemberEvidence(row.lineId)">
                            <span class="mt-0.5 shrink-0 text-[10px] font-bold text-slate-400">{{ row.index }}</span>
                            <div>
                                <p class="font-bold text-slate-900 text-sm">{{ row.title }}</p>
                                <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ row.targetLine }}</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <span
                            class="inline-block min-w-[2.2rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold text-slate-700">
                            {{ row.weight.toFixed(1) }}
                        </span>
                        <button type="button"
                            class="inline-flex max-w-[9rem] items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold shadow-sm transition-colors bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                            @click="toggleMemberEvidence(row.lineId)">
                            <span class="flex min-w-0 items-center gap-1.5">
                                <i :class="[row.evidenceIcon, 'shrink-0 text-xs']" />
                                <span class="truncate">{{ row.evidenceLabel }}</span>
                            </span>
                            <i class="fas fa-chevron-down shrink-0 text-[10px] text-slate-400 transition-transform"
                                :class="isMemberEvidenceOpen(row.lineId) ? 'rotate-180' : ''" />
                        </button>
                        <span
                            class="inline-block min-w-[2.5rem] rounded-lg bg-slate-100 px-2 py-1.5 text-center text-sm font-bold text-slate-700">
                            {{ row.selfScore != null ? row.selfScore : "—" }}
                        </span>
                    </div>
                </div>

                <div v-show="isMemberEvidenceOpen(row.lineId)"
                    class="border-t px-5 py-3 border-purple-100 bg-purple-50/40">
                    <p class="mb-2 flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <i :class="[row.evidenceDetail.titleIcon, 'text-xs']" />
                        {{ row.evidenceDetail.title }}
                    </p>
                    <div class="overflow-x-auto rounded-lg border border-purple-200">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="border-b border-purple-200 bg-purple-50 text-purple-900">
                                    <th v-for="(h, hi) in row.evidenceDetail.headers" :key="hi"
                                        class="px-3 py-2 font-bold text-left">{{ h }}</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white">
                                <tr v-for="(erow, ri) in row.evidenceDetail.rows" :key="ri"
                                    class="border-b border-slate-100">
                                    <td v-for="(cell, ci) in erow" :key="ci" class="px-3 py-2 text-slate-700">{{ cell }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </template>

        <div class="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between text-sm mt-auto">
            <span class="font-bold text-slate-700">Tổng trọng số Promotion:</span>
            <span class="font-bold text-slate-900">100 pts</span>
        </div>
    </div>
</template>