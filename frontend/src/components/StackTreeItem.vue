<script setup lang="ts">
import {ref, computed} from "vue";
import {StackNodeType} from "../../../common/enums";
import type {StackNode} from "../interface/stack";
import {useRouter} from 'vue-router';
import Uptime from "./Uptime.vue";

const props = defineProps({
    stackNode: {
        type: Object as () => StackNode,
        required: true,
    },
});

const router = useRouter();
const isOpen = ref(false);
const isFolder = computed(() => {
    return props.stackNode.nodeType === StackNodeType.FOLDER || props.stackNode.nodeType === StackNodeType.STACK_AND_FOLDER || props.stackNode.nodeType === StackNodeType.ROOT;
    // return props.model.children && props.model.children.length;
});

const isStack = computed(() => {
    return props.stackNode.nodeType === StackNodeType.STACK || props.stackNode.nodeType === StackNodeType.STACK_AND_FOLDER;
});

const url = computed(() => {
    if (!isStack.value) {
        return "";
    }
    const relativePath = props.stackNode.stack?.composeFileRelativePath;
    if (props.stackNode.stack?.endpoint) {
        return `/compose/${props.stackNode.stack.name}/${props.stackNode.stack.endpoint}?stackPath=${relativePath}`;
    } else {
        return `/compose/${props.stackNode.stack.name}?stackPath=${relativePath}`;
    }
});

function toggle() {
    isOpen.value = !isOpen.value;
}

function gotoUrl() {
    console.log("gotoUrl", url.value);
    if (isStack.value) {
        router.push(url.value);
    }else {
        toggle();
    }
}

function showStackDetail() {
    if (!isFolder.value) {
        alert("不是文件夹");
    }
}

function addChild() {
    props.stackNode.children.push({
        nodeName: "new stuff",
        nodeType: "stack",
        children: [],
        endpoint: "",
        stack: {
            name: "stack name",
            status: "",
            tags: [],
            isManagedByDockge: false,
            isGitRepo: false,
            gitUrl: "",
            branch: "",
            webhook: "",
            composeFilePath: "",
            composeFileName: "",
            composeFileRelativePath: "",
            endpoint: ""
        }
    });
}
</script>

<template>
    <li>
        <div
            :class="{ bold: isFolder, 'dim' :!stackNode?.stack?.isManagedByDockge, 'item-name':isStack }"
            @click.self="gotoUrl"
            @dblclick.stop="showStackDetail"
        >
            <input type="checkbox" value="" class="me-2" @click.stop v-if="false">
            <font-awesome-icon v-if="isFolder && false" icon="folder"/>
            <Uptime v-if="isStack" :stack="stackNode.stack" :fixed-width="true" class="me-2"/>
            {{ stackNode.nodeName }}
            <font-awesome-icon v-if="isFolder" @click.prevent="toggle"
                               :icon="isOpen ? 'chevron-circle-down' : 'chevron-circle-right'"/>
            <font-awesome-icon v-if="!isStack" icon="plus" class="ms-2" @click.stop="addChild"/>
            <a class="rounded" v-if="isStack">
                <font-awesome-icon :icon="stackNode?.stack?.isGitRepo ? 'code-branch' : 'file'" class="fa-fw"/>
            </a>
            <a class="bg-white rounded" v-if="false">
                <font-awesome-icon icon="ellipsis-vertical" class="fa-fw" @click.prevent/>
            </a>
        </div>

        <ul v-show="isOpen" v-if="isFolder">
            <StackTreeItem
                v-for="model in stackNode.children"
                class="item"
                :stack-node="model"
            >
            </StackTreeItem>
        </ul>
    </li>
</template>

<style lang="scss" scoped>
@import "../styles/vars.scss";

ul {
    list-style-type: none;
}

.dim {
    opacity: 0.5;
}

.item-name  {
    text-decoration: none;
    display: flex;
    align-items: center;
    min-height: 40px;
    border-radius: 10px;
    transition: all ease-in-out 0.15s;
    width: 100%;
    padding: 5px 8px;

    &.disabled {
        opacity: 0.3;
    }

    &:hover {
        background-color: $highlight-white;
    }

    &.active {
        background-color: #cdf8f4;
    }

    .title {
        margin-top: -4px;
    }

    .endpoint {
        font-size: 12px;
        color: $dark-font-color3;
    }
}

//ul {
//    list-style-type: none;
//    padding-left: 20px;
//}
//li {
//    cursor: pointer;
//    line-height: 1.5;
//}
</style>
