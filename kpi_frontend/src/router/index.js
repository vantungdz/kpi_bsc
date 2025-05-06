
import { createRouter, createWebHistory } from "vue-router";
import store from "../store"; 


import PerformanceObjectives from "../views/PerformanceObjectives.vue";
import KpiListCompany from "../views/KpiListCompany.vue";
import KpiListDepartment from "../views/KpiListDepartment.vue";
import KpiListSection from "../views/KpiListSection.vue";
import KpiCreateCompany from "../views/KpiCreateCompany.vue";
import KpiDetail from "../views/KpiDetail.vue";
import PersonalCreate from "../views/PersonalCreate.vue";
import KpiPersonal from "../views/KpiPersonal.vue";
import KpiCreateDepartment from "../views/KpiCreateDepartment.vue";
import KpiCreateSection from "../views/KpiCreateSection.vue";
import LoginPage from "../views/LoginPage.vue";
import ForgotPasswordPage from "../views/ForgotPasswordPage.vue";
import KpiValueApprovalList from "../views/KpiValueApprovalList.vue";

const routes = [
  {
    path: "/",
    name: "LoginPage",
    component: LoginPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/forgot-password",
    name: "ForgotPasswordPage",
    component: ForgotPasswordPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/performance",
    name: "PerformanceObjectives",
    component: PerformanceObjectives,
    meta: { requiresAuth: true },
  },
  {
    path: "/kpis",
    name: "Kpis",
    meta: { requiresAuth: true },
    children: [
      {
        path: "company",
        name: "KpiListCompany",
        component: KpiListCompany,
        meta: { roles: ["admin", "manager"] },
      },
      {
        path: "department",
        name: "KpiListDepartment",
        component: KpiListDepartment,
        meta: { roles: ["admin", "manager"] },
      },
      {
        path: "department-create",
        name: "KpiCreateDepartment",
        component: KpiCreateDepartment,
        props: true,
        meta: { roles: ["admin", "manager", "department"] },
      },
      {
        path: "section",
        name: "KpiListSection",
        component: KpiListSection,
        meta: { roles: ["admin", "manager", "leader", "department"] },
      },
      {
        path: "section-create",
        name: "KpiCreateSection",
        component: KpiCreateSection,
        props: true,
        meta: { roles: ["admin", "manager", "department", "section"] },
      },
      {
        path: "create",
        name: "KpiCreateCompany",
        component: KpiCreateCompany,
        props: (route) => ({ scope: route.query.scope }),
        meta: { roles: ["admin", "manager"] },
      },
      {
        path: ":id",
        name: "KpiDetail",
        component: KpiDetail,
        props: true,
      },
    ],
  },
  {
    path: "/approvals",
    name: "PendingApprovals",
    component: KpiValueApprovalList,
    meta: {
      requiresAuth: true,
      roles: ["leader", "manager", "admin"],
    },
  },
  {
    path: "/personal/create",
    name: "KpiPersonalCreate",
    component: PersonalCreate,
    meta: { requiresAuth: true },
  },
  {
    path: "/personal",
    name: "KpiPersonal",
    component: KpiPersonal,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});


router.beforeEach((to, from, next) => {
  
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  
  const isAuthenticated = store.getters["auth/isAuthenticated"];

  // Nếu người dùng đã đăng nhập và truy cập "/", chuyển hướng sang "/performance"
  if (isAuthenticated && to.path === "/") {
    next({ path: "/performance" });
    return;
  }

  if (requiresAuth && !isAuthenticated) {
    
    
    next({ name: "LoginPage", query: { redirect: to.fullPath } });
  } else {
    
    
    const allowedRoles = to.meta.roles;

    if (
      allowedRoles &&
      Array.isArray(allowedRoles) &&
      allowedRoles.length > 0
    ) {
      
      
      const userEffectiveRole = store.getters["auth/effectiveRole"];

      if (!userEffectiveRole || !allowedRoles.includes(userEffectiveRole)) {
        
        console.warn(
          `User role '${userEffectiveRole}' not authorized for route ${to.name}`
        );
        
        
        next(false); 
      } else {
        
        next();
      }
    } else {
      
      next();
    }
  }
});


export default router;
