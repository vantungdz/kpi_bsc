<!-- filepath: e:\project\kpi-frontend\src\features\formula\views\FormulaManageForm.vue -->
<template>
  <a-card class="formula-manage-form">
    <LoadingOverlay :visible="loading" />
    <div class="form-header">
      <a-avatar
        class="form-header-icon"
        size="large"
        style="background: linear-gradient(135deg, #1976d2 60%, #42a5f5 100%)"
      >
        <template #icon>
          <CalculatorOutlined />
        </template>
      </a-avatar>
      <h2 class="form-title">{{ $t("formula.title") }}</h2>
    </div>
    <a-divider />
    <a-form
      :model="form"
      :rules="rules"
      ref="formRef"
      layout="vertical"
      @finish="handleSubmit"
    >
      <a-row :gutter="20">
        <a-col :xs="24">
          <a-form-item :label="$t('formula.name')" name="name">
            <div style="display: flex; align-items: center; gap: 8px">
              <a-input
                v-model:value="form.name"
                :placeholder="$t('formula.namePlaceholder')"
              >
                <template #prefix>
                  <EditOutlined />
                </template>
              </a-input>
              <a-tooltip
                placement="top"
                :mouseEnterDelay="0.1"
                overlayClassName="name-tooltip"
              >
                <template #title>
                  <div style="max-width: 280px">
                    <b>{{ $t("formula.nameTooltip.title") }}</b
                    ><br />
                    <ul style="padding-left: 18px; margin: 8px 0">
                      <li>{{ $t("formula.nameTooltip.rule1") }}</li>
                      <li>{{ $t("formula.nameTooltip.rule2") }}</li>
                      <li>{{ $t("formula.nameTooltip.rule3") }}</li>
                      <li>{{ $t("formula.nameTooltip.example") }}</li>
                    </ul>
                    <small style="color: #666">{{
                      $t("formula.nameTooltip.note")
                    }}</small>
                  </div>
                </template>
                <a-button type="text" size="small" class="tooltip-btn">
                  <span class="tooltip-icon"><InfoCircleOutlined /></span>
                </a-button>
              </a-tooltip>
            </div>
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item :label="$t('formula.expression')" name="expression">
        <div style="display: flex; align-items: center; gap: 8px">
          <a-input
            v-model:value="form.expression"
            :placeholder="$t('formula.expressionPlaceholder')"
          >
            <template #prefix>
              <FunctionOutlined />
            </template>
          </a-input>
          <a-button
            type="text"
            size="small"
            class="tooltip-btn"
            @click="showExpressionHelp = true"
          >
            <span class="tooltip-icon"><QuestionCircleOutlined /></span>
          </a-button>
        </div>
      </a-form-item>

      <!-- Enable Auto Scoring Checkbox -->
      <a-form-item>
        <a-checkbox v-model:checked="enableAutoScoring">
          Enable Auto Scoring (Tự động tính điểm)
        </a-checkbox>
      </a-form-item>

      <!-- Scoring Rules Table -->
      <a-form-item v-if="enableAutoScoring" label="Scoring Rules (Quy tắc tính điểm)">
        <a-table
          :data-source="scoringRanges"
          :columns="scoringRulesColumns"
          :pagination="false"
          size="small"
          bordered
          row-key="id"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'min'">
              <a-input-number
                v-model:value="record.min"
                :placeholder="'Từ (>)'"
                style="width: 100%"
                :step="0.1"
              />
            </template>
            <template v-else-if="column.key === 'max'">
              <a-input-number
                v-model:value="record.max"
                :placeholder="'Đến (<=)'"
                style="width: 100%"
                :step="0.1"
              />
            </template>
            <template v-else-if="column.key === 'score'">
              <a-input-number
                v-model:value="record.score"
                :placeholder="'Điểm'"
                :min="1"
                :max="5"
                :step="0.5"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-button
                type="text"
                danger
                size="small"
                @click="removeRange(index)"
                :disabled="scoringRanges.length === 1"
              >
                <template #icon><MinusCircleOutlined /></template>
              </a-button>
            </template>
          </template>
        </a-table>
        <a-button
          type="dashed"
          block
          @click="addRange"
          style="margin-top: 8px"
        >
          <template #icon><PlusOutlined /></template>
          Add Range
        </a-button>
      </a-form-item>

      <a-form-item :label="$t('formula.description')" name="description">
        <v-md-editor
          v-model="form.description"
          height="400px"
          :placeholder="$t('formula.descriptionPlaceholder')"
        ></v-md-editor>
      </a-form-item>
      <a-form-item>
        <a-button
          type="default"
          html-type="submit"
          :loading="loading"
          class="main-btn-modern"
          size="middle"
          shape="round"
        >
          <template #icon>
            <SaveOutlined />
          </template>
          {{ isEdit ? $t("common.update") : $t("common.add") }}
        </a-button>
        <a-button
          v-if="isEdit"
          @click="resetForm"
          class="cancel-btn-modern"
          size="middle"
          shape="round"
          style="margin-left: 8px"
        >
          <template #icon>
            <CloseOutlined />
          </template>
          {{ $t("common.cancel") }}
        </a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <div>
      <h3 class="list-title">
        <CalculatorOutlined style="margin-right: 6px" />{{
          $t("formula.listTitle")
        }}
      </h3>
      <a-table
        :data-source="formulaList"
        :columns="formulaColumns"
        row-key="id"
        size="small"
        :pagination="false"
        bordered
        v-if="formulaList && formulaList.length"
        class="formula-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'description'">
            <div>
              <a-badge
                v-if="record.scoringRules && record.scoringRules.enabled"
                count="Auto Scoring"
                :number-style="{ backgroundColor: '#52c41a' }"
                style="margin-bottom: 8px"
              />
              <v-md-editor
                v-if="record.description"
                :model-value="record.description"
                mode="preview"
                style="max-width: 400px; max-height: 150px; overflow: auto"
              ></v-md-editor>
              <span v-else style="color: #999">-</span>
            </div>
          </template>
        </template>
        <template #actions="{ record }">
          <a-tooltip :title="$t('formula.copyFormula')">
            <a-button
              size="small"
              type="text"
              @click="copyFormula(record)"
            >
              <template #icon><CopyOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip :title="$t('common.edit')">
            <a-button size="small" type="text" @click="editFormula(record)">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm
            :title="$t('formula.deleteConfirm')"
            :ok-text="$t('common.delete')"
            :cancel-text="$t('common.cancel')"
            @confirm="() => deleteFormula(record)"
          >
            <a-tooltip :title="$t('common.delete')">
              <a-button size="small" type="text" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </template>
      </a-table>
      <a-empty v-else :description="$t('common.empty')" />
    </div>
  </a-card>

  <!-- Expression Help Modal -->
  <a-modal
    v-model:open="showExpressionHelp"
    :title="$t('formula.helpModal.title')"
    width="800px"
    :footer="null"
    centered
  >
    <div class="expression-help-content">
      <h4>{{ $t("formula.helpModal.variablesTitle") }}</h4>
      <a-table
        :data-source="variablesData"
        :columns="variablesColumns"
        :pagination="false"
        size="small"
        bordered
        class="help-table"
      />

      <h4 style="margin-top: 24px">
        {{ $t("formula.helpModal.functionsTitle") }}
      </h4>
      <a-table
        :data-source="functionsData"
        :columns="functionsColumns"
        :pagination="false"
        size="small"
        bordered
        class="help-table"
      />

      <h4 style="margin-top: 24px">
        {{ $t("formula.helpModal.examplesTitle") }}
      </h4>
      <a-table
        :data-source="examplesData"
        :columns="examplesColumns"
        :pagination="false"
        size="small"
        bordered
        class="help-table"
      />
    </div>
  </a-modal>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { message } from "ant-design-vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import {
  CalculatorOutlined,
  CopyOutlined,
  EditOutlined,
  FunctionOutlined,
  SaveOutlined,
  CloseOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons-vue";

