<template>
  <div>
    <h2>KPI Reports</h2>

    <div class="report-container detail-section">
       <div class="filters">
           <label for="report-type">Report Type:</label>
           <select id="report-type" v-model="filterOptions.reportType">
               <option value="overall">Overall</option>
               <option value="department">By Department</option>
               <option value="section">By Section</option>
               <option value="team">By Team</option>
               <option value="perspective">By Perspective</option>
               <option value="individual">By Individual</option>
           </select>

           <label v-if="filterOptions.reportType === 'department'" for="dept-filter">Department:</label>
           <select v-if="filterOptions.reportType === 'department'" id="dept-filter" v-model="filterOptions.departmentId">
                <option value="">All</option>
                <option value="1">Department 1</option>
           </select>

            <label v-if="filterOptions.reportType === 'perspective'" for="perspective-filter">Perspective:</label>
           <PerspectiveSelect v-if="filterOptions.reportType === 'perspective'" v-model="filterOptions.perspectiveId" />

           <label v-if="filterOptions.reportType === 'individual'" for="user-filter">Employee:</label>
           <UserSelect v-if="filterOptions.reportType === 'individual'" v-model="filterOptions.assignedToId" />
           <label for="start-date">From:</label>
           <input type="date" id="start-date" v-model="filterOptions.startDate">
           <label for="end-date">To:</label>
           <input type="date" id="end-date" v-model="filterOptions.endDate">

           <button @click="fetchReportData" :disabled="loading">Generate</button>
       </div>

        <div v-if="!loading && reportData.length > 0" class="export-buttons">
            <button @click="exportReport('excel')" :disabled="exporting"><i class="fas fa-file-excel"></i> Export Excel</button>
            <button @click="exportReport('pdf')" :disabled="exporting"><i class="fas fa-file-pdf"></i> Export PDF</button>
             <span v-if="exporting"> Exporting...</span>
        </div>

        <div v-if="loading">Loading report data...</div>
         <div v-else-if="error">{{ error }}</div>
         <div v-else-if="reportData.length === 0 && hasGenerated">No data found for the selected criteria.</div>
         <table v-else-if="reportData.length > 0">
            <thead>
                <tr>
                     <th>KPI Name</th>
                     <th>Hierarchy</th>
                     <th>Perspective</th>
                     <th>Unit</th>
                     <th>Target</th>
                     <th>Actual</th>
                     <th>Progress (%)</th>
                     <th>Status</th>
                     <th>Assigned To</th>
                     </tr>
            </thead>
             <tbody>
                 <tr v-for="item in reportData" :key="item.id">
                    <td>{{ item.name }}</td>
                    <td>{{ item.hierarchy || 'N/A' }}</td>
                    <td>{{ item.perspective?.name || 'N/A' }}</td>
                    <td>{{ item.unit }}</td>
                    <td>{{ formatValue(item.target, item.unit) }}</td>
                    <td>{{ formatValue(item.currentActual, item.unit) }}</td>
                     <td>{{ item.currentProgress?.toFixed(1) || 0 }}%</td>
                     <td><span :class="getStatusClass(item.currentProgress)">{{ getStatusText(item.currentProgress) }}</span></td>
                     <td>{{ item.assignedTo?.username || 'N/A' }}</td>
                 </tr>
             </tbody>
         </table>

         <div v-if="!loading && reportData.length > 0" class="report-chart">
             <h3>Report Chart (Example: Progress Distribution)</h3>
              <BaseChart
                 v-if="chartData.labels?.length"
                 type="bar"
                 :chart-data="chartData"
              />
             <div v-else>Chart data not available.</div>
         </div>

    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import apiClient from '@/services/api'; // Import trực tiếp nếu không cần store phức tạp
import PerspectiveSelect from '@/components/PerspectiveSelect.vue';
import UserSelect from '@/components/UserSelect.vue';
import BaseChart from '@/components/BaseChart.vue';
// Import helpers nếu cần
// import { formatValue, getStatusClass, getStatusText } from '@/utils/helpers';

const loading = ref(false);
const exporting = ref(false);
const error = ref(null);
const reportData = ref([]);
const hasGenerated = ref(false); // Cờ để biết đã nhấn Generate chưa

const filterOptions = reactive({
    reportType: 'overall',
    departmentId: null,
    sectionId: null,
    teamId: null,
    perspectiveId: null,
    assignedToId: null,
    startDate: '',
    endDate: '',
});

// Dữ liệu cho biểu đồ ví dụ
const chartData = computed(() => {
    if(reportData.value.length === 0) return { labels: [], datasets: [] };
    // Ví dụ: Đếm số lượng KPI theo Status
    const statusCounts = reportData.value.reduce((acc, kpi) => {
        const status = getStatusText(kpi.currentProgress);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    return {
        labels: Object.keys(statusCounts),
        datasets: [{
            label: 'KPI Count by Status',
            data: Object.values(statusCounts),
            backgroundColor: [ '#198754', '#ffc107','#dc3545', '#6c757d'], // Màu tương ứng Good, Warning, Bad, N/A
        }]
    }
});


const fetchReportData = async () => {
  loading.value = true;
  error.value = null;
  hasGenerated.value = true; // Đánh dấu đã generate
  try {
    // Xây dựng params dựa trên filterOptions
    const params = { ...filterOptions };
    // Xóa các key không cần thiết hoặc null/empty tùy theo logic API
    // if(!params.departmentId) delete params.departmentId; ...

    const response = await apiClient.get('/reports/kpis', { params }); // API Endpoint ví dụ
    reportData.value = response.data.data || []; // Giả sử API trả về { data: [...] }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to fetch report data.';
    reportData.value = []; // Xóa dữ liệu cũ nếu lỗi
  } finally {
    loading.value = false;
  }
};

const exportReport = async (format) => {
    exporting.value = true;
    try {
        const params = { ...filterOptions, format }; // Thêm format vào params
        const response = await apiClient.get('/reports/kpis/export', {
             params,
             responseType: 'blob' // Quan trọng: nhận file dạng blob
        });

        // Tạo link ảo để tải file
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const contentDisposition = response.headers['content-disposition'];
        let filename = `kpi_report.${format === 'excel' ? 'xlsx' : 'pdf'}`; // Tên file mặc định
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (filenameMatch && filenameMatch.length === 2)
                filename = filenameMatch[1];
        }
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

    } catch(err) {
        alert('Failed to export report.');
        console.error("Export error:", err);
    } finally {
        exporting.value = false;
    }
};

// --- Helpers (Nên đưa ra file riêng) ---
const formatValue = (value, unit) => { /* ... như ở Dashboard ... */ return value };
const getStatusClass = (progress) => { /* ... như ở Dashboard ... */ return '' };
const getStatusText = (progress) => { /* ... như ở Dashboard ... */ return ''};

// Fetch data lần đầu nếu cần
// onMounted(fetchReportData); // Hoặc đợi người dùng nhấn Generate

</script>

<style scoped>
/* Kế thừa style chung */
.report-container h3 { margin-top: 1.5rem; margin-bottom: 1rem;}
.export-buttons button i { margin-right: 5px; }
.report-chart { height: 300px;}
</style>