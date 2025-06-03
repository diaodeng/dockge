<!-- components/BsDropdown.vue -->
<template>
    <div class="dropdown" ref="dropdownRoot">
        <button
            type="button"
            class="btn btn-sm btn-normal dropdown-toggle btn-sm"
            data-bs-toggle="dropdown"
            :data-bs-auto-close="autoClose"
            aria-expanded="false"
        >
            <slot name="button-content"></slot>
        </button>

        <!-- 可嵌套 form、组件等 -->
        <div class="dropdown-menu p-4 bg-dark">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import { Dropdown } from "bootstrap";

const dropdownRoot = ref<HTMLElement | null>(null);
const props = defineProps<{
  autoClose?: string // 'true' | 'false' | 'inside' | 'outside'
}>();

onMounted(() => {
    nextTick(() => {
        const dropdownElementList = dropdownRoot.value?.querySelectorAll(".dropdown-toggle");
        const dropdownList = [...dropdownElementList].map(dropdownToggleEl => new Dropdown(dropdownToggleEl));
        // const toggleEl = dropdownRoot.value?.querySelector("[data-bs-toggle=\"dropdown\"]");
        // if (toggleEl) {
        //     new Dropdown(toggleEl);
        // }
        console.log(dropdownElementList);
    });
});
</script>
