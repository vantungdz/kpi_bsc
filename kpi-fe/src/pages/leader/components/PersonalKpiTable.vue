<script setup lang="ts">
import { computed } from "vue";

// Khai báo Props
const props = defineProps<{
    rows: any[]; // LeaderMyKpiDisplayRow[]
    totals: {
        totalWeight: number;
        weightedSelfPoints: number;
        averageScore: number;
        averagePmScore: number | null;
    };
    isReadonly: boolean;
    selfScores: Record<string, number>;
    employeeComment: string;
    supervisorComment: string;
}>();

const emit = defineEmits<{
    (e: "update:employeeComment", value: string): void;
    (e: "open-drawer", row: any): void;
    (e: "submit"): void;
}>();

// Dùng computed để v-model với textarea
const localEmployeeComment = computed({
    get: () => props.employeeComment,
    set: (val) => emit("update:employeeComment", val),
});

// Helper functions (mang từ Dashboard sang)
const LEADER_EVALUATION_STATUS_UI: Record<string, any> = {
    not_started: { dot: "bg-slate-300 ring-2 ring-slate-100", chip: "border-slate-200 bg-slate-50 text-slate-800", labelVi: "Chưa đánh giá" },
    pending_approval: { dot: "bg-amber-400 ring-2 ring-amber-100", chip: "border-amber-200 bg-amber-50 text-amber-950", labelVi: "Chờ duyệt" },
    approved: { dot: "bg-emerald-500 ring-2 ring-emerald-100", chip: "border-emerald-200 bg-emerald-50 text-emerald-950", labelVi: "Đã duyệt" },
    revision: { dot: "bg-orange-500 ring-2 ring-orange-100", chip: "border-orange-200 bg-orange-50 text-orange-950", labelVi: "Cần làm lại" },
    overdue: { dot: "bg-rose-600 ring-2 ring-rose-100", chip: "border-rose-200 bg-rose-50 text-rose-950", labelVi: "Quá hạn" },
};

function leaderEvalUi(s: string) {
    return LEADER_EVALUATION_STATUS_UI[s] || LEADER_EVALUATION_STATUS_UI["not_started"];
}

function actionBtnClass() {
    return "w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mx-auto";
}

function actionIcon() {
    return "fas fa-pen";
}
</script>

