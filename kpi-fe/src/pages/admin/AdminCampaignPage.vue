<script setup lang="ts">
/**
 * AdminCampaignPage.vue
 * Trang Quản lý Chiến dịch Đánh giá KPI — chuyển đổi từ a1.html
 */
import { ref, computed } from "vue";
import { isAxiosError } from "axios";
import { adminKpiService } from "@/services/modules/kpi-admin.service";
import type {
  Campaign,
  CampaignPeriod,
  Employee,
  EmployeeProgress,
  EmailTemplate,
  Section,
} from "@/mocks/admin.mock";
import type {
  NotifyPhase,
  NotifyRecipientType,
} from "@/services/modules/kpi-admin.service";

const PHASE_OPTIONS: { value: NotifyPhase; label: string }[] = [
  { value: "goal_setting", label: "Thiết lập mục tiêu (Setting)" },
  { value: "mid_year", label: "Đánh giá 1H (1st Half)" },
  { value: "end_year", label: "Đánh giá 2H (2nd Half)" },
];

const RECIPIENT_OPTIONS: { value: NotifyRecipientType; label: string }[] = [
  { value: "all", label: "Toàn công ty" },
  { value: "individual", label: "Cá nhân" },
  { value: "department", label: "Bộ phận" },
];

// ── State ──────────────────────────────────────────────────────────────────────

const campaigns = ref<Campaign[]>([]);
const employeeProgress = ref<EmployeeProgress[]>([]);
const allEmployees = ref<Employee[]>([]);
const sections = ref<Section[]>([]);
const selectedPeriod = ref<CampaignPeriod>("current");
const searchText = ref("");
const statusFilter = ref("all");
const selectedRows = ref<Set<string>>(new Set());
const showRemindModal = ref(false);
const remindTarget = ref("");
const remindTargetId = ref("");
const remindTargetEmail = ref("");
const remindReason = ref("");
const isSending = ref(false);
const toastMsg = ref("");
const showToast = ref(false);
const loading = ref(false);
const emailTemplates = ref<EmailTemplate[]>([]);
const announceResourcesLoading = ref(false);
const announceLoadError = ref("");

/** Phát hành thông báo — form chính */
const notifyPhase = ref<NotifyPhase>("goal_setting");
const notifyTemplateId = ref("");
const notifyRecipientScope = ref<NotifyRecipientType>("all");
const announceMemberIds = ref<Set<string>>(new Set());
const announceDeptIds = ref<Set<string>>(new Set());
const announceMemberSearch = ref("");

// ── Init ───────────────────────────────────────────────────────────────────────

function loadErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = err.response?.data;
    if (msg && typeof msg === "object" && "message" in msg) {
      const m = (msg as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
    if (typeof err.message === "string" && err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

const loadAnnounceResources = async () => {
  announceResourcesLoading.value = true;
  announceLoadError.value = "";
  const errors: string[] = [];
  const [tplRes, empRes, sectionRes] = await Promise.allSettled([
    adminKpiService.getEmailTemplates(),
    adminKpiService.getEmployees(),
    adminKpiService.getSections(),
  ]);
  if (tplRes.status === "fulfilled") {
    emailTemplates.value = tplRes.value ?? [];
    pickDefaultTemplate();
  } else {
    errors.push(
      `mẫu email: ${loadErrorMessage(tplRes.reason, "không tải được")}`,
    );
  }
  if (empRes.status === "fulfilled") {
    allEmployees.value = empRes.value ?? [];
  } else {
    errors.push(
      `nhân viên: ${loadErrorMessage(empRes.reason, "không tải được")}`,
    );
  }
  if (sectionRes.status === "fulfilled") {
    sections.value = sectionRes.value ?? [];
  } else {
    errors.push(
      `bộ phận: ${loadErrorMessage(sectionRes.reason, "không tải được")}`,
    );
  }
  if (errors.length > 0) {
    announceLoadError.value = errors.join("; ");
    triggerToast(`Không tải đủ dữ liệu phát hành (${announceLoadError.value}).`);
  }
  announceResourcesLoading.value = false;
};

const init = async () => {
  loading.value = true;
  const [campaignRes, progressRes] = await Promise.allSettled([
    adminKpiService.getCampaigns(),
    adminKpiService.getEmployeeProgress(selectedPeriod.value),
  ]);
  if (campaignRes.status === "fulfilled") {
    campaigns.value = campaignRes.value ?? [];
  } else {
    triggerToast(
      loadErrorMessage(campaignRes.reason, "Không tải được danh sách chiến dịch."),
    );
  }
  if (progressRes.status === "fulfilled") {
    employeeProgress.value = progressRes.value ?? [];
  } else {
    triggerToast(
      loadErrorMessage(progressRes.reason, "Không tải được tiến độ nhân viên."),
    );
  }
  loading.value = false;
  await loadAnnounceResources();
};
init();

// ── Computed ───────────────────────────────────────────────────────────────────

const currentCampaign = computed(() =>
  campaigns.value.find((c) => c.period === selectedPeriod.value),
);

const isPast = computed(() => selectedPeriod.value.startsWith("past"));
const isActive = computed(() => !isPast.value);

const currentStats = computed(
  () =>
    currentCampaign.value?.stats ?? {
      total: 0,
      completed: 0,
      pending: 0,
      notStarted: 0,
      overdue: 0,
    },
);

const filteredProgress = computed(() => {
  let rows = employeeProgress.value;
  if (searchText.value) {
    const q = searchText.value.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }
  if (statusFilter.value !== "all") {
    rows = rows.filter((r) => r.status === statusFilter.value);
  }
  return rows;
});

const checkedCount = computed(() => selectedRows.value.size);

const activeEmailTemplates = computed(() =>
  emailTemplates.value.filter((t) => t.status === "active"),
);

const templateOptionsForAnnounce = computed(() => {
  const active = emailTemplates.value.filter((t) => t.status === "active");
  const inactive = emailTemplates.value.filter((t) => t.status !== "active");
  return [...active, ...inactive];
});

const allSelectableChecked = computed(
  () =>
    selectableRows.value.length > 0 &&
    selectableRows.value.every((id) => selectedRows.value.has(id)),
);

const selectableRows = computed(() =>
  filteredProgress.value
    .filter((r) => r.status !== "completed")
    .map((r) => r.id),
);

const selectedNotifyTemplate = computed(() =>
  activeEmailTemplates.value.find((t) => t.id === notifyTemplateId.value),
);

const activeEmployeesForAnnounce = computed(() =>
  allEmployees.value.filter((e) => e.status === "active"),
);

const filteredAnnounceMembers = computed(() => {
  const q = announceMemberSearch.value.trim().toLowerCase();
  if (!q) return activeEmployeesForAnnounce.value;
  return activeEmployeesForAnnounce.value.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q),
  );
});

const allMembersSelected = computed(
  () =>
    filteredAnnounceMembers.value.length > 0 &&
    filteredAnnounceMembers.value.every((e) =>
      announceMemberIds.value.has(e.id),
    ),
);

const allDeptsSelected = computed(
  () =>
    sections.value.length > 0 &&
    sections.value.every((s) => announceDeptIds.value.has(s.id)),
);

const announceRecipientSummary = computed(() => {
  if (notifyRecipientScope.value === "all") {
    return `Toàn công ty (${activeEmployeesForAnnounce.value.length} nhân viên active)`;
  }
  if (notifyRecipientScope.value === "individual") {
    return `${announceMemberIds.value.size} nhân viên đã chọn`;
  }
  return `${announceDeptIds.value.size} bộ phận đã chọn`;
});

const handlePeriodChange = async () => {
  selectedRows.value.clear();
  loading.value = true;
  try {
    employeeProgress.value = await adminKpiService.getEmployeeProgress(
      selectedPeriod.value,
    );
  } finally {
    loading.value = false;
  }
};

const toggleAll = (checked: boolean) => {
  if (checked) {
    selectableRows.value.forEach((id) => selectedRows.value.add(id));
  } else {
    selectedRows.value.clear();
  }
};

const toggleRow = (id: string, completed: boolean) => {
  if (completed) return;
  if (selectedRows.value.has(id)) {
    selectedRows.value.delete(id);
  } else {
    selectedRows.value.add(id);
  }
};

function pickDefaultTemplate() {
  const first = activeEmailTemplates.value[0];
  notifyTemplateId.value = first?.id ?? "";
}

const onRecipientScopeChange = () => {
  announceMemberIds.value.clear();
  announceDeptIds.value.clear();
};

const toggleAnnounceMember = (id: string) => {
  if (announceMemberIds.value.has(id)) announceMemberIds.value.delete(id);
  else announceMemberIds.value.add(id);
};

const toggleAllAnnounceMembers = (checked: boolean) => {
  if (checked) {
    filteredAnnounceMembers.value.forEach((e) =>
      announceMemberIds.value.add(e.id),
    );
  } else {
    filteredAnnounceMembers.value.forEach((e) =>
      announceMemberIds.value.delete(e.id),
    );
  }
};

const toggleAnnounceDept = (id: string) => {
  if (announceDeptIds.value.has(id)) announceDeptIds.value.delete(id);
  else announceDeptIds.value.add(id);
};

const toggleAllAnnounceDepts = (checked: boolean) => {
  if (checked) sections.value.forEach((s) => announceDeptIds.value.add(s.id));
  else announceDeptIds.value.clear();
};

const sendAnnouncement = async () => {
  if (!currentCampaign.value?.id) {
    alert("Không xác định được chiến dịch hiện tại.");
    return;
  }
  if (!notifyPhase.value) {
    alert("Vui lòng chọn giai đoạn đánh giá.");
    return;
  }
  if (notifyRecipientScope.value === "individual" && announceMemberIds.value.size === 0) {
    alert("Vui lòng chọn ít nhất một nhân viên.");
    return;
  }
  if (notifyRecipientScope.value === "department" && announceDeptIds.value.size === 0) {
    alert("Vui lòng chọn ít nhất một bộ phận.");
    return;
  }

  isSending.value = true;
  try {
    const opts = {
      phase: notifyPhase.value,
      recipientType: notifyRecipientScope.value,
      emailTemplateId: notifyTemplateId.value || undefined,
      employeeIds:
        notifyRecipientScope.value === "individual"
          ? [...announceMemberIds.value]
          : undefined,
      departmentIds:
        notifyRecipientScope.value === "department"
          ? [...announceDeptIds.value]
          : undefined,
    };
    await adminKpiService.sendMassMail(currentCampaign.value.id, "", opts);
    triggerToast(`Đã gửi thông báo KPI (${announceRecipientSummary.value}).`);
  } finally {
    isSending.value = false;
  }
};

/** Mở modal remind cho một nhân viên cụ thể */
const openSingleRemindModal = (row: EmployeeProgress) => {
  remindTarget.value = row.name;
  remindTargetId.value = row.id;
  remindTargetEmail.value = row.email;
  remindReason.value = statusBadge(row.status).label;
  showRemindModal.value = true;
};

const closeModals = () => {
  showRemindModal.value = false;
};

const executeRemindMail = async () => {
  if (isSending.value) return;
  isSending.value = true;
  closeModals();
  try {
    const campaignId = currentCampaign.value?.id ?? "";
    await adminKpiService.sendRemind(campaignId, remindTargetId.value, "", {
      phase: notifyPhase.value,
      emailTemplateId: notifyTemplateId.value || undefined,
    });
    triggerToast(`Đã gửi email nhắc nhở đến ${remindTarget.value}.`);
  } finally {
    isSending.value = false;
  }
};

const triggerToast = (msg: string) => {
  toastMsg.value = msg;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

// ── Status Helpers ─────────────────────────────────────────────────────────────

const statusBadge = (status: string) =>
  ({
    overdue: {
      cls: "text-red-600 bg-red-50 border border-red-200",
      icon: "fa-exclamation-circle",
      label: "Quá hạn",
      pulse: true,
    },
    not_started: {
      cls: "text-slate-600 bg-slate-100 border border-slate-200",
      icon: "fa-circle",
      label: "Chưa đánh giá",
      pulse: false,
    },
    pending: {
      cls: "text-blue-600 bg-blue-50 border border-blue-200",
      icon: "fa-clock",
      label: "Chờ PM Duyệt",
      pulse: false,
    },
    completed: {
      cls: "text-green-700 bg-green-100 border border-green-300",
      icon: "fa-check-circle",
      label: "Hoàn tất",
      pulse: false,
    },
  })[status] ?? { cls: "", icon: "", label: status, pulse: false };

const remindBtnCls = (status: string) =>
  ({
    overdue: "text-red-600 bg-white border border-red-200 hover:bg-red-50",
    not_started:
      "text-orange-600 bg-white border border-orange-200 hover:bg-orange-50",
    pending: "text-blue-600 bg-white border border-blue-200 hover:bg-blue-50",
  })[status];

const remindBtnLabel = (status: string) =>
  ({
    overdue: "Remind",
    not_started: "Remind",
    pending: "Remind",
  })[status] ?? "";
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- HEADER -->
    <header
      class="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0"
    >
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          Quản lý Chiến dịch Đánh giá KPI
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Điều phối thời gian và nhắc nhở tiến độ toàn công ty
        </p>
      </div>

      <!-- Period Selector -->
      <div class="relative">
        <select
          v-model="selectedPeriod"
          class="appearance-none bg-indigo-50 text-indigo-700 pl-10 pr-10 py-2 rounded-md text-sm font-bold border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors shadow-sm"
          @change="handlePeriodChange"
        >
          <option v-for="c in campaigns" :key="c.period" :value="c.period">
            {{ c.label }}
          </option>
        </select>
        <i
          class="fas fa-calendar text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
        />
        <i
          class="fas fa-chevron-down text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
        />
      </div>
    </header>

    <main class="flex-1 overflow-auto p-8 bg-slate-50/50">
      <div class="max-w-[1400px] mx-auto space-y-6">
        <!-- CAMPAIGN CONTROL PANEL -->
        <div
          class="bg-white rounded-xl p-6 shadow-sm relative overflow-hidden transition-all duration-300 border"
          :class="isPast ? 'border-slate-200 bg-slate-50' : 'border-indigo-100'"
        >
          <div
            class="absolute top-0 left-0 w-1 h-full"
            :class="isPast ? 'bg-slate-300' : 'bg-indigo-500'"
          />

          <!-- Active Campaign Controls -->
          <div v-if="isActive">
            <div class="flex justify-between items-start mb-5">
              <div>
                <h2
                  class="text-lg font-bold text-slate-800 flex items-center mb-1"
                >
                  <i class="fas fa-paper-plane w-5 h-5 mr-2 text-indigo-600" />
                  Phát hành Thông báo Đánh giá KPI
                </h2>
                <p class="text-sm text-slate-500">
                  Chọn giai đoạn, mẫu email và đối tượng nhận để phát hành thông báo
                  đánh giá KPI.
                </p>
              </div>
            </div>

            <div class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Giai đoạn <span class="text-red-500">*</span></label>
                  <select v-model="notifyPhase" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500">
                    <option v-for="p in PHASE_OPTIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Mẫu email</label>
                  <select
                    v-model="notifyTemplateId"
                    class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
                    :disabled="announceResourcesLoading"
                  >
                    <option value="">Mặc định hệ thống</option>
                    <option
                      v-for="t in templateOptionsForAnnounce"
                      :key="t.id"
                      :value="t.id"
                      :disabled="t.status !== 'active'"
                    >
                      {{ t.name }}{{ t.status !== "active" ? " (đã tắt)" : "" }}
                    </option>
                  </select>
                  <p v-if="announceResourcesLoading" class="mt-1 text-xs text-slate-400">Đang tải mẫu email…</p>
                  <p v-else-if="emailTemplates.length === 0" class="mt-1 text-xs text-amber-600">
                    Chưa có mẫu email. Tạo tại Quản lý mẫu email hoặc chạy migration V4.
                  </p>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Người nhận <span class="text-red-500">*</span></label>
                  <select v-model="notifyRecipientScope" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500" @change="onRecipientScopeChange">
                    <option v-for="r in RECIPIENT_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
                  </select>
                </div>
              </div>

              <div
                v-if="announceLoadError"
                class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                {{ announceLoadError }}
                <button
                  type="button"
                  class="ml-2 font-semibold text-amber-900 underline"
                  @click="loadAnnounceResources"
                >
                  Thử lại
                </button>
              </div>

              <div v-if="notifyRecipientScope === 'individual'" class="rounded-md border border-slate-200 bg-white p-3">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-xs font-bold uppercase text-slate-500">Chọn nhân viên</span>
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" class="rounded border-slate-300 text-indigo-600" :checked="allMembersSelected" :disabled="announceResourcesLoading || filteredAnnounceMembers.length === 0" @change="toggleAllAnnounceMembers(($event.target as HTMLInputElement).checked)">
                    Chọn tất cả (đang lọc)
                  </label>
                </div>
                <input v-model="announceMemberSearch" type="text" placeholder="Tìm tên, email, mã NV..." class="mb-2 w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500" :disabled="announceResourcesLoading">
                <div class="max-h-48 min-h-[4rem] space-y-1 overflow-y-auto">
                  <p v-if="announceResourcesLoading" class="py-4 text-center text-sm text-slate-400">Đang tải danh sách nhân viên…</p>
                  <p v-else-if="filteredAnnounceMembers.length === 0" class="py-4 text-center text-sm text-slate-500">
                    {{ activeEmployeesForAnnounce.length === 0 ? "Không có nhân viên active." : "Không tìm thấy nhân viên phù hợp." }}
                  </p>
                  <label v-for="emp in filteredAnnounceMembers" :key="emp.id" class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" class="rounded border-slate-300 text-indigo-600" :checked="announceMemberIds.has(emp.id)" @change="toggleAnnounceMember(emp.id)">
                    <span class="font-medium text-slate-800">{{ emp.name }}</span>
                    <span class="text-xs text-slate-400">{{ emp.email }}</span>
                  </label>
                </div>
              </div>

              <div v-else-if="notifyRecipientScope === 'department'" class="rounded-md border border-slate-200 bg-white p-3">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-xs font-bold uppercase text-slate-500">Chọn bộ phận</span>
                  <label class="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" class="rounded border-slate-300 text-indigo-600" :checked="allDeptsSelected" :disabled="announceResourcesLoading || sections.length === 0" @change="toggleAllAnnounceDepts(($event.target as HTMLInputElement).checked)">
                    Chọn tất cả
                  </label>
                </div>
                <div class="max-h-48 min-h-[4rem] space-y-1 overflow-y-auto">
                  <p v-if="announceResourcesLoading" class="py-4 text-center text-sm text-slate-400">Đang tải danh sách bộ phận…</p>
                  <p v-else-if="sections.length === 0" class="py-4 text-center text-sm text-slate-500">Không có bộ phận nào.</p>
                  <label v-for="sec in sections" :key="sec.id" class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" class="rounded border-slate-300 text-indigo-600" :checked="announceDeptIds.has(sec.id)" @change="toggleAnnounceDept(sec.id)">
                    <span class="font-medium text-slate-800">{{ sec.name }}</span>
                  </label>
                </div>
              </div>

              <div v-else class="rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm text-indigo-800">
                <i class="fas fa-users mr-2" />
                Email sẽ gửi tới toàn bộ nhân viên đang active trong hệ thống.
              </div>

              <div class="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <span class="text-xs font-bold uppercase text-slate-400">Tóm tắt: </span>{{ announceRecipientSummary }}
              </div>

              <div class="flex justify-end">
                <button type="button" class="flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60" :disabled="isSending" @click="sendAnnouncement">
                  <i :class="isSending ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'" class="mr-2" />
                  {{ isSending ? 'Đang gửi...' : 'Gửi thông báo' }}
                </button>
              </div>
            </div>
          </div>
          <!-- Archived Campaign -->
          <div v-else class="flex items-center space-x-4">
            <div
              class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center"
            >
              <i class="fas fa-archive text-slate-500 text-lg" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-700">
                Chiến dịch Đánh giá đã đóng băng
              </h2>
              <p class="text-sm text-slate-500 mt-1">
                Dữ liệu của năm đánh giá này đã được lưu trữ (Archived) thành
                công. Không thể thiết lập thời gian hay gửi mail thông báo cho
                kỳ này nữa.
              </p>
            </div>
          </div>
        </div>

        <!-- PROGRESS SUMMARY STATS -->
        <div class="grid grid-cols-5 gap-4">
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
          >
            <div
              class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1"
            >
              Tổng Nhân sự
            </div>
            <div class="text-2xl font-black text-slate-800">
              {{ currentStats.total }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-green-500"
          >
            <div
              class="text-xs font-bold text-green-600 uppercase tracking-wider mb-1"
            >
              Đã Hoàn tất
            </div>
            <div class="text-2xl font-black text-slate-700">
              {{ currentStats.completed }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500"
          >
            <div
              class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1"
            >
              Chờ PM Duyệt
            </div>
            <div class="text-2xl font-black text-slate-700">
              {{ currentStats.pending }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-slate-400"
          >
            <div
              class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1"
            >
              Chưa đánh giá
            </div>
            <div class="text-2xl font-black text-slate-700">
              {{ currentStats.notStarted }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500 relative overflow-hidden"
          >
            <div
              class="absolute -right-2 -top-2 w-12 h-12 bg-red-50 rounded-full flex items-center justify-center"
            >
              <i class="fas fa-exclamation-circle text-red-200" />
            </div>
            <div
              class="text-xs font-bold text-red-600 uppercase tracking-wider mb-1 relative z-10"
            >
              Quá hạn nộp
            </div>
            <div class="text-2xl font-black text-red-600 relative z-10">
              {{ currentStats.overdue }}
            </div>
          </div>
        </div>

        <!-- EMPLOYEE PROGRESS TABLE -->
        <div
          class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <!-- Toolbar -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/50 px-5 py-4"
          >
            <div class="flex items-center space-x-3">
              <h2
                class="font-bold text-slate-800 text-sm uppercase tracking-wider"
              >
                Danh sách Tiến độ Nhân sự
              </h2>
              <span
                class="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded"
              >
                {{ currentStats.total }} Records
              </span>
            </div>

            <div
              class="flex items-center space-x-3 transition-all"
              :class="isPast ? 'opacity-50 pointer-events-none' : ''"
            >
              <!-- Search -->
              <div class="relative">
                <i
                  class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                />
                <input
                  v-model="searchText"
                  type="text"
                  placeholder="Tìm NV, Email..."
                  class="pl-9 pr-4 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 w-56 bg-white"
                />
              </div>

              <!-- Status Filter -->
              <select
                v-model="statusFilter"
                class="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Lọc: Tất cả Trạng thái</option>
                <option value="overdue">Quá hạn nộp</option>
                <option value="not_started">Chưa đánh giá</option>
                <option value="pending">Chờ PM Duyệt</option>
              </select>

              <button
                v-if="isActive && checkedCount > 0"
                type="button"
                class="flex items-center rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                @click="openSelectedMassMailModal"
              >
                <i class="fas fa-envelope-open-text mr-1.5 text-xs" />
                Gửi mail ({{ checkedCount }} đã chọn)
              </button>
            </div>
          </div>

          <div
            class="min-h-0 max-h-[38rem] overflow-y-auto overscroll-y-contain"
            aria-label="Danh sách tiến độ nhân sự — cuộn khi quá khoảng 10 dòng"
          >
            <table class="w-full border-collapse text-left">
              <thead
                class="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm"
              >
                <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th v-if="isActive" class="w-10 p-4 text-center">
                    <input
                      type="checkbox"
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      :checked="allSelectableChecked"
                      :disabled="selectableRows.length === 0"
                      @change="toggleAll(($event.target as HTMLInputElement).checked)"
                    >
                  </th>
                  <th class="w-[25%] p-4">Nhân viên / Email</th>
                  <th class="w-[20%] p-4">Phòng ban (Section)</th>
                  <th class="w-[20%] p-4 text-center">Trạng thái (Status)</th>
                  <th class="p-4 text-center">Cập nhật cuối</th>
                  <th v-if="isActive" class="w-32 p-4 text-center">Thao tác</th>
                </tr>
            </thead>

            <!-- Skeleton loading -->
            <tbody v-if="loading" class="divide-y divide-slate-100">
              <tr v-for="i in 4" :key="i" class="animate-pulse">
                <td class="p-4">
                  <div class="h-4 bg-slate-200 rounded w-40" />
                </td>
                <td class="p-4">
                  <div class="h-4 bg-slate-200 rounded w-28" />
                </td>
                <td class="p-4 text-center">
                  <div class="h-6 bg-slate-200 rounded-full w-24 mx-auto" />
                </td>
                <td class="p-4">
                  <div class="h-4 bg-slate-200 rounded w-20 mx-auto" />
                </td>
                <td v-if="isActive" class="p-4" />
              </tr>
            </tbody>

            <!-- Active period rows -->
            <tbody v-else-if="isActive" class="divide-y divide-slate-100">
              <tr
                v-for="row in filteredProgress"
                :key="row.id"
                class="hover:bg-slate-50 transition-colors group"
                :class="row.status === 'overdue' ? 'bg-red-50/10' : ''"
              >
                <td v-if="isActive" class="p-4 text-center">
                  <input
                    v-if="row.status !== 'completed'"
                    type="checkbox"
                    class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    :checked="selectedRows.has(row.id)"
                    @change="toggleRow(row.id, row.status === 'completed')"
                  >
                </td>
                <td
                  class="p-4"
                  :class="row.status === 'completed' ? 'opacity-75' : ''"
                >
                  <div class="flex items-center">
                    <div
                      class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mr-3 shrink-0"
                    >
                      <i class="fas fa-user text-slate-400 text-sm" />
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 text-sm">
                        {{ row.name }}
                      </div>
                      <div class="text-[10px] text-slate-500">
                        {{ row.email }}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  class="p-4"
                  :class="row.status === 'completed' ? 'opacity-75' : ''"
                >
                  <div class="text-sm font-semibold text-slate-700">
                    {{ row.section }}
                  </div>
                  <div
                    class="text-[10px] text-slate-400 uppercase tracking-wider"
                  >
                    {{ row.division }}
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase"
                    :class="[
                      statusBadge(row.status).cls,
                      statusBadge(row.status).pulse ? 'animate-pulse' : '',
                    ]"
                  >
                    <i
                      :class="`fas ${statusBadge(row.status).icon} w-3 mr-1 text-xs`"
                    />
                    {{ statusBadge(row.status).label }}
                  </span>
                </td>
                <td
                  class="p-4 text-center text-xs text-slate-500"
                  :class="!row.lastUpdate ? 'italic' : ''"
                >
                  {{ row.lastUpdate ?? "Chưa đăng nhập" }}
                </td>
                <td class="p-4 text-center">
                  <button
                    v-if="row.status !== 'completed'"
                    class="text-xs font-bold px-3 py-1.5 rounded shadow-sm w-full transition-colors flex items-center justify-center"
                    :class="remindBtnCls(row.status)"
                    @click="openSingleRemindModal(row)"
                  >
                    <i class="fas fa-bell-ring mr-1.5 text-xs" />
                    {{ remindBtnLabel(row.status) }}
                  </button>
                  <button
                    v-else
                    disabled
                    class="text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded w-full cursor-not-allowed"
                  >
                    Đã nộp
                  </button>
                </td>
              </tr>
            </tbody>

            <!-- Past period rows (archived) -->
            <tbody v-else class="divide-y divide-slate-100">
              <tr
                v-for="row in filteredProgress"
                :key="row.id"
                class="hover:bg-slate-50 transition-colors"
              >
                <td class="p-4 opacity-75">
                  <div class="flex items-center">
                    <div>
                      <div class="font-bold text-slate-800 text-sm">
                        {{ row.name }}
                      </div>
                      <div class="text-[10px] text-slate-500">
                        {{ row.email }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="p-4 opacity-75">
                  <div class="text-sm font-semibold text-slate-700">
                    {{ row.section }}
                  </div>
                  <div
                    class="text-[10px] text-slate-400 uppercase tracking-wider"
                  >
                    {{ row.division }}
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="inline-flex items-center text-[10px] font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-1 rounded-full uppercase"
                  >
                    <i class="fas fa-check-circle w-3 mr-1 text-xs" /> Đã đóng
                    KPI (Lưu trữ)
                  </span>
                </td>
                <td class="p-4 text-center text-xs text-slate-500 font-medium">
                  {{ row.lastUpdate }}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- ── MODAL: REMIND ──────────────────────────────────────────────────────── -->
  <Transition name="modal">
    <div
      v-if="showRemindModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        @click="closeModals"
      />
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-xl z-10 overflow-hidden flex flex-col border-t-4 border-t-orange-500"
      >
        <div
          class="px-6 py-4 border-b border-slate-200 flex justify-between items-center"
        >
          <h3 class="font-bold text-lg text-slate-800 flex items-center">
            <i class="fas fa-bell mr-2 text-orange-500" /> Gửi Email Nhắc nhở
            (Remind)
          </h3>
          <button
            class="text-slate-400 hover:text-slate-600"
            @click="closeModals"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Mẫu email</label>
            <select
              v-model="notifyTemplateId"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Mặc định hệ thống</option>
              <option v-for="t in activeEmailTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <!-- Người nhận -->
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Người nhận
            </p>
            <div class="bg-white border border-slate-200 rounded-md px-3 py-2 flex items-center space-x-2">
              <i class="fas fa-user text-orange-500 text-sm" />
              <span class="font-semibold text-slate-800 text-sm">{{ remindTarget }}</span>
              <span class="text-slate-400 text-xs">·</span>
              <span class="text-indigo-600 text-xs font-mono">{{ remindTargetEmail }}</span>
            </div>
          </div>
          <!-- Nội dung preview -->
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Nội dung Email (Preview)
            </p>
            <div
              class="bg-orange-50 border border-orange-100 p-4 rounded text-sm text-slate-700 italic leading-relaxed"
            >
              "Kính gửi <strong class="text-slate-800 not-italic">{{ remindTarget }}</strong>,
              hệ thống ghi nhận bạn đang ở trạng thái
              <strong class="text-red-600 not-italic">{{ remindReason }}</strong>
              trong kỳ đánh giá KPI <strong class="text-slate-800 not-italic">{{ currentCampaign?.label ?? 'hiện tại' }}</strong>.
              Vui lòng đăng nhập vào hệ thống và hoàn thành ngay lập tức."
            </div>
          </div>
        </div>
        <div
          class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3"
        >
          <button
            class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            @click="closeModals"
          >
            Hủy
          </button>
          <button
            class="px-4 py-2 text-sm font-bold text-white bg-orange-500 rounded-md hover:bg-orange-600 shadow-sm flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="isSending"
            @click="executeRemindMail()"
          >
            <i v-if="isSending" class="fas fa-spinner fa-spin mr-2" />
            <i v-else class="fas fa-paper-plane mr-2" />
            {{ isSending ? "Đang gửi..." : "Gửi Remind" }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── TOAST ─────────────────────────────────────────────────────────────── -->
  <Transition name="toast">
    <div
      v-if="showToast"
      class="fixed top-5 right-5 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center z-50"
    >
      <i class="fas fa-check-circle mr-3 text-green-400" />
      <span class="text-sm font-medium">{{ toastMsg }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 0.3s;
}
.toast-enter-from,
.toast-leave-to {
  transform: translateX(120%);
}
</style>
