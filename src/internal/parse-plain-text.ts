import { createStableId } from "./stable-id.js";
import type { TextBlock, TextSpan } from "./types.js";

export type ParsedPlainTextDocument = {
  blocks: TextBlock[];
  spans: TextSpan[];
};

export function parsePlainText(text: string): ParsedPlainTextDocument {
  if (text.length === 0) {
    return { blocks: [], spans: [] };
  }

  const blockId = createStableId("block", "plain", 0);
  const spanId = createStableId("span", blockId, 0, "text");

  return {
    blocks: [
      {
        id: blockId,
        kind: "paragraph",
        range: [0, text.length],
        childSpanIds: [spanId],
      },
    ],
    spans: [
      {
        id: spanId,
        blockId,
        kind: "text",
        text,
        range: [0, text.length],
        styleKey: "body",
        animationGroupId: createStableId("anim-group", blockId, 0),
      },
    ],
  };
}
