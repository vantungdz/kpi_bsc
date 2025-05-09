<template>
    <div class="kpi-review-page">
        <a-breadcrumb style="margin-bottom: 16px">
            <!-- eslint-disable-next-line vue/no-undef-components -->
            <a-breadcrumb-item><router-link to="/dashboard">Dashboard</router-link></a-breadcrumb-item>
            <!-- Có thể thêm breadcrumb cho danh sách nhân viên/bộ phận nếu đi từ đó -->
            <a-breadcrumb-item>Đánh giá Kết quả KPI</a-breadcrumb-item>
        </a-breadcrumb>

        <a-card :title="pageTitle" :bordered="false">
            <!-- Bộ lọc (Filters) -->
            <a-row :gutter="16" style="margin-bottom: 20px;">
                <a-col :xs="24" :sm="12" :md="8">
                    <a-form-item label="Chọn Nhân viên/Bộ phận">
                        <!-- eslint-disable-next-line vue/no-undef-components -->
                        <a-select v-model:value="selectedTarget" placeholder="Chọn đối tượng để review" show-search
                            :filter-option="filterOption" @change="handleTargetChange" :loading="isLoadingTargets">
                            <a-select-option v-for="target in reviewTargets" :key="target.id" :value="target.id">
                                {{ target.name }} ({{ target.type === 'employee' ? 'Nhân viên' : 'Bộ phận/Phòng ban' }})
                            </a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
                <a-col :xs="24" :sm="12" :md="8">
                    <a-form-item label="Chọn Chu kỳ Đánh giá">
                        <!-- eslint-disable-next-line vue/no-undef-components -->
                        <a-select v-model:value="selectedCycle" placeholder="Chọn chu kỳ" @change="fetchKpisForReview"
                            :loading="isLoadingCycles">
                            <a-select-option v-for="cycle in reviewCycles" :key="cycle.id" :value="cycle.id">
                                {{ cycle.name }}
                            </a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
            </a-row>

            <a-spin :spinning="isLoadingKpis" tip="Đang tải KPI cần review...">
                <!-- eslint-disable-next-line vue/no-undef-components -->
                <a-alert v-if="loadingError" type="error" show-icon closable style="margin-bottom: 16px"
                    :message="loadingError" @close="loadingError = null" />

                <div v-if="!selectedTarget || !selectedCycle" class="empty-state">
                    <a-empty description="Vui lòng chọn Đối tượng và Chu kỳ để bắt đầu review." />
                </div>

                <!-- eslint-disable-next-line vue/no-undef-components -->
                <div v-else-if="!isLoadingKpis && kpisToReview.length === 0 && !loadingError" class="empty-state">
                    <a-empty
                        :description="`Không có KPI nào cần review cho ${getSelectedTargetName()} trong chu kỳ ${getSelectedCycleName()}.`" />
                </div>


                <div v-else-if="kpisToReview.length > 0">
                    <a-form layout="vertical" @finish="submitOverallReview">
                        <div v-for="(kpiItem, index) in kpisToReview" :key="kpiItem.assignmentId"
                            class="kpi-review-item">
                            <a-divider v-if="index > 0" />
                            <h3>{{ index + 1 }}. {{ kpiItem.kpiName }}</h3>
                            <a-row :gutter="16">
                                <a-col :span="8">
                                    <a-descriptions size="small" bordered :column="1">
                                        <!-- eslint-disable-next-line vue/no-undef-components -->
                                        <a-descriptions-item label="Mục tiêu (Target)">
                                            {{ kpiItem.targetValue }} {{ kpiItem.unit }}
                                        </a-descriptions-item>
                                    </a-descriptions>
                                </a-col>
                                <a-col :span="8">
                                    <!-- eslint-disable-next-line vue/no-undef-components -->
                                    <a-descriptions size="small" bordered :column="1">
                                        <a-descriptions-item label="Kết quả Thực tế">
                                            {{ kpiItem.actualValue }} {{ kpiItem.unit }}
                                        </a-descriptions-item>
                                    </a-descriptions>
                                </a-col>
                                <!-- eslint-disable-next-line vue/no-undef-components -->
                                <a-col :span="8">
                                    <a-descriptions size="small" bordered :column="1">
                                        <a-descriptions-item label="Tỷ lệ Hoàn thành">
                                            <a-progress
                                                :percent="calculateCompletionRate(kpiItem.actualValue, kpiItem.targetValue)"
                                                :status="getCompletionStatus(calculateCompletionRate(kpiItem.actualValue, kpiItem.targetValue))" />
                                        </a-descriptions-item>
                                    </a-descriptions>
                                </a-col>
                            </a-row>

                            <a-form-item :label="`Đánh giá của Quản lý cho KPI: ${kpiItem.kpiName}`"
                                         :name="['kpiItem', index, 'managerComment']"
                                style="margin-top: 10px;">
                                <a-textarea v-model:value="kpiItem.managerComment"
                                    placeholder="Nhận xét, điểm mạnh, điểm cần cải thiện..." :rows="3" />
                            </a-form-item>
                            <!-- Tùy chọn: Thêm trường nhập điểm số nếu có -->
                            <!--
              <a-form-item label="Điểm số (1-5)">
                <a-rate v-model:value="kpiItem.managerScore" />
              </a-form-item>
              -->
                        </div>

                        <a-divider />
                        <a-form-item label="Nhận xét/Đánh giá Tổng thể của Quản lý" name="overallManagerComment">
                            <a-textarea v-model:value="overallReview.managerComment"
                                placeholder="Đánh giá chung về hiệu suất trong chu kỳ, định hướng phát triển..."
                                :rows="5" />
                        </a-form-item>
                        <!-- Tùy chọn: Thêm trường nhập điểm tổng thể nếu có -->

                        <a-form-item>
                            <a-button type="primary" html-type="submit" :loading="isSubmitting">
                                Lưu Đánh giá
                            </a-button>
                            <!-- Tùy chọn: Thêm nút "Hoàn tất Review" nếu có quy trình nhiều bước -->
                        </a-form-item>
                    </a-form>
                </div>
            </a-spin>
        </a-card>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import {
    Card as ACard,
    Row as ARow,
    Col as ACol,
    Select as ASelect,
    SelectOption as ASelectOption,
    Form as AForm,
    FormItem as AFormItem,
    InputTextarea as ATextarea,
    Button as AButton,
    Spin as ASpin,
    Alert as AAlert,
    Empty as AEmpty,
    Divider as ADivider,
    Descriptions as ADescriptions,
    DescriptionsItem as ADescriptionsItem,
    Progress as AProgress,
    // Rate as ARate, // Nếu dùng điểm số dạng sao
    notification,
    Breadcrumb as ABreadcrumb,
    BreadcrumbItem as ABreadcrumbItem,
} from 'ant-design-vue';

