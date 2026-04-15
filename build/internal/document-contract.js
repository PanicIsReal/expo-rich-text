import { createStableId } from "./stable-id.js";
import { TEXT_DOCUMENT_VERSION, } from "./types.js";
export class TextDocumentContractError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = "TextDocumentContractError";
        this.code = code;
        this.details = details;
    }
}
export function createEmptyTextDocument({ sourceKind = "plain", text = "", } = {}) {
    return {
        id: createStableId("doc", "empty", sourceKind, text),
        version: TEXT_DOCUMENT_VERSION,
        source: {
            kind: sourceKind,
            text,
        },
        blocks: [],
        spans: [],
        animationPlan: {
            mode: "static",
            units: [],
        },
    };
}
export function assertValidTextDocument(document) {
    if (document.version !== TEXT_DOCUMENT_VERSION) {
        throw new TextDocumentContractError("unsupported-version", `Unsupported text document version ${document.version}`, {
            expectedVersion: TEXT_DOCUMENT_VERSION,
            actualVersion: document.version,
        });
    }
    if (document.source.kind !== "plain" && document.source.kind !== "markdown") {
        throw new TextDocumentContractError("invalid-source-kind", `Unsupported text source kind ${document.source.kind}`, {
            sourceKind: document.source.kind,
        });
    }
    if (document.animationPlan.mode !== "static" &&
        document.animationPlan.mode !== "token-reveal" &&
        document.animationPlan.mode !== "glyph-reveal" &&
        document.animationPlan.mode !== "word-reveal") {
        throw new TextDocumentContractError("invalid-animation-mode", `Unsupported animation mode ${document.animationPlan.mode}`, {
            animationMode: document.animationPlan.mode,
        });
    }
    const sourceLength = document.source.text.length;
    const blocksById = new Map();
    const spansById = new Map();
    const animationUnitIds = new Set();
    for (const block of document.blocks) {
        if (blocksById.has(block.id)) {
            throw new TextDocumentContractError("duplicate-block-id", `Duplicate block id ${block.id}`, {
                blockId: block.id,
            });
        }
        assertValidRange(block.range, sourceLength, `block:${block.id}`);
        blocksById.set(block.id, block);
    }
    for (const span of document.spans) {
        if (spansById.has(span.id)) {
            throw new TextDocumentContractError("duplicate-span-id", `Duplicate span id ${span.id}`, {
                spanId: span.id,
            });
        }
        assertValidRange(span.range, sourceLength, `span:${span.id}`);
        spansById.set(span.id, span);
    }
    for (const block of document.blocks) {
        if (block.parentBlockId && !blocksById.has(block.parentBlockId)) {
            throw new TextDocumentContractError("dangling-parent-block", `Block ${block.id} references missing parent ${block.parentBlockId}`, {
                blockId: block.id,
                parentBlockId: block.parentBlockId,
            });
        }
        for (const childSpanId of block.childSpanIds) {
            const childSpan = spansById.get(childSpanId);
            if (!childSpan) {
                throw new TextDocumentContractError("dangling-child-span", `Block ${block.id} references missing child span ${childSpanId}`, {
                    blockId: block.id,
                    childSpanId,
                });
            }
            if (childSpan.blockId !== block.id) {
                throw new TextDocumentContractError("invalid-child-span-block", `Span ${childSpanId} belongs to ${childSpan.blockId}, not ${block.id}`, {
                    blockId: block.id,
                    childSpanId,
                    actualBlockId: childSpan.blockId,
                });
            }
        }
        for (const childBlockId of block.childBlockIds ?? []) {
            const childBlock = blocksById.get(childBlockId);
            if (!childBlock) {
                throw new TextDocumentContractError("dangling-child-block", `Block ${block.id} references missing child block ${childBlockId}`, {
                    blockId: block.id,
                    childBlockId,
                });
            }
            if (childBlock.parentBlockId !== block.id) {
                throw new TextDocumentContractError("invalid-child-block-parent", `Child block ${childBlockId} belongs to ${childBlock.parentBlockId ?? "none"}, not ${block.id}`, {
                    blockId: block.id,
                    childBlockId,
                    actualParentBlockId: childBlock.parentBlockId ?? null,
                });
            }
        }
    }
    for (const span of document.spans) {
        const ownerBlock = blocksById.get(span.blockId);
        if (!ownerBlock) {
            throw new TextDocumentContractError("dangling-span-block", `Span ${span.id} references missing block ${span.blockId}`, {
                spanId: span.id,
                blockId: span.blockId,
            });
        }
        assertRangeWithin(span.range, ownerBlock.range, `span:${span.id}`);
    }
    const sortedUnits = [...document.animationPlan.units].sort((left, right) => left.ordinal - right.ordinal);
    if (document.animationPlan.mode === "static") {
        if (sortedUnits.length > 0) {
            throw new TextDocumentContractError("static-animation-units", "Static animation plans must not contain units", {
                unitCount: sortedUnits.length,
            });
        }
        return document;
    }
    for (const [expectedOrdinal, unit] of sortedUnits.entries()) {
        if (animationUnitIds.has(unit.id)) {
            throw new TextDocumentContractError("duplicate-animation-unit-id", `Duplicate animation unit id ${unit.id}`, {
                unitId: unit.id,
            });
        }
        animationUnitIds.add(unit.id);
        if (unit.ordinal !== expectedOrdinal) {
            throw new TextDocumentContractError("noncontiguous-animation-ordinal", `Animation unit ordinal ${unit.ordinal} does not match expected ${expectedOrdinal}`, {
                expectedOrdinal,
                actualOrdinal: unit.ordinal,
                unitId: unit.id,
            });
        }
        assertValidRange(unit.range, sourceLength, `animationUnit:${unit.id}`);
        const parentSpan = spansById.get(unit.spanId);
        if (!parentSpan) {
            throw new TextDocumentContractError("dangling-animation-span", `Animation unit ${unit.id} references missing span ${unit.spanId}`, {
                unitId: unit.id,
                spanId: unit.spanId,
            });
        }
        assertRangeWithin(unit.range, parentSpan.range, `animationUnit:${unit.id}`);
    }
    const expectedVisibleText = [...document.spans]
        .sort((left, right) => left.range[0] - right.range[0])
        .map((span) => span.text)
        .join("");
    const actualVisibleText = sortedUnits.map((unit) => unit.text).join("");
    if (expectedVisibleText !== actualVisibleText) {
        throw new TextDocumentContractError("animation-text-mismatch", "Animation units do not reconstruct the visible text", {
            expectedVisibleText,
            actualVisibleText,
        });
    }
    return document;
}
export function serializeTextDocument(document, options) {
    const throwOnValidationError = options?.throwOnValidationError ?? shouldThrowOnValidationError();
    try {
        assertValidTextDocument(document);
        return JSON.stringify(document);
    }
    catch (error) {
        const contractError = normalizeContractError(error);
        if (throwOnValidationError) {
            throw contractError;
        }
        console.error("[expo-rich-text] document-contract-invalid", {
            code: contractError.code,
            message: contractError.message,
            details: contractError.details,
            version: document.version,
        });
        return JSON.stringify(createEmptyTextDocument());
    }
}
function shouldThrowOnValidationError() {
    if (typeof __DEV__ === "boolean") {
        return __DEV__;
    }
    return true;
}
function assertValidRange(range, sourceLength, label) {
    const [start, end] = range;
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new TextDocumentContractError("invalid-range", `Range for ${label} must contain integer offsets`, {
            label,
            range,
        });
    }
    if (start < 0 || end < start || end > sourceLength) {
        throw new TextDocumentContractError("invalid-range", `Range for ${label} is out of bounds`, {
            label,
            range,
            sourceLength,
        });
    }
}
function assertRangeWithin(childRange, parentRange, label) {
    if (childRange[0] < parentRange[0] || childRange[1] > parentRange[1]) {
        throw new TextDocumentContractError("invalid-range", `Range for ${label} must stay within its parent range`, {
            label,
            childRange,
            parentRange,
        });
    }
}
function normalizeContractError(error) {
    if (error instanceof TextDocumentContractError) {
        return error;
    }
    if (error instanceof Error) {
        return new TextDocumentContractError("invalid-range", error.message, {
            stack: error.stack,
        });
    }
    return new TextDocumentContractError("invalid-range", "Unknown text document contract failure");
}
//# sourceMappingURL=document-contract.js.map