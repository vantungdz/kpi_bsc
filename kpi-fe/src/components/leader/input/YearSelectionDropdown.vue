<script setup lang="ts">
import { ref } from 'vue';

interface YearOption {
    value: number;
    label: string;
    isCurrent: boolean;
}

const props = defineProps<{
    modelValue: number;
    years: YearOption[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
}>();

const showDropdown = ref(false);

function selectYear(year: number) {
    emit('update:modelValue', year);
    showDropdown.value = false;
}
</script>

<template>
    <div class="relative">
        <button type="button"
            class="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            @click="showDropdown = !showDropdown">
            <i class="fas fa-calendar-alt text-emerald-600" />
            <span>Năm: {{ modelValue }}</span>
            <i class="fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ml-1"
                :class="showDropdown ? 'rotate-180' : ''" />
        </button>

        <div v-if="showDropdown" class="fixed inset-0 z-40" @click="showDropdown = false" />

        <Transition enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95">
            <div v-if="showDropdown"
                class="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-xl bg-white border border-slate-100 shadow-lg ring-1 ring-black/5 focus:outline-none overflow-hidden">
                <div class="py-1">
                    <button v-for="yearOption in years" :key="yearOption.value" type="button"
                        class="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between"
                        :class="modelValue === yearOption.value
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-700 hover:bg-slate-50'
                            " @click="selectYear(yearOption.value)">
                        <div class="flex items-center gap-2.5">
                            <i v-if="modelValue === yearOption.value"
                                class="fas fa-check text-emerald-500 text-xs w-3" />
                            <span :class="modelValue !== yearOption.value ? 'ml-5' : ''">
                                {{ yearOption.label }}
                            </span>
                        </div>

                        <span v-if="yearOption.isCurrent"
                            class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Hiện tại
                        </span>
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>