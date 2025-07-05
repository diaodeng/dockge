import path from "path";

/**
 * 移除路径中的公共前缀部分
 * @param {string} fullPath 完整路径
 * @param {string} commonPrefix 要移除的公共前缀
 * @returns {string} 移除公共前缀后的路径
 */
export function removeCommonPrefix(fullPath : string, commonPrefix : string) : string {
    // 处理空值情况
    if (!commonPrefix || !fullPath) return fullPath;

    // 标准化路径和公共前缀（统一使用平台分隔符）
    const normalizedPath = path.normalize(fullPath);
    const normalizedPrefix = path.normalize(commonPrefix);

    // 处理完全相等的情况
    if (normalizedPath === normalizedPrefix) return '';

    // 检查路径是否以公共前缀开头
    if (normalizedPath.startsWith(normalizedPrefix)) {
        // 获取公共前缀之后的部分
        let remaining = normalizedPath.slice(normalizedPrefix.length);

        // 移除可能存在的路径分隔符开头
        if (remaining.startsWith(path.sep)) {
            remaining = remaining.slice(path.sep.length);
        }
        // 处理 Windows 盘符的特殊情况
        else if (remaining.startsWith(':' + path.sep)) {
            remaining = remaining.slice(2);
        }

        return remaining;
    }

    // 不匹配时返回原路径
    return fullPath;
}
