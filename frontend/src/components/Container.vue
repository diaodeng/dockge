<template>
    <div class="shadow-box big-padding mb-3">
        <div class="row">
            <div class="col-12">
                <div class="d-flex flex-nowrap">
                    <h4>{{ name }}</h4>
                    <div class="flex-grow-1 d-flex justify-content-end">
                        <BsDropdown class="">
                            <div class="btn-group-sm d-flex flex-column gap-2" role="group">
                                <router-link
                                    v-if="!isEditMode" :to="terminalRouteLink"
                                    type="button" class="btn btn-normal me-2" disabled=""
                                    data-bs-toggle="tooltip" data-bs-placement="top"
                                    data-bs-title="Bash"
                                >
                                    <font-awesome-icon icon="terminal" />
                                    <span class="ms-2">{{ $t("bash") }}</span>
                                </router-link>
                                <button
                                    v-if="status !== 'running' && status !== 'healthy'"
                                    class="btn btn-primary me-2 small"
                                    type="button"
                                    data-bs-toggle="tooltip" data-bs-placement="top"
                                    data-bs-title="Start"
                                    :disabled="processing"
                                    @click="startService"
                                >
                                    <font-awesome-icon icon="play" class="p-0 m-0" />
                                    <span class="ms-2">{{ $t("startStack") }}</span>
                                </button>
                                <button
                                    v-if="status === 'running' || status === 'healthy' || status === 'unhealthy'"
                                    class="btn btn-danger small me-2 circle"
                                    type="button"
                                    data-bs-toggle="tooltip" data-bs-placement="top"
                                    data-bs-title="Stop"
                                    :disabled="processing"
                                    @click="stopService"
                                >
                                    <font-awesome-icon icon="stop" class="" />
                                    <span class="ms-2">{{ $t("stopStack") }}</span>
                                </button>
                                <button
                                    v-if="status === 'running' || status === 'healthy' || status === 'unhealthy'"
                                    class="btn btn-warning me-2 small"
                                    data-bs-toggle="tooltip" data-bs-placement="top"
                                    data-bs-title="Restart"
                                    type="button"
                                    :disabled="processing"
                                    @click="restartService"
                                >
                                    <font-awesome-icon icon="sync" class="" />
                                    <span class="ms-2">{{ $t("restartStack") }}</span>
                                </button>
                            </div>
                        </BsDropdown>
                    </div>

                </div>
                <div class="image mb-2">
                    <span class="me-1">{{ imageName }}:</span><span class="tag">{{ imageTag }}</span>
                </div>
                <div v-if="!isEditMode" class="d-flex">
                    <div>
                        <span class="badge me-1" :class="bgStyle">{{ status }}</span>

                        <a v-for="port in envsubstService.ports" :key="port" :href="parsePort(port).url" target="_blank">
                            <span class="badge me-1 bg-secondary">{{ parsePort(port).display }}</span>
                        </a>
                    </div>
                    <div v-if="statsInstances.length > 0 && !isEditMode" class="ms-auto">
                        <div class="d-flex align-items-center gap-3">
                            <div class="text-nowrap text-truncate">
                                <span v-if="!$root.isMobile">{{ $t('CPU') }}: {{ statsInstances[0].CPUPerc }}   {{ $t('memoryAbbreviated') }}: {{ statsInstances[0].MemUsage }}</span>
                                <span v-else style="font-size: small">{{ $t('CPU') }}: {{ statsInstances[0].CPUPerc }}</span>
                            </div>
                            <BsDropdown>
                                <template #button-content>
                                    <i class="bi bi-three-dots"></i>
                                </template>
                                <form>
                                    <DockerStat
                                        v-for="stat in statsInstances"
                                        :key="stat.Name"
                                        :stat="stat"
                                        style="width: 300px"
                                    />
                                </form>
                            </BsDropdown>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="isEditMode" class="mt-2">
            <button class="btn btn-normal me-2" @click="showConfig = !showConfig">
                <font-awesome-icon icon="edit" />
                {{ $t("Edit") }}
            </button>
            <button v-if="false" class="btn btn-normal me-2">Rename</button>
            <button class="btn btn-danger me-2" @click="remove">
                <font-awesome-icon icon="trash" />
                {{ $t("deleteContainer") }}
            </button>
        </div>
        <transition name="slide-fade" appear>
            <div v-if="isEditMode && showConfig" class="config mt-3">
                <!-- Image -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $t("dockerImage") }}
                    </label>
                    <div class="input-group mb-3">
                        <input
                            v-model="service.image"
                            class="form-control"
                            list="image-datalist"
                        />
                    </div>

                    <!-- TODO: Search online: https://hub.docker.com/api/content/v1/products/search?q=louislam%2Fuptime&source=community&page=1&page_size=4 -->
                    <datalist id="image-datalist">
                        <option value="louislam/uptime-kuma:1" />
                    </datalist>
                    <div class="form-text"></div>
                </div>

                <!-- Ports -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $tc("port", 2) }}
                    </label>
                    <ArrayInput name="ports" :display-name="$t('port')" placeholder="HOST:CONTAINER" />
                </div>

                <!-- Volumes -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $tc("volume", 2) }}
                    </label>
                    <ArrayInput name="volumes" :display-name="$t('volume')" placeholder="HOST:CONTAINER" />
                </div>

                <!-- Restart Policy -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $t("restartPolicy") }}
                    </label>
                    <select v-model="service.restart" class="form-select">
                        <option value="always">{{ $t("restartPolicyAlways") }}</option>
                        <option value="unless-stopped">{{ $t("restartPolicyUnlessStopped") }}</option>
                        <option value="on-failure">{{ $t("restartPolicyOnFailure") }}</option>
                        <option value="no">{{ $t("restartPolicyNo") }}</option>
                    </select>
                </div>

                <!-- Environment Variables -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $tc("environmentVariable", 2) }}
                    </label>
                    <ArrayInput name="environment" :display-name="$t('environmentVariable')" placeholder="KEY=VALUE" />
                </div>

                <!-- Container Name -->
                <div v-if="false" class="mb-4">
                    <label class="form-label">
                        {{ $t("containerName") }}
                    </label>
                    <div class="input-group mb-3">
                        <input
                            v-model="service.container_name"
                            class="form-control"
                        />
                    </div>
                    <div class="form-text"></div>
                </div>

                <!-- Network -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $tc("network", 2) }}
                    </label>

                    <div v-if="networkList.length === 0 && service.networks && service.networks.length > 0" class="text-warning mb-3">
                        {{ $t("NoNetworksAvailable") }}
                    </div>

                    <ArraySelect name="networks" :display-name="$t('network')" placeholder="Network Name" :options="networkList" />
                </div>

                <!-- Depends on -->
                <div class="mb-4">
                    <label class="form-label">
                        {{ $t("dependsOn") }}
                    </label>
                    <ArrayInput name="depends_on" :display-name="$t('dependsOn')" :placeholder="$t(`containerName`)" />
                </div>
            </div>
        </transition>
    </div>
