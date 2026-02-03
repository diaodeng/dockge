import { DockgeServer } from "./dockge-server";
import fs, { promises as fsAsync } from "fs";
import { log } from "./log";
import yaml from "yaml";
import { DockgeSocket, fileExists, readDirWithDepth, ValidationError } from "./util-server";
import path from "path";
import {
    acceptedComposeFileNames,
    acceptedComposeFileNamePattern,
    ArbitrarilyNestedLooseObject,
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    CREATED_FILE,
    CREATED_STACK,
    EXITED, getCombinedTerminalName,
    getComposeTerminalName, getContainerExecTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING, TERMINAL_ROWS,
    UNKNOWN
} from "../common/util-common";
import { InteractiveTerminal, Terminal } from "./terminal";
import childProcessAsync from "promisify-child-process";
import { Settings } from "./settings";
import { execSync } from "child_process";
import ini from "ini";
import { StackNodeType as stackNodeType } from "../common/enums";
import { removeCommonPrefix } from "./utils/tools";

export class StackNode {
    nodeName: string;
    nodeType : stackNodeType;
    children: Map<string, StackNode> = new Map();
    stack?: Stack;

    constructor(nodeName: string, nodeType: stackNodeType, children: Map<string, StackNode>, stack?: Stack) {
        this.nodeName = nodeName;
        this.nodeType = nodeType;
        this.children = children;
        this.stack = stack;
    }

    async toJson(endpoint: string) :Promise<object> {
        let jsonChildren = [];
        if (this.children) {
            for (const child of this.children.values()) {
                jsonChildren.push(await child.toJson(endpoint));
            }
        }
        return {
            nodeName: this.nodeName,
            nodeType: this.nodeType,
            children: jsonChildren,
            stack: this.stack?.toSimpleJSON(endpoint),
            endpoint
        };
    }
}

export class Stack {

    name: string;
    stackId: string;
    composeFileRelativePath: string;
    protected _status: number = UNKNOWN;
    protected _composeYAML?: string;
    protected _composeENV?: string;
    protected _configFilePath?: string;
    protected _composeFileName: string = "compose.yaml";
    protected server: DockgeServer;

    protected combinedTerminal? : Terminal;

    protected static managedStackList: StackNode = new StackNode(stackNodeType.ROOT, stackNodeType.ROOT, new Map<string, StackNode>());

    constructor(server : DockgeServer, stackRelativePath : string, composeYAML? : string, composeENV? : string, skipFSOperations = false) {
        this.name = path.basename(stackRelativePath);
        this.composeFileRelativePath = stackRelativePath;
        this.stackId = this.composeFileRelativePath;
        this._configFilePath = path.join(server.stacksDir, stackRelativePath);
        this.server = server;
        this._composeYAML = composeYAML;
        this._composeENV = composeENV;

        if (!skipFSOperations) {
            // Check if compose file name is different from compose.yaml
            for (const filename of acceptedComposeFileNames) {
                if (fs.existsSync(path.join(this.path, filename))) {
                    this._composeFileName = filename;
                    break;
                }
            }
        }
    }

    async toJSON(endpoint : string) : Promise<object> {

        // Since we have multiple agents now, embed primary hostname in the stack object too.
        let primaryHostname = await Settings.get("primaryHostname");
        if (!primaryHostname) {
            if (!endpoint) {
                primaryHostname = "localhost";
            } else {
                // Use the endpoint as the primary hostname
                try {
                    primaryHostname = (new URL("https://" + endpoint).hostname);
                } catch (e) {
                    // Just in case if the endpoint is in a incorrect format
                    primaryHostname = "localhost";
                }
            }
        }

        let obj = this.toSimpleJSON(endpoint);
        return {
            ...obj,
            composeYAML: this.composeYAML,
            composeENV: this.composeENV,
            composeFilePath: this._configFilePath,
            primaryHostname,
        };
    }

