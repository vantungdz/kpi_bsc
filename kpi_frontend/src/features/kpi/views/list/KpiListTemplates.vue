<template>
  <div class="kpi-section-list-page">
    <div class="list-header-modern">
      <schedule-outlined class="header-icon" />
      <div class="header-title-group">
        <h2>{{ $t("templatesKpiList") }}</h2>
      </div>
      <div class="action-buttons right-align">
        <a-button v-if="canCreateTemplate" type="primary" @click="goToCreateKpi">
          <plus-outlined /> {{ $t("createNewKpi") }}
        </a-button>
      </div>
    </div>
    <a-card class="filter-card-modern">
      <a-form layout="vertical" class="filter-form-modern">
        <a-row :gutter="[16, 0]" align="middle" style="flex-wrap: wrap">
          <a-col :span="6">
            <a-form-item :label="$t('performanceObjectives')" class="filter-label-top">
              <a-select v-model:value="localFilters.typePerformance" style="width: 100%"
                :placeholder="$t('performanceObjectives')" allow-clear size="small" show-search
                :options="performanceObjectiveOptions" :filter-option="(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                  ">
                <template #suffixIcon><schedule-outlined /></template>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="5">
            <a-form-item :label="$t('search')" class="filter-label-top">
              <a-input v-model:value="localFilters.name" :placeholder="$t('kpiNamePlaceholder')" allow-clear
                size="small">
                <template #prefix><schedule-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item :label="' '" class="filter-label-top">
              <div class="filter-btn-group">
                <a-button type="primary" @click="applyFilters" size="small">{{
                  $t("apply")
                }}</a-button>
                <a-button
                  size="small"
                  @click="
                    () => {
                      localFilters.name = '';
                      localFilters.typePerformance = null;
                      appliedFilters.name = '';
                      appliedFilters.typePerformance = null;
                      applyFilters();
                    }
                  "
                >
                  {{ $t("reset") }}
                </a-button>
              </div>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <LoadingOverlay :visible="loading" />
    <a-alert v-if="!loading && error" :message="error" type="error" show-icon closable />
    <a-alert v-if="!loading && isDisplayResult && templateGroups.length === 0" :message="$t('noKpisFound')"
      type="warning" show-icon closable />
    <a-alert v-if="deletedKpiName" :message="$t('kpiDeleted', { name: deletedKpiName })" type="success" closable
      @close="deletedKpiName = null" show-icon />
    <div class="kpi-list-scroll">
      <div v-if="!loading && isDisplayResult" class="data-container">
        <div v-for="(sectionGroup, sectionIndex) in templateGroups" :key="'sec-' + sectionIndex" class="mb-8">
          <h4 class="text-base font-bold mb-1.5 section-header-modern">
            {{ $t("templatesHeader", { name: sectionGroup.section }) }}
          </h4>
          <a-collapse v-model:activeKey="activePanelKeys" expandIconPosition="end" class="kpi-collapse-modern"
            @change="onCollapseChange">
            <a-collapse-panel v-for="(perspectiveGroupRows, perspectiveKey) in sectionGroup.data" :key="'pers-' + sectionIndex + '-' + perspectiveKey"
              :header="perspectiveKey.split('. ')[1] || perspectiveKey">
              <a-table :columns="columns" :dataSource="tableData(perspectiveGroupRows)" :pagination="false" rowKey="key"
                :rowClassName="rowClassName" size="small" bordered class="kpi-table-modern section-table-modern">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'kpiName'">
                    <span class="kpi-name">{{ record.kpiName }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'weight'">
                    <span>{{ record.weight }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'target'">
                    <span class="kpi-value">{{
                      `${Number(record.target).toLocaleString()} ${record.unit}`
                      }}</span>
                  </template>
                  <template v-else-if="column.dataIndex === 'achieve'">
                    <span class="kpi-value" :title="record.formulaExpression">
                      {{ record.formulaExpression || $t("noFormula") }}
                    </span>
                  </template>
                  <template v-else-if="column.dataIndex === 'action'">
                    <div style="text-align: center">
                      <a-tooltip v-if="canEditTemplate" :title="$t('edit')">
                        <a-button type="dashed" class="kpi-actions-button" size="small" @click="handleEditKpi(record)">
                          <edit-outlined /> {{ $t("edit") }}
                        </a-button>
                      </a-tooltip>
                      <a-tooltip v-if="canCopyTemplate" :title="$t('copyKpi')">
                        <a-button type="dashed" class="kpi-actions-button" size="small" @click="handleCopyKpi(record)">
                          <copy-outlined /> {{ $t("copy") }}
                        </a-button>
                      </a-tooltip>
                      <a-tooltip v-if="canDeleteTemplate" :title="$t('deleteKpi')">
                        <a-button danger class="kpi-actions-button" size="small" @click="
                          showConfirmDeleteDialog(
                            record.kpiId,
                            record.kpiName
                          )
                          ">
                          <delete-outlined /> {{ $t("delete") }}
                        </a-button>
                      </a-tooltip>
                    </div>
                  </template>
                </template>
              </a-table>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </div>
    <a-modal danger v-model:open="isDeleteModalVisible" :title="$t('confirmDialog')" @ok="handleDeleteKpi"
      @cancel="isDeleteModalVisible = false">
      <p>{{ $t("confirmDelete", { name: selectedKpiName }) }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted, onActivated, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Button as AButton,
  Input as AInput,
  Select as ASelect,
  FormItem as AFormItem,
  Alert as AAlert,
  Collapse as ACollapse,
  CollapsePanel as ACollapsePanel,
  Table as ATable,
  Card as ACard,
} from "ant-design-vue";
import {
  ScheduleOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
} from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";

const store = useStore();
const router = useRouter();
const { t: $t } = useI18n();

const loading = computed(() => store.getters["templates/isLoading"]);
const error = computed(() => store.getters["templates/error"]);

const templateKpiList = computed(() => store.getters["templates/list"] || []);

/** Quyền KPI cấp company — đồng bộ với KpiListCompany / KpiCreateTemplates (không dùng role.name === 'admin'). */
const authUser = computed(() => store.getters["auth/user"]);
const userPermissions = computed(() => {
  const u = authUser.value;
  if (!u) return [];
  const direct = Array.isArray(u.permissions) ? u.permissions : [];
  if (direct.length > 0) return direct;
  const roles = Array.isArray(u.roles) ? u.roles : [];
  return roles.flatMap((r) => (Array.isArray(r?.permissions) ? r.permissions : []));
});

function hasKpiCompanyPermission(action) {
  return userPermissions.value.some(
    (p) =>
      String(p.action ?? "").trim() === action &&
      String(p.resource ?? "").trim() === RBAC_RESOURCES.KPI &&
      p.scope === "company",
  );
}

const canCreateTemplate = computed(() =>
  hasKpiCompanyPermission(RBAC_ACTIONS.CREATE),
);
const canEditTemplate = computed(() =>
  hasKpiCompanyPermission(RBAC_ACTIONS.UPDATE),
);
const canDeleteTemplate = computed(() =>
  hasKpiCompanyPermission(RBAC_ACTIONS.DELETE),
);
/** Sao chép mẫu: tạo mới từ bản ghi — create hoặc copy-template như danh sách KPI công ty. */
const canCopyTemplate = computed(
  () =>
    hasKpiCompanyPermission(RBAC_ACTIONS.CREATE) ||
    hasKpiCompanyPermission(RBAC_ACTIONS.COPY_TEMPLATE),
);

const isDeleteModalVisible = ref(false);
const selectedKpiId = ref(null);
const selectedKpiName = ref(null);
const deletedKpiName = ref(null);
const isDisplayResult = ref(false);
const activePanelKeys = ref([]);
const chartKey = ref(0);

const localFilters = reactive({
  name: "",
  typePerformance: null,
});
// Applied filters - chỉ filter khi đã click Apply
const appliedFilters = reactive({
  name: "",
  typePerformance: null,
});

const templateGroups = computed(() => {
  // Don't display data when loading
  if (loading.value) {
    return [];
  }

  const groupedData = {};

  // Get display data from templateKpiList
  // Store getter "templates/list" returns state.items which is already an array
  const displayData = Array.isArray(templateKpiList.value)
    ? templateKpiList.value
    : [];


  if (!Array.isArray(displayData) || displayData.length === 0) {
    return [];
  }

  // Apply filters - chỉ dùng appliedFilters (đã được apply), không dùng localFilters (tạm thời)
  let filteredData = displayData;

  // Filter by name
  if (appliedFilters.name) {
    filteredData = filteredData.filter((template) =>
      template.name?.toLowerCase().includes(appliedFilters.name.toLowerCase())
    );
  }

  // Filter by typePerformance (Performance Objectives)
  if (appliedFilters.typePerformance) {
    filteredData = filteredData.filter(
      (template) => String(template.typePerformance) === String(appliedFilters.typePerformance)
    );
  }

  // Mapping typePerformance to section name
  const getSectionNameByTypePerformance = (typePerformance) => {
    const mapping = {
      '1': 'HR-Performance Objectives-Rank123',
      '2': 'HR-Performance Objectives-Rank456',
      '3': 'HR-Performance Objectives-Rank789',
    };
    return mapping[typePerformance] || 'Templates';
  };

  // Group templates by typePerformance and perspective
  filteredData.forEach((template) => {
    if (!template) {
      return;
    }

    const perspectiveId = template.perspective_id || 0;
    const perspectiveName = template.perspective?.name || "Uncategorized";
    const perspectiveKey = `${perspectiveId}. ${perspectiveName}`;

    // Group by typePerformance
    const typePerformance = template.typePerformance || '0';
    const groupKey = `typePerformance-${typePerformance}`;

    if (!groupedData[groupKey]) {
      groupedData[groupKey] = {
        section: getSectionNameByTypePerformance(typePerformance),
        sectionId: groupKey,
        typePerformance: typePerformance, // Lưu để sort
        data: {},
      };
    }

    if (!groupedData[groupKey].data[perspectiveKey]) {
      groupedData[groupKey].data[perspectiveKey] = [];
    }

    const rowData = {
      key: `template-${template.id}`,
      kpiId: template.id,
      kpiName: template.name,
      perspectiveName: perspectiveName,
      assignTo: "Template", // Templates are not assigned to specific sections
      weight: template.weight || 0,
      target: template.target || 0,
      unit: template.unit || "",
      status: "active", // Templates are always active
      validityStatus: "active",
      type: template.type,
      typePerformance: template.typePerformance,
      frequency: template.frequency,
      description: template.description,
      formula: template.formula, // Formula object with name, expression, etc.
      formulaName: template.formula?.name || "",
      formulaExpression: template.formula?.expression || "",
    };

    groupedData[groupKey].data[perspectiveKey].push(rowData);
  });

  // Sort perspectives and templates within each perspective
  const finalGroupedArray = Object.values(groupedData).map((sectionGroup) => {
    const sortedPerspectives = Object.keys(sectionGroup.data)
      .sort()
      .reduce((sortedMap, perspectiveKey) => {
        sortedMap[perspectiveKey] = sectionGroup.data[perspectiveKey].sort(
          (a, b) => a.kpiName.localeCompare(b.kpiName)
        );
        return sortedMap;
      }, {});

    return {
      section: sectionGroup.section,
      sectionId: sectionGroup.sectionId,
      typePerformance: sectionGroup.typePerformance,
      data: sortedPerspectives,
    };
  });

  // Sort sections by typePerformance (1, 2, 3) instead of alphabetically
  finalGroupedArray.sort((a, b) => {
    const typeA = parseInt(a.typePerformance || '0', 10);
    const typeB = parseInt(b.typePerformance || '0', 10);
    return typeA - typeB;
  });

  return finalGroupedArray;
});

const applyFilters = async () => {
  isDisplayResult.value = false;

  try {
    // Copy localFilters vào appliedFilters trước khi gọi API
    appliedFilters.name = localFilters.name;
    appliedFilters.typePerformance = localFilters.typePerformance;

    const filtersToSend = {
      name: localFilters.name,
    };

    // Get typePerformance from selected performance objective
    if (localFilters.typePerformance) {
      filtersToSend.typePerformance = localFilters.typePerformance;
    }

    await store.dispatch("templates/fetchItems", filtersToSend);

    isDisplayResult.value = true;
  } catch (err) {
    console.error("Error in applyFilters:", err);
    isDisplayResult.value = false;
  }
};

// Performance Objectives options based on typePerformance mapping
const performanceObjectiveOptions = computed(() => {
  const mapping = {
    '1': 'HR-Performance Objectives-Rank123',
    '2': 'HR-Performance Objectives-Rank456',
    '3': 'HR-Performance Objectives-Rank789',
  };

  return Object.keys(mapping).map((key) => ({
    value: key,
    label: mapping[key],
  }));
});

const tableData = (perspectiveGroupRowsArray) => {
  return perspectiveGroupRowsArray;
};

const goToCreateKpi = () => {
  router.push({
    name: "KpiCreateTemplates",
  });
};

const handleEditKpi = (record) => {
  if (record && record.kpiId) {
    router.push({
      path: "/kpis/templates-create",
      query: {
        templateKpiId: record.kpiId,
        isEdit: true,
      },
    });
  } else {
    notification.warning({
      message: "Cannot edit due to missing KPI information.",
    });
  }
};

const handleCopyKpi = (record) => {
  if (record && record.kpiId) {
    router.push({
      path: "/kpis/templates-create",
      query: {
        templateKpiId: record.kpiId,
      },
    });
  } else {
    notification.warning({
      message: "Cannot copy due to missing KPI information.",
    });
  }
};

const showConfirmDeleteDialog = (id, name) => {
  isDeleteModalVisible.value = true;
  selectedKpiId.value = id;
  selectedKpiName.value = name;
};

const handleDeleteKpi = async () => {
  try {
    await store.dispatch("templates/deleteItem", selectedKpiId.value);

    // Show success notification
    notification.success({
      message: $t("templateDeletedSuccessfully") || "Template deleted successfully",
      description: $t("kpiDeleted", { name: selectedKpiName.value }) || `Template "${selectedKpiName.value}" has been deleted`,
      duration: 3,
    });

    // Refresh data
    await applyFilters();

    // Reset modal state
    deletedKpiName.value = selectedKpiName.value;
    isDeleteModalVisible.value = false;
    selectedKpiId.value = null;
    selectedKpiName.value = null;
  } catch (err) {
    console.error("Delete template error:", err);

    // Show error notification
    const errorMessage = err?.response?.data?.message || err?.message || $t("errors.unknownError") || "Failed to delete template";
    notification.error({
      message: $t("deleteFailed") || "Delete Failed",
      description: errorMessage,
      duration: 5,
    });

    // Close modal even on error
    isDeleteModalVisible.value = false;
  }
};

const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "kpiName",
    key: "kpiName",
    width: "15%",
  },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "10%",
  },
  {
    title: $t("achieve"),
    dataIndex: "achieve",
    key: "achieve",
    width: "10%",
  },
  { title: $t("weight"), dataIndex: "weight", key: "weight", width: "10%" },
  {
    title: $t("common.actions"),
    dataIndex: "action",
    key: "action",
    width: "15%",
    rowClassName: "action-column-cell",
  },
]);