const { t: $t } = useI18n();

const store = useStore();
const formRef = ref();
const form = ref({
  id: null,
  name: "",
  code: "",
  expression: "",
  description: "",
  scoringRules: null,
});
const loading = computed(() => store.getters["formula/isFormulaLoading"]);
const isEdit = ref(false);
const showExpressionHelp = ref(false);
const enableAutoScoring = ref(false);
const scoringRanges = ref([
  { id: Date.now(), min: null, max: null, score: null },
]);

// Helper functions for code generation and validation
const generateCodeFromName = (name) => {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "") // Remove special characters except spaces
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
};

const validateNameFormat = (name) => {
  if (!name) return true; // Empty is handled by required rule
  // Allow letters (including Vietnamese), numbers, spaces, and common punctuation
  // Use Unicode property escapes for better Vietnamese support
  const nameRegex = /^[\p{L}\p{N}\s\-_.,()]+$/u;
  return nameRegex.test(name);
};

const validateNameLength = (name) => {
  if (!name) return true;
  return name.length >= 2 && name.length <= 100;
};

const checkNameDuplicate = (name, currentId = null) => {
  if (!name) return true;
  const existingFormulas = formulaList.value || [];
  return !existingFormulas.some(
    (formula) =>
      formula.name.toLowerCase() === name.toLowerCase() &&
      formula.id !== currentId,
  );
};