    toSimpleJSON(endpoint : string) : object {
        return {
            name: this.name,
            stackId: this.stackId,
            status: this._status,
            tags: [],
            isManagedByDockge: this.isManagedByDockge,
            isGitRepo: this.isGitRepo,
            gitUrl: this.gitUrl,
            branch: this.branch,
            webhook: this.webhook,
            composeFileRelativePath: this.composeFileRelativePath,
            composeFilePath: this._configFilePath,
            composeFileName: this._composeFileName,
            endpoint
        };
    }

    static stackRelativePath(stackFullPath : string, stacksDir :string) : string {
        return removeCommonPrefix(path.resolve(stackFullPath), path.resolve(stacksDir));
    }

    /**
     * Get the status of the stack from `docker compose ps --format json`
     */
    async ps() : Promise<object> {
        let res = await childProcessAsync.spawn("docker", [ "compose", "ps", "--format", "json" ], {
            cwd: this.path,
            encoding: "utf-8",
        });
        if (!res.stdout) {
            return {};
        }
        return JSON.parse(res.stdout.toString());
    }

    get isManagedByDockge() : boolean {
        return !!this._configFilePath && path.resolve(this._configFilePath).startsWith(path.resolve(this.server.stacksDir));
    }

    get isGitRepo() : boolean {
        return fs.existsSync(path.join(this.path, ".git")) && fs.statSync(path.join(this.path, ".git")).isDirectory();
    }

    get gitUrl() : string {
        if (this.isGitRepo) {
            const gitConfig = ini.parse(fs.readFileSync(path.join(this.path, ".git", "config"), "utf-8"));
            return gitConfig["remote \"origin\""]?.url;
        }
        return "";
    }

    get branch() : string {
        if (this.isGitRepo) {
            try {
                let stdout = execSync("git branch --show-current", { cwd: this.path });
                return stdout.toString().trim();
            } catch (error) {
                return "";
            }
        }
        return "";
    }

    get webhook() : string {
        //TODO: refine this.
        if (this.server.config.hostname) {
            return `http://${this.server.config.hostname}:${this.server.config.port}/webhook/update/${this.stackId}`;
        } else {
            return `http://localhost:${this.server.config.port}/webhook/update/${this.stackId}`;
        }
    }

    get status() : number {
        return this._status;
    }

    validate() {
        // Check name, allows [a-z][0-9] _ - only
        if (!this.name.match(/^[a-z0-9_-]+$/)) {
            throw new ValidationError("Stack name can only contain [a-z][0-9] _ - only");
        }

        // Check YAML format
        yaml.parse(this.composeYAML);

        let lines = this.composeENV.split("\n");

        // Check if the .env is able to pass docker-compose
        // Prevent "setenv: The parameter is incorrect"
        // It only happens when there is one line and it doesn't contain "="
        if (lines.length === 1 && !lines[0].includes("=") && lines[0].length > 0) {
            throw new ValidationError("Invalid .env format");
        }
    }

    get composeYAML() : string {
        if (this._composeYAML === undefined) {
            try {
                this._composeYAML = fs.readFileSync(path.join(this.path, this._composeFileName), "utf-8");
            } catch (e) {
                this._composeYAML = "";
            }
        }
        return this._composeYAML;
    }

    get composeENV() : string {
        if (this._composeENV === undefined) {
            try {
                this._composeENV = fs.readFileSync(path.join(this.path, ".env"), "utf-8");
            } catch (e) {
                this._composeENV = "";
            }
        }
        return this._composeENV;
    }

    get path() : string {
        return this._configFilePath || path.join(this.server.stacksDir, this.composeFileRelativePath);
    }

    get fullPath() : string {
        let dir = this.path;

        // Compose up via node-pty
        let fullPathDir;

        // if dir is relative, make it absolute
        if (!path.isAbsolute(dir)) {
            fullPathDir = path.join(process.cwd(), dir);
        } else {
            fullPathDir = dir;
        }
        return fullPathDir;
    }

