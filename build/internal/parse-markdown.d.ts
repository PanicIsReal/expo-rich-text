import type { TextBlock, TextSpan } from "./types.js";
type ParsedMarkdownDocument = {
    blocks: TextBlock[];
    spans: TextSpan[];
};
export declare function parseMarkdown(source: string): ParsedMarkdownDocument;
export {};
//# sourceMappingURL=parse-markdown.d.ts.map