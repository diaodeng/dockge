<template>
    <div :class="classes">
        <div v-if="!$root.socketIO.connected && ! $root.socketIO.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.socketIO.connectionErrorMsg }}
                <div v-if="$root.socketIO.showReverseProxyGuide">
                    {{ $t("reverseProxyMsg1") }} <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy"
                                                    target="_blank">{{ $t("reverseProxyMsg2") }}</a>
                </div>
            </div>
        </div>

        <!-- Desktop header -->
        <header v-if="true" class="d-flex flex-nowrap justify-content-around py-3 mb-3 border-bottom">
            <router-link to="/"
                         class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
                <object class="bi me-2" :class="{ 'ms-4': !$root.isMobile, 'ms-1': $root.isMobile }" :style="logoSize" data="/icon.svg"/>
                <span class="title" :class="{'fs-4': !$root.isMobile, 'fs-6': $root.isMobile }">Dockge</span>
                <button class="navbar-toggler d-block d-md-block d-xl-none" type="button" data-bs-toggle="offcanvas"
                        data-bs-target="#offcanvasStackList" aria-controls="offcanvasNavbar" @click.prevent
                        aria-label="Toggle navigation">
                    <span class="border-1 bi bi-list fs-2"></span>
                </button>
            </router-link>

            <a v-if="hasNewVersion" target="_blank" href="https://github.com/louislam/dockge/releases"
               class="btn btn-warning me-3">
                <font-awesome-icon icon="arrow-alt-circle-up"/>
                {{ $t("newUpdate") }}
            </a>

            <ul class="nav nav-pills navbar-dark">
                <li v-if="$root.loggedIn" class="nav-item me-2 fs-6">
                    <router-link to="/" class="nav-link">
                        <font-awesome-icon icon="home"/>
                        <span v-if="!$root.isMobile">{{ $t("home") }}</span>
                    </router-link>
                </li>

                <li v-if="$root.loggedIn" class="nav-item me-2">
                    <router-link to="/console" class="nav-link">
                        <font-awesome-icon icon="terminal"/>
                        <span v-if="!$root.isMobile">{{ $t("console") }}</span>
                    </router-link>
                </li>

                <li v-if="$root.loggedIn" class="nav-item">
                    <div class="dropdown dropdown-profile-pic">
                        <div class="nav-link" data-bs-toggle="dropdown">
                            <div class="profile-pic">{{ $root.usernameFirstChar }}</div>
                            <font-awesome-icon icon="angle-down"/>
                        </div>

                        <!-- Header's Dropdown Menu -->
                        <ul class="dropdown-menu">
                            <!-- Username -->
                            <li>
                                <i18n-t v-if="$root.username != null" tag="span" keypath="signedInDisp"
                                        class="dropdown-item-text">
                                    <strong>{{ $root.username }}</strong>
                                </i18n-t>
                                <span v-if="$root.username == null"
                                      class="dropdown-item-text">{{ $t("signedInDispDisabled") }}</span>
                            </li>

                            <li>
                                <hr class="dropdown-divider">
                            </li>

                            <!-- Functions -->

                            <!--<li>
                                <router-link to="/registry" class="dropdown-item" :class="{ active: $route.path.includes('settings') }">
                                    <font-awesome-icon icon="warehouse" /> {{ $t("registry") }}
                                </router-link>
                            </li>-->

                            <li>
                                <button class="dropdown-item" @click="showPruneUnusedImagesDialog = !showPruneUnusedImagesDialog">
                                    <font-awesome-icon icon="trash"/>
                                    {{ $t("pruneUnusedImages") }}
                                </button>
                            </li>

                            <li>
                                <button class="dropdown-item" @click="scanFolder">
                                    <font-awesome-icon icon="arrows-rotate"/>
                                    {{ $t("scanFolder") }}
                                </button>
                            </li>

                            <li>
                                <router-link to="/settings/general" class="dropdown-item"
                                             :class="{ active: $route.path.includes('settings') }">
                                    <font-awesome-icon icon="cog"/>
                                    {{ $t("Settings") }}
                                </router-link>
                            </li>

                            <li>
                                <button class="dropdown-item" @click="$root.logout">
                                    <font-awesome-icon icon="sign-out-alt"/>
                                    {{ $t("Logout") }}
                                </button>
                            </li>
                        </ul>
                    </div>
                </li>
            </ul>
        </header>

        <main>
            <!-- prune unused images Dialog -->
            <BModal v-model="showPruneUnusedImagesDialog"
                    :okTitle="$t('pruneUnusedImages')"
                    okVariant="danger"
                    :title="$t('pruneAllEndpointUnusedImages')"
                    @ok="pruneImages()">
                <p>{{ endpoint }}</p>
                {{ $t("pruneAllEndpointUnusedImagesMsg") }}
            </BModal>
            <div v-if="$root.socketIO.connecting" class="container mt-5">
                <h4>{{ $t("connecting...") }}</h4>
            </div>

            <router-view v-if="$root.loggedIn"/>
            <Login v-if="! $root.loggedIn && $root.allowLoginDialog"/>
        </main>
    </div>