<template>
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        :class="isReadonly ? 'opacity-95' : ''">
        <table class="w-full text-left border-collapse text-sm">
            <thead>
                <tr
                    class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th class="p-4 w-12 text-center">#</th>
                    <th class="p-4 w-1/4 min-w-[180px]">Hạng mục (Objectives)</th>
                    <th class="p-4 w-1/4 min-w-[160px]">Chỉ tiêu (Target)</th>
                    <th class="p-4 text-center">Trọng số</th>
                    <th class="p-4 text-center">Trạng Thái</th>
                    <th class="p-4 text-center">Self Score</th>
                    <th class="p-4 text-center">PM Score</th>
                    <th class="p-4 text-center">Thao tác</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                <tr class="bg-slate-50/50">
                    <td colspan="8" class="p-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Click vào nút Thao tác bên phải để xem các Layout Case khác nhau
                    </td>
                </tr>
                <template v-for="row in rows" :key="row.lineId">
                    <tr v-if="row.groupBanner" class="bg-amber-50/80 border border-amber-100">
                        <td colspan="8" class="p-3 text-xs font-bold text-amber-800 uppercase tracking-wider">{{
                            row.groupBanner }}</td>
                    </tr>
                    <tr class="hover:bg-slate-50 transition-colors group">
                        <td class="p-4 text-center text-sm font-medium text-slate-400">{{ row.index }}</td>
                        <td class="p-4">
                            <div class="font-bold text-slate-800 text-sm">{{ row.title }}</div>
                            <div class="text-xs text-slate-500 mt-0.5">Mã: {{ row.code }}</div>
                            <p v-if="row.certificateOutcomeNote"
                                class="mt-1.5 max-w-md rounded border border-indigo-100 bg-indigo-50/90 px-2 py-1 text-[10px] font-medium leading-snug text-indigo-900 line-clamp-2"
                                :title="row.certificateOutcomeNote">
                                <i class="fas fa-certificate mr-1 shrink-0 text-indigo-500" />
                                Thực tế: {{ row.certificateOutcomeNote }}
                            </p>
                        </td>
                        <td class="p-4">
                            <div class="font-semibold text-slate-700 text-sm">{{ row.targetSummary }}</div>
                            <div class="text-xs text-slate-500 mt-0.5">{{ row.targetHint }}</div>
                        </td>
                        <td class="p-4 text-center">
                            <span class="bg-slate-100 px-2 py-1 rounded text-sm font-medium">{{ row.weight.toFixed(1)
                                }}</span>
                        </td>
                        <td class="p-4 text-center align-middle">
                            <div class="mx-auto inline-flex max-w-[10rem] flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-center shadow-sm"
                                :class="leaderEvalUi(row.evaluationStatus).chip">
                                <span
                                    class="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold leading-tight">
                                    <span class="h-2 w-2 shrink-0 rounded-full"
                                        :class="leaderEvalUi(row.evaluationStatus).dot" aria-hidden="true" />
                                    {{ leaderEvalUi(row.evaluationStatus).labelVi }}
                                </span>
                            </div>
                        </td>
                        <td class="p-4 text-center">
                            <select v-model.number="selfScores[row.code]"
                                class="max-w-[5rem] cursor-pointer rounded-lg border px-2 py-1.5 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                                :class="isReadonly ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-amber-400 bg-amber-50/50 text-slate-900 hover:border-amber-500'"
                                :disabled="isReadonly">
                                <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                            </select>
                        </td>
                        <td class="p-4 text-center text-sm font-semibold text-slate-800">
                            {{ row.pmScore != null ? row.pmScore.toFixed(2) : "—" }}
                        </td>
                        <td class="p-4 text-center">
                            <button type="button" :class="actionBtnClass()"
                                :title="row.caseType === 'monthly' ? 'Quản lý bằng chứng' : 'Upload bằng chứng'"
                                @click="emit('open-drawer', row)">
                                <i :class="[actionIcon(), 'text-sm']" />
                            </button>
                        </td>
                    </tr>
                </template>
                <tr class="border-t-2 border-slate-200 bg-slate-50/90">
                    <td colspan="3" class="p-4 text-right text-xs font-bold uppercase tracking-wide text-slate-700">TỔNG
                        CỘNG (TOTAL
                        SCORE):</td>
                    <td class="p-4 text-center text-sm font-bold text-slate-900">
                        {{ totals.totalWeight % 1 === 0 ? totals.totalWeight.toFixed(0) : totals.totalWeight.toFixed(1)
                        }}
                        <span class="text-[11px] font-semibold text-slate-500">pts</span>
                    </td>
                    <td class="p-4 text-center text-slate-400">—</td>
                    <td class="p-4 text-center text-sm font-bold text-slate-900">{{ totals.weightedSelfPoints }}</td>
                    <td class="p-4 text-center text-slate-400">—</td>
                    <td class="p-4 text-center text-slate-400">—</td>
                </tr>
                <tr class="border-t border-violet-100 bg-violet-50/95">
                    <td colspan="3" class="p-4 text-right text-xs font-bold uppercase tracking-wide text-violet-900">
                        ĐIỂM TRUNG BÌNH
                        (AVERAGE SCORE):</td>
                    <td class="p-4 text-center text-slate-400">—</td>
                    <td class="p-4 text-center text-slate-400">—</td>
                    <td class="p-4 text-center text-sm font-bold text-violet-900">{{ totals.averageScore.toFixed(2) }}
                    </td>
                    <td class="p-4 text-center text-sm font-bold text-violet-900">{{ totals.averagePmScore != null ?
                        totals.averagePmScore.toFixed(2) : "—" }}</td>
                    <td class="p-4 text-center text-slate-400">—</td>
                </tr>
            </tbody>
        </table>

        <div class="border-t border-slate-200 bg-slate-50/60 px-5 py-5">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
                <i class="fas fa-comments text-blue-600" />
                Comment of employee and supervisor
            </h3>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Employee's
                        comment</label>
                    <textarea v-model="localEmployeeComment" rows="5" placeholder="Nhập ý kiến của bạn..."
                        class="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        :readonly="isReadonly" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor
                        Comment</label>
                    <textarea :value="supervisorComment" rows="5" placeholder="Supervisor sẽ nhập ý kiến tại đây..."
                        class="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        readonly />
                </div>
            </div>
            <div class="mt-6 flex justify-center">
                <button type="button"
                    class="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isReadonly" @click="emit('submit')">
                    <i class="fas fa-paper-plane text-sm" /> Submit Đánh Giá
                </button>
            </div>
        </div>
    </div>
</template>