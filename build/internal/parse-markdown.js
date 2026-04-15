import { createStableId } from "./stable-id.js";
const INLINE_PATTERN = /(\[([^\]]+)\]\(([^\s)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
export function parseMarkdown(source) {
    const blocks = [];
    const spans = [];
    for (const [blockIndex, block] of parseMarkdownBlocks(source).entries()) {
        if (block.type === "hr") {
            continue;
        }
        if (block.type === "bulletList" || block.type === "orderedList") {
            const listBlockId = createStableId("block", block.type, block.range[0]);
            const listItemIds = [];
            const listBlock = {
                id: listBlockId,
                kind: block.type === "bulletList" ? "bullet-list" : "ordered-list",
                range: block.range,
                childSpanIds: [],
                childBlockIds: [],
            };
            blocks.push(listBlock);
            for (const [itemIndex, item] of block.items.entries()) {
                const itemBlockId = createStableId("block", listBlockId, "item", itemIndex, item.range[0]);
                listItemIds.push(itemBlockId);
                const itemSpanIds = appendInlineSpans({
                    spans,
                    blockId: itemBlockId,
                    text: item.text,
                    absoluteStart: item.range[0],
                    styleKeyBase: "body",
                });
                blocks.push({
                    id: itemBlockId,
                    kind: "list-item",
                    parentBlockId: listBlockId,
                    range: item.range,
                    childSpanIds: itemSpanIds,
                    metadata: block.type === "orderedList"
                        ? { orderedIndex: itemIndex + 1 }
                        : undefined,
                });
            }
            listBlock.childBlockIds = listItemIds;
            continue;
        }
        const blockId = createStableId("block", block.type, blockIndex, block.range[0]);
        const blockKind = block.type === "heading"
            ? "heading"
            : block.type === "blockquote"
                ? "blockquote"
                : block.type === "code"
                    ? "code-block"
                    : "paragraph";
        const childSpanIds = block.type === "code"
            ? (() => {
                const spanId = createStableId("span", blockId, "code", block.range[0], block.language ?? "");
                spans.push({
                    id: spanId,
                    blockId,
                    kind: "code",
                    text: block.text,
                    range: block.range,
                    styleKey: "code-block",
                    animationGroupId: createStableId("anim-group", blockId, 0),
                });
                return [spanId];
            })()
            : appendInlineSpans({
                spans,
                blockId,
                text: block.text,
                absoluteStart: block.range[0],
                styleKeyBase: block.type === "heading"
                    ? `heading-${block.level}`
                    : block.type === "blockquote"
                        ? "blockquote"
                        : "body",
            });
        blocks.push({
            id: blockId,
            kind: blockKind,
            level: block.type === "heading" ? block.level : undefined,
            range: block.range,
            childSpanIds,
            metadata: block.type === "code" ? { fenceLanguage: block.language } : undefined,
        });
    }
    return { blocks, spans };
}
function appendInlineSpans({ spans, blockId, text, absoluteStart, styleKeyBase, }) {
    const tokens = parseInline(text, absoluteStart, styleKeyBase);
    const ids = [];
    for (const [index, token] of tokens.entries()) {
        const id = createStableId("span", blockId, index, token.kind, token.range[0], token.href ?? "");
        spans.push({
            id,
            blockId,
            kind: token.kind,
            text: token.text,
            range: token.range,
            href: token.href,
            styleKey: token.styleKey,
            animationGroupId: createStableId("anim-group", blockId, token.range[0], token.range[1]),
        });
        ids.push(id);
    }
    return ids;
}
function parseInline(text, absoluteStart, styleKeyBase) {
    const tokens = [];
    let lastIndex = 0;
    for (const match of text.matchAll(INLINE_PATTERN)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            tokens.push({
                kind: "text",
                text: text.slice(lastIndex, index),
                range: [absoluteStart + lastIndex, absoluteStart + index],
                styleKey: styleKeyBase,
            });
        }
        if (match[1]) {
            tokens.push({
                kind: "link",
                text: match[2],
                href: match[3],
                range: [absoluteStart + index, absoluteStart + index + match[0].length],
                styleKey: `${styleKeyBase}-link`,
            });
        }
        else if (match[4]) {
            tokens.push({
                kind: "code",
                text: match[5],
                range: [absoluteStart + index, absoluteStart + index + match[0].length],
                styleKey: `${styleKeyBase}-code`,
            });
        }
        else if (match[6]) {
            tokens.push({
                kind: "strong",
                text: match[7],
                range: [absoluteStart + index, absoluteStart + index + match[0].length],
                styleKey: `${styleKeyBase}-strong`,
            });
        }
        else if (match[8]) {
            tokens.push({
                kind: "em",
                text: match[9],
                range: [absoluteStart + index, absoluteStart + index + match[0].length],
                styleKey: `${styleKeyBase}-em`,
            });
        }
        lastIndex = index + match[0].length;
    }
    if (lastIndex < text.length) {
        tokens.push({
            kind: "text",
            text: text.slice(lastIndex),
            range: [absoluteStart + lastIndex, absoluteStart + text.length],
            styleKey: styleKeyBase,
        });
    }
    return tokens.length > 0
        ? tokens
        : [
            {
                kind: "text",
                text,
                range: [absoluteStart, absoluteStart + text.length],
                styleKey: styleKeyBase,
            },
        ];
}
function parseMarkdownBlocks(source) {
    const normalized = source.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const lineStarts = getLineStarts(normalized);
    const blocks = [];
    for (let index = 0; index < lines.length;) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed) {
            index += 1;
            continue;
        }
        const codeMatch = line.match(/^```([\w-]*)\s*$/);
        if (codeMatch) {
            const start = lineStarts[index];
            index += 1;
            const codeLines = [];
            while (index < lines.length && !lines[index].match(/^```/)) {
                codeLines.push(lines[index]);
                index += 1;
            }
            const fenceClosed = index < lines.length;
            if (fenceClosed) {
                index += 1;
            }
            if (fenceClosed || codeLines.length > 0) {
                blocks.push({
                    type: "code",
                    language: normalizeLanguage(codeMatch[1] || null),
                    text: codeLines.join("\n"),
                    range: [start, lineEnd(lineStarts, lines, index - 1)],
                });
            }
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            blocks.push({
                type: "hr",
                range: [lineStarts[index], lineEnd(lineStarts, lines, index)],
            });
            index += 1;
            continue;
        }
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            blocks.push({
                type: "heading",
                level: headingMatch[1].length,
                text: headingMatch[2].trim(),
                range: [lineStarts[index], lineEnd(lineStarts, lines, index)],
            });
            index += 1;
            continue;
        }
        if (/^\s*>\s?/.test(line)) {
            const start = lineStarts[index];
            const quoteLines = [];
            while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
                quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
                index += 1;
            }
            blocks.push({
                type: "blockquote",
                text: quoteLines.join("\n"),
                range: [start, lineEnd(lineStarts, lines, index - 1)],
            });
            continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            const start = lineStarts[index];
            const items = [];
            while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
                items.push({
                    text: lines[index].replace(/^\s*[-*+]\s+/, "").trim(),
                    range: [lineStarts[index], lineEnd(lineStarts, lines, index)],
                });
                index += 1;
            }
            blocks.push({
                type: "bulletList",
                items,
                range: [start, lineEnd(lineStarts, lines, index - 1)],
            });
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const start = lineStarts[index];
            const items = [];
            while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
                items.push({
                    text: lines[index].replace(/^\s*\d+\.\s+/, "").trim(),
                    range: [lineStarts[index], lineEnd(lineStarts, lines, index)],
                });
                index += 1;
            }
            blocks.push({
                type: "orderedList",
                items,
                range: [start, lineEnd(lineStarts, lines, index - 1)],
            });
            continue;
        }
        const start = lineStarts[index];
        const paragraphLines = [];
        while (index < lines.length) {
            const candidate = lines[index];
            const candidateTrimmed = candidate.trim();
            if (!candidateTrimmed)
                break;
            if (candidate.match(/^```/) ||
                candidateTrimmed.match(/^(-{3,}|\*{3,}|_{3,})$/) ||
                candidate.match(/^(#{1,6})\s+/) ||
                candidate.match(/^\s*>\s?/) ||
                candidate.match(/^\s*[-*+]\s+/) ||
                candidate.match(/^\s*\d+\.\s+/)) {
                break;
            }
            paragraphLines.push(candidateTrimmed);
            index += 1;
        }
        if (paragraphLines.length > 0) {
            blocks.push({
                type: "paragraph",
                text: paragraphLines.join("\n"),
                range: [start, lineEnd(lineStarts, lines, index - 1)],
            });
            continue;
        }
        index += 1;
    }
    return blocks;
}
function getLineStarts(text) {
    const starts = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === "\n") {
            starts.push(index + 1);
        }
    }
    return starts;
}
function lineEnd(lineStarts, lines, index) {
    if (index < 0) {
        return 0;
    }
    return lineStarts[index] + lines[index].length;
}
function normalizeLanguage(language) {
    const raw = language?.trim().split(/\s+/)[0]?.toLowerCase();
    if (!raw)
        return null;
    switch (raw) {
        case "js":
        case "cjs":
        case "mjs":
            return "javascript";
        case "ts":
        case "mts":
        case "cts":
            return "typescript";
        case "sh":
        case "shell":
        case "zsh":
            return "bash";
        case "yml":
            return "yaml";
        case "md":
            return "markdown";
        case "py":
            return "python";
        default:
            return raw;
    }
}
//# sourceMappingURL=parse-markdown.js.map