# expo-rich-text

A SwiftUI-backed Expo module that renders and animates rich text on iOS. Pairs a streaming-aware incremental compiler on the JS side with a `Text`-based SwiftUI renderer on the native side — designed for LLM token streams, live markdown previews, and typewriter / fade-trail / shader reveal effects.

<!--
  Demo video.
  To swap in a real recording: open a new GitHub issue, drag the .mp4 into
  the comment box, wait for the upload to finish, copy the resulting
  https://github.com/user-attachments/assets/<uuid> URL, replace the line
  below with it, and close the issue tab without submitting. GitHub renders
  bare user-attachments URLs as an inline <video> player.
-->

[Example Video](https://streamable.com/k1fwet)

| iOS | Android | Web |
| :---: | :---: | :---: |
| ✅ (iOS 26+) | ❌ | ❌ |

> [!IMPORTANT]
> This is an **iOS-only** module. The podspec targets iOS 26 and uses SwiftUI `TextRenderer` plus Metal shaders, so older SDKs won't build. It depends on [`@expo/ui`](https://docs.expo.dev/versions/latest/sdk/ui/) — the view is hosted inside `@expo/ui/swift-ui`'s `Host`.

## Installation

This module is distributed via GitHub, not the npm registry. Add it to an Expo project (SDK 55+, custom dev client required — it is **not** available in Expo Go).

```sh
npx expo install github:PanicIsReal/expo-rich-text @expo/ui
```

Or pin to a specific commit / tag:

```sh
npx expo install "github:PanicIsReal/expo-rich-text#<commit-or-tag>" @expo/ui
```

Then prebuild and build a development client:

```sh
npx expo prebuild --clean
npx expo run:ios
```

### Requirements

- Expo SDK 55 or newer
- React Native 0.83+
- iOS 26 deployment target (set `ios.deploymentTarget` to `"26.0"` in `app.json` / the `Podfile`)
- [`@expo/ui`](https://docs.expo.dev/versions/latest/sdk/ui/) ~55.0.11 (peer dependency)

## Usage

### Static text

```tsx
import { ExpoRichText } from "expo-rich-text";

export function Hello() {
  return (
    <ExpoRichText
      itemId="hello"
      text="# Hello\n\nSome **bold** markdown and `inline code`."
      contentType="markdown"
      fontSize={17}
      lineHeight={24}
    />
  );
}
```

### Streaming from an SSE source

Pass the raw Server-Sent Events payload — the module parses `data:` frames and accumulates text for you.

```tsx
import { ExpoRichText } from "expo-rich-text";

export function Stream({ sseStream, isStreaming }: Props) {
  return (
    <ExpoRichText
      itemId="assistant-reply"
      sseStream={sseStream}
      isStreaming={isStreaming}
      contentType="markdown"
      animationSettings={{ unitMode: "word", wordsPerMinute: 320 }}
      onPlaybackStateChange={(e) => console.log(e.nativeEvent.phase)}
    />
  );
}
```

When `isStreaming` flips to `false` the view finishes revealing whatever text is already buffered, then emits `phase: "settled"` via `onPlaybackStateChange`.

### Preview loop (for design galleries / settings screens)

`ExpoRichTextPreview` loops the given `text` with the configured animation, pausing `restartDelayMs` between runs. No `itemId` or streaming plumbing required.

```tsx
import { ExpoRichTextPreview } from "expo-rich-text";

export function PresetPreview() {
  return (
    <ExpoRichTextPreview
      text="Matrix rain with a shader preset."
      contentType="plain"
      animationSettings={{ shaderPreset: "matrix", unitMode: "glyph" }}
      restartDelayMs={1200}
    />
  );
}
```

## API

```ts
import {
  ExpoRichText,
  ExpoRichTextPreview,
  DEFAULT_RICH_TEXT_ANIMATION_SETTINGS,
  resolveRichTextAnimationSettings,
  resolveRichTextSourceText,
  resolveSplitRichTextAnimationPreset,
} from "expo-rich-text";
```

Subpath entries let you import lighter slices without pulling in the native view:

| Path | Contents |
| --- | --- |
| `expo-rich-text` | Root — components, types, helpers |
| `expo-rich-text/animation` | Animation settings types, defaults, resolvers |
| `expo-rich-text/engine` | Incremental compiler, SSE helper, content-type detection |
| `expo-rich-text/preview` | Just `ExpoRichTextPreview` and its props |
| `expo-rich-text/fixtures/cases` | Canonical fixture case list (for tests) |
| `expo-rich-text/fixtures/*.json` | Raw fixture / scenario JSON |

### `<ExpoRichText>`

The main view. Renders text produced by the incremental compiler into a SwiftUI `Text` (with an optional overlay for shader effects), sized automatically to fit its content.

#### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `itemId` | `string` | **required** | Stable identity. Changing it resets the compiler and starts a fresh reveal. |
| `text` | `string` | — | Full source text. Use either `text` **or** `sseStream`, not both. |
| `sseStream` | `string` | — | Raw SSE body; parsed by `resolveRichTextSourceText`. |
| `isStreaming` | `boolean` | `false` | Keeps the reveal animation primed. Flip to `false` to let it settle. |
| `contentType` | `"plain" \| "markdown" \| "auto"` | `"auto"` | Parser selection. `"auto"` sniffs common markdown syntax. |
| `fontFamily` | `string` | system | Applied uniformly. Code spans / blocks always use a monospaced font. |
| `fontSize` | `number` | `17` | Body font size (pt). |
| `lineHeight` | `number` | `22` | Line height (pt) — passed to SwiftUI as line spacing. |
| `codeFontSize` | `number` | `15` | Font size for inline code and fenced code blocks. |
| `textColor` | `string` | system label | Any CSS-style color string (`"#rrggbb"`, `"rgba(...)"`, named). |
| `blockquoteAccentColor` | `string` | system label dim | Left accent bar on `> blockquote` lines. |
| `codeBackgroundColor` | `string` | system secondary fill | Background of inline code and fenced code blocks. |
| `selectable` | `boolean` | `true` | When `true`, long-press to select / copy. |
| `animationSettings` | `RichTextEngineSettings` | see `DEFAULT_RICH_TEXT_ANIMATION_SETTINGS` | Partial override of reveal / shader configuration. |
| `style` | `ViewStyle` | — | Forwarded to the hosting `@expo/ui` container. |
| `modifiers` | `CommonViewModifierProps["modifiers"]` | — | Apply SwiftUI modifiers from `@expo/ui/swift-ui/modifiers`. |
| `testID` | `string` | — | Forwarded to the native view. |

#### Events

All events fire with a standard `NativeSyntheticEvent`.

| Event | Payload | Fires |
| --- | --- | --- |
| `onHeightChange` | `{ height: number }` | When the rendered content height changes (use for row sizing). |
| `onRevealProgress` | `{ revealedCount: number }` | On each reveal tick while animating. |
| `onRevealStateChange` | `{ active: boolean, revealedCount: number }` | When the reveal animation starts / stops. |
| `onPlaybackStateChange` | `{ phase: RichTextPlaybackPhase, revealedCount: number }` | On playback phase transitions (`"idle" \| "revealing" \| "settling" \| "settled"`). |
| `onLinkPress` | `{ href: string }` | When a markdown link span is tapped. |

### `<ExpoRichTextPreview>`

Wraps `ExpoRichText` with a loop controller — useful for picking animation presets in settings.

```ts
type RichTextPreviewProps = Omit<
  RichTextViewProps,
  "itemId" | "text" | "sseStream" | "isStreaming"
    | "onPlaybackStateChange" | "onRevealStateChange"
> & {
  text: string;
  restartDelayMs?: number; // default 1400
  isEnabled?: boolean;     // default true — set false to show static text
};
```

When `isEnabled` is `false` the preview renders `text` statically (no animation, no loop).

### Animation settings

All animation behaviour is controlled by a single `RichTextEngineSettings` object (a `Partial<RichTextAnimationSettings>`). Unspecified fields fall back to `DEFAULT_RICH_TEXT_ANIMATION_SETTINGS`.

```ts
type RichTextAnimationSettings = {
  enabled: boolean;              // master toggle — false renders static
  revealPreset: "typewriter" | "fade-trail";
  shaderPreset:
    | "none"
    | "ember" | "matrix" | "neon" | "ghost" | "smoke" | "disintegrate"
    | "shader-glow" | "shader-wave" | "shader-crt" | "shader-noise";
  shaderStrength: number;        // 0..1
  effectColor: string;           // CSS color; "" inherits textColor
  smoothReveal: boolean;         // easing between reveal steps
  smoothNewLine: boolean;        // fade in new lines as a group
  unitMode: "glyph" | "word" | "token";
  unitsPerStep: number;          // 1..12
  unitsPerSecond: number;        // 1..80 (used when unitMode !== "word")
  wordsPerMinute: number;        // 40..720 (used when unitMode === "word")
  fadeDurationMs: number;        // 0..1200
  fadeStartOpacity: number;      // 0.05..1
  cursorEnabled: boolean;
  cursorGlyph: string;           // default "▍"
  tailLength: number;            // 1..12 — size of the fading trail
};
```

Defaults:

```ts
const DEFAULT_RICH_TEXT_ANIMATION_SETTINGS = {
  enabled: true,
  revealPreset: "fade-trail",
  shaderPreset: "none",
  shaderStrength: 1,
  effectColor: "",
  smoothReveal: false,
  smoothNewLine: false,
  unitMode: "glyph",
  unitsPerStep: 2,
  unitsPerSecond: 18,
  wordsPerMinute: 220,
  fadeDurationMs: 180,
  fadeStartOpacity: 0.22,
  cursorEnabled: true,
  cursorGlyph: "▍",
  tailLength: 4,
};
```

#### Helpers

| Function | Purpose |
| --- | --- |
| `resolveRichTextAnimationSettings(partial?)` | Merge + clamp a partial settings object into a fully-resolved `RichTextAnimationSettings`. |
| `resolveSplitRichTextAnimationPreset(preset)` | Map a single `RichTextAnimationPreset` (e.g. `"matrix"`) to the pair `{ revealPreset, shaderPreset }`. |
| `resolveRichTextSourceText({ text, sseStream })` | Derive the effective source string — prefers `sseStream` when set, otherwise returns `text ?? ""`. |

### Types

Exported from the root entry:

- `RichTextViewProps`, `RichTextPreviewProps`
- `RichTextContentType`, `RichTextPlaybackPhase`
- `RichTextEngineSettings`
- `RichTextAnimationSettings`, `RichTextAnimationPreset`, `RichTextAnimationRevealPreset`, `RichTextAnimationShaderPreset`, `RichTextAnimationUnitMode`
- Event payloads: `RichTextHeightEvent`, `RichTextRevealProgressEvent`, `RichTextRevealStateEvent`, `RichTextPlaybackStateEvent`, `RichTextLinkPressEvent`

## Styling

Role-specific tinting is intentionally not part of the public API. Use the explicit color props (`textColor`, `blockquoteAccentColor`, `codeBackgroundColor`) when you need to override the default styling — there is no global theme hook.

Supported markdown constructs:

- Headings (`# … ######`)
- Paragraphs with soft/hard line breaks
- `**bold**`, `*italic*`, `inline code`, `~~strikethrough~~`, `[links](https://…)`
- `> blockquotes` (single- and multi-line)
- `-` / `*` / `+` bullet lists and `1.` ordered lists
- Fenced code blocks (``` ```lang … ``` ```)

## How streaming works

`ExpoRichText` uses an incremental compiler (`RichTextIncrementalCompiler` — exported from `expo-rich-text/engine`) that emits one of three update kinds to native:

- **reset** — full document replaced (first render, or non-prefix edits)
- **append** — new tail added to an already-stable prefix (the common streaming case)
- **replace** — prefix preserved, suffix swapped (rare edits that alter only the tail)

This means only the appended bytes cross the bridge during a stream, and the SwiftUI side can animate just the new units.

## License

MIT — see [`package.json`](./package.json). Issues and PRs: <https://github.com/PanicIsReal/expo-rich-text/issues>.
