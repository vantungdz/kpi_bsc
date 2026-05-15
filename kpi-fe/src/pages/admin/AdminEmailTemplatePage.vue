<script setup lang="ts">
/**
 * AdminEmailTemplatePage.vue
 * Quản lý Mẫu Email — thống kê tổng + đang kích hoạt; danh sách phẳng; tạo / sửa / xóa.
 */
import { ref, computed } from "vue";
import { isAxiosError } from "axios";
import { adminKpiService } from "@/services/modules/kpi-admin.service";
import type { EmailTemplate } from "@/mocks/admin.mock";
import { TEMPLATE_VARIABLES } from "@/mocks/admin.mock";

const templates = ref<EmailTemplate[]>([]);
const loading = ref(false);
const showDrawer = ref(false);
const drawerMode = ref<"create" | "edit">("create");
const editingId = ref<string | null>(null);
const saving = ref(false);
const deletingId = ref<string | null>(null);
const toastMsg = ref("");
const showToast = ref(false);

const formName = ref("");
const formSubject = ref("");
const formBody = ref("");
const formStatus = ref<"active" | "inactive">("active");

const loadTemplates = async () => {
  loading.value = true;
  try {
    templates.value = await adminKpiService.getEmailTemplates();
  } catch (e) {
    triggerToast(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không tải được danh sách mẫu.",
    );
  } finally {
    loading.value = false;
  }
};

void loadTemplates();

const totalTemplates = computed(() => templates.value.length);
const activeCount = computed(
  () => templates.value.filter((t) => t.status === "active").length,
);

const openCreateDrawer = () => {
  drawerMode.value = "create";
  formName.value = "";
  formSubject.value = "";
  formBody.value = "";
  formStatus.value = "active";
  editingId.value = null;
  showDrawer.value = true;
};

const openEditDrawer = (tpl: EmailTemplate) => {
  drawerMode.value = "edit";
  formName.value = tpl.name;
  formSubject.value = tpl.subject;
  formBody.value = tpl.body;
  formStatus.value = tpl.status;
  editingId.value = tpl.id;
  showDrawer.value = true;
};

const closeDrawer = () => {
  showDrawer.value = false;
};