const rules = {
  name: [
    { required: true, message: $t("formula.nameRequired"), trigger: "blur" },
    {
      validator: (rule, value) => {
        if (!validateNameLength(value)) {
          return Promise.reject($t("formula.validation.nameLength"));
        }
        if (!validateNameFormat(value)) {
          return Promise.reject($t("formula.validation.nameFormat"));
        }
        if (!checkNameDuplicate(value, form.value.id)) {
          return Promise.reject($t("formula.validation.nameDuplicate"));
        }
        return Promise.resolve();
      },
      trigger: "blur",
    },
  ],
  expression: [
    {
      required: true,
      message: $t("formula.expressionRequired"),
      trigger: "blur",
    },
  ],
};

const formulaList = computed(() => store.getters["formula/getFormulas"] || []);
const formulaColumns = computed(() => [
  { title: $t("formula.name"), dataIndex: "name", key: "name" },
  {
    title: $t("formula.expression"),
    dataIndex: "expression",
    key: "expression",
  },
  {
    title: $t("formula.description"),
    dataIndex: "description",
    key: "description",
    width: 900,
  },
  {
    title: $t("common.actions"),
    key: "actions",
    slots: { customRender: "actions" },
    width: 140,
  },
]);

// Modal data for expression help — variables match backend buildFormulaScope
const variablesData = computed(() => [
  {
    key: "values",
    variable: "values",
    type: $t("formula.helpModal.array"),
    description: $t("formula.helpModal.valuesDesc"),
  },
  {
    key: "target",
    variable: "target",
    type: $t("formula.helpModal.number"),
    description: $t("formula.helpModal.targetDesc"),
  },
  {
    key: "months",
    variable: "months",
    type: $t("formula.helpModal.array"),
    description: $t("formula.helpModal.monthsDesc"),
  },
  {
    key: "weight",
    variable: "weight",
    type: $t("formula.helpModal.number"),
    description: $t("formula.helpModal.weightDesc"),
  },
]);

const functionsData = computed(() => [
  {
    key: "sum",
    function: "sum(arr)",
    description: $t("formula.helpModal.sumDesc"),
  },
  {
    key: "average",
    function: "average(arr)",
    description: $t("formula.helpModal.averageDesc"),
  },
  {
    key: "divide",
    function: "divide(a, b)",
    description: $t("formula.helpModal.divideDesc"),
  },
  {
    key: "dotMultiply",
    function: "dotMultiply(a, b)",
    description: $t("formula.helpModal.dotMultiplyDesc"),
  },
  {
    key: "dotDivide",
    function: "dotDivide(a, b)",
    description: $t("formula.helpModal.dotDivideDesc"),
  },
]);

const examplesData = computed(() => [
  {
    key: "basic",
    expression: "(sum(values)/sum(targets))*100",
    description: $t("formula.helpModal.basicExample"),
  },
  {
    key: "target",
    expression: "sum(values)/target*100",
    description: $t("formula.helpModal.targetExample"),
  },
  {
    key: "average",
    expression: "average(values)",
    description: $t("formula.helpModal.averageExample"),
  },
  {
    key: "monthsWeighted",
    expression: "divide(sum(dotMultiply(values, months)), sum(months))",
    description: $t("formula.helpModal.monthsWeightedExample"),
  },
]);

const variablesColumns = computed(() => [
  {
    title: $t("formula.helpModal.variable"),
    dataIndex: "variable",
    key: "variable",
    width: 100,
  },
  {
    title: $t("formula.helpModal.type"),
    dataIndex: "type",
    key: "type",
    width: 80,
  },
  {
    title: $t("formula.helpModal.description"),
    dataIndex: "description",
    key: "description",
  },
]);