</template>

<script>
import { defineComponent, nextTick } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { parseDockerPort } from "../../../common/util-common";
import DockerStat from "./DockerStat.vue";
import { Dropdown } from "bootstrap";
import BsDropdown from "./BsDropdown.vue";

export default defineComponent({
    components: {
        BsDropdown,
        FontAwesomeIcon,
        DockerStat
    },
    props: {
        name: {
            type: String,
            required: true,
        },
        isEditMode: {
            type: Boolean,
            default: false,
        },
        first: {
            type: Boolean,
            default: false,
        },
        serviceStatus: {
            type: Object,
            default: null,
        },
        dockerStats: {
            type: Object,
            default: null
        }
    },
    emits: [
    ],
    data() {
        return {
            showConfig: false,
            expandedStats: false,
            processing: false,
        };
    },
    computed: {

        networkList() {
            let list = [];
            for (const networkName in this.jsonObject.networks) {
                list.push(networkName);
            }
            return list;
        },

        bgStyle() {
            if (this.status === "running" || this.status === "healthy") {
                return "bg-primary";
            } else if (this.status === "unhealthy") {
                return "bg-danger";
            } else {
                return "bg-secondary";
            }
        },

        terminalRouteLink() {
            if (this.endpoint) {
                return {
                    name: "containerTerminalEndpoint",
                    params: {
                        endpoint: this.endpoint,
                        stackName: this.stackName,
                        serviceName: this.name,
                        type: "bash",
                    },
                };
            } else {
                return {
                    name: "containerTerminal",
                    params: {
                        stackName: this.stackName,
                        serviceName: this.name,
                        type: "bash",
                    },
                };
            }
        },

        endpoint() {
            return this.$parent.$parent.endpoint;
        },

        stack() {
            return this.$parent.$parent.stack;
        },

        stackName() {
            return this.$parent.$parent.stack.name;
        },

        service() {
            if (!this.jsonObject.services[this.name]) {
                return {};
            }
            return this.jsonObject.services[this.name];
        },

        jsonObject() {
            return this.$parent.$parent.jsonConfig;
        },

        envsubstJSONConfig() {
            return this.$parent.$parent.envsubstJSONConfig;
        },

        envsubstService() {
            if (!this.envsubstJSONConfig.services[this.name]) {
                return {};
            }
            return this.envsubstJSONConfig.services[this.name];
        },

        imageName() {
            if (this.envsubstService.image) {
                return this.envsubstService.image.split(":")[0];
            } else {
                return "";
            }
        },

        imageTag() {
            if (this.envsubstService.image) {
                let tag = this.envsubstService.image.split(":")[1];

                if (tag) {
                    return tag;
                } else {
                    return "latest";
                }
            } else {
                return "";
            }
        },
        statsInstances() {
            if (!this.serviceStatus || this.serviceStatus.length === 0 || typeof this.serviceStatus === "string") {
                return [];
            }
            return this.serviceStatus
                .map(s => this.dockerStats[s.name])
                .filter(s => !!s)
                .sort((a, b) => a.Name.localeCompare(b.Name)) || {};
        },
        status() {
            if (!this.serviceStatus) {
                return "N/A";
            }
            return typeof this.serviceStatus === "string" ? this.serviceStatus : this.serviceStatus[0].status;
        }
    },
    mounted() {
        this.processing = false;
        if (this.first) {
            // this.showConfig = true;
        }
        const toggleEl = document.querySelector("[data-bs-toggle=\"dropdown\"]");
        if (toggleEl) {
            new Dropdown(toggleEl);
        }
    },
    methods: {
        parsePort(port) {
            if (this.stack.endpoint) {
                return parseDockerPort(port, this.stack.primaryHostname);
            } else {
                let hostname = this.$root.info.primaryHostname || location.hostname;
                return parseDockerPort(port, hostname);
            }
        },
        remove() {
            delete this.jsonObject.services[this.name];
        },
        startService() {
            this.$emit("start-service", this.name);
        },
        stopService() {
            this.$emit("stop-service", this.name);
        },
        restartService() {
            this.$emit("restart-service", this.name);
        }

    }
});
</script>

<style scoped lang="scss">
@import "../styles/vars";

.container {
    .image {
        font-size: 0.8rem;
        color: #6c757d;
        .tag {
            color: #33383b;
        }
    }

    .function {
        align-content: center;
        display: flex;
        height: 100%;
        width: 100%;
        align-items: center;
        justify-content: end;
    }

    .stats {
        font-size: 0.8rem;
        color: #6c757d;
    }
}
</style>
