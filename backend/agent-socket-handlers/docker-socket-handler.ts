import { AgentSocketHandler } from "../agent-socket-handler";
import { DockgeServer } from "../dockge-server";
import { callbackError, callbackResult, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { Stack } from "../stack";
import { AgentSocket } from "../../common/agent-socket";
import { Terminal } from "../terminal";
import { getComposeTerminalName } from "../../common/util-common";

export class DockerSocketHandler extends AgentSocketHandler {
    create(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket) {
        // Do not call super.create()

        agentSocket.on("deployStack", async (name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                const stack = await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                await stack.deploy(socket);
                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deployed",
                    msgi18n: true,
                }, callback);
                stack.joinCombinedTerminal(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("gitDeployStack", async (stackName : unknown, gitUrl : unknown, branch : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                if (typeof(gitUrl) !== "string") {
                    throw new ValidationError("Git URL must be a string");
                }
                if (typeof(branch) !== "string") {
                    throw new ValidationError("Git Ref must be a string");
                }

                const terminalName = getComposeTerminalName(socket.endpoint, stackName);

                // TODO: this could be done smarter.
                if (!isAdd) {
                    const stack = await Stack.getStack(server, stackName);
                    await stack.delete(socket);
                }

                let exitCode = await Terminal.exec(server, socket, terminalName, "git", [ "clone", "-b", branch, gitUrl, stackName ], server.stacksDir);
                if (exitCode !== 0) {
                    throw new Error(`Failed to clone git repo [Exit Code ${exitCode}]`);
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.deploy(socket);

                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deployed"
                }, callback);
                stack.joinCombinedTerminal(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("saveStack", async (name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                callbackResult({
                    ok: true,
                    msg: "Saved",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("deleteStack", async (name : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(name) !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);

                try {
                    await stack.delete(socket);
                } catch (e) {
                    server.sendStackList();
                    throw e;
                }

                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deleted",
                    msgi18n: true,
                }, callback);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("getStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);

                if (stack.isManagedByDockge) {
                    stack.joinCombinedTerminal(socket);
                }

                callbackResult({
                    ok: true,
                    stack: await stack.toJSON(socket.endpoint),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // requestStackList
        agentSocket.on("requestStackList", async (callback) => {
            try {
                checkLogin(socket);
                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // startStack
        agentSocket.on("startStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.start(socket);
                callbackResult({
                    ok: true,
                    msg: "Started",
                    msgi18n: true,
                }, callback);
                server.sendStackList();

                stack.joinCombinedTerminal(socket);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        // stopStack
        agentSocket.on("stopStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.stop(socket);
                callbackResult({
                    ok: true,
                    msg: "Stopped",
                    msgi18n: true,
                }, callback);
                server.sendStackList();

                stack.leaveCombinedTerminal(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // restartStack
        agentSocket.on("restartStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.restart(socket);
                callbackResult({
                    ok: true,
                    msg: "Restarted",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // updateStack
        agentSocket.on("updateStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.update(socket);
                callbackResult({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // gitSync
        agentSocket.on("gitSync", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.gitSync(socket);
                callbackResult({
                    ok: true,
                    msg: "Synced"
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // down stack
        agentSocket.on("downStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.down(socket);
                callbackResult({
                    ok: true,
                    msg: "Downed",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Services status
        agentSocket.on("serviceStatusList", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                const stack = await Stack.getStack(server, stackName, true);
                const serviceStatusList = Object.fromEntries(await stack.getServiceStatusList());
                callbackResult({
                    ok: true,
                    serviceStatusList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Start a service
        agentSocket.on("startService", async (stackName: unknown, serviceName: unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof (stackName) !== "string" || typeof (serviceName) !== "string") {
                    throw new ValidationError("Stack name and service name must be strings");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.startService(socket, serviceName);
                stack.joinCombinedTerminal(socket); // Ensure the combined terminal is joined
                callbackResult({
                    ok: true,
                    msg: "Service" + serviceName + " started"
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Stop a service
        agentSocket.on("stopService", async (stackName: unknown, serviceName: unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof (stackName) !== "string" || typeof (serviceName) !== "string") {
                    throw new ValidationError("Stack name and service name must be strings");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.stopService(socket, serviceName);
                callbackResult({
                    ok: true,
                    msg: "Service" + serviceName + " stopped"
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("restartService", async (stackName: unknown, serviceName: unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof stackName !== "string" || typeof serviceName !== "string") {
                    throw new Error("Invalid stackName or serviceName");
                }

                const stack = await Stack.getStack(server, stackName, true);
                await stack.restartService(socket, serviceName);
                callbackResult({
                    ok: true,
                    msg: "Service" + serviceName + " restarted"
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Docker stats
        agentSocket.on("dockerStats", async (callback) => {
            try {
                checkLogin(socket);

                const dockerStats = Object.fromEntries(await server.getDockerStats());
                callbackResult({
                    ok: true,
                    dockerStats,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // getExternalNetworkList
        agentSocket.on("getDockerNetworkList", async (callback) => {
            try {
                checkLogin(socket);
                const dockerNetworkList = await server.getDockerNetworkList();
                callbackResult({
                    ok: true,
                    dockerNetworkList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // prune images
        agentSocket.on("pruneImages", async (callback) => {
            try {
                checkLogin(socket);

                let exitCode = await Terminal.exec(server, socket, "console", "docker", ["image", "prune", "-a", "-f"], "");

                if (exitCode !== 0) {
                    callbackError(new Error("Failed to restart, please check the terminal output for more information."), callback);
                    return;
                }
                callbackResult({ ok: true, msg: exitCode }, callback);

            } catch (e) {
                callbackError(e, callback);
            }
        });
    }

    async saveStack(server : DockgeServer, name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown) : Promise<Stack> {
        // Check types
        if (typeof(name) !== "string") {
            throw new ValidationError("Name must be a string");
        }
        if (typeof(composeYAML) !== "string") {
            throw new ValidationError("Compose YAML must be a string");
        }
        if (typeof(composeENV) !== "string") {
            throw new ValidationError("Compose ENV must be a string");
        }
        if (typeof(isAdd) !== "boolean") {
            throw new ValidationError("isAdd must be a boolean");
        }

        const stack = new Stack(server, name, composeYAML, composeENV, false);
        await stack.save(isAdd);
        return stack;
    }

}