const store = useStore();

// --- State cho việc chọn đối tượng và chu kỳ ---
const selectedTarget = ref(null);
const reviewTargets = computed(() => store.getters["kpiEvaluations/getReviewableTargets"]);
const isLoadingTargets = computed(() => store.getters["kpiEvaluations/isLoadingReviewableTargets"]);
// const reviewTargetsError = computed(() => store.getters["kpiEvaluations/getReviewableTargetsError"]);

const selectedCycle = ref(null);
const reviewCycles = computed(() => store.getters["kpiEvaluations/getReviewCycles"]);
const isLoadingCycles = computed(() => store.getters["kpiEvaluations/isLoadingReviewCycles"]);
// const reviewCyclesError = computed(() => store.getters["kpiEvaluations/getReviewCyclesError"]);


// --- State cho danh sách KPI cần review ---
const kpisToReview = computed(() => store.getters["kpiEvaluations/getKpisToReview"]);
const isLoadingKpis = computed(() => store.getters["kpiEvaluations/isLoadingKpisToReview"]);
const loadingError = computed(() => store.getters["kpiEvaluations/getKpisToReviewError"]); // Chung cho lỗi tải KPI


// --- State cho đánh giá tổng thể ---
const overallReview = ref({
    managerComment: '',
    // managerScore: null, // Nếu có
});

const isSubmitting = computed(() => store.getters["kpiEvaluations/isSubmittingKpiReview"]);
const submitError = computed(() => store.getters["kpiEvaluations/getSubmitKpiReviewError"]);


// --- Computed Properties ---
const pageTitle = computed(() => {
    const targetName = getSelectedTargetName();
    const cycleName = getSelectedCycleName();
    if (targetName && cycleName) {
        return `Đánh giá Kết quả KPI cho ${targetName} - Chu kỳ: ${cycleName}`;
    }
    return 'Đánh giá Kết quả KPI';
});

