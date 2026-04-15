import { type TextAnimationSettings, type TextAnimationUnitMode } from "./internal/animation-config.js";
import type { AnimationMode, TextSourceKind } from "./internal/types.js";
export type RichTextContentType = "plain" | "markdown" | "auto";
export type RichTextPlaybackPhase = "idle" | "revealing" | "settling" | "settled";
export type RichTextPreviewLoopPhase = "idle" | "revealing" | "settling" | "waiting";
export type RichTextEngineSettings = Partial<TextAnimationSettings>;
export type RichTextPreviewControllerState = {
    configKey: string | null;
    phase: RichTextPreviewLoopPhase;
    sessionVersion: number;
    isStreaming: boolean;
    restartPending: boolean;
};
export type RichTextPreviewControllerAction = {
    type: "config-updated";
    configKey: string;
    enabled: boolean;
} | {
    type: "playback-state";
    playbackPhase: RichTextPlaybackPhase;
} | {
    type: "restart-timer-fired";
};
export type RichTextPreviewControllerCommand = {
    type: "none";
} | {
    type: "cancel-restart";
} | {
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
export type RichTextUpdate = RichTextResetUpdate | RichTextAppendUpdate | RichTextReplaceUpdate;
export type RichTextCompilerInput = {
    text: string;
    contentType: RichTextContentType;
    animationMode: AnimationMode;
    isStreaming: boolean;
};
export declare function resolveRichTextSourceText({ text, sseStream, }: {
    text?: string;
    sseStream?: string;
}): string;
export declare function buildRichTextPreviewSseStream(text: string, chunkSize?: number): string;
export declare function createRichTextPreviewConfigKey({ text, contentType, animationSettings, }: {
    text: string;
    contentType: RichTextContentType;
    animationSettings?: RichTextEngineSettings;
}): string;
export declare function createInitialRichTextPreviewControllerState(): RichTextPreviewControllerState;
export declare function reduceRichTextPreviewController(currentState: RichTextPreviewControllerState, action: RichTextPreviewControllerAction, restartDelayMs: number): RichTextPreviewControllerResult;
export declare function resolveRichTextSourceKind(sourceText: string, contentType: RichTextContentType): TextSourceKind;
export declare function resolveRichTextAnimationMode({ enabled, isStreaming, hasActiveVisualEffects, unitMode, }: {
    enabled: boolean;
    isStreaming?: boolean;
    hasActiveVisualEffects?: boolean;
    unitMode: TextAnimationUnitMode;
}): AnimationMode;
export declare function resolveRichTextTiming(settings: RichTextEngineSettings | undefined): {
    resolvedSettings: TextAnimationSettings;
    revealIntervalMs: number;
};
export declare class RichTextIncrementalCompiler {
    private generation;
    private sourceText;
    private document;
    private sourceKind;
    private animationMode;
    private lastStableBoundaryUtf16;
    private lastCompileKey;
    private lastUpdateJson;
    reset(): void;
    buildUpdateJson(input: RichTextCompilerInput): string;
    private buildUpdate;
    private commitReset;
    private commitAppend;
    private commitReplace;
}
export declare function buildRichTextUpdateJson(input: RichTextCompilerInput, compiler?: RichTextIncrementalCompiler): string;
export declare function buildRichTextDocumentJson({ text, contentType, animationMode, }: {
    text: string;
    contentType: RichTextContentType;
    animationMode: AnimationMode;
}): string;
//# sourceMappingURL=engine.d.ts.map