const saveTemplate = async () => {
  if (!formName.value.trim() || !formSubject.value.trim()) {
    triggerToast("Vui lòng nhập Tên mẫu và Tiêu đề email.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: formName.value.trim(),
      subject: formSubject.value.trim(),
      body: formBody.value,
      status: formStatus.value,
    };
    if (drawerMode.value === "create") {
      await adminKpiService.createEmailTemplate(
        payload as Omit<EmailTemplate, "id">,
      );
      triggerToast("Đã tạo mẫu Email mới thành công!");
    } else if (editingId.value) {
      await adminKpiService.updateEmailTemplate(editingId.value, payload);
      triggerToast("Đã lưu mẫu Email thành công!");
    }
    await loadTemplates();
    closeDrawer();
  } catch (e) {
    triggerToast(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không lưu được mẫu.",
    );
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (tpl: EmailTemplate, ev: MouseEvent) => {
  ev.stopPropagation();
  if (
    !confirm(`Xóa mẫu "${tpl.name}"? Mẫu sẽ không còn dùng được trên chiến dịch.`)
  ) {
    return;
  }
  deletingId.value = tpl.id;
  try {
    await adminKpiService.deleteEmailTemplate(tpl.id);
    triggerToast("Đã xóa mẫu email.");
    await loadTemplates();
  } catch (e) {
    triggerToast(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không xóa được mẫu.",
    );
  } finally {
    deletingId.value = null;
  }
};

const copyVariable = async (varStr: string) => {
  try {
    await navigator.clipboard.writeText(varStr);
    triggerToast(`Đã copy biến ${varStr} vào khay nhớ tạm.`);
  } catch {
    triggerToast(`Copy: ${varStr}`);
  }
};

const triggerToast = (msg: string) => {
  toastMsg.value = msg;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

const statusBadge = (status: string) =>
  status === "active"
    ? {
        cls: "bg-green-50 text-green-600 border border-green-200",
        label: "Kích hoạt",
      }
    : {
        cls: "bg-slate-100 text-slate-500 border border-slate-200",
        label: "Tạm ngưng",
      };

const cardIconBg = () =>
  "bg-indigo-50 text-indigo-600 border border-indigo-100";
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <header
      class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4"
    >
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Mẫu Email</h1>
        <p class="mt-1 text-sm text-slate-500">
          Tạo và quản lý mẫu dùng khi gửi thông báo từ trang Chiến dịch đánh giá
          (toàn công ty hoặc từng nhân viên).
        </p>
      </div>
      <button
        type="button"
        class="flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
        @click="openCreateDrawer"
      >
        <i class="fas fa-plus mr-2" /> Tạo mẫu mới
      </button>
    </header>

    <main class="flex-1 overflow-auto bg-slate-50/50 p-8">
      <div class="mx-auto max-w-[1400px] space-y-8">
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div
            class="flex items-center justify-between rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-5 shadow-sm"
          >
            <div>
              <div
                class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Tổng số mẫu
              </div>
              <div class="text-3xl font-black text-slate-800">
                {{ totalTemplates }}
              </div>
            </div>
            <div
              class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"
            >
              <i class="fas fa-layer-group text-xl" />
            </div>
          </div>
          <div
            class="flex items-center justify-between rounded-xl border border-slate-200 border-l-4 border-l-green-500 bg-white p-5 shadow-sm"
          >
            <div>
              <div
                class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Đang kích hoạt
              </div>
              <div class="text-3xl font-black text-slate-700">
                {{ activeCount }}
              </div>
            </div>
            <div
              class="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-500"
            >
              <i class="fas fa-check-circle text-xl" />
            </div>
          </div>
        </div>

        <div v-if="loading" class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="i in 6"
            :key="i"
            class="animate-pulse rounded-xl border border-slate-200 bg-white p-5"
          >
            <div class="mb-4 h-10 w-10 rounded bg-slate-200" />
            <div class="mb-2 h-5 w-3/4 rounded bg-slate-200" />
            <div class="mb-1 h-4 w-full rounded bg-slate-200" />
            <div class="h-4 w-4/5 rounded bg-slate-200" />
          </div>
        </div>

        <div v-else-if="!templates.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          <i class="fas fa-inbox mb-3 text-3xl text-slate-300" />
          <p class="font-medium text-slate-600">Chưa có mẫu email.</p>
          <p class="mt-1 text-sm">Nhấn &quot;Tạo mẫu mới&quot; để thêm mẫu đầu tiên.</p>
        </div>

        <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="tpl in templates"
            :key="tpl.id"
            class="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-indigo-300"
            role="button"
            tabindex="0"
            @click="openEditDrawer(tpl)"
            @keydown.enter="openEditDrawer(tpl)"
          >
            <div class="flex items-start justify-between border-b border-slate-100 p-5">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded"
                :class="cardIconBg()"
              >
                <i class="fas fa-envelope text-lg" />
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold"
                  :class="statusBadge(tpl.status).cls"
                >
                  {{ statusBadge(tpl.status).label }}
                </span>
                <button
                  type="button"
                  class="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Xóa mẫu"
                  :disabled="deletingId === tpl.id"
                  @click="confirmDelete(tpl, $event)"
                >
                  <i
                    :class="deletingId === tpl.id ? 'fas fa-spinner fa-spin' : 'fas fa-trash-alt'"
                    class="text-sm"
                  />
                </button>
              </div>
            </div>
            <div class="flex flex-1 flex-col p-5">
              <h3
                class="mb-1 text-base font-bold text-slate-800 transition-colors group-hover:text-indigo-600"
              >
                {{ tpl.name }}
              </h3>
              <p class="mb-2 line-clamp-1 text-xs font-medium text-indigo-600">
                {{ tpl.subject }}
              </p>
              <p class="line-clamp-2 text-xs leading-relaxed text-slate-500">
                {{ tpl.body.slice(0, 140).replace(/\n/g, " ") }}
                {{ tpl.body.length > 140 ? "…" : "" }}
              </p>
            </div>
            <div
              class="flex items-center justify-between rounded-b-xl border-t border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-medium text-slate-400"
            >
              <span>Cập nhật: {{ tpl.updatedAt }}</span>
              <span
                class="font-bold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100"
              >Sửa →</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <Transition name="backdrop">
    <div
      v-if="showDrawer"
      class="fixed inset-0 z-40 bg-slate-900/40"
      @click="closeDrawer"
    />
  </Transition>

  <Transition name="drawer">
    <div
      v-if="showDrawer"
      class="fixed right-0 top-0 z-50 flex h-full w-full max-w-[800px] flex-col bg-slate-50 shadow-2xl"
    >
      <div
        class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm"
      >
        <h2 class="flex items-center text-lg font-bold text-slate-800">
          <i class="fas fa-file-alt mr-2 text-indigo-600" />
          {{
            drawerMode === "create" ? "Tạo mẫu email mới" : "Chỉnh sửa mẫu email"
          }}
        </h2>
        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          @click="closeDrawer"
        >
          <i class="fas fa-times" />
        </button>
      </div>

      <div class="flex flex-1 overflow-y-auto">
        <div class="flex-1 space-y-5 p-6">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label
                  class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  Tên mẫu <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="formName"
                  type="text"
                  class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
              </div>
              <div>
                <label
                  class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >Trạng thái</label>
                <select
                  v-model="formStatus"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                  :class="formStatus === 'active' ? 'text-green-600' : 'text-slate-500'"
                >
                  <option value="active">Đang kích hoạt</option>
                  <option value="inactive">Tạm ngưng</option>
                </select>
              </div>
            </div>
            <div>
              <label
                class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Tiêu đề email <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formSubject"
                type="text"
                class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
              <p v-pre class="mt-1 text-[10px] text-slate-400">
                Có thể dùng biến như {{KPI_Period}}, {{Employee_Name}}, …
              </p>
            </div>
          </div>

          <div
            class="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            style="height: 400px"
          >
            <div class="flex items-center space-x-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span class="text-xs text-slate-500">Nội dung (text)</span>
            </div>
            <textarea
              v-model="formBody"
              class="w-full flex-1 resize-none p-4 font-sans text-sm leading-relaxed text-slate-700 focus:outline-none"
              placeholder="Nhập nội dung email…"
            />
          </div>
        </div>

        <div
          class="flex w-64 shrink-0 flex-col border-l border-slate-200 bg-slate-100 p-5"
        >
          <h3 class="mb-2 flex items-center text-sm font-bold text-slate-700">
            <i class="fas fa-code mr-2 text-indigo-500" /> Biến gợi ý
          </h3>
          <p class="mb-4 text-[10px] leading-relaxed text-slate-500">
            Nhấn để copy, dán vào tiêu đề hoặc nội dung.
          </p>
          <div class="flex flex-1 flex-col space-y-4 overflow-y-auto pr-1">
            <div>
              <div
                class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                Người nhận
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="v in TEMPLATE_VARIABLES.recipient"
                  :key="v.key"
                  class="cursor-pointer rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-indigo-600 shadow-sm transition-colors hover:border-indigo-400"
                  :title="v.desc"
                  @click="copyVariable(v.key)"
                >
                  {{ v.key }}
                </div>
              </div>
            </div>
            <div>
              <div
                class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                Chiến dịch
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="v in TEMPLATE_VARIABLES.campaign"
                  :key="v.key"
                  class="cursor-pointer rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-emerald-600 shadow-sm transition-colors hover:border-emerald-400"
                  :title="v.desc"
                  @click="copyVariable(v.key)"
                >
                  {{ v.key }}
                </div>
              </div>
            </div>
            <div>
              <div
                class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                Khác
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="v in TEMPLATE_VARIABLES.reminder"
                  :key="v.key"
                  class="cursor-pointer rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-orange-600 shadow-sm transition-colors hover:border-orange-400"
                  :title="v.desc"
                  @click="copyVariable(v.key)"
                >
                  {{ v.key }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex shrink-0 items-center justify-end space-x-3 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
      >
        <button
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          @click="closeDrawer"
        >
          Hủy
        </button>
        <button
          type="button"
          class="flex items-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
          :disabled="saving"
          @click="saveTemplate"
        >
          <i
            :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'"
            class="mr-2"
          />
          {{ saving ? "Đang lưu…" : "Lưu mẫu" }}
        </button>
      </div>
    </div>
  </Transition>

  <Transition name="toast">
    <div
      v-if="showToast"
      class="fixed right-5 top-5 z-50 flex items-center rounded-lg bg-slate-800 px-4 py-3 text-white shadow-lg"
    >
      <i class="fas fa-check-circle mr-3 text-green-400" />
      <span class="text-sm font-medium">{{ toastMsg }}</span>
    </div>
  </Transition>
</template>

<style scoped>
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
