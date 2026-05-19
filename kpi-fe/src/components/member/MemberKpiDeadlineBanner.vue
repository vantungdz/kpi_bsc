<script setup lang="ts">
defineProps<{
  banner: {
    kind: 'warning' | 'overdue'
    title: string
    subtitle?: string
    daysLeft?: number
    bgClass: string
    borderClass: string
    iconWrapClass: string
    titleClass: string
    subtitleClass: string
    ctaClass: string
    icon: string
  }
}>()

defineEmits<{
  (e: 'cta-click'): void
}>()

</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
    :class="[banner.bgClass, banner.borderClass]"
    role="status"
  >
    <div class="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        :class="banner.iconWrapClass"
      >
        <i :class="[banner.icon, 'text-lg']" />
      </div>
      <div class="min-w-0">
        <p class="font-bold leading-tight" :class="banner.titleClass">
          {{ banner.title }}
        </p>
        <p
          v-if="banner.kind === 'warning'"
          class="mt-1 text-sm leading-snug"
          :class="banner.subtitleClass"
        >
          You have <strong class="font-bold">{{ banner.daysLeft }}</strong> day(s) left to self-evaluate your KPI.
        </p>
        <p
          v-else-if="banner.subtitle"
          class="mt-1 text-sm leading-snug"
          :class="banner.subtitleClass"
        >
          {{ banner.subtitle }}
        </p>
      </div>
    </div>
    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <button type="button" :class="banner.ctaClass" @click="$emit('cta-click')">
        Evaluate Now
      </button>
    </div>
  </div>
</template>
