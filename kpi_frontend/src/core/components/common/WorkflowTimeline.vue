<template>
  <a-card size="small" class="workflow-card">
    <template #title>
      <div class="workflow-title">
        <span>{{ $t("workflow.timeline.title") }}</span>
        <a-tag v-if="workflow" :color="statusColor">{{
          currentStepTitleDisplay
        }}</a-tag>
      </div>
    </template>

    <a-skeleton v-if="loading" active :paragraph="{ rows: 2 }" />

    <template v-else-if="workflow">
      <div class="workflow-compact">
        <div class="workflow-compact-summary">
          <span class="workflow-next-action">{{ translatedNextAction }}</span>
          <a-button
            type="link"
            size="small"
            class="workflow-detail-btn"
            @click="drawerOpen = true"
          >
            {{ $t("workflow.actions.viewDetail") }}
          </a-button>
        </div>
        <div class="workflow-horizontal-scroll">
          <div class="workflow-steps-inner" :style="horizontalInnerStyle">
            <a-steps
              direction="horizontal"
              size="small"
              class="workflow-steps-horizontal"
              :current="currentIndex"
              :items="compactStepItems"
            />
          </div>
        </div>
      </div>

      <a-drawer
        v-model:open="drawerOpen"
        :title="$t('workflow.timeline.detailTitle')"
        placement="right"
        :width="drawerWidth"
        :body-style="{ paddingTop: '12px' }"
      >
        <a-alert
          type="info"
          show-icon
          class="workflow-summary"
          :message="translatedNextAction"
          :description="summaryText"
        />
        <a-steps
          direction="vertical"
          size="small"
          class="workflow-steps workflow-steps-drawer"
          :current="currentIndex"
          :items="stepItems"
        />
      </a-drawer>
    </template>

    <a-empty v-else :description="$t('workflow.timeline.notAvailable')" />
  </a-card>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Drawer as ADrawer,
  Empty as AEmpty,
  Skeleton as ASkeleton,
  Steps as ASteps,
  Tag as ATag,
} from "ant-design-vue";
import { KpiDefinitionStatusText } from "@/core/constants/kpiStatus";

const { t: $t, locale } = useI18n();

