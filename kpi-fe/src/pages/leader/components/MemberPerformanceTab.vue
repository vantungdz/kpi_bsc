<script setup lang="ts">
import { reactive } from "vue";
import type { LeaderTeamMember } from "@/types/kpi";
import {
    type TeamMemberKpiPanelGroup,
} from "@/mocks/leaderDashboard.mock";

const props = defineProps<{
    member: LeaderTeamMember;
    groups: TeamMemberKpiPanelGroup[];
}>();

// Quản lý trạng thái mở/đóng evidence cục bộ trong tab này
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
            <div class="sticky top-0 z-10 bg-amber-50/80 border-y border-amber-100 px-5 py-2">
                <p class="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    {{ group.label }}
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
                                <p v-if="row.certificateOutcomeNote"
                                    class="mt-1.5 max-w-md rounded border border-indigo-100 bg-indigo-50/90 px-2 py-1 text-[10px] font-medium leading-snug text-indigo-900 line-clamp-2">
                                    <i class="fas fa-certificate mr-1 shrink-0 text-indigo-500" />
                                    {{ row.certificateOutcomeNote }}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <span
                            class="inline-block min-w-[2.2rem] rounded-lg bg-slate-100 px-2 py-1 text-center text-sm font-bold text-slate-700">
                            {{ row.weight.toFixed(1) }}
                        </span>
                        <button type="button"
                            class="inline-flex max-w-[9rem] items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold shadow-sm transition-colors"
                            :class="row.evidenceTone === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'"
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

                <div v-show="isMemberEvidenceOpen(row.lineId)" class="border-t px-5 py-3"
                    :class="row.evidenceDetail.accent === 'emerald' ? 'border-emerald-100 bg-emerald-50/40' : 'border-indigo-100 bg-indigo-50/40'">
                    <p class="mb-2 flex items-center gap-1.5 text-xs font-bold"
                        :class="row.evidenceDetail.accent === 'emerald' ? 'text-emerald-900' : 'text-indigo-900'">
                        <i :class="[row.evidenceDetail.titleIcon, 'text-xs']" />
                        {{ row.evidenceDetail.title }}
                    </p>
                    <div class="overflow-x-auto rounded-lg border"
                        :class="row.evidenceDetail.accent === 'emerald' ? 'border-emerald-200' : 'border-indigo-200'">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="border-b"
                                    :class="row.evidenceDetail.accent === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-indigo-200 bg-indigo-50 text-indigo-900'">
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
            <span class="font-bold text-slate-700">Tổng trọng số:</span>
            <span class="font-bold text-slate-900">160 pts</span>
        </div>

        <div class="border-t border-slate-200 bg-white px-5 py-4 pb-8">
            <h3 class="mb-3 text-sm font-bold text-slate-800 flex items-center gap-2">
                <i class="fas fa-comments text-blue-500" /> Nhận xét
            </h3>
            <div class="space-y-3">
                <div>
                    <label class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Nhân
                        viên</label>
                    <div
                        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 italic">
                        Chưa có nhận xét.</div>
                </div>
                <div>
                    <label
                        class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Supervisor</label>
                    <div
                        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 italic">
                        Chưa có nhận xét.</div>
                </div>
            </div>
        </div>
    </div>
</template>