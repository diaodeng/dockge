<script setup lang="ts">
import {ref, computed} from "vue";
import StackTreeItem from "./StackTreeItem.vue";
import { StackNode } from "../interface/stack";
import { StackNodeType } from "../../../common/enums";
import { StackNode as StackNodeModel } from "../interface/stack";

const props = defineProps({
    scrollbar: Boolean,
});
const treeData = defineModel<StackNode|StackNode[]>("treeData", {required: true});
const treeData111 = ref({
    nodeName: "192.168.100.33",
    nodeType: "folder",
    children: [
        {
            nodeName: "Stack 1",
            nodeType: "stack",
            stack: {
                id: 1,
                name: "Stack 1",
                status: 0,
                endpoint: "111111111",
                isManagedByDockge: false,
                isGitRepo: false,
            },
        },
        {
            nodeName: "Stack 2",
            nodeType: "stack",
            stack: {
                id: 1,
                name: "Stack 2",
                status: 1,
                endpoint: "111111113",
                isManagedByDockge: false,
                isGitRepo: false,
            },
        },
        {
            nodeName: "stack folder",
            nodeType: "folder",
            children: [
                {
                    nodeName: "Stack folder 3",
                    nodeType: "folder",
                    children: [{
                        nodeName: "Stack 3",
                        nodeType: "stack",
                        stack: {
                            id: 3,
                            name: "Stack 3",
                            status: 2,
                            endpoint: "111111111",
                            isManagedByDockge: false,
                            isGitRepo: false,
                        },
                    }, {
                        nodeName: "Stack 4",
                        nodeType: "stack",
                        stack: {
                            id: 4,
                            name: "Stack 4",
                            status: 3,
                            endpoint: "111111111",
                            isManagedByDockge: false,
                            isGitRepo: false,
                        },
                    }]
                },
                {
                    nodeName: "Stack 5",
                    nodeType: "stack",
                    stack: {
                        id: 5,
                        name: "Stack 5",
                        status: 4,
                        endpoint: "111111111",
                        isManagedByDockge: false,
                        isGitRepo: false,
                    },
                },
                {
                    nodeName: "Stack 6",
                    nodeType: "stack",
                    stack: {
                        id: 6,
                        name: "Stack 6",
                        endpoint: "111111111",
                        isManagedByDockge: false,
                        isGitRepo: false,
                    },
                },
                {
                    nodeName: "child folder",
                    nodeType: "folder",
                    children: [{
                        nodeName: "Stack 7",
                        nodeType: "stack",
                        stack: {
                            id: 7,
                            name: "Stack 7",
                            endpoint: "111111111",
                            isManagedByDockge: false,
                            isGitRepo: false,
                        },
                    }, {
                        nodeName: "Stack 8",
                        nodeType: "stack",
                        stack: {
                            id: 8,
                            name: "Stack 8",
                            endpoint: "111111111",
                            isManagedByDockge: false,
                            isGitRepo: false,
                        },
                    }]
                }
            ]
        }
    ]
});


const search = ref("");

const filteredTree = computed(() =>
    filterTree(treeData.value, search.value)
);

/**
 * 递归过滤树结构
 * @param {Array|Object} tree 树结构，可以是数组或单个对象
 * @param {string} keyword 过滤关键词
 * @returns {Array|Object|null} 返回过滤后的新树结构
 */
function filterTree(tree : StackNode|StackNode[], keyword) {
    if (!keyword) {
        return tree;
    }

    const filter = (node: StackNode) => {
        if (!node) {
            return null;
        }
        let matched = node.nodeName?.toLowerCase().includes(keyword.toLowerCase());

        // 如果有 children，递归过滤它们
        if (node.children) {
            const filteredChildren = node.children
                .map(filter)
                .filter(Boolean); // 过滤掉空节点

            if (filteredChildren.length > 0 || matched) {
                return {
                    ...node,
                    children: filteredChildren
                };
            }
        }

        return matched ? { ...node } : null;
    };

    // 支持根是数组或对象
    if (Array.isArray(tree)) {
        return tree.map(filter).filter(Boolean);
    } else {
        return filter(tree);
    }
}

function findStack(node, targetName) {
    if (node.nodeType !== StackNodeType.FOLDER && node.nodeName === targetName) {
        return node;
    }

    if (node.children && Array.isArray(node.children)) {
        for (let child of node.children) {
            const result = findStack(child, targetName);
            if (result) {
                return result;
            }
        }
    }

    return null;
}

const style = computed(() => {
    if (window.innerWidth > 550) {
        return {
            height: "calc(100vh - 160px + 10px)",
        };
    } else {
        return {
            height: "calc(100vh - 160px)",
        };
    }

});

</script>

<template>
    <div :class="{ scrollbar: scrollbar }" class="shadow-box" :style="style">
        <input v-model="search" />
        <ul v-for="node in filteredTree" class="ps-0">
            <StackTreeItem :stack-node="node" class="item"></StackTreeItem>
        </ul>
    </div>
</template>

<style>
.item {
    cursor: pointer;
    line-height: 1.5;
}

.bold {
    font-weight: bold;
}
ul {
    list-style-type: none;
}
</style>