</template>

<script>
import Login from "../components/Login.vue";
import { compareVersions } from "compare-versions";
import { ALL_ENDPOINTS } from "../../../common/util-common";

export default {

    components: {
        Login,
    },

    data() {
        return {
            showPruneUnusedImagesDialog: false,
            processing: false,
        };
    },

    computed: {

        // Theme or Mobile
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            return classes;
        },

        hasNewVersion() {
            if (this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            } else {
                return false;
            }
        },

        logoSize() {
            if (this.$root.isMobile){
                return {
                    width: "30px",
                    height:"30px"
                };
            }else {
                return {
                    width: "40px",
                    height:"40px"
                };
            }
        },

    },

    watch: {},

    mounted() {
    },

    beforeUnmount() {

    },

    methods: {
        scanFolder() {
            this.processing = true;
            this.$root.emitAgent(ALL_ENDPOINTS, "requestStackList", (res) => {
                this.$root.toastRes(res);
                this.processing = false;
            });
        },

        pruneImages() {
            this.processing = true;
            this.$root.emitAgent(ALL_ENDPOINTS, "pruneImages", (res) => {
                this.$root.toastRes(res);
                this.processing = false;
            });
        },
    },

};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.nav-link {
    &.status-page {
        background-color: rgba(255, 255, 255, 0.1);
    }
}

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    height: calc(60px + env(safe-area-inset-bottom));
    width: 100%;
    left: 0;
    background-color: #fff;
    box-shadow: 0 15px 47px 0 rgba(0, 0, 0, 0.05), 0 5px 14px 0 rgba(0, 0, 0, 0.05);
    text-align: center;
    white-space: nowrap;
    padding: 0 10px env(safe-area-inset-bottom);

    a {
        text-align: center;
        width: 25%;
        display: inline-block;
        height: 100%;
        padding: 8px 10px 0;
        font-size: 13px;
        color: #c1c1c1;
        overflow: hidden;
        text-decoration: none;

        &.router-link-exact-active, &.active {
            color: $primary;
            font-weight: bold;
        }

        div {
            font-size: 20px;
        }
    }
}

main {
    min-height: calc(100vh - 160px);
}

.title {
    font-weight: bold;
}

.nav {
    margin-right: 25px;
}

.lost-connection {
    padding: 5px;
    background-color: crimson;
    color: white;
    position: fixed;
    width: 100%;
    z-index: 99999;
}

// Profile Pic Button with Dropdown
.dropdown-profile-pic {
    user-select: none;

    .nav-link {
        cursor: pointer;
        display: flex;
        gap: 6px;
        align-items: center;
        background-color: rgba(200, 200, 200, 0.2);
        padding: 0.5rem 0.8rem;

        &:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
    }

    .dropdown-menu {
        transition: all 0.2s;
        padding-left: 0;
        padding-bottom: 0;
        margin-top: 8px !important;
        border-radius: 16px;
        overflow: hidden;

        .dropdown-divider {
            margin: 0;
            border-top: 1px solid rgba(0, 0, 0, 0.4);
            background-color: transparent;
        }

        .dropdown-item-text {
            font-size: 14px;
            padding-bottom: 0.7rem;
        }

        .dropdown-item {
            padding: 0.7rem 1rem;
        }

        .dark & {
            background-color: $dark-bg;
            color: $dark-font-color;
            border-color: $dark-border-color;

            .dropdown-item {
                color: $dark-font-color;

                &.active {
                    color: $dark-font-color2;
                    background-color: $highlight !important;
                }

                &:hover {
                    background-color: $dark-bg2;
                }
            }
        }
    }

    .profile-pic {
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        background-color: $primary;
        width: 24px;
        height: 24px;
        margin-right: 5px;
        border-radius: 50rem;
        font-weight: bold;
        font-size: 10px;
    }
}

.dark {
    header {
        background-color: $dark-header-bg;
        border-bottom-color: $dark-header-bg !important;

        span {
            color: #f0f6fc;
        }
    }

    .bottom-nav {
        background-color: $dark-bg;
    }
}
</style>