const rowClassName = (record) => {
  return record.isParent ? "row-parent" : "";
};

watch(
  templateGroups,
  (newGroups) => {
    const keys = [];
    if (Array.isArray(newGroups)) {
      newGroups.forEach((sectionGroup, sectionIndex) => {
        if (
          sectionGroup &&
          typeof sectionGroup.data === "object" &&
          sectionGroup.data !== null
        ) {
          Object.keys(sectionGroup.data).forEach((perspectiveKey) => {
            const panelKey = `pers-${sectionIndex}-${perspectiveKey}`;
            keys.push(panelKey);
          });
        }
      });
    }
    activePanelKeys.value = keys;
  },
  {
    immediate: true,
    deep: true,
  }
);

const onCollapseChange = () => {
  // Whenever the collapse state changes (open or close),
  // we increment the chart's key. This forces a redraw.
  chartKey.value++;
};

const loadData = async () => {
  try {
    // Fetch templates and apply filters
    await applyFilters();
  } catch (err) {
    console.error("Error loading data:", err);
    error.value = err.message || "Failed to fetch initial data.";
  }
};

onMounted(async () => {
  document.body.classList.add("no-outer-scroll");
  await loadData();
});

// Refresh data when component is activated (useful if using keep-alive)
onActivated(async () => {
  await loadData();
});

