import {
  resolveAnimationUnitsPerSecond,
  resolveTextAnimationSettings,
  type TextAnimationSettings,
  type TextAnimationUnitMode,
} from "./internal/animation-config.js";
import { buildTextDocument } from "./internal/build-document.js";
import {
  createEmptyTextDocument,
  serializeTextDocument,
} from "./internal/document-contract.js";
import { deriveTextFromSseStream } from "./internal/sse.js";
import type {
  AnimationMode,
  AnimationUnit,
  TextBlock,
  TextDocument,
  TextSourceKind,
  TextSpan,
} from "./internal/types.js";

export type RichTextContentType = "plain" | "markdown" | "auto";
export type RichTextPlaybackPhase =
  | "idle"
  | "revealing"
  | "settling"
  | "settled";
export type RichTextPreviewLoopPhase =
  | "idle"
  | "revealing"
  | "settling"
  | "waiting";

export type RichTextEngineSettings = Partial<TextAnimationSettings>;
export type RichTextPreviewControllerState = {
  configKey: string | null;
  phase: RichTextPreviewLoopPhase;
  sessionVersion: number;
  isStreaming: boolean;
  restartPending: boolean;
};
export type RichTextPreviewControllerAction =
  | {
      type: "config-updated";
      configKey: string;
      enabled: boolean;
    }
  | {
      type: "playback-state";
      playbackPhase: RichTextPlaybackPhase;
    }
  | {
      type: "restart-timer-fired";
    };
export type RichTextPreviewControllerCommand =
  | {
      type: "none";
    }
  | {
      type: "cancel-restart";
    }
  | {
      type: "schedule-restart";
      delayMs: number;
    };
export type RichTextPreviewControllerResult = {
  state: RichTextPreviewControllerState;
  command: RichTextPreviewControllerCommand;
};

export type RichTextUpdateVersion = 2;

export type RichTextResetUpdate = {
  version: RichTextUpdateVersion;
  kind: "reset";
  generation: number;
  documentJson: string;
  isStreaming: boolean;
};

export type RichTextAppendUpdate = {
  version: RichTextUpdateVersion;
  kind: "append";
  generation: number;
  appendFromUtf16: number;
  appendedText: string;
  appendedBlocksJson: string;
  appendedSpansJson: string;
  appendedUnitsJson: string;
  isStreaming: boolean;
};

export type RichTextReplaceUpdate = {
  version: RichTextUpdateVersion;
  kind: "replace";
  generation: number;
  preservedPrefixUtf16: number;
  documentJson: string;
  isStreaming: boolean;
};

export type RichTextUpdate =
  | RichTextResetUpdate
  | RichTextAppendUpdate
  | RichTextReplaceUpdate;

export type RichTextCompilerInput = {
  text: string;
  contentType: RichTextContentType;
  animationMode: AnimationMode;
  isStreaming: boolean;
};

