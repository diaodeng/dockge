<script setup lang="ts">
import {ref, computed} from "vue";
import StackTreeItem from "./StackTreeItem.vue";
import {StackNode} from "../interface/stack";
import {StackNodeType} from "../../../common/enums";
import {StackNode as StackNodeModel} from "../interface/stack";

const props = defineProps({
    scrollbar: Boolean,
});
const treeData = defineModel< Record<string, StackNode>>("treeData", {required: true});


const searchText = ref("");
const selectMode = ref(true);

const filteredTree = computed(() =>{
    return filterTree(treeData.value, searchText.value)
    }
    
);

/**
 * 递归过滤树结构
 * @param {Array|Object} tree 树结构，可以是数组或单个对象
 * @param {string} keyword 过滤关键词
 * @returns {Array|Object|null} 返回过滤后的新树结构
 */
function filterTree(tree: Record<string, StackNode>, keyword) {
    if (!keyword || Object.keys(tree).length === 0) {
        return tree;
    }

    const filterNode = (node: StackNode | null) : StackNode | null => {
        if (!node) {
            return null;
        }
        let matched = node.nodeName?.toLowerCase().includes(keyword.toLowerCase());

        // 如果有 children，递归过滤它们
        if (node.children  && node.children.length > 0) {
            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter((child): child is StackNode => child !== null); // 过滤掉空节点

            if (filteredChildren.length > 0 || matched) {
                return {
                    ...node,
                    children: filteredChildren
                };
            }
        }

        return matched ? {...node} : null;
    };
    
    const result: Record<string, StackNode | null> = {};
    Object.entries(tree).forEach(([endpoint, stackNode]) => {
        const filteredNode = filterNode(stackNode);
        if (filteredNode) {
            result[endpoint] = filteredNode;
        }
    });
    return result;
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

const boxStyle = computed(() => {
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

const stackListStyle = computed(() => {
            //let listHeaderHeight = 107;
            let listHeaderHeight = 60;
            if (selectMode) {
                listHeaderHeight += 42;
            }
            return {
                "height": `calc(100% - ${listHeaderHeight}px)`
            };
        })

function clearSearchText(evt: Event) {
    searchText.value = "";
}

</script>

<template>
    <div class="shadow-box mb-3" :style="boxStyle" style="display: flex; flex-direction: column;">
        <div class="list-header" style="flex: 0 0 auto;">
            <div class="header-top">
                <div class="placeholder" v-if="false"></div>
                <div class="search-wrapper" style="flex-grow: 1">
                    <a v-if="searchText === ''" class="search-icon">
                        <font-awesome-icon icon="search"/>
                    </a>
                    <a v-if="searchText !== ''" class="search-icon" style="cursor: pointer" @click="clearSearchText">
                        <font-awesome-icon icon="times"/>
                    </a>
                    <form style="flex-grow: 1">
                        <input v-model="searchText" class="form-control search-input" autocomplete="off"/>
                    </form>
                </div>
            </div>
        </div>
        <div :class="{ scrollbar: scrollbar }" style="flex: 1 1 auto;min-height: 0; overflow-y: auto;overflow-x: hidden">
            <ul v-for="(agentNodes, endpoint) in (filteredTree || {})" class="ps-0" :key="endpoint">
                <StackTreeItem :stack-node="agentNodes" class="item"></StackTreeItem>
            </ul>
        </div>

    </div>
</template>

<style lang="scss" scoped>
@import "../styles/vars.scss";

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

.shadow-box {
    height: calc(100vh - 150px);
    position: sticky;
    top: 10px;
}

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.list-header {
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px 10px 0 0;
    margin: -10px;
    margin-bottom: 10px;
    padding: 10px;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }
}

.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-filter {
    display: flex;
    align-items: center;
}

@media (max-width: 770px) {
    .list-header {
        margin: -20px;
        margin-bottom: 10px;
        padding: 5px;
    }
}

.search-wrapper {
    display: flex;
    align-items: center;
}

.search-icon {
    padding: 10px;
    color: #c0c0c0;
    
    svg[data-icon="times"] {
        cursor: pointer;
        transition: all ease-in-out 0.1s;

        &:hover {
            opacity: 0.5;
        }
    }
}

.search-input {
    max-width: 15em;
}

.stack-item {
    width: 100%;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.bottom-style {
    padding-left: 67px;
    margin-top: 5px;
}

.selection-controls {
    margin-top: 5px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.agent-select {
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: $dark-font-color3;
    padding-left: 10px;
    padding-right: 10px;
    display: flex;
    align-items: center;
    user-select: none;
}
</style>
