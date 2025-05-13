<template>
  <div class="performance-objectives-page">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboard") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{
        $t("performanceObjectivesTitle")
      }}</a-breadcrumb-item>
    </a-breadcrumb>

    <a-card
      :title="$t('performanceObjectivesEvaluation')"
      class="rounded-xl shadow-md"
    >
      <!-- Selection Row -->
      <a-row :gutter="16" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="8" v-if="isDivisionSelectionVisible">
          <a-form-item :label="$t('selectDivision')">
            <a-select
              v-model:value="selectedDivision"
              :placeholder="$t('selectDivisionPlaceholder')"
              allow-clear
            >
              <a-select-option
                v-for="dept in departments"
                :key="dept.id"
                :value="dept.id"
              >
                {{ dept.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :sm="12" :md="8">
          <a-form-item :label="$t('selectEmployee')">
            <a-select
              v-model:value="selectedEmployee"
              :placeholder="$t('selectEmployeePlaceholder')"
              @change="handleEmployeeChange"
              :loading="isLoadingEmployees"
              :disabled="
                isLoadingEmployees ||
                (isDivisionSelectionVisible && !selectedDivision) ||
                (!isDivisionSelectionVisible &&
                  !(
                    currentUser &&
                    ((currentUser.role === 'section' &&
                      currentUser.sectionId) ||
                      (currentUser.role === 'department' &&
                        currentUser.departmentId))
                  ))
              "
              show-search
              :filter-option="employeeFilterOption"
              allow-clear
            >
              <a-select-option
                v-for="emp in employeesToDisplay"
                :key="emp.id"
                :value="emp.id"
              >
                {{ emp.first_name }} {{ emp.last_name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row class="mb-4" gutter="16" style="margin-bottom: 20px">
        <a-col
          :span="8"
          v-if="
            selectedEmployee &&
            currentEvaluationStatus &&
            objectivesData.length > 0
          "
        >
          <strong>Status: </strong>
          <a-tag
            :color="getObjectiveEvaluationStatusColor(currentEvaluationStatus)"
          >
            {{ $t("objectiveEvaluationStatus." + currentEvaluationStatus) }}
          </a-tag>
        </a-col>
      </a-row>

      <a-spin :spinning="isLoadingObjectives">
        <div v-if="!selectedEmployee" class="empty-state">
          <a-empty :description="$t('selectEmployeeToViewObjectives')" />
        </div>
        <div
          v-else-if="
            selectedEmployee &&
            !isLoadingObjectives &&
            processedTableData.length === 0
          "
          class="empty-state"
        >
          <a-empty :description="$t('noObjectivesAssigned')" />
        </div>

        <a-table
          v-else
          :columns="columns"
          :data-source="processedTableData"
          :pagination="false"
          bordered
          rowKey="key"
          size="middle"
          class="performance-objectives-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="!record.isGroup">
              <template v-if="column.key === 'supervisorEvalScore'">
                <a-input-number
                  v-model:value="record.supervisorEvalScore"
                  style="width: 100%"
                  :formatter="supervisorScoreFormatter"
                  :parser="supervisorScoreParser"
                  :disabled="isEvaluationClosed"
                  @change="
                    () => {
                      console.log(
                        '[TPL DEBUG] supervisorEvalScore @change. Current record.supervisorEvalScore:',
                        record.supervisorEvalScore
                      );
                      handleEvaluationChange(record.key);
                    }
                  "
                />
              </template>

              <!-- Note -->
              <template v-else-if="column.key === 'note'">
                <a-textarea
                  v-model:value="record.note"
                  :rows="2"
                  @change="() => handleEvaluationChange(record.key)"
                  :disabled="isEvaluationClosed"
                />
              </template>

              <!-- Weight Score cho Supervisor -->
              <template v-else-if="column.key === 'weightedScoreSupervisor'">
                <span>{{
                  calcWeightedScore(record.supervisorEvalScore, record.weight)
                }}</span>
              </template>

              <!-- Target -->
              <template v-else-if="column.key === 'target'">
                <span
                  >{{ formatNumberRef(record.target) }} ({{
                    record.unit
                  }})</span
                >
              </template>

              <template v-else-if="column.key === 'actualResult'">
                <span
                  >{{ formatNumberRef(record.actualResult) }} ({{
                    record.unit
                  }})</span
                >
              </template>

              <!-- Mặc định (Objective Item, Actual Result, KPI Name) -->
              <template v-else>
                {{ record[column.dataIndex] }}
              </template>
            </template>
          </template>
        </a-table>

        <!-- Tổng kết & Save Button -->
        <div
          v-if="selectedEmployee && processedTableData.length > 0"
          class="mt-4"
        >
          <a-row justify="space-between" align="middle">
            <a-col>
              <p>
                <strong>{{ $t("totalWeightedScoreSupervisor") }}:</strong>
                {{ totalWeightedScoreSupervisor.toFixed(2) }}
              </p>
              <p>
                <strong>{{ $t("averageScoreSupervisor") }}:</strong>
                {{ averageScoreSupervisor.toFixed(2) }}
              </p>
            </a-col>
            <a-col>
              <a-button
                type="primary"
                @click="saveEvaluation"
                :loading="isSaving"
                :disabled="isEvaluationClosed"
              >
                {{ $t("saveEvaluation") }}
              </a-button>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, h } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import {
  notification,
  Empty as AEmpty,
  Spin as ASpin,
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  Tag as ATag, // + Import ATag
  FormItem as AFormItem,
  InputNumber as AInputNumber,
  Textarea as ATextarea,
} from "ant-design-vue";

const { t: $t } = useI18n();
const store = useStore();
import {
  ObjectiveEvaluationStatus,
  ObjectiveEvaluationStatusColor,
} from "@/core/constants/objectiveEvaluationStatus";

const currentUser = computed(() => store.getters["auth/user"]);

const isDivisionSelectionVisible = computed(() => {
  return (
    currentUser.value &&
    (currentUser.value.role === "admin" || currentUser.value.role === "manager")
  );
});

const selectedDivision = ref(null);
const selectedEmployee = ref(null);

const departments = computed(
  () => store.getters["departments/departmentList"] || []
);
const allEmployees = computed(() => store.getters["employees/userList"] || []);
const isLoadingEmployees = computed(() => store.getters["employees/isLoading"]);

const objectivesData = ref([]);
const isLoadingObjectives = computed(
  () => store.getters["kpiEvaluations/isLoadingAssignedPerformanceObjectives"]
);
const isSaving = computed(
  () => store.getters["kpiEvaluations/isSavingPerformanceObjectiveEvaluation"]
);
const currentEvaluationStatus = computed(
  () => store.getters["kpiEvaluations/getCurrentPerformanceEvaluationStatus"]
); // Map status from store

const isEvaluationClosed = computed(() => {
  const closedStatuses = [
    ObjectiveEvaluationStatus.APPROVED,
    ObjectiveEvaluationStatus.REJECTED_BY_SECTION,
    ObjectiveEvaluationStatus.REJECTED_BY_DEPT,
    ObjectiveEvaluationStatus.REJECTED_BY_MANAGER,
    // Thêm các trạng thái khác nếu cần, ví dụ: CANCELED
  ];
  return closedStatuses.includes(currentEvaluationStatus.value);
});

const getObjectiveEvaluationStatusColor = (status) => {
  return (
    ObjectiveEvaluationStatusColor[status] ||
    ObjectiveEvaluationStatusColor.default ||
    "default"
  );
};

const employeesToDisplay = computed(() => {
  if (!allEmployees.value || allEmployees.value.length === 0) return [];

  if (isDivisionSelectionVisible.value) {
    // Admin or Manager
    if (!selectedDivision.value) {
      return []; // Must select a division first
    }
    return allEmployees.value.filter(
      (emp) => emp.departmentId === selectedDivision.value
    );
  } else {
    // For roles like 'section' or 'department'
    if (
      currentUser.value &&
      currentUser.value.role === "section" &&
      currentUser.value.sectionId
    ) {
      return allEmployees.value.filter(
        (emp) => emp.sectionId === currentUser.value.sectionId
      );
    } else if (
      currentUser.value &&
      currentUser.value.role === "department" &&
      currentUser.value.departmentId
    ) {
      return allEmployees.value.filter(
        (emp) => emp.departmentId === currentUser.value.departmentId
      );
    }
    return []; // Default to empty if not a section leader with a sectionId
  }
});

const formatNumberRef = ref((value) => {
  if (isNaN(value)) return value;
  const formatted = new Intl.NumberFormat("en-US").format(value);
  console.log("Formatted value:", formatted);
  return formatted;
});

const formatNumber = (value) => {
  if (isNaN(value)) return value;
  const formatted = new Intl.NumberFormat("en-US").format(value);
  console.log("Formatted value:", formatted);
  return formatted;
};

const supervisorScoreFormatter = (value) => {
  console.log(
    "[DEBUG supervisorScoreFormatter] Received raw value:",
    value,
    typeof value
  );
  if (value == null || String(value).trim() === "") {
    console.log(
      '[DEBUG supervisorScoreFormatter] Value is null or empty, returning ""'
    );
    return "";
  }
  const num = Number(value);
  if (isNaN(num)) {
    console.log(
      "[DEBUG supervisorScoreFormatter] Value is NaN after Number() conversion. Original value:",
      value,
      "Returning original."
    );
    return String(value); // Hoặc return '' nếu muốn hiển thị giá trị không hợp lệ là rỗng
  }
  const formatted = new Intl.NumberFormat("en-US").format(num);
  console.log(
    "[DEBUG supervisorScoreFormatter] Returned formatted value:",
    formatted
  );
  return formatted;
};

const supervisorScoreParser = (displayValue) => {
  console.log(
    "[DEBUG supervisorScoreParser] Received display value:",
    displayValue,
    typeof displayValue
  );
  if (displayValue == null || String(displayValue).trim() === "") {
    console.log(
      '[DEBUG supervisorScoreParser] Display value is null or empty, returning "" for AInputNumber to parse as null.'
    );
    return ""; // Ant Design InputNumber thường parse chuỗi rỗng thành null cho model
  }
  const cleanedValue = String(displayValue).replace(/,/g, "");
  console.log(
    "[DEBUG supervisorScoreParser] Returned cleaned string for AInputNumber to convert:",
    cleanedValue
  );
  return cleanedValue; // Trả về chuỗi đã làm sạch, AInputNumber sẽ tự chuyển đổi nó thành number cho v-model
};

const numberOfColumns = 7; // kpiName, target, actualResult, weight, supervisorEvalScore, weightedScoreSupervisor, note
const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "name",
    key: "name",
    width: "20%",
    customRender: ({ record, text }) => {
      if (record.isGroup) {
        // This is the group header row
        return {
          children: h("strong", null, record.item),
          props: {
            colSpan: numberOfColumns,
            style: {
              backgroundColor: "#fafafa",
              textAlign: "left",
              paddingLeft: "16px",
              paddingTop: "12px",
              paddingBottom: "12px",
            },
          },
        };
      }
      return text; // For non-group rows, displays record.name (KPI Name)
    },
  },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "15%",
    customRender: ({ record }) => {
      if (record.isGroup) return { props: { colSpan: 0 } };
      const targetValue =
        typeof record.target === "string"
          ? parseFloat(record.target)
          : record.target;
      const formattedTarget = formatNumber(targetValue);
      return record.unit
        ? `${formattedTarget} (${record.unit})`
        : formattedTarget || "";
    },
  },
  {
    title: $t("actualResult"),
    dataIndex: "actualResult",
    key: "actualResult",
    width: "15%",
    customRender: ({ record }) => {
      if (record.isGroup) return { props: { colSpan: 0 } };
      const actualResultValue =
        typeof record.actualResult === "string"
          ? parseFloat(record.actualResult)
          : record.actualResult;
      const formattedActualResult = formatNumber(actualResultValue);
      return record.unit
        ? `${formattedActualResult} (${record.unit})`
        : formattedActualResult || "";
    },
  },
  {
    title: $t("weight"),
    dataIndex: "weight",
    key: "weight",
    width: "5%",
    customRender: ({ record, text }) => {
      if (record.isGroup) return { props: { colSpan: 0 } };
      return text;
    },
  },
  {
    title: $t("supervisorEvalScore"),
    // dataIndex is not strictly needed if bodyCell handles rendering and v-model updates the record
    key: "supervisorEvalScore",
    width: "10%",
    customRender({ record }) {
      if (record.isGroup) return { props: { colSpan: 0 } };
      return null; // Để bodyCell trong template xử lý việc render a-input-number
    },
  },
  {
    title: $t("notes"),
    dataIndex: "note",
    key: "note",
    width: "15%",
    customRender: ({ record }) => {
      if (record.isGroup) return { props: { colSpan: 0 } };
      return null; // Allow bodyCell to render the ATextarea
    },
  },
]);

