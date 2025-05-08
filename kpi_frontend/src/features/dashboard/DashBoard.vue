<template>
    <div class="dashboard-overview-container">
    <h1>Dashboard Tổng Quan</h1>
    <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <router-link to="/dashboard/kpi-process-stats">
                <a-card hoverable class="dashboard-block-card card-kpi-stats">
                    <template #title>
                        <line-chart-outlined /> Thống kê Quy trình KPI
                    </template>
                    <p>Xem chi tiết số lượng KPI chờ duyệt, đã duyệt/từ chối, thời gian duyệt trung bình và các KPI
                        nổi bật.</p>
                </a-card>
            </router-link>
        </a-col>
        <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <router-link to="/dashboard/notification-stats">
            <a-card hoverable class="dashboard-block-card card-notification-stats">
                <template #title>
                <bell-outlined /> Thống kê Thông báo
                </template>
                <p>Phân tích số lượng và loại thông báo trong hệ thống.</p>
            </a-card>
            </router-link>
        </a-col>
    </a-row>
    </div>
</template>

<script setup>
// import { Card, Row, Col } from 'ant-design-vue'; // These are likely globally registered or will be resolved by Vue
import { LineChartOutlined, BellOutlined } from '@ant-design/icons-vue'; // Import icons nếu cần

// Components like ACard, ARow, ACol, LineChartOutlined, BellOutlined
// are automatically available in the template when imported in <script setup>
// if they are registered globally or PascalCased and used directly.
</script>

<style scoped>
.dashboard-overview-container {
    padding: 24px;
}

/* Đảm bảo router-link chiếm toàn bộ chiều cao của cột cha (a-col)
   và thiết lập nó như một flex container cho a-card bên trong. */
.dashboard-overview-container :deep(.ant-col > a) {
    display: flex; /* Sử dụng flex để a-card bên trong có thể co giãn */
    flex-direction: column; /* Xếp a-card theo chiều dọc */
    height: 100%; /* Quan trọng: chiếm toàn bộ chiều cao của a-col */
}

.dashboard-block-card {
    min-height: 150px;
    flex-grow: 1; /* Quan trọng: cho phép card co giãn để lấp đầy router-link */
    display: flex; /* Sử dụng flex để quản lý layout bên trong card (header, body) */
    flex-direction: column; /* Xếp header và body của card theo chiều dọc */
    justify-content: space-between; /* Phân bổ không gian giữa header và body */
    transition: all 0.3s ease; /* Giữ lại hiệu ứng transition đã có */
}

/* Thêm màu sắc cho từng khối */
.card-kpi-stats {
    border-left: 5px solid #1890ff; /* Viền trái màu xanh dương đậm */
    /* Bỏ background-color chung ở đây */
}
.card-kpi-stats :deep(.ant-card-head) {
    background-color: #e6f7ff; /* Màu nền xanh dương nhạt cho title */
}
.card-kpi-stats :deep(.ant-card-body) {
    background-color: #f0faff; /* Màu nền xanh dương rất nhạt hoặc trắng cho body */
}
/* Màu chữ cho card KPI stats */
.card-kpi-stats .ant-card-head-title,
.card-kpi-stats :deep(.anticon) { /* Áp dụng cho cả icon trong title */
    color: #0050b3; /* Màu xanh dương đậm hơn cho title và icon */
}
.card-kpi-stats p {
    color: #003a75; /* Màu xanh dương sẫm hơn cho nội dung */
}

.card-notification-stats {
    border-left: 5px solid #faad14; /* Viền trái màu vàng đậm */
    /* Bỏ background-color chung ở đây */
}
.card-notification-stats :deep(.ant-card-head) {
    background-color: #fffbe6; /* Màu nền vàng nhạt cho title */
}
.card-notification-stats :deep(.ant-card-body) {
    background-color: #fffefa; /* Màu nền vàng rất nhạt hoặc trắng cho body */
}
/* Màu chữ cho card Notification stats */
.card-notification-stats .ant-card-head-title,
.card-notification-stats :deep(.anticon) {
    color: #ad6800; /* Màu vàng đậm hơn cho title và icon */
}
.card-notification-stats p {
    color: #874d00; /* Màu vàng sẫm hơn cho nội dung */
}
/* Bạn có thể thêm các class tương tự cho các khối khác */



.dashboard-block-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dashboard-block-card .ant-card-head {
    flex-shrink: 0; /* Ngăn header co lại khi không đủ không gian */
    /* Bỏ font-size và font-weight ở đây nếu muốn nó kế thừa từ style chung của AntD hoặc định nghĩa lại trong từng card-xxx */
    font-size: 1.1em;
    font-weight: bold;
}

.dashboard-block-card :deep(.ant-card-body) {
    flex-grow: 1; /* Cho phép body của card chiếm phần không gian dọc còn lại */
    display: flex; /* Sử dụng flex để căn chỉnh nội dung bên trong body nếu cần */
    flex-direction: column; /* Xếp các phần tử trong body theo chiều dọc */
}

.dashboard-block-card p {
    font-size: 0.9em;
    color: #555;
    margin-top: 8px; /* Giữ lại margin đã có */
}

a {
    /* Đảm bảo link không có gạch chân mặc định */
    text-decoration: none;
    color: inherit;
    /* Kế thừa màu chữ từ cha */
}
</style>
