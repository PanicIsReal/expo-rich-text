import { type TextDocument, type TextSourceKind } from "./types.js";
type TextDocumentContractErrorCode = "unsupported-version" | "invalid-source-kind" | "invalid-animation-mode" | "duplicate-block-id" | "duplicate-span-id" | "duplicate-animation-unit-id" | "invalid-range" | "dangling-parent-block" | "dangling-child-block" | "dangling-child-span" | "dangling-span-block" | "dangling-animation-span" | "invalid-child-block-parent" | "invalid-child-span-block" | "noncontiguous-animation-ordinal" | "animation-text-mismatch" | "static-animation-units";
export declare class TextDocumentContractError extends Error {
    readonly code: TextDocumentContractErrorCode;
    readonly details?: Record<string, unknown>;
    constructor(code: TextDocumentContractErrorCode, message: string, details?: Record<string, unknown>);
}
export declare function createEmptyTextDocument({ sourceKind, text, }?: {
    sourceKind?: TextSourceKind;
    text?: string;
}): TextDocument;
export declare function assertValidTextDocument(document: TextDocument): TextDocument;
export declare function serializeTextDocument(document: TextDocument, options?: {
    throwOnValidationError?: boolean;
}): string;
export {};
//# sourceMappingURL=document-contract.d.ts.map