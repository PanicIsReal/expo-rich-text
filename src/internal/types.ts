export const TEXT_DOCUMENT_VERSION = 1 as const;

export type TextSourceKind = "plain" | "markdown";
export type AnimationMode =
  | "static"
  | "token-reveal"
  | "glyph-reveal"
  | "word-reveal";
export type TextDocumentVersion = typeof TEXT_DOCUMENT_VERSION;
export type TextRange = [number, number];

export type TextDocument = {
  id: string;
  version: TextDocumentVersion;
  source: {
    kind: TextSourceKind;
    text: string;
  };
  blocks: TextBlock[];
  spans: TextSpan[];
  animationPlan: AnimationPlan;
};

export type TextBlockKind =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet-list"
  | "ordered-list"
  | "list-item"
  | "code-block";

export type TextBlock = {
  id: string;
  kind: TextBlockKind;
  level?: number;
  parentBlockId?: string;
  range: TextRange;
  childSpanIds: string[];
  childBlockIds?: string[];
  metadata?: {
    orderedIndex?: number;
    fenceLanguage?: string | null;
  };
};

export type TextSpanKind =
  | "text"
  | "strong"
  | "em"
  | "code"
  | "link"
  | "soft-break"
  | "hard-break";

export type TextSpan = {
  id: string;
  blockId: string;
  kind: TextSpanKind;
  text: string;
  range: TextRange;
  href?: string;
  styleKey: string;
  animationGroupId: string;
};

export type AnimationUnitKind = "token" | "grapheme" | "word";

export type AnimationUnit = {
  id: string;
  spanId: string;
  kind: AnimationUnitKind;
  text: string;
  range: TextRange;
  ordinal: number;
};

export type AnimationPlan = {
  mode: AnimationMode;
  units: AnimationUnit[];
};
