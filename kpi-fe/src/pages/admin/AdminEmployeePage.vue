<script setup lang="ts">
/**
 * AdminEmployeePage.vue
 * Trang Quản lý Danh sách Nhân sự — chuyển đổi từ a2.html
 */
import { ref, computed } from "vue";
import { adminKpiService } from "@/services/modules/kpi-admin.service";
import type {
  Employee,
  EmployeeStatus,
  Section,
  RankOption,
} from "@/mocks/admin.mock";

// ── State ──────────────────────────────────────────────────────────────────────

const employees = ref<Employee[]>([]);
const totalSections = ref(4);
const loading = ref(false);
const searchText = ref("");
const statusFilter = ref("all");
const sectionFilter = ref("all");
const rankFilter = ref("all");

// Pagination
const currentPage = ref(1);
const pageSize = 10;

// Drawer
const showDrawer = ref(false);
const drawerMode = ref<"create" | "edit">("create");
const showImportModal = ref(false);
const toastMsg = ref("");
const showToast = ref(false);

// Form state
const formCode = ref("");
const formName = ref("");
const formEmail = ref("");
const formSectionId = ref("");
const formRankCode = ref("R1");
const formStatus = ref<EmployeeStatus>("active");
const formCodeDisabled = ref(false);
const editingId = ref<string | null>(null);

// Dữ liệu dropdown từ DB
const sections = ref<Section[]>([]);
const rankOptions = ref<RankOption[]>([]);

// ── Init ───────────────────────────────────────────────────────────────────────

const init = async () => {
  loading.value = true;
  try {
    const [empResult, secResult, rankResult] = await Promise.allSettled([
      adminKpiService.getEmployees(),
      adminKpiService.getSections(),
      adminKpiService.getRanks(),
    ]);
    if (empResult.status === "fulfilled") {
      employees.value = empResult.value ?? [];
    }
    if (secResult.status === "fulfilled") {
      sections.value = secResult.value ?? [];
    }
    if (rankResult.status === "fulfilled") {
      rankOptions.value = rankResult.value ?? [];
    }
    totalSections.value = new Set(employees.value.map((e) => e.section)).size;
  } catch (err) {
    console.error("[AdminEmployeePage] init error:", err);
  } finally {
    loading.value = false;
  }
};
init();

// ── Computed ───────────────────────────────────────────────────────────────────

const activeCount = computed(
  () => employees.value.filter((e) => e.status !== "inactive").length,
);

const filteredEmployees = computed(() => {
  let list = employees.value;
  if (searchText.value) {
    const q = searchText.value.toLowerCase();
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q),
    );
  }
  if (statusFilter.value !== "all")
    list = list.filter((e) => e.status === statusFilter.value);
  if (sectionFilter.value !== "all")
    list = list.filter((e) => e.section === sectionFilter.value);
  if (rankFilter.value !== "all")
    list = list.filter((e) => e.rank === rankFilter.value);
  return list;
});

const paginatedEmployees = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredEmployees.value.slice(start, start + pageSize);
});

const totalPages = computed(() =>
  Math.ceil(filteredEmployees.value.length / pageSize),
);

const pageNumbers = computed(() => {
  const pages: (number | "...")[] = [];
  const total = totalPages.value;
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage.value > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage.value - 1);
      i <= Math.min(total - 1, currentPage.value + 1);
      i++
    )
      pages.push(i);
    if (currentPage.value < total - 2) pages.push("...");
    pages.push(total);
  }
  return pages;
});

const availableSections = computed(() => [
  ...new Set(employees.value.map((e) => e.section)),
]);

// ── Methods ────────────────────────────────────────────────────────────────────

const openCreateDrawer = () => {
  drawerMode.value = "create";
  formCode.value = "";
  formName.value = "";
  formEmail.value = "";
  formSectionId.value = sections.value[0]?.id ?? "";
  formRankCode.value = "R1";
  formStatus.value = "active";
  formCodeDisabled.value = false;
  editingId.value = null;
  showDrawer.value = true;
};

