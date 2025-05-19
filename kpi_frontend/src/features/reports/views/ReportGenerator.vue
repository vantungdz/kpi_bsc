<template>
    <div class="report-generator">
        <template v-if="canGenerateReport">
            <h2>{{ $t('reportOptions') }}</h2>

            <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
                <a-form-item :label="$t('reportType')">
                    <a-select v-model:value="selectedReportType" :placeholder="$t('selectReportType')">
                        <a-select-option value="kpi-summary">{{ $t('kpiSummary') }}</a-select-option>
                        <a-select-option value="kpi-details">{{ $t('kpiDetails') }}</a-select-option>
                        <a-select-option value="kpi-comparison">{{ $t('kpiComparison') }}</a-select-option>
                        <a-select-option value="kpi-custom">{{ $t('customReport') }}</a-select-option>
                        <a-select-option value="kpi-performance-overview">{{ $t('kpiPerformanceOverview') }}</a-select-option>
                        <a-select-option value="dashboard-multi">{{ $t('dashboardMulti') }}</a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('fileFormat')">
                    <a-radio-group v-model:value="selectedFileFormat">
                        <a-radio value="excel">Excel</a-radio>
                        <a-radio value="pdf">PDF</a-radio>
                        <a-radio value="csv">CSV</a-radio>
                    </a-radio-group>
                </a-form-item>

                <a-form-item :label="$t('dateRange')">
                    <a-range-picker v-model:value="selectedDateRange" />
                </a-form-item>

                <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                    <a-button type="primary" @click="generateReport" :loading="loading" :disabled="!canGenerateReport">
                        <template #icon>
                            <ExportOutlined />
                        </template>
                        {{ $t('generateReport') }}
                    </a-button>
                </a-form-item>
            </a-form>
        </template>
        <template v-else>
            <a-alert type="error" :message="$t('accessDenied')" :description="$t('accessDeniedDescription')" show-icon />
        </template>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { message } from 'ant-design-vue';
import { ExportOutlined } from '@ant-design/icons-vue';

const { t } = useI18n();
const store = useStore();

const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const canGenerateReport = computed(() => ["admin", "manager"].includes(effectiveRole.value));

const selectedReportType = ref(null);
const selectedFileFormat = ref('excel');
const selectedDateRange = ref(null);
const loading = ref(false);

const generateReport = () => {
    if (!selectedReportType.value) {
        message.error(t('selectReportTypeFirst'));
        return;
    }
    loading.value = true;
    let startDate = null, endDate = null;
    if (selectedDateRange.value && selectedDateRange.value.length === 2) {
        startDate = selectedDateRange.value[0];
        endDate = selectedDateRange.value[1];
        // Nếu là moment object, chuyển sang string ISO
        if (startDate && typeof startDate === 'object' && startDate.format) {
            startDate = startDate.format('YYYY-MM-DD');
        }
        if (endDate && typeof endDate === 'object' && endDate.format) {
            endDate = endDate.format('YYYY-MM-DD');
        }
    }
    store.dispatch('reports/generateReport', {
        reportType: selectedReportType.value,
        fileFormat: selectedFileFormat.value,
        startDate,
        endDate,
    }).then(() => {
        loading.value = false;
        message.success(t('reportGeneratedSuccessfully'));
    }).catch(() => {
        loading.value = false;
    });
};
</script>

<style scoped>
.report-generator {
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 5px;
    margin-top: 20px;
}
</style>

