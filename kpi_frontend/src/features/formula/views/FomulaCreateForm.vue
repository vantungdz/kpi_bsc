<!-- filepath: e:\project\kpi-frontend\src\features\formula\views\FormulaManageForm.vue -->
<template>
  <a-card class="formula-manage-form">
    <div class="form-header">
      <a-avatar class="form-header-icon" size="large" style="background: linear-gradient(135deg, #1976d2 60%, #42a5f5 100%)">
        <template #icon>
          <CalculatorOutlined />
        </template>
      </a-avatar>
      <h2 class="form-title">{{ $t('formula.title') }}</h2>
    </div>
    <a-divider />
    <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" @finish="handleSubmit">
      <a-row :gutter="20">
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('formula.name')" name="name">
            <a-input v-model:value="form.name" :placeholder="$t('formula.namePlaceholder')">
              <template #prefix>
                <EditOutlined />
              </template>
            </a-input>
          </a-form-item>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('formula.code')" name="code">
            <a-input v-model:value="form.code" :placeholder="$t('formula.codePlaceholder')">
              <template #prefix>
                <BarcodeOutlined />
              </template>
            </a-input>
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item :label="$t('formula.expression')" name="expression">
        <div style="display: flex; align-items: center; gap: 8px;">
          <a-input v-model:value="form.expression" :placeholder="$t('formula.expressionPlaceholder')">
            <template #prefix>
              <FunctionOutlined />
            </template>
          </a-input>
          <a-tooltip placement="top" :mouseEnterDelay="0.1" overlayClassName="formula-tooltip">
            <template #title>
              <div style="max-width:320px;">
                <b>{{ $t('formula.tooltipTitle') }}</b><br />
                <ul style="padding-left:18px;">
                  <li v-html="$t('formula.tooltip.values')"></li>
                  <li v-html="$t('formula.tooltip.targets')"></li>
                  <li v-html="$t('formula.tooltip.weight')"></li>
                  <li v-html="$t('formula.tooltip.sum')"></li>
                  <li v-html="$t('formula.tooltip.average')"></li>
                  <li v-html="$t('formula.tooltip.minmax')"></li>
                </ul>
                <b>{{ $t('formula.tooltip.exampleLabel') }}</b>
                <code>{{ $t('formula.tooltip.example') }}</code>
              </div>
            </template>
            <a-button type="text" size="small" class="tooltip-btn">
              <span class="tooltip-icon"><QuestionCircleOutlined /></span>
            </a-button>
          </a-tooltip>
        </div>
      </a-form-item>
      <a-form-item :label="$t('formula.description')" name="description">
        <a-textarea v-model:value="form.description" :placeholder="$t('formula.descriptionPlaceholder')">
          <template #prefix>
            <FileTextOutlined />
          </template>
        </a-textarea>
      </a-form-item>
      <a-form-item>
        <a-button type="default" html-type="submit" :loading="loading" class="main-btn-modern" size="middle" shape="round">
          <template #icon>
            <SaveOutlined />
          </template>
          {{ isEdit ? $t('common.update') : $t('common.add') }}
        </a-button>
        <a-button v-if="isEdit" @click="resetForm" class="cancel-btn-modern" size="middle" shape="round" style="margin-left: 8px">
          <template #icon>
            <CloseOutlined />
          </template>
          {{ $t('common.cancel') }}
        </a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <div>
      <h3 class="list-title"><CalculatorOutlined style="margin-right:6px;" />{{ $t('formula.listTitle') }}</h3>
      <a-table :data-source="formulaList" :columns="formulaColumns" row-key="id" size="small" :pagination="false"
        bordered v-if="formulaList && formulaList.length" class="formula-table">
        <template #actions="{ record }">
          <a-tooltip :title="$t('common.edit')">
            <a-button size="small" type="text" @click="editFormula(record)">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm :title="$t('formula.deleteConfirm')" :ok-text="$t('common.delete')"
            :cancel-text="$t('common.cancel')" @confirm="() => deleteFormula(record)">
            <a-tooltip :title="$t('common.delete')">
              <a-button size="small" type="text" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </template>
      </a-table>
      <a-empty v-else :description="$t('common.empty')" />
    </div>
  </a-card>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { message } from "ant-design-vue";