const openEditDrawer = (emp: Employee) => {
  drawerMode.value = "edit";
  formCode.value = emp.code;
  formName.value = emp.name;
  formEmail.value = emp.email;
  const matchedSection = sections.value.find((s) => s.name === emp.section);
  formSectionId.value = matchedSection?.id ?? sections.value[0]?.id ?? "";
  formRankCode.value = emp.rank ?? "R1";
  formStatus.value = emp.status;
  formCodeDisabled.value = true;
  editingId.value = emp.id;
  showDrawer.value = true;
};

const closeDrawer = () => {
  showDrawer.value = false;
};

const saveEmployee = async () => {
  const payload = {
    code: formCode.value,
    name: formName.value,
    email: formEmail.value,
    sectionId: formSectionId.value,
    rankCode: formRankCode.value,
    status: formStatus.value,
  };

  if (drawerMode.value === "create") {
    await adminKpiService.createEmployee(payload);
    employees.value = await adminKpiService.getEmployees();
    triggerToast("Đã thêm nhân sự mới thành công!");
  } else if (editingId.value) {
    const updated = await adminKpiService.updateEmployee(editingId.value, payload);
    const idx = employees.value.findIndex((e) => e.id === editingId.value);
    if (idx > -1 && updated) employees.value[idx] = updated;
    else employees.value = await adminKpiService.getEmployees();
    triggerToast("Đã cập nhật thông tin nhân viên thành công!");
  }
  closeDrawer();
};

