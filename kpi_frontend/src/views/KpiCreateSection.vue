<template>
  <div v-if="canAccessCreatePage">
    <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical" @finish="handleChangeCreate"
      @finishFailed="onFinishFailed">

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="Use Existing KPI as Template (Optional)" name="templateKpi">
            <a-select v-model:value="selectedTemplateKpiId" placeholder="Select a KPI to use as template..." show-search
              allow-clear :options="kpiTemplateOptions" :filter-option="(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
                " :loading="loadingKpiTemplates" style="width: 100%; margin-bottom: 15px" @change="loadKpiTemplate" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item class="textLabel" label="Perspective" name="perspective_id">
        <a-select v-model:value="form.perspective_id" placeholder="Perspective">
          <a-select-option v-for="perspective in perspectiveList" :key="perspective.id" :value="perspective.id">{{
            perspective.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" label="KPI Name" name="name">
            <a-input v-model:value="form.name" placeholder="KPI Name" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" label="Calculation Formula" name="calculation_type">
            <a-select v-model:value="form.calculation_type" placeholder="Chọn Calculation Formula">
              <a-select-option v-for="formula in formulaList" :key="formula.id" :value="formula.id">
                {{ formula.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" label="Type" name="type">
            <a-select v-model:value="form.type" placeholder="Type KPI">
              <a-select-option value="efficiency"> Hiệu suất </a-select-option>
              <a-select-option value="qualitative"> Định Tính </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" label="Unit" name="unit">
            <a-select v-model:value="form.unit" placeholder="Unit">
              <a-select-option value="MM"> MM </a-select-option>
              <a-select-option value="Point"> Point </a-select-option>
              <a-select-option value="Product"> Product </a-select-option>
              <a-select-option value="Project"> Project </a-select-option>
              <a-select-option value="Certification">
                Certification
              </a-select-option>
              <a-select-option value="Article"> Article </a-select-option>
              <a-select-option value="Person"> Person </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" label="Target" name="target">
            <a-input v-model:value="form.target" placeholder="Target"
              @input="(event) => handleNumericInput('target', event)" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" label="Weight (%)" name="weight">
            <a-input v-model:value="form.weight" placeholder="Weight"
              @input="(event) => handleNumericInput('weight', event)" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item class="textLabel" label="Frequency" name="frequency">
        <a-select v-model:value="form.frequency" placeholder="Frequency">
          <a-select-option value="daily"> Daily </a-select-option>
          <a-select-option value="weekly"> Weekly </a-select-option>
          <a-select-option value="monthly"> Monthly </a-select-option>
          <a-select-option value="quarterly"> Quarterly </a-select-option>
          <a-select-option value="yearly"> Yearly </a-select-option>
        </a-select>
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item class="textLabel" label="Date Start" name="start_date">
            <a-date-picker v-model:value="form.start_date" style="width: 100%" value-format="YYYY-MM-DD" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item class="textLabel" label="Date End" name="end_date" :rules="[{ validator: validateEndDate }]">
            <a-date-picker v-model:value="form.end_date" style="width: 100%" value-format="YYYY-MM-DD" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item class="textLabel" label="Description" name="description">
        <a-textarea v-model:value="form.description" placeholder="Description" allow-clear />
      </a-form-item>

      <a-form-item v-if="canAssignDirectlyToUser" class="textLabel" label="Assign To User" name="assigned_user_id">
        <a-alert v-if="assignmentError" :message="assignmentError" type="error" show-icon style="margin-bottom: 10px" />
        <a-select v-model:value="form.assigned_user_id" placeholder="Select a user..." show-search allow-clear
          :options="sectionUserOptions"
          :filter-option="(input, option) => option.label.toLowerCase().includes(input.toLowerCase())"
          :loading="loadingSectionUsers" style="width: 100%;" />
      </a-form-item>

      <a-form-item>
        <a-row justify="end" style="margin-top: 10px">
          <a-button style="margin-right: 10px" @click="resetForm(true)">
            Clear Form
          </a-button>
          <a-button style="margin-right: 10px" type="primary" html-type="submit" :loading="loading">
            Save KPI
          </a-button>
          <a-button type="default" @click="goBack"> Back </a-button>
        </a-row>
      </a-form-item>
    </a-form>
  </div>
  <div v-else>
    <a-alert message="Access Denied"
      description="You do not have permission to create KPIs with the current role/scope." type="error" show-icon />
    <a-button type="default" style="margin-top: 15px" @click="goBack">
      Back
    </a-button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import {
  notification,
  Alert as AAlert,
  DatePicker as ADatePicker,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Select as ASelect,
  SelectOption as ASelectOption,
  Textarea as ATextarea,
  Row as ARow,
  Col as ACol,
  Button as AButton,
} from "ant-design-vue";
import dayjs from "dayjs";

// --- Store, Router, Route ---
const router = useRouter();
const route = useRoute();
const store = useStore();

// Lấy sectionId từ route params
const sectionId = computed(() => parseInt(route.params.sectionId, 10)); // Giả định sectionId là route param
// Cố định scope là 'section' cho component này
const creationScope = 'section'; // Cố định scope

// --- State ---
const loading = ref(false); // Loading cho hành động submit form
const loadingInitialData = ref(false); // Loading cho việc fetch dữ liệu ban đầu
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);
const assignmentError = ref(null); // Dùng cho lỗi gán user (ví dụ: user chưa được chọn)
const formRef = ref();

// Form state - Đã bỏ section_id, targets
const form = ref({
  name: "",
  calculation_type: null,
  type: null,
  unit: null,
  target: null, // Target chính của KPI
  weight: null,
  frequency: null,
  perspective_id: null,
  start_date: null,
  end_date: null,
  assigned_user_id: null, // Lưu ID của User được gán trực tiếp
  description: "",
  // targets: {}, // Không còn bảng gán mục tiêu
});

const formulaList = ref([
  {
    id: "percentage",
    name: "Tỷ lệ hoàn thành (%)",
  },
  {
    id: "average",
    name: "Giá trị trung bình",
  },
  {
    id: "sum",
    name: "Tổng số",
  },
]);

// --- Computed Properties ---
const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const kpiTemplateList = computed(
  () => store.getters["kpis/kpiListAll"] || []
);
const loadingKpiTemplates = computed(() => store.getters["kpis/loadingAll"]);

const kpiTemplateOptions = computed(() =>
  kpiTemplateList.value.map((kpi) => ({
    value: kpi.id,
    label: kpi.name,
  }))
);

// Lấy danh sách User thuộc Section hiện tại từ store Users
// Cần có users store và action/getter tương ứng
const sectionUserList = computed(() => store.getters["users/usersBySection"](sectionId.value) || []); // Giả định getter này tồn tại
const loadingSectionUsers = computed(() => store.getters["users/loadingBySection"] || false); // Giả định getter này tồn tại

const sectionUserOptions = computed(() =>
  sectionUserList.value.map(user => ({
    value: user.id,
    label: `${user.first_name} ${user.last_name}` // Hoặc user.name tùy cấu trúc user
  }))
);


// === Lấy Role và Định nghĩa Quyền (Điều chỉnh cho scope='section') ===
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const canAccessCreatePage = computed(() => {
  // Chỉ admin, manager, hoặc section admin/manager có quyền tạo KPI cấp section
  const allowedRoles = ["admin", "manager", "section"]; // Thêm 'section' role nếu có quyền
  // Thêm kiểm tra nếu role hiện tại khớp với scope
  return allowedRoles.includes(effectiveRole.value);
});

// Quyền gán trực tiếp cho User trong Section
const canAssignDirectlyToUser = computed(() => {
  // Ví dụ: Admin, Manager, và role 'section' (nếu có quyền) có thể gán cho user trong section
  const allowedRolesForUserAssignment = ["admin", "manager", "section"]; // Thêm các role có quyền
  return allowedRolesForUserAssignment.includes(effectiveRole.value);
});

// Quyền gán cho Sections con không tồn tại ở cấp Section
// const canAssignToSections = computed(() => false);


// --- Methods ---
// Reset form
const resetForm = (clearTemplateSelection = false) => {
  formRef.value?.resetFields();
  form.value = {
    name: "",
    calculation_type: null,
    type: null,
    unit: null,
    target: null,
    weight: null,
    frequency: null,
    perspective_id: null,
    start_date: null,
    end_date: null,
    assigned_user_id: null, // Reset user assignment
    description: "",
  };
  assignmentError.value = null;
  if (clearTemplateSelection) {
    selectedTemplateKpiId.value = null;
  }
  console.log("Form Reset");
};
// Load template
const loadKpiTemplate = async (selectedId) => {
  if (!selectedId) {
    resetForm();
    return;
  }
  loadingKpiTemplate.value = true;
  assignmentError.value = null;
  console.log(`Loading template KPI ID: ${selectedId}`);
  try {
    await store.dispatch("kpis/fetchKpiDetail", selectedId);
    const kpiDetail = store.getters["kpis/currentKpi"];
    if (kpiDetail) {
      // Cẩn thận khi load template: chỉ copy các trường thông tin KPI
      form.value.name = kpiDetail.name ? `${kpiDetail.name} (Copy)` : "";
      form.value.calculation_type = kpiDetail.calculation_type || null;
      form.value.type = kpiDetail.type || null;
      form.value.unit = kpiDetail.unit || null;
      form.value.target = kpiDetail.target ?? null;
      form.value.weight = kpiDetail.weight ?? null;
      form.value.frequency = kpiDetail.frequency || null;
      form.value.perspective_id = kpiDetail.perspective?.id || null;
      form.value.description = kpiDetail.description || "";
      form.value.start_date = kpiDetail.start_date
        ? dayjs(kpiDetail.start_date)
        : null;
      form.value.end_date = kpiDetail.end_date
        ? dayjs(kpiDetail.end_date)
        : null;
      // Reset assignment khi load template
      form.value.assigned_user_id = null;

      notification.success({
        message: `Loaded data from KPI: ${kpiDetail.name}`,
      });
    } else {
      throw new Error("KPI Detail not found.");
    }
  } catch (error) {
    console.error("Error loading KPI template:", error);
    notification.error({
      message: "Failed to load KPI template data.",
    });
    resetForm();
  } finally {
    loadingKpiTemplate.value = false;
  }
};
// Xử lý input target (chỉ còn target chính)
const handleNumericInput = (field, event) => {
  let value = event.target.value;
  value = value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  form.value[field] = value === '' ? null : parseFloat(value);
};
// Validate weight
const validateWeight = async (_, value) => {
  if (value === null || value === '') return Promise.resolve(); // Trọng số có thể là 0
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return Promise.reject("Weight must be a number");
  if (numValue < 0 || numValue > 100)
    return Promise.reject("Weight must be between 0 and 100");
  return Promise.resolve();
};

// Validate Assignment: Kiểm tra xem đã gán cho User chưa
const validateAssignment = async (_, value) => {
  if (value === null || value === '') return Promise.resolve(); // Trọng số có thể là 0
  if (canAssignDirectlyToUser.value && form.value.assigned_user_id === null) {
    assignmentError.value = "Assignment Required: Please select a user to assign this KPI.";
    return Promise.reject("No user selected for assignment.");
  }
  // Nếu chức năng gán user không bật, hoặc user đã được chọn
  assignmentError.value = null;
  return Promise.resolve();
};


// Quay lại
const goBack = () => {
  // Có thể điều hướng về trang danh sách KPI Section (cần sectionId param)
  // Giả định route list KPI Section có tên 'KpiListSection' và nhận sectionId param
  router.push({ name: 'KpiListSection', params: { sectionId: sectionId.value } });
  // Nếu route list section không có param, chỉ cần router.push({ name: 'KpiListSection' });
};

// === HÀM SUBMIT ===
const handleChangeCreate = async () => {
  loading.value = true;
  assignmentError.value = null; // Reset error before validation/submit

  try {
    await formRef.value?.validate(); // Validate form trước (bao gồm cả assignment)

    const assignmentsPayload = {
      from: creationScope, // 'section'
      to_user: null,
    };

    let hasValidAssignment = false;

    // Xử lý gán cho User
    if (canAssignDirectlyToUser.value && form.value.assigned_user_id !== null) {
      assignmentsPayload.to_user = { id: form.value.assigned_user_id };
      hasValidAssignment = true;
    }

    // Kiểm tra cuối cùng: Phải có ít nhất một kiểu gán hợp lệ (ở đây chỉ có gán User)
    if (!hasValidAssignment) {
      assignmentError.value = "Assignment Required: Please select a user to assign this KPI.";
      throw new Error(assignmentError.value);
    }

    // ----- Format và Tạo Payload Cuối Cùng -----
    const formattedStartDate = form.value.start_date
      ? dayjs(form.value.start_date).toISOString()
      : null;
    const formattedEndDate = form.value.end_date
      ? dayjs(form.value.end_date).toISOString()
      : null;
    const numericMainTarget =
      form.value.target !== null ? Number(form.value.target) : null;
    const numericMainWeight =
      form.value.weight !== null ? Number(form.value.weight) : null;


    // ---- Tạo dữ liệu KPI cuối cùng ----
    const kpiData = {
      name: form.value.name,
      calculation_type: form.value.calculation_type,
      type: form.value.type,
      unit: form.value.unit,
      target: numericMainTarget,
      weight: numericMainWeight,
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      description: form.value.description,
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      // Thêm section_id vào payload chính
      section_id: sectionId.value, // Lấy từ route params
      assignments: assignmentsPayload, // Sử dụng assignmentsPayload đã xử lý (chỉ có to_user)
    };

    // Dọn dẹp assignments payload: chỉ giữ lại to_user
    delete kpiData.assignments.to_sections; // Loại bỏ to_sections (không dùng ở scope Section)

    console.log("Submitting KPI Data (Final Structure):", kpiData);

    // Gửi request tạo KPI
    await store.dispatch("kpis/createKpi", kpiData);

    notification.success({ message: "KPI created successfully" });
    resetForm(true);
    // Điều hướng sau khi tạo thành công (quay về trang danh sách KPI của section)
    // Sử dụng tên route danh sách KPI Section và truyền sectionId qua params
    router.push({ name: 'KpiListSection', params: { sectionId: sectionId.value } }); // Cần đảm bảo route list section nhận sectionId param

  } catch (error) {
    // Xử lý lỗi validation và lỗi từ API
    if (error instanceof Error && error.message === assignmentError.value) {
      // Lỗi validation assignment đã được set, không làm gì thêm
      console.log("Assignment validation failed:", assignmentError.value);
    } else {
      console.error("KPI creation failed:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "KPI creation failed.";
      notification.error({
        message: "KPI Creation Failed",
        description: errorMessage,
        duration: 5,
      });
    }

  } finally {
    loading.value = false;
  }
};

// Hàm khi validation thất bại
const onFinishFailed = (errorInfo) => {
  console.log("Form validation failed:", errorInfo);
  let errorMessages = "Please check required fields and input formats.";
  if (errorInfo?.errorFields?.length > 0) {
    // Tìm lỗi không phải từ trường assigned_user_id nếu có
    const nonAssignmentErrors = errorInfo.errorFields.filter(field => field.name[0] !== 'assigned_user_id');
    if (nonAssignmentErrors.length > 0) {
      const firstErrorField = nonAssignmentErrors[0];
      const fieldName = Array.isArray(firstErrorField.name)
        ? firstErrorField.name.join(".")
        : firstErrorField.name;
      const errors = Array.isArray(firstErrorField.errors)
        ? firstErrorField.errors.join(", ")
        : "Unknown error";
      errorMessages = `Error in field '${fieldName}': ${errors}`;
    } else if (errorInfo.errorFields.some(field => field.name[0] === 'assigned_user_id')) {
      // Nếu chỉ có lỗi từ trường assigned_user_id, sử dụng assignmentError.value
      if (assignmentError.value) {
        errorMessages = assignmentError.value;
      } else {
        errorMessages = "Please select a user for assignment.";
      }
    }
  }

  notification.error({
    message: "Form Validation Failed",
    description: errorMessages,
  });
};


// --- Validation Rules cho Form ---
const validateEndDate = async (_, value) => {
  if (
    value &&
    form.value.start_date &&
    dayjs(value).isBefore(dayjs(form.value.start_date))
  ) {
    return Promise.reject("End Date must be after Start Date");
  }
  return Promise.resolve();
};

const formRules = reactive({
  perspective_id: [
    {
      required: true,
      message: "Please select Perspective",
    },
  ],
  name: [
    {
      required: true,
      message: "Please enter KPI Name",
      trigger: "blur",
    },
  ],
  calculation_type: [
    {
      required: true,
      message: "Please select Calculation Formula",
    },
  ],
  type: [
    {
      required: true,
      message: "Please select KPI Type",
    },
  ],
  unit: [
    {
      required: true,
      message: "Please select Unit",
    },
  ],
  target: [
    {
      required: true,
      message: "Please enter Target",
      trigger: "blur",
    },
    // Đã loại bỏ hàm bên ngoài không cần thiết và sửa signature của validator
    {
      validator: async (_, value) => {
        const numValue = parseFloat(value);
        if (value === null || value === '' || isNaN(numValue) || numValue < 0) {
          return Promise.reject("Target must be a non-negative number");
        }
        return Promise.resolve();
      },
      trigger: "blur",
    },
  ],
  weight: [
    {
      required: true,
      message: "Please enter Weight",
      trigger: "blur",
    },
    {
      validator: validateWeight,
      trigger: "blur",
    },
  ],
  frequency: [
    {
      required: true,
      message: "Please select Frequency",
    },
  ],
  start_date: [
    {
      required: true,
      message: "Please select Start Date",
    }
  ],
  end_date: [
    {
      required: true,
      message: "Please select End Date",
    },
    {
      validator: validateEndDate,
      trigger: "change",
    },
  ],
  // Rule cho phần Assignment (chỉ kiểm tra assigned_user_id)
  assigned_user_id: [
    {
      validator: validateAssignment,
      required: computed(() => canAssignDirectlyToUser.value), // Required chỉ khi có quyền gán user
      message: "Please select a user for assignment",
      trigger: 'change',
    },
  ],
});


// --- Watchers (Đơn giản hóa, chỉ watch assigned_user_id nếu cần logic tương tác) ---
// watch assigned_user_id để set/clear assignment error nếu cần
watch(() => form.value.assigned_user_id, (newVal) => {
  if (canAssignDirectlyToUser.value && newVal === null) {
    // assignmentError.value = "Assignment Required: Please select a user to assign this KPI.";
    // Validation rule assigned_user_id sẽ tự set lỗi này
  } else {
    assignmentError.value = null; // Xóa lỗi nếu user được chọn hoặc không có quyền gán
  }
  // Kích hoạt lại validation cho assigned_user_id
  formRef.value?.validateFields(['assigned_user_id']).catch(() => { });
}, { immediate: true }); // Chạy lần đầu khi mount


// --- Lifecycle Hook ---
onMounted(async () => {
  // Kiểm tra sectionId hợp lệ từ route params
  if (!sectionId.value || isNaN(sectionId.value)) {
    console.error("Invalid Section ID in route params.");
    notification.error({
      message: "Invalid Section ID.",
      description: "Cannot create KPI without a valid section.",
    });
    // Có thể điều hướng về trang danh sách section hoặc trang lỗi
    router.push({ name: 'KpiListSection' }); // Giả định tên route danh sách section là 'KpiListSection'
    return;
  }

  loadingInitialData.value = true; // Bắt đầu loading dữ liệu ban đầu
  try {
    await Promise.all([
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("kpis/fetchAllKpisForSelect"), // For template
      // Fetch Users chỉ cho Section hiện tại
      // Cần có action fetchUsersBySection trong users store module
      store.dispatch('users/fetchUsersBySection', sectionId.value), // Giả định action này tồn tại và lưu vào state riêng
    ]);

    const templateKpiIdFromRoute = route.query.templateKpiId;
    if (templateKpiIdFromRoute) {
      const kpiId = parseInt(templateKpiIdFromRoute, 10);
      if (!isNaN(kpiId)) {
        await loadKpiTemplate(kpiId);
        selectedTemplateKpiId.value = kpiId;
      } else {
        console.error("Invalid templateKpiId in route query.");
        notification.error({ message: "Invalid template ID provided." });
      }
    }
  } catch (error) {
    console.error("Error fetching initial data:", error);
    notification.error({
      message: "Failed to load necessary data.",
      description: error.message || 'An error occurred.',
      duration: 5,
    });
  } finally {
    loadingInitialData.value = false; // Kết thúc loading dữ liệu ban đầu
  }
});
</script>

<style scoped>
.textLabel label {
  font-weight: bold !important;
}

.table-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.ant-form-item {
  margin-bottom: 16px;
}

:deep(.ant-input-number-disabled) {
  background-color: #f5f5f5 !important;
  color: rgba(0, 0, 0, 0.25) !important;
  cursor: not-allowed !important;
}
</style>