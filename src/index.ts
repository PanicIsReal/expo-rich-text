export { default, ExpoRichText, ExpoRichTextPreview } from "./component.js";
export type {
  RichTextHeightEvent,
  RichTextLinkPressEvent,
  RichTextPlaybackStateEvent,
  RichTextPreviewProps,
  RichTextRevealProgressEvent,
  RichTextRevealStateEvent,
  RichTextViewProps,
} from "./component.js";

export type {
  RichTextContentType,
  RichTextEngineSettings,
  RichTextPlaybackPhase,
} from "./engine.js";

export type {
  RichTextAnimationPreset,
  RichTextAnimationRevealPreset,
  RichTextAnimationSettings,
  RichTextAnimationShaderPreset,
  RichTextAnimationUnitMode,
} from "./animation.js";

export { resolveRichTextSourceText } from "./engine.js";

export {
  DEFAULT_RICH_TEXT_ANIMATION_SETTINGS,
  resolveRichTextAnimationSettings,
  resolveSplitRichTextAnimationPreset,
} from "./animation.js";
