<script setup lang="ts">
// Khai báo Props & Emits
const props = defineProps<{
    members: any[]; // LeaderTeamMember[]
}>();

const emit = defineEmits<{
    (e: "open-member-drawer", member: any): void;
}>();

// Helper functions cho Team Member table
function getTeamMemberInitials(name: string) {
    return name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getProgressColor(pct: number) {
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 50) return "bg-blue-500";
    if (pct >= 30) return "bg-amber-400";
    return "bg-red-400";
}

const SHEET_STATUS_UI: Record<string, { label: string; dot: string; badge: string }> = {
    approved: { label: "Đã duyệt", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    submitted: { label: "Đã nộp", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-800 border-blue-200" },
    draft: { label: "Bản nháp", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-900 border-amber-200" },
};

function getSheetStatusUi(status: string) {
    return SHEET_STATUS_UI[status] ?? { label: status, dot: "bg-slate-400", badge: "bg-slate-50 text-slate-700 border-slate-200" };
}
</script>

<template>
    <div class="overflow-x-auto">
        <table class="w-full text-sm text-left border-collapse">
            <thead>
                <tr
                    class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th class="px-5 py-3">Thành viên</th>
                    <th class="px-5 py-3">Vai trò</th>
                    <th class="px-5 py-3 text-center">Tiến độ KPI</th>
                    <th class="px-5 py-3 text-center">Trạng thái Sheet</th>
                    <th class="px-5 py-3 text-center">Điểm</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                <tr v-for="member in members" :key="member.id"
                    class="cursor-pointer transition-colors hover:bg-slate-50/70"
                    @click="emit('open-member-drawer', member)">
                    <td class="px-5 py-4">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                                {{ getTeamMemberInitials(member.name) }}
                            </div>
                            <div>
                                <p class="font-semibold text-slate-800 text-sm">{{ member.name }}</p>
                                <p class="text-xs text-slate-500">{{ member.rank }}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-5 py-4 text-sm text-slate-600">
                        {{ member.role ?? "—" }}
                    </td>
                    <td class="px-5 py-4 text-center">
                        <div class="flex flex-col items-center gap-1">
                            <div class="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all"
                                    :class="getProgressColor(member.progress ?? 0)"
                                    :style="{ width: `${member.progress ?? 0}%` }" />
                            </div>
                            <span class="text-xs font-semibold text-slate-700">{{ member.progress ?? 0 }}%</span>
                        </div>
                    </td>
                    <td class="px-5 py-4 text-center">
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                            :class="getSheetStatusUi(member.sheetStatus).badge">
                            <span class="h-1.5 w-1.5 rounded-full shrink-0"
                                :class="getSheetStatusUi(member.sheetStatus).dot" />
                            {{ getSheetStatusUi(member.sheetStatus).label }}
                        </span>
                    </td>
                    <td class="px-5 py-4 text-center font-bold text-slate-800">
                        {{ member.score != null ? member.score.toFixed(2) : "—" }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>