const MARKDOWN_SYNTAX_PATTERN =
  /(^#{1,6}\s)|(^\s*[-*+]\s)|(^\s*\d+\.\s)|(^\s*>\s)|(^```)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(^(-{3,}|\*{3,}|_{3,})$)/m;
const RICH_TEXT_UPDATE_VERSION = 2 as const;

export function resolveRichTextSourceText({
  text,
  sseStream,
}: {
  text?: string;
  sseStream?: string;
}): string {
  if (typeof sseStream === "string" && sseStream.length > 0) {
    return deriveTextFromSseStream(sseStream);
  }
  return text ?? "";
}

export function buildRichTextPreviewSseStream(
  text: string,
  chunkSize = 3,
): string {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks.map((chunk) => `data: ${chunk}\n\n`).join("");
}

export function createRichTextPreviewConfigKey({
  text,
  contentType,
  animationSettings,
}: {
  text: string;
  contentType: RichTextContentType;
  animationSettings?: RichTextEngineSettings;
}): string {
  return JSON.stringify({
    text,
    contentType,
    animationSettings: resolveTextAnimationSettings(animationSettings),
  });
}

export function createInitialRichTextPreviewControllerState(): RichTextPreviewControllerState {
  return {
    configKey: null,
    phase: "idle",
    sessionVersion: 0,
    isStreaming: false,
    restartPending: false,
  };
}

export function reduceRichTextPreviewController(
  currentState: RichTextPreviewControllerState,
  action: RichTextPreviewControllerAction,
  restartDelayMs: number,
): RichTextPreviewControllerResult {
  switch (action.type) {
    case "config-updated": {
      if (!action.enabled) {
        return {
          state: {
            configKey: action.configKey,
            phase: "idle",
            sessionVersion: currentState.sessionVersion,
            isStreaming: false,
            restartPending: false,
          },
          command: currentState.restartPending
            ? { type: "cancel-restart" }
            : { type: "none" },
        };
      }

      if (currentState.configKey === action.configKey) {
        return {
          state: currentState,
          command: { type: "none" },
        };
      }

      return {
        state: {
          configKey: action.configKey,
          phase: "revealing",
          sessionVersion: currentState.sessionVersion + 1,
          isStreaming: true,
          restartPending: false,
        },
        command: currentState.restartPending
          ? { type: "cancel-restart" }
          : { type: "none" },
      };
    }

    case "playback-state": {
      if (currentState.phase === "idle") {
        return {
          state: currentState,
          command: { type: "none" },
        };
      }

      if (action.playbackPhase === "idle") {
        return {
          state: currentState,
          command: { type: "none" },
        };
      }

      if (action.playbackPhase === "revealing") {
        if (
          currentState.phase === "revealing" &&
          currentState.isStreaming &&
          !currentState.restartPending
        ) {
          return {
            state: currentState,
            command: { type: "none" },
          };
        }

        return {
          state: {
            ...currentState,
            phase: "revealing",
            isStreaming: true,
            restartPending: false,
          },
          command: currentState.restartPending
            ? { type: "cancel-restart" }
            : { type: "none" },
        };
      }

      if (action.playbackPhase === "settling") {
        if (
          currentState.phase === "settling" &&
          !currentState.isStreaming &&
          !currentState.restartPending
        ) {
          return {
            state: currentState,
            command: { type: "none" },
          };
        }

        return {
          state: {
            ...currentState,
            phase: "settling",
            isStreaming: false,
            restartPending: false,
          },
          command: currentState.restartPending
            ? { type: "cancel-restart" }
            : { type: "none" },
        };
      }

      if (currentState.restartPending) {
        return {
          state: currentState,
          command: { type: "none" },
        };
      }

      return {
        state: {
          ...currentState,
          phase: "waiting",
          isStreaming: false,
          restartPending: true,
        },
        command: {
          type: "schedule-restart",
          delayMs: restartDelayMs,
        },
      };
    }

    case "restart-timer-fired": {
      if (!currentState.restartPending || currentState.configKey == null) {
        return {
          state: currentState,
          command: { type: "none" },
        };
      }

      return {
        state: {
          ...currentState,
          phase: "revealing",
          sessionVersion: currentState.sessionVersion + 1,
          isStreaming: true,
          restartPending: false,
        },
        command: { type: "none" },
      };
    }
  }
}

export function resolveRichTextSourceKind(
  sourceText: string,
  contentType: RichTextContentType,
): TextSourceKind {
  if (contentType === "plain" || contentType === "markdown") {
    return contentType;
  }
  return MARKDOWN_SYNTAX_PATTERN.test(sourceText) ? "markdown" : "plain";
}

export function resolveRichTextAnimationMode({
  enabled,
  isStreaming,
  hasActiveVisualEffects,
  unitMode,
}: {
  enabled: boolean;
  isStreaming?: boolean;
  hasActiveVisualEffects?: boolean;
  unitMode: TextAnimationUnitMode;
}): AnimationMode {
  if (!enabled || (!isStreaming && !hasActiveVisualEffects)) {
    return "static";
  }
  switch (unitMode) {
    case "token":
      return "token-reveal";
    case "word":
      return "word-reveal";
    default:
      return "glyph-reveal";
  }
}

export function resolveRichTextTiming(
  settings: RichTextEngineSettings | undefined,
): {
  resolvedSettings: TextAnimationSettings;
  revealIntervalMs: number;
} {
  const resolvedSettings = resolveTextAnimationSettings(settings);
  const revealUnitsPerSecond = resolvedSettings.enabled
    ? resolveAnimationUnitsPerSecond(resolvedSettings)
    : 120;
  const revealIntervalMs = resolvedSettings.enabled
    ? Math.round(
        Math.min(
          Math.max(
            (1000 * resolvedSettings.unitsPerStep) /
              Math.max(revealUnitsPerSecond, 0.001),
            16,
          ),
          500,
        ),
      )
    : 16;

  return {
    resolvedSettings,
    revealIntervalMs,
  };
}

export class RichTextIncrementalCompiler {
  private generation = 0;
  private sourceText = "";
  private document = createEmptyTextDocument();
  private sourceKind: TextSourceKind | null = null;
  private animationMode: AnimationMode | null = null;
  private lastStableBoundaryUtf16 = 0;
  private lastCompileKey: string | null = null;
  private lastUpdateJson: string | null = null;

  reset(): void {
    this.generation = 0;
    this.sourceText = "";
    this.document = createEmptyTextDocument();
    this.sourceKind = null;
    this.animationMode = null;
    this.lastStableBoundaryUtf16 = 0;
    this.lastCompileKey = null;
    this.lastUpdateJson = null;
  }

  buildUpdateJson(input: RichTextCompilerInput): string {
    const compileKey = JSON.stringify(input);
    if (compileKey === this.lastCompileKey && this.lastUpdateJson) {
      return this.lastUpdateJson;
    }

    const update = this.buildUpdate(input);
    const updateJson = JSON.stringify(update);
    this.lastCompileKey = compileKey;
    this.lastUpdateJson = updateJson;
    return updateJson;
  }

  private buildUpdate(input: RichTextCompilerInput): RichTextUpdate {
    const nextDocument = buildRichTextDocument({
      text: input.text,
      contentType: input.contentType,
      animationMode: input.animationMode,
    });
    const nextSourceKind = nextDocument.source.kind;

    this.generation += 1;
    const generation = this.generation;

    const canIncrementallyReplace =
      this.sourceKind !== null &&
      this.animationMode !== null &&
      nextSourceKind === this.sourceKind &&
      input.animationMode === this.animationMode &&
      input.text.startsWith(this.sourceText) &&
      input.text !== this.sourceText;

    if (!canIncrementallyReplace) {
      return this.commitReset(nextDocument, input.isStreaming, generation);
    }

    const appendBoundary = resolveSafeAppendBoundary(
      this.document,
      nextDocument,
    );
    if (
      appendBoundary !== null &&
      appendBoundary >= this.lastStableBoundaryUtf16
    ) {
      return this.commitAppend(
        nextDocument,
        input.isStreaming,
        generation,
        appendBoundary,
      );
    }

    const preservedPrefixUtf16 = resolvePreservedPrefixUtf16(
      this.document,
      nextDocument,
    );
    if (preservedPrefixUtf16 > 0) {
      return this.commitReplace(
        nextDocument,
        input.isStreaming,
        generation,
        preservedPrefixUtf16,
      );
    }

    return this.commitReset(nextDocument, input.isStreaming, generation);
  }

  private commitReset(
    document: TextDocument,
    isStreaming: boolean,
    generation: number,
  ): RichTextResetUpdate {
    this.sourceText = document.source.text;
    this.document = document;
    this.sourceKind = document.source.kind;
    this.animationMode = document.animationPlan.mode;
    this.lastStableBoundaryUtf16 = 0;

    return {
      version: RICH_TEXT_UPDATE_VERSION,
      kind: "reset",
      generation,
      documentJson: serializeTextDocument(document),
      isStreaming,
    };
  }

  private commitAppend(
    document: TextDocument,
    isStreaming: boolean,
    generation: number,
    appendFromUtf16: number,
  ): RichTextAppendUpdate {
    const appendedBlocks = sliceTailBlocks(document.blocks, appendFromUtf16);
    const appendedSpans = sliceTailSpans(document.spans, appendFromUtf16);
    const appendedUnits = sliceTailUnits(
      document.animationPlan.units,
      appendFromUtf16,
    );

    this.sourceText = document.source.text;
    this.document = document;
    this.sourceKind = document.source.kind;
    this.animationMode = document.animationPlan.mode;
    this.lastStableBoundaryUtf16 = appendFromUtf16;

    return {
      version: RICH_TEXT_UPDATE_VERSION,
      kind: "append",
      generation,
      appendFromUtf16,
      appendedText: document.source.text.slice(appendFromUtf16),
      appendedBlocksJson: JSON.stringify(appendedBlocks),
      appendedSpansJson: JSON.stringify(appendedSpans),
      appendedUnitsJson: JSON.stringify(appendedUnits),
      isStreaming,
    };
  }

  private commitReplace(
    document: TextDocument,
    isStreaming: boolean,
    generation: number,
    preservedPrefixUtf16: number,
  ): RichTextReplaceUpdate {
    this.sourceText = document.source.text;
    this.document = document;
    this.sourceKind = document.source.kind;
    this.animationMode = document.animationPlan.mode;
    this.lastStableBoundaryUtf16 = 0;

    return {
      version: RICH_TEXT_UPDATE_VERSION,
      kind: "replace",
      generation,
      preservedPrefixUtf16,
      documentJson: serializeTextDocument(document),
      isStreaming,
    };
  }
}

export function buildRichTextUpdateJson(
  input: RichTextCompilerInput,
  compiler = new RichTextIncrementalCompiler(),
): string {
  return compiler.buildUpdateJson(input);
}

export function buildRichTextDocumentJson({
  text,
  contentType,
  animationMode,
}: {
  text: string;
  contentType: RichTextContentType;
  animationMode: AnimationMode;
}): string {
  return serializeTextDocument(
    buildRichTextDocument({
      text,
      contentType,
      animationMode,
    }),
  );
}

function buildRichTextDocument({
  text,
  contentType,
  animationMode,
}: {
  text: string;
  contentType: RichTextContentType;
  animationMode: AnimationMode;
}): TextDocument {
  return buildTextDocument({
    text,
    sourceKind: resolveRichTextSourceKind(text, contentType),
    animationMode,
  });
}

function resolveSafeAppendBoundary(
  previousDocument: TextDocument,
  nextDocument: TextDocument,
): number | null {
  const commonPrefixBlockCount = countCommonPrefix(
    previousDocument.blocks,
    nextDocument.blocks,
    areTextBlocksEqual,
  );

  const boundary =
    commonPrefixBlockCount >= previousDocument.blocks.length
      ? previousDocument.source.text.length
      : (previousDocument.blocks[commonPrefixBlockCount]?.range[0] ?? 0);

  if (boundary <= 0) {
    return null;
  }

  const appendedBlocks = sliceTailBlocks(nextDocument.blocks, boundary);
  const appendedSpans = sliceTailSpans(nextDocument.spans, boundary);
  const appendedUnits = sliceTailUnits(
    nextDocument.animationPlan.units,
    boundary,
  );

  if (
    appendedBlocks.length === 0 &&
    appendedSpans.length === 0 &&
    appendedUnits.length === 0
  ) {
    return null;
  }

  return boundary;
}

function resolvePreservedPrefixUtf16(
  previousDocument: TextDocument,
  nextDocument: TextDocument,
): number {
  const previousText = previousDocument.source.text;
  if (
    previousText.length === 0 ||
    !nextDocument.source.text.startsWith(previousText)
  ) {
    return 0;
  }

  const unitBoundary = resolveCommonPrefixBoundary(
    previousDocument.animationPlan.units,
    nextDocument.animationPlan.units,
    areAnimationUnitsEqual,
    (unit) => unit.range[1],
  );
  if (previousDocument.animationPlan.units.length > 0) {
    return clampBoundary(unitBoundary, previousText.length);
  }

  const spanBoundary = resolveCommonPrefixBoundary(
    previousDocument.spans,
    nextDocument.spans,
    areTextSpansEqual,
    (span) => span.range[1],
  );
  if (previousDocument.spans.length > 0) {
    return clampBoundary(spanBoundary, previousText.length);
  }

  const blockBoundary = resolveCommonPrefixBoundary(
    previousDocument.blocks,
    nextDocument.blocks,
    areTextBlocksEqual,
    (block) => block.range[1],
  );
  if (previousDocument.blocks.length > 0) {
    return clampBoundary(blockBoundary, previousText.length);
  }

  return previousText.length;
}

function resolveCommonPrefixBoundary<T>(
  previousValues: T[],
  nextValues: T[],
  areEqual: (previousValue: T, nextValue: T) => boolean,
  getBoundary: (value: T) => number,
): number {
  const commonPrefixCount = countCommonPrefix(
    previousValues,
    nextValues,
    areEqual,
  );
  if (commonPrefixCount <= 0) {
    return 0;
  }
  if (commonPrefixCount >= previousValues.length) {
    return getBoundary(previousValues[previousValues.length - 1]) ?? 0;
  }
  return getBoundary(previousValues[commonPrefixCount - 1]) ?? 0;
}

function clampBoundary(boundary: number, maxBoundary: number): number {
  return Math.max(0, Math.min(boundary, maxBoundary));
}

function countCommonPrefix<T>(
  previousValues: T[],
  nextValues: T[],
  areEqual: (previousValue: T, nextValue: T) => boolean,
): number {
  const maxCount = Math.min(previousValues.length, nextValues.length);
  let index = 0;

  while (
    index < maxCount &&
    areEqual(previousValues[index], nextValues[index])
  ) {
    index += 1;
  }

  return index;
}

function areTextBlocksEqual(
  previousBlock: TextBlock,
  nextBlock: TextBlock,
): boolean {
  return (
    previousBlock.id === nextBlock.id &&
    previousBlock.kind === nextBlock.kind &&
    previousBlock.level === nextBlock.level &&
    previousBlock.parentBlockId === nextBlock.parentBlockId &&
    previousBlock.range[0] === nextBlock.range[0] &&
    previousBlock.range[1] === nextBlock.range[1] &&
    JSON.stringify(previousBlock.childSpanIds) ===
      JSON.stringify(nextBlock.childSpanIds) &&
    JSON.stringify(previousBlock.childBlockIds ?? []) ===
      JSON.stringify(nextBlock.childBlockIds ?? []) &&
    JSON.stringify(previousBlock.metadata ?? null) ===
      JSON.stringify(nextBlock.metadata ?? null)
  );
}

function areTextSpansEqual(
  previousSpan: TextSpan,
  nextSpan: TextSpan,
): boolean {
  return (
    previousSpan.id === nextSpan.id &&
    previousSpan.blockId === nextSpan.blockId &&
    previousSpan.kind === nextSpan.kind &&
    previousSpan.text === nextSpan.text &&
    previousSpan.range[0] === nextSpan.range[0] &&
    previousSpan.range[1] === nextSpan.range[1] &&
    previousSpan.href === nextSpan.href &&
    previousSpan.styleKey === nextSpan.styleKey &&
    previousSpan.animationGroupId === nextSpan.animationGroupId
  );
}

function areAnimationUnitsEqual(
  previousUnit: AnimationUnit,
  nextUnit: AnimationUnit,
): boolean {
  return (
    previousUnit.id === nextUnit.id &&
    previousUnit.spanId === nextUnit.spanId &&
    previousUnit.kind === nextUnit.kind &&
    previousUnit.text === nextUnit.text &&
    previousUnit.range[0] === nextUnit.range[0] &&
    previousUnit.range[1] === nextUnit.range[1] &&
    previousUnit.ordinal === nextUnit.ordinal
  );
}

function sliceTailBlocks(
  blocks: TextBlock[],
  boundaryUtf16: number,
): TextBlock[] {
  return blocks.filter((block) => block.range[0] >= boundaryUtf16);
}

function sliceTailSpans(spans: TextSpan[], boundaryUtf16: number): TextSpan[] {
  return spans.filter((span) => span.range[0] >= boundaryUtf16);
}

function sliceTailUnits(
  units: AnimationUnit[],
  boundaryUtf16: number,
): AnimationUnit[] {
  return units.filter((unit) => unit.range[0] >= boundaryUtf16);
}