const functionsColumns = computed(() => [
  {
    title: $t("formula.helpModal.function"),
    dataIndex: "function",
    key: "function",
    width: 120,
  },
  {
    title: $t("formula.helpModal.description"),
    dataIndex: "description",
    key: "description",
  },
]);

const examplesColumns = computed(() => [
  {
    title: $t("formula.helpModal.expression"),
    dataIndex: "expression",
    key: "expression",
    width: 200,
  },
  {
    title: $t("formula.helpModal.description"),
    dataIndex: "description",
    key: "description",
  },
]);

// Scoring Rules Table Columns — Từ (>): min exclusive. Đến (<=): max inclusive.
const scoringRulesColumns = [
  { title: "Từ (>)", key: "min", width: 150 },
  { title: "Đến (<=)", key: "max", width: 150 },
  { title: "Điểm", key: "score", width: 120 },
  { title: "Actions", key: "actions", width: 80 },
];

// Add and remove scoring range functions
const addRange = () => {
  scoringRanges.value.push({
    id: Date.now(),
    min: null,
    max: null,
    score: null,
  });
};

const removeRange = (index) => {
  if (scoringRanges.value.length > 1) {
    scoringRanges.value.splice(index, 1);
  }
};

// Watch for name changes to auto-generate code
watch(
  () => form.value.name,
  (newName) => {
    if (newName) {
      form.value.code = generateCodeFromName(newName);
    }
  },
);

const resetForm = () => {
  isEdit.value = false;
  form.value = {
    id: null,
    name: "",
    code: "",
    expression: "",
    description: "",
    scoringRules: null,
  };
  enableAutoScoring.value = false;
  scoringRanges.value = [
    { id: Date.now(), min: null, max: null, score: null },
  ];
  formRef.value?.resetFields();
};

