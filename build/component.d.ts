import { type CommonViewModifierProps } from "@expo/ui/swift-ui";
import React from "react";
import type { NativeSyntheticEvent, ViewProps } from "react-native";
import { type RichTextContentType, type RichTextEngineSettings, type RichTextPlaybackPhase } from "./engine.js";
export type RichTextHeightEvent = {
    height: number;
};
export type RichTextRevealProgressEvent = {
    revealedCount: number;
};
export type RichTextRevealStateEvent = {
    active: boolean;
    revealedCount: number;
};
export type RichTextPlaybackStateEvent = {
    phase: RichTextPlaybackPhase;
    revealedCount: number;
};
export type RichTextLinkPressEvent = {
    href: string;
};
export type RichTextViewProps = Omit<ViewProps, "children" | "testID"> & CommonViewModifierProps & {
    itemId: string;
    text?: string;
    sseStream?: string;
    isStreaming?: boolean;
    contentType?: RichTextContentType;
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    codeFontSize?: number;
    textColor?: string;
    blockquoteAccentColor?: string;
    codeBackgroundColor?: string;
    selectable?: boolean;
    animationSettings?: RichTextEngineSettings;
    onHeightChange?: (event: NativeSyntheticEvent<RichTextHeightEvent>) => void;
    onRevealProgress?: (event: NativeSyntheticEvent<RichTextRevealProgressEvent>) => void;
    onRevealStateChange?: (event: NativeSyntheticEvent<RichTextRevealStateEvent>) => void;
    onPlaybackStateChange?: (event: NativeSyntheticEvent<RichTextPlaybackStateEvent>) => void;
    onLinkPress?: (event: NativeSyntheticEvent<RichTextLinkPressEvent>) => void;
};
export declare function ExpoRichText({ itemId, text, sseStream, isStreaming, contentType, animationSettings, style, modifiers, testID, onHeightChange, onRevealStateChange, onPlaybackStateChange, ...rest }: RichTextViewProps): React.FunctionComponentElement<import("@expo/ui/swift-ui").HostProps>;
export default ExpoRichText;
export type RichTextPreviewProps = Omit<RichTextViewProps, "itemId" | "text" | "sseStream" | "isStreaming" | "onPlaybackStateChange" | "onRevealStateChange"> & {
    text: string;
    restartDelayMs?: number;
    isEnabled?: boolean;
};
type PreviewLoopSessionProps = Omit<RichTextPreviewProps, "text" | "contentType" | "animationSettings" | "restartDelayMs" | "isEnabled"> & {
    text: string;
    contentType: RichTextContentType;
    animationSettings?: RichTextEngineSettings;
    restartDelayMs: number;
    configKey: string;
};
export declare function ExpoRichTextPreview({ text, contentType, animationSettings, restartDelayMs, isEnabled, ...rest }: RichTextPreviewProps): React.FunctionComponentElement<RichTextViewProps> | React.FunctionComponentElement<PreviewLoopSessionProps>;
//# sourceMappingURL=component.d.ts.map