    /**
     * Save the stack to the disk
     * @param isAdd
     */
    async save(isAdd : boolean) {
        this.validate();

        let dir = this.path;

        // Check if the name is used if isAdd
        if (isAdd) {
            if (await fileExists(dir)) {
                throw new ValidationError("Stack name already exists");
            }

            // Create the stack folder
            await fsAsync.mkdir(dir);
        } else {
            if (!await fileExists(dir)) {
                throw new ValidationError("Stack not found");
            }
        }

        // Write or overwrite the compose.yaml
        await fsAsync.writeFile(path.join(dir, this._composeFileName), this.composeYAML);

        const envPath = path.join(dir, ".env");

        // Write or overwrite the .env
        // If .env is not existing and the composeENV is empty, we don't need to write it
        if (await fileExists(envPath) || this.composeENV.trim() !== "") {
            await fsAsync.writeFile(envPath, this.composeENV);
        }
    }

    async deploy(socket : DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to deploy, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async delete(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "down", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to delete, please check the terminal output for more information.");
        }

        // Remove the stack folder
        await fsAsync.rm(this.path, {
            recursive: true,
            force: true
        });

        return exitCode;
    }

    async updateStatus() {
        // let statusList = await Stack.getStatusList();
        let stackNode = Stack.findStackFromTree(this.composeFileRelativePath, Stack.managedStackList);

        if (stackNode && stackNode.stack?.status ) {
            this._status = stackNode.stack.status;
        } else {
            this._status = UNKNOWN;
        }
    }

    /**
     * Checks if a compose file exists in the specified directory.
     * @async
     * @static
     * @param {string} stacksDir - The directory of the stack.
     * @param {string} filename - The name of the directory to check for the compose file.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether any compose file exists.
     */
    static async composeFileExists(stacksDir : string, filename : string) : Promise<boolean> {
        let filenamePath = path.join(stacksDir, filename);
        // Check if any compose file exists
        for (const filename of acceptedComposeFileNames) {
            let composeFile = path.join(filenamePath, filename);
            if (await fileExists(composeFile)) {
                return true;
            }
        }
        return false;
    }

    /**
     * {isNew} if not exit to create
     * */
    static __findStockNodeFromTree(stackRelativePath : string, stackNode : StackNode, isNew : boolean) : StackNode|undefined {
        const pathComponents = stackRelativePath.split(path.sep);
        let currentNode = stackNode;
        for (const component of pathComponents) {
            if (!component) {
                continue;
            }
            if (!currentNode.children.get(component)) {
                if (!isNew) {
                    return undefined;
                }
                currentNode.children.set(component, new StackNode(component, stackNodeType.FOLDER, new Map<string, StackNode>()));
            }
            const finded_node = currentNode.children.get(component);
            // 这里找到的应该是一个文件夹，如果是stack，那么这个文件夹同时是stack和文件夹
            if (currentNode.nodeType === stackNodeType.STACK) {
                currentNode.nodeType = stackNodeType.STACK_AND_FOLDER;
            }

            currentNode = finded_node;
        }
        return currentNode;
    }

    static findStackFromTree(stackRelativePath : string, stackNode: StackNode) : StackNode|undefined {
        return  Stack.__findStockNodeFromTree(stackRelativePath, stackNode, false);
    }

    static async getStackList(server : DockgeServer, useCacheForManaged = false) : Promise<StackNode> {

        // Use cached stack list?
        if (useCacheForManaged && this.managedStackList && this.managedStackList.children.size > 0) {
            return this.managedStackList;
        }

        // 构建目录树
        let childrenNodeTree: Map<string, StackNode> = new Map<string, StackNode>();
        let directoryRootTree: StackNode = new StackNode(stackNodeType.ROOT, stackNodeType.ROOT, childrenNodeTree);

        // Get status from docker compose ls
        let res = undefined;
        let composeList = [];
        try {
            res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
                encoding: "utf-8",
            });