const scrollToTop = () => {
  const container = document.querySelector(".site-layout-content");
  if (container) {
    container.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const editFormula = (record) => {
  isEdit.value = true;
  form.value = { ...record };

  // Load scoring rules if exists
  if (record.scoringRules && record.scoringRules.enabled) {
    enableAutoScoring.value = true;
    scoringRanges.value = record.scoringRules.ranges.map((r, idx) => ({
      id: Date.now() + idx,
      min: r.min,
      max: r.max,
      score: r.score,
    }));
  } else {
    enableAutoScoring.value = false;
    scoringRanges.value = [
      { id: Date.now(), min: null, max: null, score: null },
    ];
  }

  formRef.value?.clearValidate();
  scrollToTop();
};

const copyFormula = async (record) => {
  const baseName = (record?.name || "").trim() || $t("formula.unnamed");
  const copySuffix = $t("formula.copySuffix");
  const newName = baseName + copySuffix;
  const scoringRules = record?.scoringRules
    ? {
        enabled: !!record.scoringRules.enabled,
        type: record.scoringRules.type || "range",
        input: record.scoringRules.input || "efficiency",
        ranges: Array.isArray(record.scoringRules.ranges)
          ? record.scoringRules.ranges.map((r) => ({
              min: r?.min ?? undefined,
              max: r?.max ?? undefined,
              score: r?.score,
            }))
          : [],
      }
    : null;
  try {
    await store.dispatch("formula/duplicateFormula", {
      name: newName,
      code: generateCodeFromName(newName),
      expression: record?.expression ?? "",
      description: record?.description ?? "",
      scoringRules,
    });
  } catch (e) {
    message.error(
      e?.message || $t("formula.copyFormulaError") || "Failed to duplicate",
    );
  }
};

const handleSubmit = async () => {
  if (!form.value.name || !form.value.expression) {
    message.error($t("common.requiredFieldsMissing"));
    return;
  }

  // Ensure code is generated before submit
  if (!form.value.code && form.value.name) {
    form.value.code = generateCodeFromName(form.value.name);
  }

  // Build scoring rules object
  const scoringRules = enableAutoScoring.value
    ? {
        enabled: true,
        type: "range",
        input: "efficiency",
        ranges: scoringRanges.value.map((r) => ({
          min: r.min !== null ? r.min : undefined,
          max: r.max !== null ? r.max : undefined,
          score: r.score,
        })),
      }
    : null;

  try {
    if (isEdit.value) {
      await store.dispatch("formula/updateFormula", {
        id: form.value.id,
        updateData: {
          name: form.value.name,
          expression: form.value.expression,
          description: form.value.description,
          scoringRules,
        },
      });
      message.success($t("common.updateSuccess"));
    } else {
      // Backend will auto-generate ID, only send required fields
      await store.dispatch("formula/addFormula", {
        name: form.value.name,
        code: form.value.code,
        expression: form.value.expression,
        description: form.value.description,
        scoringRules,
      });
      message.success($t("common.addSuccess"));
    }
    resetForm();
    await store.dispatch("formula/fetchFormulas");
  } catch (e) {
    console.error(e);
  }
};

const deleteFormula = async (record) => {
  try {
    await store.dispatch("formula/deleteFormula", record.id);
    message.success($t("common.deleteSuccess"));
    await store.dispatch("formula/fetchFormulas");
  } catch (e) {
    message.error(e?.message || $t("common.deleteError"));
  }
};

onMounted(async () => {
  await store.dispatch("formula/fetchFormulas");
});
</script>

<style scoped>
.formula-manage-form {
  margin: 24px auto 0 auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 16px #e3eaf355;
  padding: 24px 24px 16px 24px;
  max-width: 100%;
  border: 1px solid #f0f3fa;
  transition: box-shadow 0.2s;
}
.form-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 0.5em;
  justify-content: center;
}
.form-header-icon {
  box-shadow: 0 2px 8px #e3eaf399;
}
.form-title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin: 0;
  color: #1976d2;
  text-shadow: none;
}
.list-title {
  font-size: 1.08rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1976d2;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ant-form-item {
  margin-bottom: 15px;
}
.main-btn-modern {
  min-width: 100px;
  font-weight: 500;
  border-radius: 18px;
  height: 36px;
  background: #fafdff;
  color: #1976d2;
  border: 1.5px solid #b3d1f7;
  box-shadow: none;
  transition: all 0.18s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.main-btn-modern:hover,
.main-btn-modern:focus {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #90caf9;
}
.cancel-btn-modern {
  min-width: 80px;
  border-radius: 18px;
  border: 1px solid #e3eaf3;
  color: #1976d2;
  background: #fafdff;
  font-weight: 400;
  margin-left: 8px;
  height: 36px;
  transition:
    background 0.2s,
    color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cancel-btn-modern:hover {
  background: #e3eaf3;
  color: #1565c0;
}
.formula-table {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px #e3eaf333;
  margin-bottom: 10px;
}
.formula-table .ant-table-thead > tr > th {
  background: #fafdff;
  color: #1976d2;
  font-weight: 500;
  font-size: 0.98rem;
}
.formula-table .ant-table-tbody > tr:hover > td {
  background: #e3f2fd55;
  transition: background 0.2s;
}
.formula-table .ant-table-tbody > tr > td {
  font-size: 0.97rem;
  padding: 8px 7px;
}
.ant-empty-description {
  color: #b0bec5;
  font-size: 1.05rem;
}
.formula-tooltip .ant-tooltip-inner,
:deep(.formula-tooltip .ant-tooltip-inner),
.code-tooltip .ant-tooltip-inner,
:deep(.code-tooltip .ant-tooltip-inner),
.name-tooltip .ant-tooltip-inner,
:deep(.name-tooltip .ant-tooltip-inner) {
  background: #fafdff !important;
  color: #222;
  border-radius: 10px;
  box-shadow: 0 2px 12px #1976d233;
  padding: 14px 18px 12px 18px;
  min-width: 260px;
  max-width: 340px;
  font-size: 0.98rem;
}
.tooltip-btn {
  padding: 0;
  border: none;
  background: none;
  box-shadow: none;
  outline: none;
}
.tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1976d2 70%, #42a5f5 100%);
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 1px 4px #1976d233;
  border: 2px solid #fff;
  transition: background 0.2s;
}
.tooltip-btn:hover .tooltip-icon {
  background: linear-gradient(135deg, #1565c0 70%, #1976d2 100%);
}

/* Expression Help Modal Styles */
.expression-help-content h4 {
  color: #1976d2;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 12px;
  border-bottom: 2px solid #e3f2fd;
  padding-bottom: 8px;
}

.help-table {
  margin-bottom: 16px;
}

.help-table .ant-table-thead > tr > th {
  background: #fafdff;
  color: #1976d2;
  font-weight: 600;
  font-size: 0.95rem;
}

.help-table .ant-table-tbody > tr > td {
  font-size: 0.9rem;
  padding: 8px 12px;
}

.help-table .ant-table-tbody > tr:hover > td {
  background: #e3f2fd55;
}
</style>