import { useStore } from "vuex";
import { useI18n } from 'vue-i18n';
import { CalculatorOutlined, EditOutlined, BarcodeOutlined, FunctionOutlined, FileTextOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue';

const { t: $t } = useI18n();

const store = useStore();
const formRef = ref();
const form = ref({
    id: null,
    name: "",
    code: "",
    expression: "",
    description: "",
});
const loading = computed(() => store.getters["formula/isFormulaLoading"]);
const isEdit = ref(false);

const rules = {
    name: [{ required: true, message: $t('formula.nameRequired'), trigger: "blur" }],
    code: [{ required: true, message: $t('formula.codeRequired'), trigger: "blur" }],
    expression: [{ required: true, message: $t('formula.expressionRequired'), trigger: "blur" }],
};

const formulaList = computed(() => store.getters["formula/getFormulas"] || []);
const formulaColumns = computed(() => [
    { title: $t('formula.name'), dataIndex: "name", key: "name" },
    { title: $t('formula.code'), dataIndex: "code", key: "code" },
    { title: $t('formula.expression'), dataIndex: "expression", key: "expression" },
    { title: $t('formula.description'), dataIndex: "description", key: "description" },
    {
        title: $t('common.actions'),
        key: "actions",
        slots: { customRender: "actions" },
        width: 120,
    },
]);

const resetForm = () => {
    isEdit.value = false;
    form.value = { id: null, name: "", code: "", expression: "", description: "" };
    formRef.value?.resetFields();
};

const editFormula = (record) => {
    isEdit.value = true;
    form.value = { ...record };
    formRef.value?.clearValidate();
};

const handleSubmit = async () => {
    if (!form.value.name || !form.value.code || !form.value.expression) {
        message.error("Vui lòng nhập đầy đủ thông tin bắt buộc!");
        return;
    }
    try {
        if (isEdit.value) {
            await store.dispatch("formula/updateFormula", {
                id: form.value.id,
                updateData: {
                    name: form.value.name,
                    code: form.value.code,
                    expression: form.value.expression,
                    description: form.value.description,
                },
            });
            message.success("Cập nhật công thức thành công!");
        } else {
            await store.dispatch("formula/addFormula", form.value);
            message.success("Thêm công thức thành công!");
        }
        resetForm();
        await store.dispatch("formula/fetchFormulas");
    } catch (e) {
        // lỗi đã được notification trong store
    }
};

const deleteFormula = async (record) => {
    try {
        await store.dispatch("formula/deleteFormula", record.id);
        message.success("Xóa công thức thành công!");
        await store.dispatch("formula/fetchFormulas");
    } catch (e) {
        message.error(e?.message || "Xóa công thức thất bại!");
    }
};

onMounted(async () => {
    await store.dispatch("formula/fetchFormulas");
});
</script>

<style scoped>
.formula-manage-form {
  margin: 24px auto 0 auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 16px #e3eaf355;
  padding: 24px 24px 16px 24px;
  max-width: 70%;
  border: 1px solid #f0f3fa;
  transition: box-shadow 0.2s;
}
.form-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 0.5em;
  justify-content: center;
}
.form-header-icon {
  box-shadow: 0 2px 8px #e3eaf399;
}
.form-title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin: 0;
  color: #1976d2;
  text-shadow: none;
}
.list-title {
  font-size: 1.08rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1976d2;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ant-form-item {
  margin-bottom: 15px;
}
.main-btn-modern {
  min-width: 100px;
  font-weight: 500;
  border-radius: 18px;
  height: 36px;
  background: #fafdff;
  color: #1976d2;
  border: 1.5px solid #b3d1f7;
  box-shadow: none;
  transition: all 0.18s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.main-btn-modern:hover, .main-btn-modern:focus {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #90caf9;
}
.cancel-btn-modern {
  min-width: 80px;
  border-radius: 18px;
  border: 1px solid #e3eaf3;
  color: #1976d2;
  background: #fafdff;
  font-weight: 400;
  margin-left: 8px;
  height: 36px;
  transition: background 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cancel-btn-modern:hover {
  background: #e3eaf3;
  color: #1565c0;
}
.formula-table {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px #e3eaf333;
  margin-bottom: 10px;
}
.formula-table .ant-table-thead > tr > th {
  background: #fafdff;
  color: #1976d2;
  font-weight: 500;
  font-size: 0.98rem;
}
.formula-table .ant-table-tbody > tr:hover > td {
  background: #e3f2fd55;
  transition: background 0.2s;
}
.formula-table .ant-table-tbody > tr > td {
  font-size: 0.97rem;
  padding: 8px 7px;
}
.ant-empty-description {
  color: #b0bec5;
  font-size: 1.05rem;
}
.formula-tooltip .ant-tooltip-inner,
:deep(.formula-tooltip .ant-tooltip-inner) {
  background: #fafdff !important;
  color: #222;
  border-radius: 10px;
  box-shadow: 0 2px 12px #1976d233;
  padding: 14px 18px 12px 18px;
  min-width: 260px;
  max-width: 340px;
  font-size: 0.98rem;
}
.tooltip-btn {
  padding: 0;
  border: none;
  background: none;
  box-shadow: none;
  outline: none;
}
.tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1976d2 70%, #42a5f5 100%);
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 1px 4px #1976d233;
  border: 2px solid #fff;
  transition: background 0.2s;
}
.tooltip-btn:hover .tooltip-icon {
  background: linear-gradient(135deg, #1565c0 70%, #1976d2 100%);
}
</style>