const props = defineProps({
  workflow: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const drawerOpen = ref(false);

const drawerWidth = computed(() =>
  typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : 440,
);

const currentIndex = computed(() => {
  if (!props.workflow?.steps?.length) return 0;
  const index = props.workflow.steps.findIndex(
    (step) => step.status === "current" || step.status === "rejected",
  );
  return index >= 0 ? index : props.workflow.steps.length - 1;
});

const statusColor = computed(() => {
  if (!props.workflow?.steps?.length) return "default";
  const step = props.workflow.steps[currentIndex.value];
  switch (step?.status) {
    case "completed":
      return "green";
    case "current":
      return "blue";
    case "rejected":
      return "red";
    default:
      return "default";
  }
});

const dateLocaleTag = computed(() => {
  const l = locale.value;
  if (l === "vi") return "vi-VN";
  if (l === "ja") return "ja-JP";
  return undefined;
});

const translatedNextAction = computed(() => {
  const wf = props.workflow;
  if (!wf) return "";
  const na = wf.nextActionI18n;
  if (na?.key) {
    const path = `workflow.detail.nextAction.${na.key}`;
    const tr = $t(path, na.params || {});
    if (tr !== path) return tr;
  }
  return wf.nextAction || "";
});

const currentStepTitleDisplay = computed(() => {
  const wf = props.workflow;
  if (!wf?.currentStepKey) return wf?.currentStepTitle || "";
  const path = `workflow.detail.stepTitles.${wf.currentStepKey}`;
  const tr = $t(path);
  return tr !== path ? tr : wf.currentStepTitle || "";
});

const summaryText = computed(() => {
  const wf = props.workflow;
  if (!wf) return "";
  const parts = [];
  const scopeKey = wf.scopeKey || "assigned";
  const scope = $t(`workflow.detail.scope.${scopeKey}`);
  if (wf.subject?.name) {
    parts.push(
      $t("workflow.detail.summaryLine", {
        scope,
        subject: wf.subject.name,
      }),
    );
  } else {
    parts.push(scope);
  }
  if (wf.owner?.name) {
    parts.push(
      `${$t("workflow.timeline.ownerLabel")}: ${wf.owner.name}`,
    );
  }
  if (wf.activePhase) {
    const phaseKey =
      wf.activePhase === "MID_YEAR"
        ? "workflow.reviewPhase.midYear"
        : "workflow.reviewPhase.yearEnd";
    const tr = $t(phaseKey);
    parts.push(tr !== phaseKey ? tr : wf.activePhase);
  }
  return parts.join(" | ");
});

function translateStepTitle(step) {
  if (!step?.key) return step?.title || "";
  const path = `workflow.detail.stepTitles.${step.key}`;
  const tr = $t(path);
  return tr !== path ? tr : step.title || "";
}

function translateStepDescriptionBody(step) {
  const di = step?.descriptionI18n;
  if (!di?.key) return step?.description || "";
  const p = { ...(di.params || {}) };

  if (di.key === "definitionStatus" && p.status) {
    const map = KpiDefinitionStatusText($t);
    p.status = map[p.status] || p.status;
  }

  if (di.key === "progressSubmitted" && p.value != null && p.value !== "") {
    const n = Number(p.value);
    p.value = Number.isNaN(n)
      ? p.value
      : n.toLocaleString(dateLocaleTag.value);
  }

  const rejectionKeys = [
    "sectionRejected",
    "deptRejected",
    "managerRejected",
    "reviewRejected",
  ];
  if (rejectionKeys.includes(di.key) && !String(p.reason || "").trim()) {
    p.reason = $t("workflow.detail.descriptions.rejectionFallback");
  }

  if (di.key === "assignmentAssigned") {
    const scopeKey = p.scopeKey || "assigned";
    const scope = $t(`workflow.detail.scope.${scopeKey}`);
    if (p.subjectName?.trim()) {
      return $t("workflow.detail.descriptions.assignmentAssigned", {
        scope,
        subject: p.subjectName,
      });
    }
    return $t("workflow.detail.descriptions.assignmentAssignedScopeOnly", {
      scope,
    });
  }

  const path = `workflow.detail.descriptions.${di.key}`;
  return $t(path, p);
}

function buildDescription(step) {
  const base = translateStepDescriptionBody(step);
  if (!step?.at) return base;
  const date = new Date(step.at);
  const formatted = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(dateLocaleTag.value);
  return formatted ? `${base} (${formatted})` : base;
}

const stepItems = computed(() => {
  if (!props.workflow?.steps?.length) return [];
  return props.workflow.steps.map((step) => ({
    title: translateStepTitle(step),
    description: buildDescription(step),
    status: mapStatus(step.status),
  }));
});

const compactStepItems = computed(() => {
  if (!props.workflow?.steps?.length) return [];
  return props.workflow.steps.map((step) => ({
    title: translateStepTitle(step),
    status: mapStatus(step.status),
  }));
});

const horizontalInnerStyle = computed(() => {
  const n = props.workflow?.steps?.length ?? 0;
  if (n < 2) return {};
  const minPx = Math.max(n * 124, 260);
  return { minWidth: `${minPx}px` };
});

function mapStatus(status) {
  switch (status) {
    case "completed":
      return "finish";
    case "current":
      return "process";
    case "rejected":
      return "error";
    default:
      return "wait";
  }
}
</script>

<style scoped>
.workflow-card {
  margin-top: 16px;
}

.workflow-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workflow-compact-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.workflow-next-action {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  line-height: 1.5;
  flex: 1;
  min-width: 0;
}

.workflow-detail-btn {
  flex-shrink: 0;
  padding: 0 4px;
  height: auto;
  line-height: 1.5;
}

.workflow-horizontal-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  margin: 0 -2px;
  padding-bottom: 4px;
}

.workflow-steps-inner {
  padding: 4px 2px 8px;
}

.workflow-steps-horizontal :deep(.ant-steps-item-title) {
  font-size: 12px;
  line-height: 1.35;
  max-width: 140px;
  white-space: normal;
  word-break: break-word;
}

.workflow-summary {
  margin-bottom: 16px;
}

.workflow-steps-drawer :deep(.ant-steps-item-description) {
  white-space: normal;
}
</style>
