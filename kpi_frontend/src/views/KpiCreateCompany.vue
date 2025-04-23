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
      <a-row :gutter="12" style="
          margin-top: -10px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        ">
        <a-col :span="8">
          <a-statistic title="Overall Target" :value="overallTargetValue" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic title="Total Assigned" :value="totalAssignedTarget" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic title="Remaining" :value="remainingTarget" :precision="2"
            :value-style="isOverAssigned ? { color: '#cf1322' } : {}" />
        </a-col>
      </a-row>
      <a-form-item v-if="canAssignToUnits" class="textLabel" label="Assign To Department/Section & Set Targets"
        name="section_id_table" help="Use this table to assign the KPI down and set targets." :extra="form.assigned_user_id ? 'Direct user assignment will be cleared.' : ''
          ">
        <a-alert v-if="assignmentError" :message="assignmentError" type="error" show-icon style="margin-bottom: 10px" />
        <a-table :columns="columns" :data-source="departmentTreeData" :pagination="false"
          :row-key="(record) => record.key" :expandable="{ childrenColumnName: 'children' }"
          :row-selection="rowSelection" :class="{ 'table-disabled': !!form.assigned_user_id }" size="small" bordered>
          <template #target="{ record }">
            <a-input-number :value="targetValues[record.key] || null" placeholder="Target" :min="0" style="width: 100%"
              :disabled="!!form.assigned_user_id ||
                !selectedRowKeys.includes(record.key)
                " :formatter="(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                " :parser="(value) => String(value).replace(/\$\s?|(,*)/g, '')"
              @change="(value) => handleTargetChange(record.key, value)" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span :style="{ opacity: form.assigned_user_id ? 0.5 : 1 }">
                {{ record.name }}
              </span>
            </template>
          </template>
        </a-table>
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
// Import không có defineProps
import { ref, computed, onMounted, watch, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
// Import đầy đủ components Ant Design
import {
  notification,
  Alert as AAlert,
  DatePicker as ADatePicker,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Select as ASelect,
  SelectOption as ASelectOption,
  Textarea as ATextarea,
  Row as ARow,
  Col as ACol,
  Table as ATable,
  Button as AButton,
  Statistic as AStatistic, // Thêm AStatistic
} from "ant-design-vue";
import dayjs from "dayjs";

// --- Store, Router, Route ---
const router = useRouter();
const route = useRoute();
const store = useStore();
const creationScope = computed(() => route.query.scope || "company");

// --- State ---
const loading = ref(false);
const loadingUsers = ref(false);
const targetValues = ref({}); // Lưu target nhập trong bảng { key: value }
const selectedRowKeys = ref([]);
const assignmentError = ref(null);
const formRef = ref();
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);

// Form state - Thêm key 'targets'
const form = ref({
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
  section_id: [],
  department_id: [],
  assigned_user_id: null,
  description: "",
  targets: {},
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
// Lấy danh sách từ store
const departments = computed(
  () => store.getters["departments/departmentList"] || []
);
const rawSections = computed(() => store.getters["sections/sectionList"] || []);
const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const kpiTemplateList = computed(
  () => store.getters["kpis/kpiListAll"] || []
);
const loadingKpiTemplates = computed(() => store.getters["kpis/loadingAll"]);

const departmentTreeData = ref([]);

const loadDepartmentTreeData = async () => {
  const departmentsList = departments.value || [];
  const result = [];

  for (const dept of departmentsList) {
    const sections = await store.dispatch('sections/fetchSectionsByDepartment', dept.id);

    const node = {
      key: `department - ${dept.id}`,
      id: dept.id,
      name: dept.name,
      type: 'department',
      children: (sections || []).map(section => ({
        key: `section - ${section.id}`,
        id: section.id,
        name: section.name,
        type: 'section',
        parentId: dept.id
      }))
    };

    result.push(node);
  }

  departmentTreeData.value = result;
};

const kpiTemplateOptions = computed(() =>
  kpiTemplateList.value.map((kpi) => ({
    value: kpi.id,
    label: kpi.name,
  }))
);

// === Lấy Role và Định nghĩa Quyền ===
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const canAccessCreatePage = computed(() =>
  ["admin", "manager", "department", "section"].includes(effectiveRole.value)
);
const canAssignDirectlyToUser = computed(() => {
  if (effectiveRole.value === "admin") return creationScope.value !== "company";
  return (
    ["department", "section"].includes(effectiveRole.value) &&
    creationScope.value === effectiveRole.value
  );
});
const canAssignToUnits = computed(() => {
  return (
    ["admin", "manager"].includes(effectiveRole.value) &&
    creationScope.value === "company"
  );
});
const isAssigningToUnits = computed(
  () => canAssignToUnits.value && selectedRowKeys.value.length > 0
);
// ====================================

// Cấu hình cột bảng Assign
const columns = [
  {
    title: "Department / Section",
    dataIndex: "name",
    key: "name",
  },
  {
    title: "Target",
    key: "target",
    slots: {
      customRender: "target",
    },
    width: "150px",
  },
];

// Cấu hình lựa chọn dòng cho bảng Assign
const rowSelection = computed(() => ({
  type: "checkbox",
  selectedRowKeys: selectedRowKeys.value,
  getCheckboxProps: (record) => ({
    disabled: !!form.value.assigned_user_id,
    name: record.name,
  }),
  onSelect: (record, selected) => {
    if (form.value.assigned_user_id) return;
    let currentSelectedKeys = [...selectedRowKeys.value];
    let currentSectionIds = [...form.value.section_id];
    const isDepartment = record.type === "department";
    const recordKey = record.key;
    const recordId = record.id;
    if (isDepartment) {
      const departmentData = departmentTreeData.value.find(
        (d) => d.key === recordKey
      );
      const childSections = departmentData?.children;
      const childSectionKeys = childSections.map((section) => section.key);
      const childSectionIds = childSections.map((section) => section.id);
      const keysToAffect = [recordKey, ...childSectionKeys];
      if (selected) {
        keysToAffect.forEach((k) => {
          if (!currentSelectedKeys.includes(k)) currentSelectedKeys.push(k);
        });
        childSectionIds.forEach((id) => {
          if (!currentSectionIds.includes(id)) currentSectionIds.push(id);
        });
      } else {
        const keysToRemoveSet = new Set(keysToAffect);
        currentSelectedKeys = currentSelectedKeys.filter(
          (key) => !keysToRemoveSet.has(key)
        );
        const childIdSet = new Set(childSectionIds);
        currentSectionIds = currentSectionIds.filter(
          (id) => !childIdSet.has(id)
        );
        keysToAffect.forEach((key) => delete targetValues.value[key]);
      }
    } else if (record.type === "section") {
      if (selected) {
        if (!currentSelectedKeys.includes(recordKey))
          currentSelectedKeys.push(recordKey);
        if (!currentSectionIds.includes(recordId))
          currentSectionIds.push(recordId);
      } else {
        currentSelectedKeys = currentSelectedKeys.filter(
          (key) => key !== recordKey
        );
        currentSectionIds = currentSectionIds.filter((id) => id !== recordId);
        delete targetValues.value[recordKey];
      }
      const parentDepartment = departmentTreeData.value.find((dept) =>
        dept.children?.some((child) => child.id === record.id)
      );
      if (parentDepartment) {
        const parentKey = parentDepartment.key;
        const parentChildrenKeys = parentDepartment.children.map(
          (child) => child.key
        );
        const tempSelectedKeysSet = new Set(currentSelectedKeys);
        const allChildrenSelected = parentChildrenKeys.every((childKey) =>
          tempSelectedKeysSet.has(childKey)
        );
        const isParentCurrentlySelected = tempSelectedKeysSet.has(parentKey);
        if (allChildrenSelected && !isParentCurrentlySelected) {
          currentSelectedKeys.push(parentKey);
        } else if (!allChildrenSelected && isParentCurrentlySelected) {
          currentSelectedKeys = currentSelectedKeys.filter(
            (key) => key !== parentKey
          );
          delete targetValues.value[parentKey];
        }
      }
    }
    selectedRowKeys.value = currentSelectedKeys;
    form.value.section_id = currentSectionIds;
    const finalSelectedKeysSet = new Set(selectedRowKeys.value);
    const selectedDepartmentIds = new Set();
    departments.value.forEach((dept) => {
      const deptKey = `department - ${dept.id}`;
      if (finalSelectedKeysSet.has(deptKey)) {
        selectedDepartmentIds.add(dept.id);
      } else {
        const currentDeptData = departmentTreeData.value.find(
          (d) => d.id === dept.id
        );
        const sectionsInDept = currentDeptData?.children;
        if (
          sectionsInDept.some((sec) =>
            finalSelectedKeysSet.has(`section - ${sec.id}`)
          )
        ) {
          selectedDepartmentIds.add(dept.id);
        }
      }
    });
    form.value.department_id = Array.from(selectedDepartmentIds).filter(
      Boolean
    );
  },
}));

const overallTargetValue = computed(() => {
  // Chuyển đổi target tổng thành số, mặc định là 0 nếu không hợp lệ
  const target = parseFloat(form.value.target);
  return isNaN(target) ? 0 : target;
});

const totalAssignedTarget = computed(() => {
  let total = 0;
  selectedRowKeys.value.forEach((key) => {
    // Chỉ tính tổng các target được nhập cho các dòng đang được chọn
    const targetValue = form.value.targets[key]; // Lấy từ form model đã parse
    if (
      targetValue !== undefined &&
      targetValue !== null &&
      !isNaN(targetValue) &&
      targetValue >= 0
    ) {
      // *** Lưu ý về phân cấp: Logic này đang cộng tất cả target được nhập
      // *** cho các dòng được chọn (cả cha và con nếu cả hai cùng được chọn và nhập target).
      // *** Nếu bạn muốn chỉ cộng target của cấp thấp nhất được chọn, logic sẽ phức tạp hơn.
      total += Number(targetValue);
    }
  });
  return total;
});

const remainingTarget = computed(() => {
  // Làm tròn để tránh lỗi dấu phẩy động nhỏ
  return parseFloat((overallTargetValue.value - totalAssignedTarget.value).toFixed(5));
});

const isOverAssigned = computed(() => {
  // So sánh với sai số nhỏ để tránh lỗi dấu phẩy động
  return remainingTarget.value < -1e-9; // Âm một chút cũng coi là vượt
});

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
    section_id: [],
    department_id: [],
    assigned_user_id: null,
    description: "",
    targets: {},
  };
  selectedRowKeys.value = [];
  targetValues.value = {};
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
// Xử lý input target
const handleTargetChange = (key, value) => {
  const targetKey = String(key);
  if (form.value.assigned_user_id) return;
  if (value === null || value === "" || isNaN(value)) {
    delete targetValues.value[targetKey];
    delete form.value.targets[targetKey];
  } else {
    const numValue = parseFloat(value);
    targetValues.value[targetKey] = numValue;
    form.value.targets[targetKey] = numValue;
  }
  formRef.value?.validateFields([["targets", targetKey]]);
  if (!isAssigningToUnits.value && form.value.assigned_user_id === null) {
    formRef.value?.validateFields(["assigned_user_id"]).catch(() => { });
  }
}; // Validate để xóa lỗi nếu có } };
const handleNumericInput = (field, event) => {
  let value = event.target.value;
  value = value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  form.value[field] = value;
};
// Validate weight
const validateWeight = async (_rule, value) => {
  if (!value && value !== 0) return Promise.resolve();
  if (isNaN(value)) return Promise.reject("Weight must be a number");
  const numValue = parseFloat(value);
  if (numValue < 0 || numValue > 100)
    return Promise.reject("Weight must be between 0 and 100");
  return Promise.resolve();
};
// Quay lại
const goBack = () => {
  router.go(-1);
};

// === HÀM SUBMIT (Đã cập nhật payload và kiểm tra quyền) ===
const handleChangeCreate = async () => {
  loading.value = true;
  assignmentError.value = null;

  try {
    await formRef.value?.validate(); // Validate form trước

    const assignmentsPayload = {
      from: creationScope.value,
      to_sections: [],
      to_departments: [],
      to_user: null,
    };
    const departmentTargets = new Map();
    let hasValidAssignment = false;
    let missingTargetError = false;

    if (form.value.assigned_user_id && canAssignDirectlyToUser.value) {
      assignmentsPayload.to_user = { id: form.value.assigned_user_id };
      hasValidAssignment = true;
    } else if (selectedRowKeys.value?.length > 0 && canAssignToUnits.value) {
      selectedRowKeys.value.forEach((key) => {
        const targetValue = form.value.targets[key];
        const isTargetEnteredAndValid =
          targetValue !== undefined &&
          targetValue !== null &&
          !isNaN(targetValue) &&
          targetValue >= 0;
        const numericTarget = isTargetEnteredAndValid
          ? Number(targetValue)
          : null;

        if (key.startsWith("section - ")) {
          const sectionId = parseInt(key.split(" - ")[1], 10);
          if (!isNaN(sectionId)) {
            if (isTargetEnteredAndValid) {
              const sectionData = rawSections.value.find((s) => s.id === sectionId);
              const departmentId = sectionData?.department_id;

              assignmentsPayload.to_sections.push({
                id: sectionId,
                target: numericTarget,
              });
              if (departmentId && !departmentTargets.has(departmentId)) {
                departmentTargets.set(departmentId, numericTarget);
              }
              hasValidAssignment = true;
              if (
                sectionData?.department_id &&
                !departmentTargets.has(sectionData.department_id)
              ) {
                departmentTargets.set(sectionData.department_id, null);
              }
            } else {
              missingTargetError = true;
            }
          }
        } else if (key.startsWith("department - ")) {
          // <<< Thêm dấu cách
          const departmentId = parseInt(key.split(" - ")[1], 10); // <<< Split bằng ' - '
          if (!isNaN(departmentId)) {
            if (isTargetEnteredAndValid) {
              departmentTargets.set(departmentId, numericTarget);
              hasValidAssignment = true;
            } else if (
              selectedRowKeys.value.includes(key) &&
              !departmentTargets.has(departmentId)
            ) {
              departmentTargets.set(departmentId, null);
            }
            // Logic kiểm tra lỗi thiếu target cho department cha (nếu cần)
            const childSections =
              departmentTreeData.value.find((d) => d.id === departmentId)
                ?.children;
            const selectedChildKeys = childSections
              .map((s) => `section - ${s.id}`)
              .filter((k) => selectedRowKeys.value.includes(k));
            const hasValidChildTarget = selectedChildKeys.some((k) => {
              const childTarget = form.value.targets[k]; // Đọc từ form model
              return (
                childTarget !== undefined &&
                childTarget !== null &&
                !isNaN(childTarget) &&
                childTarget >= 0
              );
            });
            if (
              selectedRowKeys.value.includes(key) &&
              !isTargetEnteredAndValid &&
              (!selectedChildKeys.length || !hasValidChildTarget)
            ) {
              missingTargetError = true;
            }
          }
        }
        // =================================
      });

      // Tạo mảng to_departments từ map
      departmentTargets.forEach((target, id) => {
        assignmentsPayload.to_departments.push({ id: id, target: target });
      });

      // Kiểm tra lỗi thiếu target cuối cùng
      if (missingTargetError) {
        assignmentError.value =
          "Please enter a valid Target (>= 0) for all selected items.";
        throw new Error(assignmentError.value);
      }
    }

    // Kiểm tra cuối cùng (dùng hasValidAssignment)
    if (!assignmentsPayload.to_user && !hasValidAssignment) {
      assignmentError.value =
        "Assignment Required: Please assign to a user OR select at least one unit and enter its target.";
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
      form.value.target !== null && !isNaN(form.value.target)
        ? Number(form.value.target)
        : null;
    const numericMainWeight =
      form.value.weight !== null && !isNaN(form.value.weight)
        ? Number(form.value.weight)
        : null;

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
      assignments: {
        from: creationScope.value,
        to_user: assignmentsPayload.to_user,
        to_departments: assignmentsPayload.to_departments,
        to_sections: assignmentsPayload.to_sections,
      },
    };
    if (kpiData.assignments.to_user) {
      delete kpiData.assignments.to_departments;
      delete kpiData.assignments.to_sections;
    } else {
      delete kpiData.assignments.to_user;
    }

    console.log("Submitting KPI Data (Final Structure):", kpiData);
    await store.dispatch("kpis/createKpi", kpiData);
    notification.success({ message: "KPI created successfully" });
    resetForm(true);
    // Điều hướng...
    if (creationScope.value === "company") router.push("/kpis/company");
    else if (creationScope.value === "department")
      router.push("/kpis/department");
    else if (creationScope.value === "section") router.push("/kpis/section");
    else if (creationScope.value === "individual")
      router.push("/kpis/individual");
    else router.push("/");
  } catch (error) {
    if (error instanceof Error && error.message === assignmentError.value) {
      /* Lỗi đã hiển thị */
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
    const firstErrorField = errorInfo.errorFields[0];
    const fieldName = Array.isArray(firstErrorField.name)
      ? firstErrorField.name.join(".")
      : firstErrorField.name;
    const errors = Array.isArray(firstErrorField.errors)
      ? firstErrorField.errors.join(", ")
      : "Unknown error";
    errorMessages = `Error in field '${fieldName}': ${errors}`;
  }
  notification.error({
    message: "Form Validation Failed",
    description: errorMessages,
  });
};

// --- Validation Rules cho Form ---
const validateEndDate = async (_rule, value) => {
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
  end_date: [
    {
      validator: validateEndDate,
      trigger: "change",
    },
  ],
  // Không cần rule cho section_id_table ở đây nữa
});

// --- Watchers ---
watch(
  () => form.value.assigned_user_id,
  (newUserId) => {
    if (newUserId && selectedRowKeys.value.length > 0) {
      selectedRowKeys.value = [];
      form.value.section_id = [];
      form.value.department_id = [];
      targetValues.value = {};
      form.value.targets = {};
      formRef.value?.clearValidate(["targets"]);
    }
  }
);
watch(
  selectedRowKeys,
  (newKeys) => {
    if (newKeys?.length > 0 && form.value.assigned_user_id) {
      form.value.assigned_user_id = null;
      formRef.value?.clearValidate(["assigned_user_id"]);
    }
  },
  {
    deep: true,
  }
);

// --- Lifecycle Hook ---
onMounted(async () => {
  loadingUsers.value = true;
  try {
    await Promise.all([
      store.dispatch("departments/fetchDepartments"),
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("sections/fetchSections"),
      store.dispatch("kpis/fetchAllKpisForSelect"),
      loadDepartmentTreeData(),
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
    });
  } finally {
    loadingUsers.value = false;
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