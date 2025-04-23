import { createRouter, createWebHistory } from "vue-router";

// Views
import PerformanceObjectives from "../views/PerformanceObjectives.vue";
import KpiListCompany from "../views/KpiListCompany.vue";
import KpiListDepartment from "../views/KpiListDepartment.vue";
import KpiListSection from "../views/KpiListSection.vue";
import KpiListIndividual from "../views/KpiListIndividual.vue";
import KpiCreateCompany from "../views/KpiCreateCompany.vue"; // Giả định đây là component KpiCreateCompany hoặc xử lý chung
import KpiDetail from "../views/KpiDetail.vue";
import PersonalCreate from "../views/PersonalCreate.vue";
import KpiPersonal from "../views/KpiPersonal.vue";
import KpiCreateDepartment from "../views/KpiCreateDepartment.vue"; // Vẫn giữ import
import LoginPage from "../views/LoginPage.vue";
import ForgotPasswordPage from "../views/ForgotPasswordPage.vue";

const routes = [
  {
    path: "/",
    name: "LoginPage",
    component: LoginPage,
  },
  {
    path: "/forgot-password",
    name: "ForgotPasswordPage",
    component: ForgotPasswordPage,
  },
  {
    path: "/performance",
    name: "PerformanceObjectives",
    component: PerformanceObjectives,
  },
  {
    path: "/kpis",
    name: "Kpis",
    children: [
      {
        path: "company", // /kpis/company
        name: "KpiListCompany",
        component: KpiListCompany,
      },
      {
        path: "department", // /kpis/department
        name: "KpiListDepartment",
        component: KpiListDepartment, // Component hiển thị danh sách KPI phòng ban
        // Không còn children chứa KpiCreateDepartment ở đây nữa
      },
      // Route TẠO KPI cho Department (đã chuyển ra ngoài, là con trực tiếp của /kpis)
      {
        path: "department-create/:departmentId", // Path mới và thêm departmentId param
        name: "KpiCreateDepartment", // Tên route giữ nguyên
        component: KpiCreateDepartment, // Component tạo KPI Department
        props: true, // Vẫn truyền departmentId từ params vào component
      },
      {
        path: "section", // /kpis/section
        name: "KpiListSection",
        component: KpiListSection,
        // Nếu có route tạo/chi tiết section, chúng cũng nên là sibling route hoặc có cấu trúc riêng
        children: [
          // { path: ":sectionId/create", ... } <-- Nếu có, sẽ là con của /kpis/section
          // Có thể cân nhắc làm tương tự route department-create ở trên: /kpis/section-create/:sectionId
        ],
      },
      // Giữ lại các route khác
      {
        path: "individual", // /kpis/individual
        name: "KpiListIndividual",
        component: KpiListIndividual,
      },
      {
        path: "create", // /kpis/create (route tạo chung?)
        name: "KpiCreateCompany",
        component: KpiCreateCompany,
        props: (route) => ({ scope: route.query.scope }),
      },
      {
        path: ":id", // /kpis/:id (route chi tiết KPI chung)
        name: "KpiDetail",
        component: KpiDetail,
        props: true,
      },
    ],
  },

  {
    path: "/personal/create", // /personal/create
    name: "KpiPersonalCreate",
    component: PersonalCreate,
  },
  {
    path: "/personal", // /personal
    name: "KpiPersonal",
    component: KpiPersonal,
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
