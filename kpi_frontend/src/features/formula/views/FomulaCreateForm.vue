<!-- filepath: e:\project\kpi-frontend\src\features\formula\views\FormulaManageForm.vue -->
<template>
    <a-card class="formula-manage-form">
        <h2 class="form-title">{{ $t('formula.title') }}</h2>
        <a-divider />
        <a-form :model="form" :rules="rules" ref="formRef" layout="vertical" @finish="handleSubmit">
            <a-row :gutter="24">
                <a-col :xs="24" :md="12">
                    <a-form-item :label="$t('formula.name')" name="name">
                        <a-input v-model:value="form.name" :placeholder="$t('formula.namePlaceholder')" />
                    </a-form-item>
                </a-col>
                <a-col :xs="24" :md="12">
                    <a-form-item :label="$t('formula.code')" name="code">
                        <a-input v-model:value="form.code" :placeholder="$t('formula.codePlaceholder')" />
                    </a-form-item>
                </a-col>
            </a-row>
            <a-form-item :label="$t('formula.expression')" name="expression">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <a-input v-model:value="form.expression" :placeholder="$t('formula.expressionPlaceholder')" />
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
                            <span class="tooltip-icon">?</span>
                        </a-button>
                    </a-tooltip>
                </div>
            </a-form-item>
            <a-form-item :label="$t('formula.description')" name="description">
                <a-textarea v-model:value="form.description" :placeholder="$t('formula.descriptionPlaceholder')" />
            </a-form-item>
            <a-form-item>
                <a-button type="primary" html-type="submit" :loading="loading" class="main-btn">
                    {{ isEdit ? $t('common.update') : $t('common.add') }}
                </a-button>
                <a-button v-if="isEdit" style="margin-left: 8px" @click="resetForm" class="cancel-btn">{{
                    $t('common.cancel') }}</a-button>
            </a-form-item>
        </a-form>
        <a-divider />
        <div>
            <h3 class="list-title">{{ $t('formula.listTitle') }}</h3>
            <a-table :data-source="formulaList" :columns="formulaColumns" row-key="id" size="small" :pagination="false"
                bordered v-if="formulaList && formulaList.length" class="formula-table">
                <template #actions="{ record }">
                    <a-button size="small" type="link" @click="editFormula(record)">{{ $t('common.edit') }}</a-button>
                    <a-popconfirm :title="$t('formula.deleteConfirm')" :ok-text="$t('common.delete')"
                        :cancel-text="$t('common.cancel')" @confirm="() => deleteFormula(record)">
                        <a-button size="small" type="link" danger>{{ $t('common.delete') }}</a-button>
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
    margin: 32px auto 0 auto;
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 6px 32px #1976d21a;
    padding: 40px 40px 28px 40px;
    max-width: 1000px;
    transition: box-shadow 0.2s;
    border: 1px solid #e3eaf3;
}

.form-title {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5em;
    text-align: center;
    letter-spacing: 0.5px;
    color: #1976d2;
    text-shadow: 0 2px 8px #e3eaf3;
}

.list-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 12px;
    color: #1976d2;
}

.ant-form-item {
    margin-bottom: 20px;
}

.main-btn {
    min-width: 120px;
    font-weight: 600;
    background: linear-gradient(90deg, #1976d2 60%, #42a5f5 100%);
    border: none;
    color: #fff;
    box-shadow: 0 2px 8px #1976d255;
    border-radius: 6px;
    transition: background 0.2s, box-shadow 0.2s;
}
.main-btn:hover {
    background: linear-gradient(90deg, #1565c0 60%, #1976d2 100%);
    color: #fff;
    box-shadow: 0 4px 16px #1976d255;
}
.cancel-btn {
    min-width: 80px;
    border-radius: 6px;
    border: 1px solid #b0bec5;
    color: #1976d2;
    background: #f5faff;
    font-weight: 500;
    transition: background 0.2s, color 0.2s;
}
.cancel-btn:hover {
    background: #e3eaf3;
    color: #1565c0;
}

.formula-table {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px #e3eaf355;
    margin-bottom: 12px;
}
.formula-table .ant-table-thead > tr > th {
    background: #f5faff;
    color: #1976d2;
    font-weight: 600;
    font-size: 1rem;
}
.formula-table .ant-table-tbody > tr:hover > td {
    background: #e3f2fd55;
    transition: background 0.2s;
}
.formula-table .ant-table-tbody > tr > td {
    font-size: 0.98rem;
    padding: 10px 8px;
}

.ant-empty-description {
    color: #b0bec5;
    font-size: 1.1rem;
}

.formula-tooltip .ant-tooltip-inner,
:deep(.formula-tooltip .ant-tooltip-inner) {
  background: #fafdff !important;
  color: #222;
  border-radius: 12px;
  box-shadow: 0 4px 24px #1976d233;
  padding: 18px 22px 16px 22px;
  min-width: 320px;
  max-width: 400px;
  font-size: 1rem;
}
.tooltip-content {
  text-align: left;
}
.tooltip-title {
  font-weight: 700;
  color: #1976d2;
  margin-bottom: 6px;
  font-size: 1.08em;
}
.tooltip-content ul {
  margin: 0 0 8px 0;
  padding-left: 20px;
}
.tooltip-content li {
  margin-bottom: 2px;
  font-size: 0.98em;
}
.tooltip-example {
  margin-top: 8px;
  color: #333;
  font-size: 0.98em;
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
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1976d2 70%, #42a5f5 100%);
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  box-shadow: 0 2px 8px #1976d255;
  border: 2px solid #fff;
  transition: background 0.2s;
}
.tooltip-btn:hover .tooltip-icon {
  background: linear-gradient(135deg, #1565c0 70%, #1976d2 100%);
}
</style>