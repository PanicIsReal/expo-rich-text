import { Host, type CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeSyntheticEvent, ViewProps } from "react-native";

import {
  buildRichTextPreviewSseStream,
  createInitialRichTextPreviewControllerState,
  createRichTextPreviewConfigKey,
  RichTextIncrementalCompiler,
  reduceRichTextPreviewController,
  resolveRichTextAnimationMode,
  resolveRichTextSourceText,
  resolveRichTextTiming,
  type RichTextContentType,
  type RichTextEngineSettings,
  type RichTextPlaybackPhase,
} from "./engine.js";
import type {
  TextAnimationRevealPreset,
  TextAnimationShaderPreset,
} from "./internal/animation-config.js";

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

type NativeRichTextViewProps = CommonViewModifierProps & {
  itemId: string;
  updateJson?: string;
  documentJson?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  codeFontSize?: number;
  textColor?: string;
  blockquoteAccentColor?: string;
  codeBackgroundColor?: string;
  selectable?: boolean;
  isStreaming?: boolean;
  animationMode?: "static" | "token-reveal" | "glyph-reveal" | "word-reveal";
  revealIntervalMs?: number;
  revealUnitsPerStep?: number;
  fadeDurationMs?: number;
  fadeStartOpacity?: number;
  effectColor?: string;
  revealPreset?: TextAnimationRevealPreset;
  shaderPreset?: TextAnimationShaderPreset;
  shaderStrength?: number;
  smoothReveal?: boolean;
  smoothNewLine?: boolean;
  cursorEnabled?: boolean;
  cursorGlyph?: string;
  tailLength?: number;
  onRevealProgress?: (
    event: NativeSyntheticEvent<RichTextRevealProgressEvent>,
  ) => void;
  onVisualRevealStateChange?: (
    event: NativeSyntheticEvent<RichTextRevealStateEvent>,
  ) => void;
  onPlaybackStateChange?: (
    event: NativeSyntheticEvent<RichTextPlaybackStateEvent>,
  ) => void;
  onLinkPress?: (event: NativeSyntheticEvent<RichTextLinkPressEvent>) => void;
};

export type RichTextViewProps = Omit<ViewProps, "children" | "testID"> &
  CommonViewModifierProps & {
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
    onRevealProgress?: (
      event: NativeSyntheticEvent<RichTextRevealProgressEvent>,
    ) => void;
    onRevealStateChange?: (
      event: NativeSyntheticEvent<RichTextRevealStateEvent>,
    ) => void;
    onPlaybackStateChange?: (
      event: NativeSyntheticEvent<RichTextPlaybackStateEvent>,
    ) => void;
    onLinkPress?: (event: NativeSyntheticEvent<RichTextLinkPressEvent>) => void;
  };

let nativeRichTextView: React.ComponentType<NativeRichTextViewProps> | null =
  null;

function getNativeRichTextView(): React.ComponentType<NativeRichTextViewProps> {
  if (!nativeRichTextView) {
    nativeRichTextView = requireNativeView<NativeRichTextViewProps>(
      "ExpoRichText",
      "ExpoRichTextView",
    );
  }
  return nativeRichTextView;
}

