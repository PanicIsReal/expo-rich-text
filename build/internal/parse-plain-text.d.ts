import type { TextBlock, TextSpan } from "./types.js";
export type ParsedPlainTextDocument = {
    blocks: TextBlock[];
    spans: TextSpan[];
};
export declare function parsePlainText(text: string): ParsedPlainTextDocument;
//# sourceMappingURL=parse-plain-text.d.ts.map