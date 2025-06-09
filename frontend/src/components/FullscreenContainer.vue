<script setup lang="ts">
import { useTemplateRef, ref } from "vue";

const containerRef = useTemplateRef("fullscreenContainer");

const isFullscreen = ref(false);
const emit = defineEmits(["onFullscreen", "onExitFullscreen", "onFullscreenChange"]);

function toggleFullscreen() {
    isFullscreen.value = !isFullscreen.value;
    if (isFullscreen.value) {
        // 进入全屏模式
        containerRef.value.classList.add("fullscreen-mode", "bg-dark");
        emit("onFullscreen");
        // backdrop.style.display = "block";
        // fullscreenBtn.innerHTML = "<i class=\"fas fa-compress\"></i>";
        // modeIndicator.textContent = "全屏模式";
        // modeIndicator.className = "badge bg-danger";
    } else {
        // 退出全屏模式
        containerRef.value.classList.remove("fullscreen-mode", "bg-dark");
        emit("onExitFullscreen");
        // backdrop.style.display = "none";
        // fullscreenBtn.innerHTML = "<i class=\"fas fa-expand\"></i>";
        // modeIndicator.textContent = "普通模式";
        // modeIndicator.className = "badge bg-primary";
    }
    emit("onFullscreenChange", isFullscreen.value);
}
</script>

<template>
    <div ref="fullscreenContainer">
        <div class="h-100 w-100">
            <div class="position-relative top-0">
                <i class="bi bi-arrows-fullscreen me-3 mt-2 fullscreen-btn position-absolute top-0 end-0 fs-6" @click="toggleFullscreen"></i>
            </div>
            <slot name="default"></slot>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../styles/vars.scss";

.fullscreen-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    color: #eeeeee;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s;
}

.light .fullscreen-btn {
  background-color: gray;
  color: #fff;
}

.fullscreen-btn:hover {
    background: rgba(255,255,255,0.3);
    transform: scale(1.05);
}

/* 全屏模式样式 */
.fullscreen-mode {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    z-index: 1050 !important;
    border-radius: 0 !important;
    overflow-y: auto;
    box-shadow: none !important;
}
</style>