onUnmounted(() => {
  document.body.classList.remove("no-outer-scroll");
});
</script>

<style scoped>
.kpi-section-list-page {
  /* padding: 24px; */
  background: #f6f8fa;
  height: 100%;
  min-height: 0;
  /* quan trọng khi cha dùng flex */
  display: flex;
  flex-direction: column;
}

.kpi-list-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.data-container {
  overflow: visible !important;
  height: auto !important;
}

.list-header-modern .header-icon {
  color: #2563eb;
}

.filter-card-modern {
  max-width: 98%;
}

.kpi-table-modern {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 0;
}

.section-table-modern {
  margin-bottom: 0;
}

.kpi-row-hover:hover {
  background: #f0fdfa !important;
  cursor: pointer;
}

.kpi-value {
  font-weight: 500;
  color: #2563eb;
}

.kpi-date {
  color: #64748b;
  font-size: 13px;
}

.kpi-name {
  font-weight: 500;
  color: #0f172a;
}

.goal-status-tag {
  font-weight: 500;
  font-size: 13px;
  padding: 0 10px;
  border-radius: 8px;
}

.kpi-actions-button {
  border-radius: 6px;
}

.kpi-collapse-modern {
  background: #f9fafb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 18px;
}

.section-header-modern {
  color: #2563eb;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

:deep(.kpi-list-scroll .ant-table-thead th) {
  position: sticky;
  top: 0;
  z-index: 2;
}

:deep(.kpi-list-scroll .ant-table-body),
:deep(.kpi-list-scroll .ant-table-content),
:deep(.kpi-list-scroll .ant-table-container),
:deep(.kpi-list-scroll .ant-table-header) {
  overflow: visible !important;
  max-height: none !important;
}

:deep(.kpi-list-scroll .ant-collapse-content-box) {
  overflow: visible !important;
}

:deep(.ant-card-body) {
  padding: 0 !important;
}
</style>
