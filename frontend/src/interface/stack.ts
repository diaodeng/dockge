export interface Stack {
    name: string;
    stackId: string;
    status: string;
    tags: Array<string>;
    isManagedByDockge: boolean;
    isGitRepo: boolean;
    gitUrl: string;
    branch: string;
    webhook: string;
    composeFileRelativePath: string;
    composeFilePath: string;
    composeFileName: string;
    endpoint:string
}

export interface StackNode {
    nodeName: string;
    nodeType: string;
    children: Array<StackNode>;
    endpoint:string

    stack?: Stack;
}

export interface StackListResponse {
    ok: boolean;
    stackList: StackNode;
    endpoint: string;
}

interface StackList {
    [endpoint: string]: StackNode[];
}


export interface StackListData {
  [endpoint: string]: StackNode;
}