// --- Methods ---
const getSelectedTargetName = () => {
    const target = reviewTargets.value.find(t => t.id === selectedTarget.value);
    return target ? target.name : '';
};

const getSelectedCycleName = () => {
    const cycle = reviewCycles.value.find(c => c.id === selectedCycle.value);
    return cycle ? cycle.name : '';
};

const filterOption = (input, option) => {
    return option.children[0].children.toLowerCase().includes(input.toLowerCase());
};

const fetchReviewTargets = async () => {
    try {
        await store.dispatch('kpiEvaluations/fetchReviewableTargets');
    } catch (error) {
        // Store action already handles notification
        console.error("Component error fetching review targets:", error);
    }
};

const fetchReviewCycles = async () => {
    try {
        await store.dispatch('kpiEvaluations/fetchReviewCycles');
    } catch (error) {
        // Store action already handles notification
        console.error("Component error fetching review cycles:", error);
    }
};

const handleTargetChange = () => {
    if (selectedTarget.value && selectedCycle.value) {
        fetchKpisForReview();
    }
};

const fetchKpisForReview = async () => {
    if (!selectedTarget.value || !selectedCycle.value) {
        store.commit("kpiEvaluations/SET_KPIS_TO_REVIEW", []); // Clear kpis if no selection
        return;
    }
    try {
        const target = reviewTargets.value.find(t => t.id === selectedTarget.value);
        if (!target) {
            notification.error({ message: 'Lỗi', description: 'Không tìm thấy thông tin đối tượng được chọn.' });
            return;
        }
        await store.dispatch('kpiEvaluations/fetchKpisForReview', {
            targetId: selectedTarget.value,
            targetType: target.type,
            cycleId: selectedCycle.value,
        });

    } catch (error) {
        // Store action already handles notification and error state
        console.error("Component error fetching KPIs for review:", error);
    }
};

const calculateCompletionRate = (actual, target) => {
    if (target === null || target === undefined || target === 0 || actual === null || actual === undefined) {
        return 0;
    }
    return Math.round((actual / target) * 100);
};

const getCompletionStatus = (rate) => {
    if (rate >= 100) return 'success';
    if (rate >= 70) return 'normal';
    return 'exception';
};

const submitOverallReview = async () => {
    try {
        const target = reviewTargets.value.find(t => t.id === selectedTarget.value);
        if (!target) {
            notification.error({ message: 'Lỗi', description: 'Vui lòng chọn đối tượng review hợp lệ.' });
            return;
        }
        const reviewData = {
            targetId: selectedTarget.value,
            targetType: target.type,
            cycleId: selectedCycle.value, // Ensure selectedCycle.value is the ID
            overallComment: overallReview.value.managerComment,
            // overallScore: overallReview.value.managerScore, // Nếu có
            kpiReviews: kpisToReview.value.map(kpi => ({
                assignmentId: kpi.assignmentId,
                managerComment: kpi.managerComment,
                managerScore: kpi.managerScore, // Nếu có
            })),
        };
        console.log('Submitting review data:', reviewData);
        await store.dispatch('kpiEvaluations/submitKpiReview', reviewData);
        notification.success({ message: 'Lưu đánh giá thành công!' });
    } catch (err) {
        const error = err || submitError.value; // Use error from store if dispatch itself didn't throw awaited error
        notification.error({ message: 'Lỗi lưu đánh giá', description: error.message });
    }
};

onMounted(() => {
    fetchReviewTargets();
    fetchReviewCycles();
    // TODO: Có thể lấy targetId và cycleId từ route params nếu người dùng điều hướng từ một nơi cụ thể
    // Ví dụ: selectedTarget.value = route.query.targetId; selectedCycle.value = route.query.cycleId;
    // if (selectedTarget.value && selectedCycle.value) fetchKpisForReview();
});

</script>

<style scoped>
.kpi-review-page {
    padding: 24px;
}

.kpi-review-item {
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    background-color: #fafafa;
}

.kpi-review-item h3 {
    margin-bottom: 12px;
    font-size: 1.1em;
}

.empty-state {
    text-align: center;
    padding: 40px 0;
}
</style>
