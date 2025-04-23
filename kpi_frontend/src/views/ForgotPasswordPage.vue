<template>
    <div class="forgot-password-container">
      <div class="forgot-password-box">
        <img src="../assets/logo.png" alt="Logo" class="logo-image"> <h2>Forgot Your Password</h2>
        <a-form
          ref="formRef"
          :model="formData"
          :rules="rules"
          layout="vertical"
          @finish="handleRequestReset"
          @finishFailed="onFinishFailed"
          style="margin-top: 30px;"
        >
          <a-form-item
            label="Email Address"
            name="email"
            has-feedback
            :validateTrigger="['change', 'blur']"
          >
            <a-input
              v-model:value="formData.email"
              placeholder="Enter your registered email"
              :disabled="loading"
              size="large"
            >
              <template #prefix><mail-outlined /></template>
            </a-input>
          </a-form-item>
  
          <a-form-item v-if="statusMessage">
             <a-alert :message="statusMessage" :type="isError ? 'error' : 'success'" show-icon />
          </a-form-item>
  
          <a-form-item>
            <a-button
              type="primary"
              html-type="submit"
              :loading="loading"
              block
              size="large"
            >
              Send Password Reset Link
            </a-button>
          </a-form-item>
        </a-form>
  
        <div class="back-to-login">
          <router-link to="/">← Back to Login</router-link>
        </div>
  
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, reactive, onUnmounted } from 'vue';
  // Import Ant Design components và icons
  import { Form, Input, Button, Alert } from 'ant-design-vue';
  import { MailOutlined } from '@ant-design/icons-vue';
  
  // --- State ---
  const formData = reactive({
    email: '',
  });
  const formRef = ref();
  const loading = ref(false);
  const statusMessage = ref(''); // Thông báo thành công hoặc lỗi
  const isError = ref(false);   // Xác định loại thông báo (error hay success)
  
  // --- Store & Router ---
  
  // --- Validation Rules ---
  const rules = reactive({
    email: [
      { required: true, message: 'Please input your Email address!' },
      { type: 'email', message: 'Please enter a valid email address!', trigger: ['change', 'blur'] },
    ],
  });
  
  // --- Methods ---
  // Xử lý khi submit form
  const handleRequestReset = async (values) => {
    loading.value = true;
    statusMessage.value = ''; // Xóa thông báo cũ
    isError.value = false;
    console.log('Requesting password reset for:', values.email);
  
    try {
      // --- !!! ACTION CẦN TẠO: 'auth/requestPasswordReset(email)' ---
      // Action này sẽ gọi API backend để yêu cầu gửi link reset.
      // Backend sẽ xử lý việc gửi email. Action chỉ cần biết thành công hay thất bại.
      console.warn("Store action 'auth/requestPasswordReset' needs to be implemented.");
      // await store.dispatch('auth/requestPasswordReset', values.email); // <-- Gọi action thật
      await new Promise(resolve => setTimeout(resolve, 1000)); // << Giả lập gọi API thành công
  
      // Nếu thành công (action không throw error)
      statusMessage.value = "If an account with that email exists, a password reset link has been sent. Please check your inbox (and spam folder).";
      isError.value = false;
      formData.email = ''; // Xóa email sau khi gửi thành công (tùy chọn)
      // Không cần chuyển hướng ngay, để người dùng đọc thông báo
  
    } catch (error) {
      // Nếu thất bại (action throw error)
      console.error("Password reset request failed:", error);
      // Lấy lỗi từ action (action nên xử lý lỗi API và trả về message phù hợp)
      statusMessage.value = error?.message || 'Failed to send reset link. Please try again later.';
      isError.value = true;
    } finally {
      loading.value = false;
    }
  };
  
  // Xử lý khi validation client thất bại
  const onFinishFailed = (errorInfo) => {
    console.log('Form validation Failed:', errorInfo);
    // Thường không cần làm gì thêm vì Ant Design tự hiển thị lỗi dưới input
  };
  
  // Xóa thông báo khi component unmount
  onUnmounted(() => {
      statusMessage.value = '';
      isError.value = false;
  });
  
  // Đăng ký component Ant Design (chỉ cần nếu không dùng auto-import)
  const AForm = Form;
  const AFormItem = Form.Item;
  const AInput = Input;
  const AButton = Button;
  const AAlert = Alert;
  
  </script>
  
  <style scoped>
  .forgot-password-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh; /* Hoặc height phù hợp nếu nằm trong layout khác */
    padding: 20px;
    background: linear-gradient(to bottom right, #f0f2f5, #e6e9f0); /* Nền khác trang login */
  }
  
  .forgot-password-box {
    background-color: #fff;
    padding: 40px 35px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 450px; /* Có thể rộng hơn login box một chút */
    text-align: center;
  }
  
  .logo-image { /* Đổi tên class nếu dùng logo */
    max-height: 60px;
    margin-bottom: 20px;
  }
  
  .forgot-password-box h2 {
    margin-bottom: 15px;
    color: #343a40;
    font-size: 1.6rem; /* Hơi nhỏ hơn login */
    font-weight: 600;
  }
  
  .description-text {
      color: #6c757d;
      margin-bottom: 25px;
      font-size: 0.95em;
  }
  
  :deep(.ant-form-item-label > label) {
    font-weight: 500;
    color: #495057;
  }
  
  :deep(.ant-form-item) {
      margin-bottom: 24px;
  }
  
  .back-to-login {
      margin-top: 25px;
      font-size: 0.9em;
  }
  
  .back-to-login a {
      color: var(--brand-link, #0d6efd); /* Dùng biến màu nếu có */
      text-decoration: none;
  }
  .back-to-login a:hover {
      text-decoration: underline;
  }

  </style>