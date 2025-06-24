interface Stack {
    name: string;
    status: string;
    tags: Array<string>;
    isManagedByDockge: boolean;
    isGitRepo: boolean;
    gitUrl: string;
    branch: string;
    webhook: string;
    composeFilePath: string;
    composeFileName: string;
    endpoint:string
}

interface StackNode {
    nodeName: string;
    nodeType: string;
    children?: Array<StackNode>;

    stack?: Stack;
}

interface StackList {
    [endpoint: string]: StackNode[];
}