const triggerToast = (msg: string) => {
  toastMsg.value = msg;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

// ── Display Helpers ────────────────────────────────────────────────────────────

const statusBadge = (status: EmployeeStatus) =>
  ({
    active: {
      cls: "bg-green-50 text-green-600 border border-green-200",
      label: "Active",
    },
    inactive: {
      cls: "bg-slate-200 text-slate-500 border border-slate-300",
      label: "Inactive",
    },
  })[status];

const rankBadgeCls = (rank: string) => {
  const r = Number.parseInt(rank.replace("R", ""));
  if (r >= 7) return "bg-indigo-100 text-indigo-700 border border-indigo-200";
  if (r >= 5) return "bg-purple-100 text-purple-700 border border-purple-200";
  return "bg-slate-100 text-slate-600 border border-slate-300";
};

const avatarCls = (status: EmployeeStatus) =>
  ({
    active: "bg-slate-100 text-slate-600 border border-slate-200",
    inactive: "bg-slate-200 text-slate-400 border border-slate-300",
  })[status];

const avatarIcon = (status: EmployeeStatus) =>
  ({
    active: "fa-user",
    inactive: "fa-user-times",
  })[status];

</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- HEADER -->
    <header
      class="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0"
    >
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          Quản lý Danh sách Nhân sự (Master Data)
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Cập nhật thông tin, chức danh và Rank của nhân viên trong Khối IT
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          class="bg-white text-slate-600 border border-slate-300 px-4 py-2 rounded-md text-sm font-bold hover:bg-slate-50 shadow-sm flex items-center transition-colors"
          @click="showImportModal = true"
        >
          <i class="fas fa-file-upload mr-2" /> Import từ Excel
        </button>
        <button
          class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center transition-colors"
          @click="openCreateDrawer"
        >
          <i class="fas fa-user-plus mr-2" /> Thêm Nhân sự
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-auto p-8 bg-slate-50/50">
      <div class="max-w-[1400px] mx-auto space-y-6">
        <!-- SUMMARY CARDS -->
        <div class="grid grid-cols-2 gap-5">
          <div
            class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500"
          >
            <div>
              <div
                class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1"
              >
                Tổng Nhân sự Active
              </div>
              <div class="text-3xl font-black text-slate-800">
                {{ activeCount }}
              </div>
            </div>
            <div
              class="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center"
            >
              <i class="fas fa-users text-xl" />
            </div>
          </div>
          <div
            class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-blue-500"
          >
            <div>
              <div
                class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1"
              >
                Tổng số Section
              </div>
              <div class="text-3xl font-black text-slate-700">
                {{ totalSections }}
              </div>
            </div>
            <div
              class="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center"
            >
              <i class="fas fa-layer-group text-xl" />
            </div>
          </div>
        </div>

        <!-- EMPLOYEE TABLE -->
        <div
          class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <!-- Toolbar / Filters -->
          <div
            class="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center"
          >
            <div class="relative">
              <i
                class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
              />
              <input
                v-model="searchText"
                type="text"
                placeholder="Tìm theo Mã NV, Tên, Email..."
                class="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-72 bg-white"
                @input="currentPage = 1"
              />
            </div>

            <div class="flex items-center space-x-3">
              <select
                v-model="statusFilter"
                class="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500"
                @change="currentPage = 1"
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="active">Đang làm việc (Active)</option>
                <option value="inactive">Đã nghỉ (Inactive)</option>
              </select>
              <select
                v-model="sectionFilter"
                class="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500"
                @change="currentPage = 1"
              >
                <option value="all">Section: Tất cả</option>
                <option v-for="s in availableSections" :key="s" :value="s">
                  {{ s }}
                </option>
              </select>
              <select
                v-model="rankFilter"
                class="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500"
                @change="currentPage = 1"
              >
                <option value="all">Rank: Tất cả</option>
                <option v-for="r in rankOptions" :key="r.code" :value="r.code">
                  {{ r.code }} — {{ r.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr
                  class="bg-white border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                >
                  <th class="p-4 w-28 text-center">Mã NV</th>
                  <th class="p-4 w-[30%]">Thông tin Nhân sự</th>
                  <th class="p-4 w-[20%]">Phòng ban (Section)</th>
                  <th class="p-4 w-[20%]">Rank &amp; Chức danh</th>
                  <th class="p-4 text-center w-24">Trạng thái</th>
                  <th class="p-4 text-center w-24">Thao tác</th>
                </tr>
              </thead>

              <!-- Skeleton loading -->
              <tbody v-if="loading" class="divide-y divide-slate-100">
                <tr v-for="i in 5" :key="i" class="animate-pulse">
                  <td class="p-4">
                    <div class="h-4 bg-slate-200 rounded w-16 mx-auto" />
                  </td>
                  <td class="p-4">
                    <div class="h-4 bg-slate-200 rounded w-40" />
                  </td>
                  <td class="p-4">
                    <div class="h-4 bg-slate-200 rounded w-28" />
                  </td>
                  <td class="p-4">
                    <div class="h-4 bg-slate-200 rounded w-24" />
                  </td>
                  <td class="p-4">
                    <div class="h-6 bg-slate-200 rounded w-16 mx-auto" />
                  </td>
                  <td class="p-4" />
                </tr>
              </tbody>

              <tbody v-else class="divide-y divide-slate-100">
                <tr
                  v-for="emp in paginatedEmployees"
                  :key="emp.id"
                  class="hover:bg-slate-50 transition-colors group"
                  :class="{
                    'opacity-60 bg-slate-50': emp.status === 'inactive',
                  }"
                >
                  <td
                    class="p-4 text-center text-xs font-bold"
                    :class="
                      emp.status === 'inactive'
                        ? 'text-slate-400'
                        : 'text-slate-500'
                    "
                  >
                    {{ emp.code }}
                  </td>
                  <td class="p-4">
                    <div class="flex items-center">
                      <div
                        class="w-9 h-9 rounded-full flex items-center justify-center mr-3 shrink-0"
                        :class="
                          emp.rank === 'R8'
                            ? 'bg-slate-800 text-white font-bold text-xs shadow-sm'
                            : avatarCls(emp.status)
                        "
                      >
                        <span v-if="emp.rank === 'R8'" class="text-xs font-bold"
                          >GM</span
                        >
                        <i
                          v-else
                          :class="`fas ${avatarIcon(emp.status)} text-sm`"
                        />
                      </div>
                      <div>
                        <div
                          class="font-bold text-sm"
                          :class="
                            emp.status === 'inactive'
                              ? 'text-slate-500 line-through decoration-slate-400'
                              : 'text-slate-800'
                          "
                        >
                          {{ emp.name }}
                        </div>
                        <div
                          class="text-[11px] mt-0.5 flex items-center"
                          :class="
                            emp.status === 'inactive'
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          "
                        >
                          <i class="fas fa-envelope w-3 mr-1 text-xs" />
                          {{ emp.email }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="p-4">
                    <div
                      class="text-sm font-semibold"
                      :class="
                        emp.status === 'inactive'
                          ? 'text-slate-500'
                          : 'text-slate-700'
                      "
                    >
                      {{ emp.section }}
                    </div>
                  </td>
                  <td class="p-4">
                    <div
                      class="flex items-center gap-2 flex-wrap"
                      :class="emp.status === 'inactive' ? 'opacity-70' : ''"
                    >
                      <span
                        class="w-7 h-7 rounded font-black text-xs flex items-center justify-center shrink-0"
                        :class="rankBadgeCls(emp.rank)"
                        >{{ emp.rank }}</span
                      >
                      <div>
                        <div class="text-xs font-bold text-slate-600">
                          {{ emp.jobTitle }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 text-center">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
                      :class="statusBadge(emp.status).cls"
                      >{{ statusBadge(emp.status).label }}</span
                    >
                  </td>
                  <td class="p-4 text-center">
                    <button
                      v-if="emp.status !== 'inactive'"
                      class="transition-colors p-1.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                      title="Chỉnh sửa"
                      @click="openEditDrawer(emp)"
                    >
                      <i class="fas fa-edit text-sm" />
                    </button>
                    <button
                      v-else
                      class="text-slate-400 cursor-not-allowed p-1.5"
                      title="Đã nghỉ việc"
                    >
                      <i class="fas fa-lock text-sm" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div
            class="px-5 py-4 border-t border-slate-200 bg-white flex justify-between items-center"
          >
            <div class="text-xs text-slate-500">
              Hiển thị
              {{
                Math.min(
                  (currentPage - 1) * pageSize + 1,
                  filteredEmployees.length,
                )
              }}
              đến
              {{ Math.min(currentPage * pageSize, filteredEmployees.length) }}
              trong {{ filteredEmployees.length }} kết quả
            </div>
            <div class="flex space-x-1">
              <button
                class="px-2.5 py-1 border border-slate-300 rounded text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                :disabled="currentPage <= 1"
                @click="currentPage--"
              >
                <i class="fas fa-chevron-left text-sm" />
              </button>
              <template v-for="p in pageNumbers" :key="p">
                <span v-if="p === '...'" class="px-2 py-1 text-slate-400"
                  >...</span
                >
                <button
                  v-else
                  class="px-3 py-1 border rounded font-medium text-sm"
                  :class="
                    p === currentPage
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-600 font-bold'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  "
                  @click="currentPage = p as number"
                >
                  {{ p }}
                </button>
              </template>
              <button
                class="px-2.5 py-1 border border-slate-300 rounded text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                :disabled="currentPage >= totalPages"
                @click="currentPage++"
              >
                <i class="fas fa-chevron-right text-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- ── MODAL: IMPORT EXCEL ────────────────────────────────────────────────── -->
  <Transition name="modal">
    <div
      v-if="showImportModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        @click="showImportModal = false"
      />
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-xl z-10 overflow-hidden flex flex-col"
      >
        <div
          class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50"
        >
          <h3 class="font-bold text-lg text-slate-800 flex items-center">
            <i class="fas fa-file-upload mr-2 text-indigo-600" /> Import Master
            Data Nhân sự
          </h3>
          <button
            class="text-slate-400 hover:text-slate-700"
            @click="showImportModal = false"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <div class="p-6">
          <p class="text-sm text-slate-600 mb-4">
            Tải lên file Excel (.xlsx) hoặc CSV chứa danh sách nhân viên. Hệ
            thống sẽ tự động map các cột:
            <strong>Mã NV, Họ Tên, Email, Section, Rank, Role, Status</strong>.
          </p>
          <div
            class="border-2 border-dashed border-indigo-300 bg-indigo-50/50 rounded-xl p-8 text-center hover:bg-indigo-50 transition-colors cursor-pointer relative group"
          >
            <input
              type="file"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".csv,.xlsx,.xls"
            />
            <div
              class="w-16 h-16 bg-white shadow-sm border border-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"
            >
              <i class="fas fa-cloud-upload-alt text-2xl" />
            </div>
            <h4 class="text-sm font-bold text-indigo-900 mb-1">
              Kéo thả file vào đây
            </h4>
            <p class="text-xs text-indigo-600/70 font-medium">
              hoặc click để chọn file từ máy tính
            </p>
          </div>
          <div class="mt-4 flex justify-between items-center text-xs">
            <a
              href="#"
              class="text-indigo-600 font-bold hover:underline flex items-center"
            >
              <i class="fas fa-download mr-1" /> Tải File Mẫu (Template)
            </a>
            <span class="text-slate-400">Max file size: 5MB</span>
          </div>
        </div>
        <div
          class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3"
        >
          <button
            class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            @click="showImportModal = false"
          >
            Hủy
          </button>
          <button
            class="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm flex items-center"
            @click="showImportModal = false"
          >
            <i class="fas fa-play mr-2" /> Tiến hành Import
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── DRAWER: ADD / EDIT EMPLOYEE ───────────────────────────────────────── -->
  <Transition name="backdrop">
    <div
      v-if="showDrawer"
      class="fixed inset-0 bg-slate-900/40 z-40"
      @click="closeDrawer"
    />
  </Transition>

  <Transition name="drawer">
    <div
      v-if="showDrawer"
      class="fixed top-0 right-0 h-full w-full max-w-[500px] bg-slate-50 shadow-2xl z-50 flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm"
      >
        <h2 class="text-lg font-bold text-slate-800 flex items-center">
          <i
            :class="`fas ${drawerMode === 'create' ? 'fa-user-plus' : 'fa-user-cog'} mr-2 text-indigo-600`"
          />
          {{
            drawerMode === "create"
              ? "Thêm Nhân sự mới"
              : "Cập nhật Thông tin Nhân sự"
          }}
        </h2>
        <button
          class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          @click="closeDrawer"
        >
          <i class="fas fa-times" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Section 1: Identity -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3
            class="font-bold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2"
          >
            1. Thông tin Định danh
          </h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1"
                >
                  Mã Nhân viên <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="formCode"
                  type="text"
                  placeholder="VNG-..."
                  :disabled="formCodeDisabled"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-bold uppercase disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label
                  class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1"
                >
                  Trạng thái <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="formStatus"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-700"
                >
                  <option value="active">Đang làm việc (Active)</option>
                  <option value="inactive">Đã nghỉ (Inactive)</option>
                </select>
              </div>
            </div>
            <div>
              <label
                class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1"
              >
                Họ và Tên <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formName"
                type="text"
                placeholder="Nhập họ và tên..."
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label
                class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1"
              >
                Email Công ty <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formEmail"
                type="email"
                placeholder="email@company.com"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <!-- Section 2: Org Structure -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3
            class="font-bold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2"
          >
            2. Cấu trúc Tổ chức (Org Chart)
          </h3>
          <div class="space-y-4">
            <div>
              <label
                class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1"
              >
                Phòng ban (Section) <span class="text-red-500">*</span>
              </label>
              <select
                v-model="formSectionId"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Chọn phòng ban --</option>
                <option
                  v-for="sec in sections"
                  :key="sec.id"
                  :value="sec.id"
                >
                  {{ sec.name }}
                </option>
              </select>
            </div>
            <div>
              <label
                class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1"
              >
                Rank Level <span class="text-red-500">*</span>
              </label>
              <select
                v-model="formRankCode"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-indigo-700"
              >
                <option value="">-- Chọn cấp bậc --</option>
                <option
                  v-for="r in rankOptions"
                  :key="r.code"
                  :value="r.code"
                >
                  {{ r.code }} — {{ r.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div
        class="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-end space-x-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
      >
        <button
          class="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          @click="closeDrawer"
        >
          Hủy bỏ
        </button>
        <button
          class="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center"
          @click="saveEmployee"
        >
          <i class="fas fa-save mr-2" /> Lưu Thông tin
        </button>
      </div>
    </div>
  </Transition>

  <!-- TOAST -->
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

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease-in-out;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s;
}
.backdrop-enter-from,
.backdrop-leave-to {
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