export function ExpoRichText({
  itemId,
  text,
  sseStream,
  isStreaming = false,
  contentType = "auto",
  animationSettings,
  style,
  modifiers,
  testID,
  onHeightChange,
  onRevealStateChange,
  onPlaybackStateChange,
  ...rest
}: RichTextViewProps) {
  const NativeRichTextView = getNativeRichTextView();
  const [nativeRevealState, setNativeRevealState] = useState<{
    itemId: string;
    active: boolean;
  }>({
    itemId,
    active: false,
  });
  const sourceText = useMemo(
    () => resolveRichTextSourceText({ text, sseStream }),
    [sseStream, text],
  );

  const { resolvedSettings, revealIntervalMs } = useMemo(
    () => resolveRichTextTiming(animationSettings),
    [animationSettings],
  );
  const compiler = useMemo(() => new RichTextIncrementalCompiler(), [itemId]);

  const animationMode = useMemo(
    () =>
      resolveRichTextAnimationMode({
        enabled: resolvedSettings.enabled,
        isStreaming,
        hasActiveVisualEffects:
          nativeRevealState.itemId === itemId && nativeRevealState.active,
        unitMode: resolvedSettings.unitMode,
      }),
    [
      isStreaming,
      itemId,
      nativeRevealState.active,
      nativeRevealState.itemId,
      resolvedSettings.enabled,
      resolvedSettings.unitMode,
    ],
  );

  const updateJson = useMemo(
    () =>
      compiler.buildUpdateJson({
        text: sourceText,
        contentType,
        animationMode,
        isStreaming,
      }),
    [animationMode, compiler, contentType, isStreaming, sourceText],
  );

  const handleLayoutContent = useCallback(
    (event: { nativeEvent: { width: number; height: number } }) => {
      onHeightChange?.({
        nativeEvent: {
          height: event.nativeEvent.height,
        },
      } as NativeSyntheticEvent<RichTextHeightEvent>);
    },
    [onHeightChange],
  );

  const modifierEventListener = useMemo(
    () => (modifiers ? createViewModifierEventListener(modifiers) : undefined),
    [modifiers],
  );

  const handleRevealStateChange = useCallback(
    (event: NativeSyntheticEvent<RichTextRevealStateEvent>) => {
      const active = !!event.nativeEvent.active;
      setNativeRevealState((currentState) => {
        if (currentState.itemId === itemId && currentState.active === active) {
          return currentState;
        }
        return {
          itemId,
          active,
        };
      });
      onRevealStateChange?.(event);
    },
    [itemId, onRevealStateChange],
  );

  return React.createElement(Host, {
    matchContents: { vertical: true },
    onLayoutContent: handleLayoutContent,
    style,
    children: React.createElement(
      NativeRichTextView as React.ComponentType<NativeRichTextViewProps>,
      {
        ...rest,
        itemId,
        updateJson,
        isStreaming,
        animationMode,
        revealIntervalMs,
        revealUnitsPerStep: resolvedSettings.unitsPerStep,
        fadeDurationMs: resolvedSettings.fadeDurationMs,
        fadeStartOpacity: resolvedSettings.fadeStartOpacity,
        effectColor: resolvedSettings.effectColor || undefined,
        revealPreset: resolvedSettings.revealPreset,
        shaderPreset: resolvedSettings.shaderPreset,
        shaderStrength: resolvedSettings.shaderStrength,
        smoothReveal: resolvedSettings.smoothReveal,
        smoothNewLine: resolvedSettings.smoothNewLine,
        cursorEnabled: resolvedSettings.cursorEnabled,
        cursorGlyph: resolvedSettings.cursorGlyph,
        tailLength: resolvedSettings.tailLength,
        modifiers,
        testID,
        onVisualRevealStateChange: handleRevealStateChange,
        onPlaybackStateChange,
        ...(modifierEventListener ?? {}),
      },
    ),
  });
}

export default ExpoRichText;

export type RichTextPreviewProps = Omit<
  RichTextViewProps,
  | "itemId"
  | "text"
  | "sseStream"
  | "isStreaming"
  | "onPlaybackStateChange"
  | "onRevealStateChange"
> & {
  text: string;
  restartDelayMs?: number;
  isEnabled?: boolean;
};

type PreviewLoopSessionProps = Omit<
  RichTextPreviewProps,
  "text" | "contentType" | "animationSettings" | "restartDelayMs" | "isEnabled"
> & {
  text: string;
  contentType: RichTextContentType;
  animationSettings?: RichTextEngineSettings;
  restartDelayMs: number;
  configKey: string;
};

