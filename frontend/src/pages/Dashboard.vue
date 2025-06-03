<template>
    <div class="container-fluid">
        <div class="row">
            <div class="col-12 col-md-4 col-lg-4 col-xl-3"
                 :class="{'offcanvas': !$root.isDeskTop, 'offcanvas-start': !$root.isDeskTop, 'text-bg-dark':!$root.isDeskTop}"
                 tabindex="-1"
                 id="offcanvasStackList"
                 aria-labelledby="offcanvasNavbarLabel"
            >
                <div class="offcanvas-header d-block d-xl-none d-flex flex-nowrap">
                    <h5 class="offcanvas-title" id="offcanvasDarkNavbarLabel">StackList</h5>
                    <button type="button" class="btn-close" style="color: white" data-bs-dismiss="offcanvas" data-bs-target="offcanvasStackList" aria-label="Close"></button>
                </div>
                <div>
                    <router-link to="/compose" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
                </div>
                <StackList :scrollbar="true" />
            </div>

            <div ref="container" class="col-12 col-xl-9 mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>
    </div>
</template>

<script>

import StackList from "../components/StackList.vue";

export default {
    components: {
        StackList,
    },
    data() {
        return {
            height: 0
        };
    },
    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
