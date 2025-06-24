<script setup lang="ts">
import { ref } from "vue";
import StackListItem from "./StackListItem.vue";

const props = defineProps({
    model: Object
});

const isOpen = ref(true);
const isFolder = computed(() => {
    return props.model.children && props.model.children.length;
});

function toggle() {
    isOpen.value = !isOpen.value;
}

function showStackDetail() {
    if (!isFolder.value) {
        alert("不是文件夹");
    }
}

function addChild() {
    props.model.children.push({
        nodeName: "new stuff",
        nodeType: "stack",
        stack: {
            id: 11,
            name: "Stack 1",
            endpoint: "111111111",
            isManagedByDockge: false,
            isGitRepo: false,
        }
    });
}
</script>

<template>
    <li>
        <div
            v-if="model.nodeType === 'folder'"
            :class="{ bold: isFolder }"
            @click.self="toggle"
            @dblclick.stop="showStackDetail"
        >
            <input type="checkbox" value="" class="me-2" @click.stop>
            <font-awesome-icon v-if="isFolder" icon="folder" />
            {{ model.nodeName }}
            <font-awesome-icon v-if="isFolder" :icon="isOpen ? 'chevron-circle-down' : 'chevron-circle-right'" />
            <font-awesome-icon v-if="isFolder" icon="plus" class="ms-2" @click.stop="addChild" />
            <!--            <font-awesome-icon icon="ellipsis-vertical" />-->
            <!--            <span v-if="isFolder">[{{ isOpen ? '-' : '+' }}]</span>-->
            <!--            <span v-if="isFolder" class="add" @click.stop="addChild">+</span>-->
        </div>
        <StackListItem v-else :stack="model.stack" />
        <ul v-show="isOpen" v-if="isFolder">
            <StackTreeItem
                v-for="model in model.children"
                class="item"
                :model="model"
            >
            </StackTreeItem>
        </ul>
    </li>
</template>
