function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
export function createStableId(prefix, ...parts) {
    const normalized = parts.map((part) => `${part ?? ""}`).join("|");
    return `${prefix}-${hashString(normalized)}`;
}
//# sourceMappingURL=stable-id.js.map