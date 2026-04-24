<script setup lang="ts">
import { ref, reactive } from "vue";
import { useAuth } from "@/composables/useAuth";
import type { LoginRequest } from "@/types/api";

const { login, isLoading, loginError } = useAuth();

const form = reactive<LoginRequest>({ email: "", password: "" });
const showPassword = ref(false);

async function handleSubmit() {
  await login({ ...form });
}

function fillDemo(role: "gm" | "pm" | "leader" | "member" | "admin") {
  const map = {
    gm: { email: "gm@kpi.com", password: "Abc@12345" },
    pm: { email: "pm1@kpi.com", password: "Abc@12345" },
    leader: { email: "leader1@kpi.com", password: "Abc@12345" },
    member: { email: "member1@kpi.com", password: "Abc@12345" },
    admin: { email: "admin@company.vn", password: "Abc@12345" },
  };
  form.email = map[role].email;
  form.password = map[role].password;
}
</script>

<template>
  <div
    class="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex min-h-[520px]"
  >
    <!-- Left panel -->
    <div
      class="hidden md:flex flex-col justify-between w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-10 text-white"
    >
      <div>
        <div class="flex items-center gap-3 mb-10">
          <div class="bg-white/20 p-2 rounded-xl">
            <i class="fas fa-bullseye text-2xl" />
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight">KPI System</h1>
            <p class="text-blue-200 text-sm font-medium">
              Performance Management
            </p>
          </div>
        </div>
        <h2 class="text-3xl font-bold leading-snug mb-4">
          Quản lý &amp;<br />Đánh giá KPI<br />nhân viên
        </h2>
        <p class="text-blue-200 text-sm leading-relaxed">
          Hệ thống đánh giá hiệu suất toàn diện cho GM, PM, Leader và nhân viên.
        </p>
      </div>

      <!-- Demo accounts -->
      <div class="space-y-2">
        <p
          class="text-blue-200 text-xs font-bold uppercase tracking-wider mb-3"
        >
          Demo accounts
        </p>
        <button
          v-for="r in ['gm', 'pm', 'leader', 'member', 'admin'] as const"
          :key="r"
          class="w-full text-left px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-sm font-medium"
          @click="fillDemo(r)"
        >
          <span class="capitalize font-bold">{{ r.toUpperCase() }}</span>
          <span class="text-blue-200 text-xs ml-2">
            {{ r === "admin" ? "admin@company.vn" : `${r}@kpi.com` }} /
            Abc@12345
          </span>
        </button>
      </div>
    </div>

    <!-- Right panel: form -->
    <div class="flex-1 flex flex-col justify-center p-10">
      <div class="md:hidden flex items-center gap-3 mb-8">
        <div class="bg-blue-600 p-2 rounded-xl">
          <i class="fas fa-bullseye text-white text-xl" />
        </div>
        <h1 class="text-2xl font-black text-slate-800">KPI System</h1>
      </div>

      <h2 class="text-2xl font-bold text-slate-800 mb-1">Đăng nhập</h2>
      <p class="text-slate-500 text-sm mb-8">
        Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.
      </p>

      <form class="space-y-5" @submit.prevent="handleSubmit">
        <!-- Email -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5"
            >Email</label
          >
          <div class="relative">
            <i
              class="fas fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
            />
            <input
              v-model="form.email"
              type="email"
              required
              placeholder="your@email.com"
              class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
          </div>
        </div>

        <!-- Password -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5"
            >Mật khẩu</label
          >
          <div class="relative">
            <i
              class="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
            />
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              placeholder="••••••••"
              class="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              @click="showPassword = !showPassword"
            >
              <i
                :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"
                class="text-sm"
              />
            </button>
          </div>
        </div>

        <!-- Error -->
        <div
          v-if="loginError"
          class="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm"
        >
          <i class="fas fa-exclamation-circle text-red-500" />
          {{ loginError }}
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
        >
          <i v-if="isLoading" class="fas fa-spinner fa-spin text-sm" />
          <i v-else class="fas fa-sign-in-alt text-sm" />
          {{ isLoading ? "Đang đăng nhập..." : "Đăng nhập" }}
        </button>
      </form>
    </div>
  </div>
</template>
