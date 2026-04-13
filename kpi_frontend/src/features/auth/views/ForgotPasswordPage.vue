<template>
  <div class="forgot-password-container">
    <div class="forgot-password-box">
      <img
        src="@/core/assets/logo.png"
        :alt="$t('logoAlt')"
        class="logo-image"
      />
      <h2>{{ $t("forgotPassword") }}</h2>
      <a-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        layout="vertical"
        @finish="handleRequestReset"
        @finishFailed="onFinishFailed"
        style="margin-top: 30px"
      >
        <a-form-item
          :label="$t('emailAddress')"
          name="email"
          has-feedback
          :validateTrigger="['change', 'blur']"
        >
          <a-input
            v-model:value="formData.email"
            :placeholder="$t('enterRegisteredEmail')"
            :disabled="loading"
            size="large"
          >
            <template #prefix><mail-outlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item v-if="statusMessage">
          <a-alert
            :message="statusMessage"
            :type="isError ? 'error' : 'success'"
            show-icon
          />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            :loading="loading"
            block
            size="large"
          >
            {{ $t("sendPasswordResetLink") }}
          </a-button>
        </a-form-item>
      </a-form>

      <div class="back-to-login">
        <router-link to="/">← {{ $t("backToLogin") }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onUnmounted } from "vue";

import { Form, Input, Button, Alert } from "ant-design-vue";
import { MailOutlined } from "@ant-design/icons-vue";

const formData = reactive({
  email: "",
});
const formRef = ref();
const loading = ref(false);
const statusMessage = ref("");
const isError = ref(false);

const rules = reactive({
  email: [
    { required: true, message: "Please input your Email address!" },
    {
      type: "email",
      message: "Please enter a valid email address!",
      trigger: ["change", "blur"],
    },
  ],
});

const handleRequestReset = async () => {
  loading.value = true;
  statusMessage.value = "";
  isError.value = false;

  try {
    console.warn(
      "Store action 'auth/requestPasswordReset' needs to be implemented."
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    statusMessage.value =
      "If an account with that email exists, a password reset link has been sent. Please check your inbox (and spam folder).";
    isError.value = false;
    formData.email = "";
  } catch (error) {
    console.error("Password reset request failed:", error);
    statusMessage.value =
      error?.message || "Failed to send reset link. Please try again later.";
    isError.value = true;
  } finally {
    loading.value = false;
  }
};

onUnmounted(() => {
  statusMessage.value = "";
  isError.value = false;
});

const AForm = Form;
const AFormItem = Form.Item;
const AInput = Input;
const AButton = Button;
const AAlert = Alert;
</script>

<style scoped>
:root {
  --brand-primary: #1976d2;
  --brand-primary-hover: #125ea2;
  --brand-link: #1976d2;
  --brand-primary-bg: #f5faff;
  --brand-shadow: 0 8px 32px 0 rgba(25, 118, 210, 0.1);
}
.forgot-password-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5faff 0%, #e3f0ff 100%);
  padding: 0;
  overflow: auto;
  min-height: unset;
  height: unset;
}
.forgot-password-box {
  background: #fff;
  border-radius: 18px;
  box-shadow: var(--brand-shadow);
  padding: 48px 38px 36px 38px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  animation: fadeIn 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 100vh;
  overflow-y: auto;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.logo-image {
  max-height: 60px;
  margin-bottom: 28px;
  filter: drop-shadow(0 2px 8px #1976d220);
}
.forgot-password-box h2 {
  margin-bottom: 32px;
  color: var(--brand-primary);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}
:deep(.ant-form-item-label > label) {
  font-weight: 600;
  font-size: 1rem;
  color: #1976d2;
}
:deep(.ant-form-item) {
  margin-bottom: 22px;
}
:deep(.ant-input-affix-wrapper),
:deep(.ant-input-password-affix-wrapper) {
  border-radius: 8px;
  background: #f5faff;
  border: 1.5px solid #e3f0ff;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
:deep(.ant-input-affix-wrapper-focused),
:deep(.ant-input-password-affix-wrapper-focused) {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px #1976d220;
}
:deep(.ant-input),
:deep(.ant-input-password) {
  background: transparent;
}
:deep(.ant-input-prefix),
:deep(.ant-input-password-icon) {
  color: #1976d2;
  opacity: 0.8;
}
:deep(.ant-btn) {
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.08rem;
  height: 44px;
  transition:
    background 0.2s,
    border 0.2s,
    transform 0.1s;
}
:deep(.ant-btn-primary) {
  background: linear-gradient(90deg, #1976d2 80%, #2196f3 100%);
  border: none;
  color: #fff;
  box-shadow: 0 2px 8px #1976d220;
}
:deep(.ant-btn-primary:not(:disabled):hover) {
  background: linear-gradient(90deg, #125ea2 80%, #1976d2 100%);
  color: #fff;
}
:deep(.ant-btn:active:not(:disabled)) {
  transform: scale(0.97);
}
:deep(.ant-alert) {
  border-radius: 8px;
  font-size: 1rem;
}
.back-to-login {
  margin-top: 25px;
  font-size: 0.95em;
}
.back-to-login a {
  color: var(--brand-link);
  text-decoration: none;
  transition: color 0.2s;
}
.back-to-login a:hover {
  text-decoration: underline;
  color: var(--brand-primary-hover);
}
@media (max-width: 600px) {
  .forgot-password-box {
    padding: 28px 8px 24px 8px;
    max-width: 98vw;
  }
  .logo-image {
    max-height: 44px;
  }
  .forgot-password-box h2 {
    font-size: 1.2rem;
  }
}
</style>