const processedTableData = computed(() => {
  if (!objectivesData.value || objectivesData.value.length === 0) return [];

  const grouped = objectivesData.value.reduce((acc, curr) => {
    const aspect = curr.bscAspect || "Uncategorized";
    if (!acc[aspect]) {
      acc[aspect] = [];
    }

    console.log("Mapping Objective:", {
      id: curr.id,
      target: curr.target,
      actualResult: curr.actualResult,
      unit: curr.unit,
    }); // Log detailed information about each objective

    acc[aspect].push({
      ...curr,
      supervisorEvalScore:
        curr.supervisorEvalScore === undefined
          ? null
          : curr.supervisorEvalScore,
      unit: curr.unit || "", // Ensure unit is part of the object if it comes from API
      note: curr.note === undefined ? "" : curr.note,
    });
    return acc;
  }, {});

  const result = [];

  const aspectOrder = ["A. Performance Objectives", "B. Training Objectives"];
  const sortedAspects = Object.keys(grouped).sort((a, b) => {
    const indexA = aspectOrder.indexOf(a);
    const indexB = aspectOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const aspect of sortedAspects) {
    result.push({ key: `group-${aspect}`, isGroup: true, item: aspect });
    result.push(...grouped[aspect].map((obj) => ({ ...obj, key: obj.id })));
  }

  console.log("Processed Table Data:", result); // Log final processed data for debugging

  return result;
});

const calcWeightedScore = (score, weight) => {
  if (typeof score === "number" && typeof weight === "number") {
    return score * weight;
  }
  return 0;
};

const totalWeightedScoreSupervisor = computed(() => {
  return objectivesData.value.reduce((sum, item) => {
    return sum + calcWeightedScore(item.supervisorEvalScore, item.weight);
  }, 0);
});

const averageScoreSupervisor = computed(() => {
  const scoredItems = objectivesData.value.filter(
    (item) =>
      typeof item.supervisorEvalScore === "number" &&
      typeof item.weight === "number" &&
      item.weight > 0
  );
  const totalWeightOfScoredItems = scoredItems.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  if (totalWeightOfScoredItems === 0) return 0;
  return totalWeightedScoreSupervisor.value / totalWeightOfScoredItems;
});

const handleEmployeeChange = () => {
  fetchObjectives();
};

const employeeFilterOption = (input, option) => {
  return option.children[0].children
    .toLowerCase()
    .includes(input.toLowerCase());
};

const fetchInitialData = async () => {
  store.dispatch("departments/fetchDepartments");
  store.dispatch("employees/fetchUsers");
};

const fetchObjectives = async () => {
  if (selectedEmployee.value) {
    // Removed selectedCycle condition
    objectivesData.value = [];
    try {
      const fetchedMappedObjectives = await store.dispatch(
        "kpiEvaluations/fetchAssignedPerformanceObjectives",
        {
          employeeId: selectedEmployee.value,
          // cycleId: selectedCycle.value, // Nếu bạn có selectedCycle, hãy truyền nó vào đây
        }
      );

      objectivesData.value = fetchedMappedObjectives || [];
    } catch (error) {
      notification.error({
        message: $t("errorFetchingObjectives"),
        description: error.message,
      });
      objectivesData.value = [];
    }
  } else {
    objectivesData.value = [];
  }
};

const handleEvaluationChange = (objectiveKey) => {
  // objectiveKey is now expected to be the objective's ID for non-group items,
  // as generated in processedTableData.
  const objectiveInProcessedData = processedTableData.value.find(
    (item) => item.key === objectiveKey
  );
  if (objectiveInProcessedData) {
    // If objectiveKey is item.id (for non-group items), this lookup is direct.
    const originalObjective = objectivesData.value.find(
      (item) => item.id === objectiveKey
    );
    if (originalObjective) {
      originalObjective.supervisorEvalScore =
        objectiveInProcessedData.supervisorEvalScore;
      originalObjective.note = objectiveInProcessedData.note;
    }
  }
};

const saveEvaluation = async () => {
  if (!selectedEmployee.value) {
    // Removed selectedCycle condition
    notification.error({
      message: $t("error"),
      description: $t("pleaseSelectEmployee"),
    }); // Updated error message
    return;
  }

  const evaluationPayload = {
    employeeId: selectedEmployee.value,
    evaluations: objectivesData.value.map((obj) => ({
      objectiveId: obj.id,
      score: obj.supervisorEvalScore,
      note: obj.note,
    })),
  };

  try {
    await store.dispatch(
      "kpiEvaluations/savePerformanceObjectiveEvaluation",
      evaluationPayload
    ); // Corrected dispatch path
  } catch (error) {
    notification.error({
      message: $t("errorSavingEvaluation"),
      description: error.message,
    });
  }
};

onMounted(() => {
  fetchInitialData();
});

// Watcher for when selectedDivision changes (primarily for admin/manager)
watch(selectedDivision, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    // Ensure it only runs on actual change
    selectedEmployee.value = null;
    objectivesData.value = []; // Clear objectives when division changes
  }
});

// Watcher for when the current user ID changes, to reset selections
watch(
  () => currentUser.value?.id,
  (newUserId, oldUserId) => {
    if (newUserId !== oldUserId && oldUserId !== undefined) {
      // If the user actually changes
      selectedDivision.value = null; // Reset division
      selectedEmployee.value = null; // Reset employee
      objectivesData.value = []; // Clear objectives
    }
  }
);

watch(selectedEmployee, () => {
  fetchObjectives();
});

defineExpose({
  formatNumberInTemplate: formatNumberRef.value,
});
</script>

<style scoped>
.performance-objectives-page {
  padding: 24px;
}

.mt-4 {
  margin-top: 1rem;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
}

/* Ensure the table cells have enough padding and prevent text overflow */
.performance-objectives-table td {
  padding: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
