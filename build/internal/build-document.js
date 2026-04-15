import { buildAnimationPlan } from "./animation-plan.js";
import { parseMarkdown } from "./parse-markdown.js";
import { parsePlainText } from "./parse-plain-text.js";
import { createStableId } from "./stable-id.js";
import { TEXT_DOCUMENT_VERSION, } from "./types.js";
export function buildTextDocument({ text, sourceKind, animationMode, }) {
    const parsed = sourceKind === "markdown" ? parseMarkdown(text) : parsePlainText(text);
    return {
        id: createStableId("doc", sourceKind),
        version: TEXT_DOCUMENT_VERSION,
        source: {
            kind: sourceKind,
            text,
        },
        blocks: parsed.blocks,
        spans: parsed.spans,
        animationPlan: buildAnimationPlan(parsed.spans, animationMode),
    };
}
//# sourceMappingURL=build-document.js.map