            if (!res || !res.stdout) {
                log.warn("stack.getStackList", "No response from docker compose daemon when attempting to retrieve list of stacks");
                // return stackList;
            } else {
                composeList = JSON.parse(res.stdout.toString());
            }
        } catch (e) {
            log.warn("stack.getStackList", "Failed to get list of stacks from docker compose daemon");
        }

        for (let composeStack of composeList) {
            try {
                let composeFiles = composeStack.ConfigFiles.split(","); // it is possible for a project to have more than one config file
                const stackDir = path.dirname(composeFiles[0]);
                const composeFileName = path.basename(composeFiles[0]);
                if(path.basename(stackDir) !== composeStack.Name){
                    // 说明这个stackDir是一个文件夹，文件夹的名字和composeStack.Name不一致
                    // 这种情况一般是因为docker compose ls返回的是一个文件夹的路径，而不是一个文件的路径
                    throw new Error("Invalid stackDir");
                }
                const stackRelativePath = Stack.stackRelativePath(stackDir, server.stacksDir);

                let stack = new Stack(server, stackRelativePath);
                stack._status = this.statusConvert(composeStack.Status);


                stack._configFilePath = stackDir;
                stack._composeFileName = composeFileName;
                if (stack.name === "dockge" && !stack.isManagedByDockge) {
                    // skip dockge if not managed by dockge
                    continue;
                }
                // 将项目添加到目录树
                let currentNode = Stack.__findStockNodeFromTree(stackRelativePath, directoryRootTree, true);
                if (Object.keys(currentNode!.children).length > 0) {
                    currentNode!.nodeType = stackNodeType.STACK_AND_FOLDER;
                } else {
                    currentNode!.nodeType = stackNodeType.STACK;
                }
                currentNode!.stack = stack;

            } catch (e) {
                if (e instanceof Error) {
                    log.error("stack.getStackList", `Failed to get stack ${composeStack.Name}, error: ${e.message}`);
                }
            }
        }

        // Search stacks directory for compose files not associated with a running compose project (ie. never started through CLI)
        try {
            // Hopefully the user has access to everything in this directory! Ifdfv they don't, log the error. It is a small price to pay for fast searching.
            // let rawFilesList = fs.readdirSync(server.stacksDir, {
            //     recursive: false,
            //     withFileTypes: true
            // });
            let depth = process.env.STACK_CHECK_DEPTH;
            let rawFilesList = readDirWithDepth(server.stacksDir, depth ? parseInt(depth) : 2);
            let acceptedComposeFiles = rawFilesList.filter((dirEnt: fs.Dirent) => dirEnt.isFile() && !!dirEnt.name.match(acceptedComposeFileNamePattern));
            log.debug("stack.getStackList", `Folder scan yielded ${acceptedComposeFiles.length} files`);
            for (let composeFile of acceptedComposeFiles) {
                // check if we have seen this file before
                let fullPath = composeFile.parentPath;
                const stackDir = fullPath;
                const composeFileName = composeFile.name;
                const stackRelativePath = Stack.stackRelativePath(stackDir, server.stacksDir);

                // a file with an accepted compose filename has been found that did not appear in `docker compose ls`. Use its config file path as a temp name
                log.info("stack.getStackList", `Found project unknown to docker compose: ${fullPath}/${composeFileName}`);
                let [ configFilePath, configFilename, inferredProjectName ] = [ stackDir, composeFileName, path.basename(stackDir) ];


                let currentNode = Stack.__findStockNodeFromTree(stackRelativePath, directoryRootTree, true);
                if (currentNode!.stack && currentNode!.stack!.name) {
                    continue;
                }

                let stack = new Stack(server, stackRelativePath);
                stack._status = CREATED_FILE;
                stack._configFilePath = configFilePath;
                stack._composeFileName = configFilename;
                if (Object.keys(currentNode!.children).length > 0) {
                    currentNode!.nodeType = stackNodeType.STACK_AND_FOLDER;
                } else {
                    currentNode!.nodeType = stackNodeType.STACK;
                }
                currentNode!.stack = stack;

            }
        } catch (e) {
            if (e instanceof Error) {
                log.error("stack.getStackList", `Got error searching for undiscovered stacks:\n${e.message}`);
                log.exception("stack.getStackList", e, "Error searching for undiscovered stacks");
            }
        }

        this.managedStackList = directoryRootTree;
        return directoryRootTree;
    }

    /**
     * Get the status list, it will be used to update the status of the stacks
     * Not all status will be returned, only the stack that is deployed or created to `docker compose` will be returned
     */
    static async getStatusList() : Promise<Map<string, number>> {
        let statusList = new Map<string, number>();

        let res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return statusList;
        }

        let composeList = JSON.parse(res.stdout.toString());

        for (let composeStack of composeList) {
            statusList.set(composeStack.Name, this.statusConvert(composeStack.Status));
        }

        return statusList;
    }

    /**
     * Convert the status string from `docker compose ls` to the status number
     * Input Example: "exited(1), running(1)"
     * @param status
     */
    static statusConvert(status : string) : number {
        if (status.startsWith("created")) {
            return CREATED_STACK;
        } else if (status.includes("exited")) {
            // If one of the service is exited, we consider the stack is exited
            return EXITED;
        } else if (status.startsWith("running")) {
            // If there is no exited services, there should be only running services
            return RUNNING;
        } else {
            return UNKNOWN;
        }
    }

    static async getStack(server: DockgeServer, stackRelativePath: string, skipFSOperations = false) : Promise<Stack> {
        let stackNode: StackNode | undefined;
        let stack: Stack | undefined;
        if (!skipFSOperations) {
            let stackList = await this.getStackList(server, true);
            stackNode = Stack.findStackFromTree(stackRelativePath, stackList);
            if (!stackNode || !stackNode.stack || !await fileExists(stackNode.stack!.path) || !(await fsAsync.stat(stackNode.stack.path)).isDirectory() ) {
                throw new ValidationError(`getStack; Stack ${stackRelativePath} not found in ${stack ? stack._configFilePath : "unknown path"}`);
            }
            stack = stackNode.stack;
        } else {
            // search for known stack with this name
            if (this.managedStackList && this.managedStackList.children.size > 0) {
                stackNode = Stack.findStackFromTree(stackRelativePath, this.managedStackList);
                stack = stackNode?.stack;
            }
            if (!this.managedStackList || !stackNode) {
                stack = new Stack(server, stackRelativePath, undefined, undefined, true);
                stack._status = UNKNOWN;
                stack._configFilePath = path.resolve(server.stacksDir, stackRelativePath);
            }
        }
        return stack!;
    }

    async start(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to start, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async stop(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "stop" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to stop, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async restart(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "restart" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async down(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "down" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to down, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async update(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);

        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "pull" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to pull, please check the terminal output for more information.");
        }

        // If the stack is not running, we don't need to restart it
        await this.updateStatus();
        log.debug("update", "Status: " + this.status);
        if (this.status !== RUNNING) {
            return exitCode;
        }

        exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async gitSync(socket?: DockgeSocket) {
        const terminalName = socket ? getComposeTerminalName(socket.endpoint, this.stackId) : "";

        if (!this.isGitRepo) {
            throw new Error("This stack is not a git repository");
        }

        let exitCode = await Terminal.exec(this.server, socket, terminalName, "git", [ "pull", "--strategy-option", "theirs" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to sync, please check the terminal output for more information.");
        }

        // If the stack is not running, we don't need to restart it
        await this.updateStatus();
        log.debug("update", "Status: " + this.status);
        if (this.status !== RUNNING) {
            return exitCode;
        }

        exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }

    checkRemoteChanges() {
        return new Promise((resolve, reject) => {
            if (!this.isGitRepo) {
                reject("This stack is not a git repository");
                return;
            }
            //fetch remote changes and check if the current branch is behind
            try {
                const stdout = execSync("git fetch origin && git status -uno", { cwd: this.path }).toString();
                if (stdout.includes("Your branch is behind")) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (error) {
                log.error("checkRemoteChanges", error);
                reject("Failed to check local status");
                return;
            }
        });
    }

    async joinCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.stackId);
        const terminal = Terminal.getOrCreateTerminal(this.server, terminalName, "docker", [ "compose", "logs", "-f", "--tail", "100" ], this.path);
        terminal.enableKeepAlive = true;
        terminal.rows = COMBINED_TERMINAL_ROWS;
        terminal.cols = COMBINED_TERMINAL_COLS;
        terminal.join(socket);
        terminal.start();
    }

    async leaveCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.stackId);
        const terminal = Terminal.getTerminal(terminalName);
        if (terminal) {
            terminal.leave(socket);
        }
    }

    async joinContainerTerminal(socket: DockgeSocket, serviceName: string, shell : string = "sh", index: number = 0) {
        const terminalName = getContainerExecTerminalName(socket.endpoint, this.stackId, serviceName, index);
        let terminal = Terminal.getTerminal(terminalName);

        if (!terminal) {
            terminal = new InteractiveTerminal(this.server, terminalName, "docker", [ "compose", "exec", serviceName, shell ], this.path);
            terminal.rows = TERMINAL_ROWS;
            log.debug("joinContainerTerminal", "Terminal created");
        }

        terminal.join(socket);
        terminal.start();
    }

    async getServiceStatusList() {
        let statusList = new Map<string, Array<object>>();

        try {
            log.info("DEBUGTHISPATH:", this.path);
            log.info("this.server.config.hostname:", this.server.config.hostname);
            let res = await childProcessAsync.spawn("docker", [ "compose", "ps", "--format", "json" ], {
                cwd: this.path,
                encoding: "utf-8",
            });

            if (!res.stdout) {
                return statusList;
            }

            let lines = res.stdout?.toString().split("\n");

            const addLine = (obj: { Service: string, State: string, Name: string, Health: string }) => {
                if (!statusList.has(obj.Service)) {
                    statusList.set(obj.Service, []);
                }
                statusList.get(obj.Service)?.push({
                    status: obj.Health || obj.State,
                    name: obj.Name
                });
            };

            for (let line of lines) {
                try {
                    let obj = JSON.parse(line);
                    if (obj instanceof Array) {
                        obj.forEach(addLine);
                    } else {
                        addLine(obj);
                    }
                } catch (e) {
                }
            }
            return statusList;
        } catch (e) {
            log.error("getServiceStatusList", e);
            return statusList;
        }
    }

    async startService(socket: DockgeSocket, serviceName: string) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error(`Failed to start service ${serviceName}, please check logs for more information.`);
        }

        return exitCode;
    }

    async stopService(socket: DockgeSocket, serviceName: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "stop", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error(`Failed to stop service ${serviceName}, please check logs for more information.`);
        }

        return exitCode;
    }

    async restartService(socket: DockgeSocket, serviceName: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "restart", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error(`Failed to restart service ${serviceName}, please check logs for more information.`);
        }

        return exitCode;
    }

    async downService(socket: DockgeSocket, serviceName: string) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "down", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to down, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async updateService(socket: DockgeSocket, serviceName: string) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.stackId);

        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "pull", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to pull, please check the terminal output for more information.");
        }

        // If the stack is not running, we don't need to restart it
        await this.updateStatus();
        log.debug("update", "Status: " + this.status);
        if (this.status !== RUNNING) {
            return exitCode;
        }

        exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }
}