function ExpoRichTextPreviewLoopSession({
  text,
  contentType,
  animationSettings,
  restartDelayMs,
  configKey,
  ...rest
}: PreviewLoopSessionProps) {
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [runtimeState, setRuntimeState] = useState(() => {
    const initialResult = reduceRichTextPreviewController(
      createInitialRichTextPreviewControllerState(),
      {
        type: "config-updated",
        configKey,
        enabled: true,
      },
      restartDelayMs,
    );
    return {
      controllerState: initialResult.state,
      scheduledRestartVersion:
        initialResult.command.type === "schedule-restart" ? 1 : 0,
      scheduledRestartDelayMs:
        initialResult.command.type === "schedule-restart"
          ? initialResult.command.delayMs
          : null,
    };
  });

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const applyControllerAction = useCallback(
    (
      action:
        | {
            type: "playback-state";
            playbackPhase: RichTextPlaybackPhase;
          }
        | {
            type: "restart-timer-fired";
          },
    ) => {
      setRuntimeState((currentState) => {
        const result = reduceRichTextPreviewController(
          currentState.controllerState,
          action,
          restartDelayMs,
        );
        const nextScheduledRestartVersion =
          result.command.type === "schedule-restart"
            ? currentState.scheduledRestartVersion + 1
            : currentState.scheduledRestartVersion;
        const nextScheduledRestartDelayMs =
          result.command.type === "schedule-restart"
            ? result.command.delayMs
            : result.state.restartPending
              ? currentState.scheduledRestartDelayMs
              : null;

        if (
          currentState.controllerState === result.state &&
          currentState.scheduledRestartVersion ===
            nextScheduledRestartVersion &&
          currentState.scheduledRestartDelayMs === nextScheduledRestartDelayMs
        ) {
          return currentState;
        }

        return {
          controllerState: result.state,
          scheduledRestartVersion: nextScheduledRestartVersion,
          scheduledRestartDelayMs: nextScheduledRestartDelayMs,
        };
      });
    },
    [restartDelayMs],
  );

  useEffect(() => {
    if (runtimeState.scheduledRestartDelayMs == null) {
      return;
    }

    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      applyControllerAction({ type: "restart-timer-fired" });
    }, runtimeState.scheduledRestartDelayMs);

    return () => {
      clearRestartTimer();
    };
  }, [
    applyControllerAction,
    clearRestartTimer,
    runtimeState.scheduledRestartDelayMs,
    runtimeState.scheduledRestartVersion,
  ]);

  const handlePlaybackStateChange = useCallback(
    (event: NativeSyntheticEvent<RichTextPlaybackStateEvent>) => {
      applyControllerAction({
        type: "playback-state",
        playbackPhase: event.nativeEvent.phase,
      });
    },
    [applyControllerAction],
  );

  return React.createElement(ExpoRichText, {
    ...rest,
    itemId: `expo-rich-text-preview-${runtimeState.controllerState.sessionVersion}`,
    sseStream: buildRichTextPreviewSseStream(text),
    isStreaming: runtimeState.controllerState.isStreaming,
    contentType,
    animationSettings,
    onPlaybackStateChange: handlePlaybackStateChange,
  });
}

export function ExpoRichTextPreview({
  text,
  contentType = "plain",
  animationSettings,
  restartDelayMs = 1400,
  isEnabled = true,
  ...rest
}: RichTextPreviewProps) {
  const configKey = useMemo(
    () =>
      createRichTextPreviewConfigKey({
        text,
        contentType,
        animationSettings,
      }),
    [animationSettings, contentType, text],
  );

  if (!isEnabled) {
    return React.createElement(ExpoRichText, {
      ...rest,
      itemId: `expo-rich-text-preview-static-${configKey}`,
      text,
      isStreaming: false,
      contentType,
      animationSettings,
    });
  }

  return React.createElement(ExpoRichTextPreviewLoopSession, {
    ...rest,
    key: `expo-rich-text-preview-loop-${configKey}`,
    text,
    contentType,
    animationSettings,
    restartDelayMs,
    configKey,
  });
}
