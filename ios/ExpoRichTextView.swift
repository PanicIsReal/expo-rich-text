import ExpoModulesCore
import ExpoUI
import CoreText
import SwiftUI
import UIKit

final class ExpoRichTextProps: UIBaseViewProps {
  @Field var itemId = ""
  @Field var documentJson: String?
  @Field var updateJson: String?
  @Field var fontFamily: String?
  @Field var fontSize: Double = 17
  @Field var lineHeight: Double = 22
  @Field var codeFontSize: Double = 15
  @Field var textColor: UIColor?
  @Field var blockquoteAccentColor: UIColor?
  @Field var codeBackgroundColor: UIColor?
  @Field var selectable = true
  @Field var isStreaming = false
  @Field var animationMode = "static"
  @Field var revealIntervalMs: Double = 96
  @Field var revealUnitsPerStep = 2
  @Field var fadeDurationMs: Double = 180
  @Field var fadeStartOpacity: Double = 0.22
  @Field var effectColor: UIColor?
  @Field var revealPreset = "fade-trail"
  @Field var shaderPreset = "none"
  @Field var shaderStrength: Double = 1
  @Field var smoothReveal = false
  @Field var smoothNewLine = false
  @Field var cursorEnabled = true
  @Field var cursorGlyph = "▍"
  @Field var tailLength = 4

  var onRevealProgress = EventDispatcher()
  var onVisualRevealStateChange = EventDispatcher()
  var onPlaybackStateChange = EventDispatcher()
  var onLinkPress = EventDispatcher()
}

private struct RichTextHostedSnapshot: Equatable {
  var textSegments: [RichTextHostedTextSegment] = []
  var overlaySegments: [RichTextHostedTextSegment] = []
  var selectable = true
  var revealActive = false
  var shaderPreset = "none"
  var shaderStrength: CGFloat = 1
  var shaderTime: CFTimeInterval = 0
  var lineSpacing: CGFloat = 0
  var textColor = UIColor.label
  var effectColor = UIColor.label
}

private struct RichTextHostedTextSegment: Equatable {
  var attributedText = AttributedString()
  var opacity: Double = 1
}

private struct RichTextFadeOpacityAttribute: AttributedStringKey, TextAttribute {
  typealias Value = RichTextFadeOpacityAttribute
  static let name = "richTextFadeOpacity"

  let opacity: Double
}

private struct RichTextFadeTextRenderer: TextRenderer {
  func draw(layout: Text.Layout, in ctx: inout GraphicsContext) {
    for line in layout {
      for run in line {
        var runContext = ctx
        if let fade = run[RichTextFadeOpacityAttribute.self] {
          runContext.opacity *= fade.opacity
        }
        runContext.draw(run)
      }
    }
  }
}

private struct RichTextResolvedConfiguration: Equatable, Hashable {
  let itemId: String
  let documentJson: String
  let updateJson: String
  let fontFamily: String?
  let fontSize: CGFloat
  let lineHeight: CGFloat
  let codeFontSize: CGFloat
  let textColor: UIColor?
  let blockquoteAccentColor: UIColor?
  let codeBackgroundColor: UIColor?
  let effectColor: UIColor?
  let selectable: Bool
  let isStreaming: Bool
  let animationMode: String
  let revealIntervalMs: Double
  let revealUnitsPerStep: Int
  let fadeDurationMs: Double
  let fadeStartOpacity: CGFloat
  let revealPreset: String
  let shaderPreset: String
  let shaderStrength: CGFloat
  let smoothReveal: Bool
  let smoothNewLine: Bool
  let cursorEnabled: Bool
  let cursorGlyph: String
  let tailLength: Int

  init(props: ExpoRichTextProps) {
    itemId = props.itemId
    documentJson = props.documentJson ?? ""
    updateJson = props.updateJson ?? ""
    fontFamily = props.fontFamily
    fontSize = CGFloat(props.fontSize)
    lineHeight = CGFloat(props.lineHeight)
    codeFontSize = CGFloat(props.codeFontSize)
    textColor = props.textColor
    blockquoteAccentColor = props.blockquoteAccentColor
    codeBackgroundColor = props.codeBackgroundColor
    effectColor = props.effectColor
    selectable = props.selectable
    isStreaming = props.isStreaming
    animationMode = props.animationMode
    revealIntervalMs = props.revealIntervalMs
    revealUnitsPerStep = props.revealUnitsPerStep
    fadeDurationMs = props.fadeDurationMs
    fadeStartOpacity = CGFloat(props.fadeStartOpacity)
    revealPreset = props.revealPreset
    shaderPreset = props.shaderPreset
    shaderStrength = CGFloat(props.shaderStrength)
    smoothReveal = props.smoothReveal
    smoothNewLine = props.smoothNewLine
    cursorEnabled = props.cursorEnabled
    cursorGlyph = props.cursorGlyph
    tailLength = props.tailLength
  }
}

@MainActor
private final class RichTextCoordinator: ObservableObject {
  private enum RevealPreset: String {
    case typewriter = "typewriter"
    case fadeTrail = "fade-trail"
  }

  private enum ShaderPreset: String {
    case none
    case ember
    case matrix
    case neon
    case ghost
    case smoke
    case disintegrate
    case shaderGlow = "shader-glow"
    case shaderWave = "shader-wave"
    case shaderCRT = "shader-crt"
    case shaderNoise = "shader-noise"

    var usesContinuousTimeline: Bool {
      switch self {
      case .shaderGlow, .shaderWave, .shaderCRT, .shaderNoise, .smoke, .disintegrate:
        return true
      default:
        return false
      }
    }
  }

  private let rendererCore = RichTextRendererCore()
  @Published private(set) var hostedSnapshot = RichTextHostedSnapshot()
  private weak var props: ExpoRichTextProps?
  private var isVisible = false

  private var currentItemId = ""
  private var documentJson = ""
  private var updateJson = ""

  private var fontFamily = "Menlo"
  private var fontSize: CGFloat = 17
  private var lineHeight: CGFloat = 22
  private var codeFontSize: CGFloat = 15
  private var textColor: UIColor?
  private var blockquoteAccentColor: UIColor?
  private var codeBackgroundColor: UIColor?
  private var effectColor: UIColor?
  private var selectable = true
  private var isStreaming = false
  private var animationMode = "static"
  private var revealIntervalMs: Double = 96
  private var revealUnitsPerStep = 2
  private var fadeDurationMs: Double = 180
  private var fadeStartOpacity: CGFloat = 0.22
  private var revealPreset: RevealPreset = .fadeTrail
  private var shaderPreset: ShaderPreset = .none
  private var shaderStrength: CGFloat = 1
  private var smoothReveal = false
  private var smoothNewLine = false
  private var cursorEnabled = true
  private var cursorGlyph = "▍"
  private var tailLength = 4

  private var currentSnapshot: RichTextRenderSnapshot?
  private var shaderAnimationStartTime: CFTimeInterval?

  private var revealTimer: Timer?
  private var revealTimerInterval: TimeInterval?
  private var visualEffectTimer: Timer?
  private let visualEffectTimerInterval: TimeInterval = 1.0 / 30.0

  private var lastEmittedVisibleCharacterCount = -1
  private var lastEmittedRevealActive: Bool?
  private var lastEmittedRevealVisibleCharacterCount = -1
  private var lastEmittedPlaybackPhase = ""
  private var lastEmittedPlaybackVisibleCharacterCount = -1
  init() {
    let now = CACurrentMediaTime()
    rendererCore.updateSettings(
      theme: currentTheme,
      settings: currentSessionSettings,
      now: now
    )
    render(now: now, forceLayout: true)
  }

  func attach(props: ExpoRichTextProps) {
    self.props = props
    isVisible = true
  }

  func detach() {
    isVisible = false
    props = nil
    invalidateTimers()
  }

  func apply(configuration: RichTextResolvedConfiguration, props: ExpoRichTextProps) {
    let now = CACurrentMediaTime()
    let nextRevealPreset = RevealPreset(rawValue: configuration.revealPreset) ?? .fadeTrail
    let nextShaderPreset = ShaderPreset(rawValue: configuration.shaderPreset) ?? .none
    let nextShaderStrength = max(0, min(configuration.shaderStrength, 1))
    let nextRevealIntervalMs = max(16, min(configuration.revealIntervalMs, 500))
    let nextRevealUnitsPerStep = max(1, min(configuration.revealUnitsPerStep, 12))
    let nextFadeDurationMs = max(0, min(configuration.fadeDurationMs, 1_200))
    let nextFadeStartOpacity = max(0.05, min(configuration.fadeStartOpacity, 1))
    let nextCursorGlyph = configuration.cursorGlyph.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      ? "▍"
      : configuration.cursorGlyph
    let nextTailLength = max(1, min(configuration.tailLength, 12))

    let didChangeItem = currentItemId != configuration.itemId
    let didChangeDocument = documentJson != configuration.documentJson
    let didChangeUpdate = updateJson != configuration.updateJson
    let didChangeShaderPreset = shaderPreset != nextShaderPreset
    let didChangeThemeOrSettings =
      fontFamily != (configuration.fontFamily ?? "Menlo") ||
      abs(fontSize - configuration.fontSize) > 0.5 ||
      abs(lineHeight - configuration.lineHeight) > 0.5 ||
      abs(codeFontSize - configuration.codeFontSize) > 0.5 ||
      !colorsEqual(textColor, configuration.textColor) ||
      !colorsEqual(blockquoteAccentColor, configuration.blockquoteAccentColor) ||
      !colorsEqual(codeBackgroundColor, configuration.codeBackgroundColor) ||
      !colorsEqual(effectColor, configuration.effectColor) ||
      selectable != configuration.selectable ||
      isStreaming != configuration.isStreaming ||
      animationMode != configuration.animationMode ||
      abs(revealIntervalMs - nextRevealIntervalMs) > 0.5 ||
      revealUnitsPerStep != nextRevealUnitsPerStep ||
      abs(fadeDurationMs - nextFadeDurationMs) > 0.5 ||
      abs(fadeStartOpacity - nextFadeStartOpacity) > 0.01 ||
      revealPreset != nextRevealPreset ||
      shaderPreset != nextShaderPreset ||
      abs(shaderStrength - nextShaderStrength) > 0.01 ||
      smoothReveal != configuration.smoothReveal ||
      smoothNewLine != configuration.smoothNewLine ||
      cursorEnabled != configuration.cursorEnabled ||
      cursorGlyph != nextCursorGlyph ||
      tailLength != nextTailLength

    currentItemId = configuration.itemId
    documentJson = configuration.documentJson
    updateJson = configuration.updateJson
    fontFamily = configuration.fontFamily ?? "Menlo"
    fontSize = configuration.fontSize
    lineHeight = configuration.lineHeight
    codeFontSize = configuration.codeFontSize
    textColor = configuration.textColor
    blockquoteAccentColor = configuration.blockquoteAccentColor
    codeBackgroundColor = configuration.codeBackgroundColor
    effectColor = configuration.effectColor
    selectable = configuration.selectable
    isStreaming = configuration.isStreaming
    animationMode = configuration.animationMode
    revealIntervalMs = nextRevealIntervalMs
    revealUnitsPerStep = nextRevealUnitsPerStep
    fadeDurationMs = nextFadeDurationMs
    fadeStartOpacity = nextFadeStartOpacity
    revealPreset = nextRevealPreset
    shaderPreset = nextShaderPreset
    shaderStrength = nextShaderStrength
    smoothReveal = configuration.smoothReveal
    smoothNewLine = configuration.smoothNewLine
    cursorEnabled = configuration.cursorEnabled
    cursorGlyph = nextCursorGlyph
    tailLength = nextTailLength

    if didChangeItem {
      shaderAnimationStartTime = nil
      resetEmittedSnapshotState()
      rendererCore.resetForNewItem(now: now)
    } else if didChangeShaderPreset {
      shaderAnimationStartTime = nil
    }

    if didChangeThemeOrSettings || didChangeItem {
      rendererCore.updateSettings(
        theme: currentTheme,
        settings: currentSessionSettings,
        now: now
      )
    }

    if (didChangeDocument || didChangeItem), !documentJson.isEmpty {
      _ = rendererCore.applyDocumentJson(documentJson, isStreaming: isStreaming, now: now)
    }

    if (didChangeUpdate || didChangeItem), !updateJson.isEmpty {
      _ = rendererCore.applyUpdateJson(updateJson, now: now)
    }

    if didChangeItem || didChangeDocument || didChangeUpdate || didChangeThemeOrSettings {
      render(now: now, forceLayout: true)
    }
  }

  private var currentTheme: RichTextTheme {
    RichTextTheme(
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      codeFontSize: codeFontSize,
      textColor: textColor ?? .label,
      blockquoteAccentColor: blockquoteAccentColor,
      codeBackgroundColor: codeBackgroundColor
    )
  }

  private var currentSessionSettings: RichTextRenderSessionSettings {
    RichTextRenderSessionSettings(
      animationMode: animationMode,
      isStreaming: isStreaming,
      revealIntervalMs: revealIntervalMs,
      revealUnitsPerStep: revealUnitsPerStep,
      fadeDurationMs: fadeDurationMs,
      fadeStartOpacity: fadeStartOpacity,
      revealPreset: revealPreset.rawValue,
      shaderPreset: shaderPreset.rawValue,
      shaderStrength: shaderStrength,
      cursorEnabled: cursorEnabled,
      cursorGlyph: cursorGlyph,
      tailLength: tailLength,
      smoothReveal: smoothReveal,
      smoothNewLine: smoothNewLine
    )
  }

  private func render(now: CFTimeInterval, forceLayout: Bool) {
    let snapshot = rendererCore.makeSnapshot(now: now)
    let renderState = resolvedRenderState(from: snapshot)
    let omitsForegroundColor =
      shaderPreset == .shaderCRT || shaderPreset == .shaderNoise

    let textSegments = RichTextSwiftUIAttributedStringBuilder.buildDocument(
      document: snapshot.document,
      theme: currentTheme,
      renderState: renderState,
      inlineCursor: resolvedInlineCursor(
        snapshot: snapshot,
        theme: currentTheme,
        accentColor: activeCursorColor()
      ),
      omitsForegroundColor: omitsForegroundColor
    )
    let overlaySegments =
      snapshot.activeOverlayUnitOrdinals.isEmpty
        ? []
        : RichTextSwiftUIAttributedStringBuilder.buildDocument(
          document: snapshot.document,
          theme: currentTheme,
          renderState: renderState,
          inlineCursor: nil,
          omitsForegroundColor: false,
          visibleUnitOrdinals: snapshot.activeOverlayUnitOrdinals
        )

    let shaderTime = resolvedShaderTime(now: now)
    let bodyFont = RichTextAttributedStringBuilder.resolveFont(
      currentTheme.fontFamily,
      size: currentTheme.fontSize,
      monospaced: false
    )
    let lineSpacing = max(0, currentTheme.lineHeight - bodyFont.lineHeight)

    let nextHostedSnapshot = RichTextHostedSnapshot(
      textSegments: textSegments,
      overlaySegments: overlaySegments,
      selectable: selectable,
      revealActive: snapshot.revealActive,
      shaderPreset: shaderPreset.rawValue,
      shaderStrength: shaderStrength,
      shaderTime: shaderTime,
      lineSpacing: lineSpacing,
      textColor: currentTheme.textColor,
      effectColor: effectColor ?? activeCursorColor()
    )
    if hostedSnapshot != nextHostedSnapshot {
      hostedSnapshot = nextHostedSnapshot
    }

    currentSnapshot = snapshot
    emitSnapshot(snapshot)
    updateTimers(for: snapshot)
  }

  private func resolvedInlineCursor(
    snapshot: RichTextRenderSnapshot,
    theme: RichTextTheme,
    accentColor: UIColor
  ) -> RichTextInlineCursor? {
    guard cursorEnabled else { return nil }
    guard snapshot.shouldShowInlineCursor || snapshot.shouldShowSmoothCursorLayer else { return nil }

    return RichTextInlineCursor(
      glyph: cursorGlyph,
      font: RichTextAttributedStringBuilder.resolveFont(
        theme.fontFamily,
        size: theme.fontSize,
        monospaced: false
      ),
      color: accentColor.withAlphaComponent(0.92),
      lineHeight: theme.lineHeight
    )
  }

  private func emitSnapshot(_ snapshot: RichTextRenderSnapshot) {
    guard let props, isVisible else { return }

    let visibleCharacterCount = snapshot.visibleCharacterCount
    if lastEmittedVisibleCharacterCount != visibleCharacterCount {
      lastEmittedVisibleCharacterCount = visibleCharacterCount
      props.onRevealProgress(["revealedCount": visibleCharacterCount])
    }

    if
      lastEmittedRevealActive != snapshot.revealActive ||
      lastEmittedRevealVisibleCharacterCount != visibleCharacterCount
    {
      lastEmittedRevealActive = snapshot.revealActive
      lastEmittedRevealVisibleCharacterCount = visibleCharacterCount
      props.onVisualRevealStateChange([
        "active": snapshot.revealActive,
        "revealedCount": visibleCharacterCount,
      ])
    }

    let playbackPhase = snapshot.playbackPhase.rawValue
    if lastEmittedPlaybackPhase != playbackPhase ||
      lastEmittedPlaybackVisibleCharacterCount != visibleCharacterCount
    {
      lastEmittedPlaybackPhase = playbackPhase
      lastEmittedPlaybackVisibleCharacterCount = visibleCharacterCount
      props.onPlaybackStateChange([
        "phase": playbackPhase,
        "revealedCount": visibleCharacterCount,
      ])
    }
  }

  private func updateTimers(for snapshot: RichTextRenderSnapshot) {
    guard isVisible else {
      invalidateTimers()
      return
    }

    if let interval = snapshot.revealTimerInterval {
      ensureRevealTimer(interval: interval)
    } else {
      stopRevealTimer()
    }

    if snapshot.requiresVisualEffectTimer || shaderPreset.usesContinuousTimeline {
      ensureVisualEffectTimer()
    } else {
      stopVisualEffectTimer()
    }
  }

  private func ensureRevealTimer(interval: TimeInterval) {
    if revealTimer != nil, let revealTimerInterval, abs(revealTimerInterval - interval) <= 0.0001 {
      return
    }

    stopRevealTimer()

    let timer = Timer(timeInterval: interval, repeats: true) { [weak self] timer in
      Task { @MainActor [weak self] in
        guard let self else {
          timer.invalidate()
          return
        }
        guard self.isVisible, self.props != nil else {
          timer.invalidate()
          self.stopRevealTimer()
          return
        }

        let now = CACurrentMediaTime()
        self.rendererCore.tick(now: now)
        self.render(now: now, forceLayout: false)
      }
    }
    revealTimer = timer
    revealTimerInterval = interval
    RunLoop.main.add(timer, forMode: .common)
  }

  private func stopRevealTimer() {
    revealTimer?.invalidate()
    revealTimer = nil
    revealTimerInterval = nil
  }

  private func ensureVisualEffectTimer() {
    if visualEffectTimer != nil {
      return
    }

    let timer = Timer(timeInterval: visualEffectTimerInterval, repeats: true) { [weak self] timer in
      Task { @MainActor [weak self] in
        guard let self else {
          timer.invalidate()
          return
        }
        guard self.isVisible, self.props != nil else {
          timer.invalidate()
          self.stopVisualEffectTimer()
          return
        }

        let now = CACurrentMediaTime()
        self.render(now: now, forceLayout: false)
      }
    }
    visualEffectTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func stopVisualEffectTimer() {
    visualEffectTimer?.invalidate()
    visualEffectTimer = nil
  }

  private func invalidateTimers() {
    stopRevealTimer()
    stopVisualEffectTimer()
  }

  private func resetEmittedSnapshotState() {
    lastEmittedVisibleCharacterCount = -1
    lastEmittedRevealActive = nil
    lastEmittedRevealVisibleCharacterCount = -1
    lastEmittedPlaybackPhase = ""
    lastEmittedPlaybackVisibleCharacterCount = -1
  }

  private func resolvedRenderState(from snapshot: RichTextRenderSnapshot) -> RichTextRenderState? {
    guard let snapshotRenderState = snapshot.renderState else { return nil }
    return RichTextRenderState(
      visibleUnitCount: snapshotRenderState.visibleUnitCount,
      revealTimes: snapshotRenderState.revealTimes,
      now: snapshotRenderState.now,
      fadeDurationMs: snapshotRenderState.fadeDurationMs,
      fadeStartOpacity: snapshotRenderState.fadeStartOpacity,
      effectColor: effectColor,
      revealPreset: snapshotRenderState.revealPreset,
      shaderPreset: snapshotRenderState.shaderPreset,
      shaderStrength: snapshotRenderState.shaderStrength,
      tailLength: snapshotRenderState.tailLength,
      hiddenUnitOrdinals: snapshotRenderState.hiddenUnitOrdinals
    )
  }

  private func activeCursorColor() -> UIColor {
    if let customEffectColor = effectColor {
      return customEffectColor
    }

    switch shaderPreset {
    case .ember:
      return UIColor(red: 1.0, green: 0.62, blue: 0.18, alpha: 1)
    case .matrix:
      return UIColor(red: 0.55, green: 1.0, blue: 0.62, alpha: 1)
    case .neon:
      return UIColor(red: 0.28, green: 0.92, blue: 1.0, alpha: 1)
    case .ghost:
      return UIColor(red: 0.84, green: 0.90, blue: 1.0, alpha: 1)
    case .smoke:
      return UIColor(red: 0.86, green: 0.90, blue: 0.98, alpha: 1)
    case .disintegrate:
      return UIColor(red: 0.95, green: 0.80, blue: 0.66, alpha: 1)
    case .shaderGlow:
      return UIColor(red: 0.31, green: 0.87, blue: 1.0, alpha: 1)
    case .shaderWave:
      return UIColor(red: 0.54, green: 0.87, blue: 1.0, alpha: 1)
    case .shaderCRT:
      return UIColor(red: 0.72, green: 0.98, blue: 0.78, alpha: 1)
    case .shaderNoise:
      return UIColor(red: 0.52, green: 0.72, blue: 0.92, alpha: 1)
    default:
      return textColor ?? .label
    }
  }

  private func resolvedShaderTime(now: CFTimeInterval) -> CFTimeInterval {
    guard shaderPreset.usesContinuousTimeline else {
      shaderAnimationStartTime = nil
      return 0
    }

    let startTime: CFTimeInterval
    if let shaderAnimationStartTime {
      startTime = shaderAnimationStartTime
    } else {
      shaderAnimationStartTime = now
      startTime = now
    }

    return max(0, now - startTime)
  }

  private func colorsEqual(_ lhs: UIColor?, _ rhs: UIColor?) -> Bool {
    switch (lhs, rhs) {
    case (nil, nil):
      return true
    case let (lhs?, rhs?):
      return lhs.isEqual(rhs)
    default:
      return false
    }
  }
}

struct ExpoRichTextView: ExpoSwiftUI.View {
  @ObservedObject var props: ExpoRichTextProps
  @StateObject private var coordinator = RichTextCoordinator()

  init(props: ExpoRichTextProps) {
    self.props = props
  }

  var body: some View {
    let configuration = RichTextResolvedConfiguration(props: props)
    return RichTextHostedRootContainerView(
      snapshot: coordinator.hostedSnapshot,
      onOpenURL: { url in
        props.onLinkPress(["href": url.absoluteString])
      }
    )
    .frame(maxWidth: .infinity, alignment: .leading)
    .onAppear {
      coordinator.attach(props: props)
      coordinator.apply(
        configuration: configuration,
        props: props
      )
    }
    .onDisappear {
      coordinator.detach()
    }
    .onChange(of: configuration) { _, nextConfiguration in
      coordinator.apply(
        configuration: nextConfiguration,
        props: props
      )
    }
  }
}

private struct RichTextInlineCursor {
  let glyph: String
  let font: UIFont
  let color: UIColor
  let lineHeight: CGFloat
}

private enum ExpoRichTextShaderResources {
  static let library: ShaderLibrary = {
    let candidates: [Bundle] = [
      Bundle(for: ExpoRichTextModule.self),
      Bundle.main,
    ]
    for candidate in candidates {
      if
        let url = candidate.url(forResource: "ExpoRichTextShaders", withExtension: "bundle"),
        let bundle = Bundle(url: url)
      {
        return ShaderLibrary.bundle(bundle)
      }
    }
    return ShaderLibrary.default
  }()
}

private struct RichTextHostedRootContainerView: View {
  let snapshot: RichTextHostedSnapshot
  let onOpenURL: (URL) -> Void

  var body: some View {
    RichTextHostedRootView(
      snapshot: snapshot,
      onOpenURL: onOpenURL
    )
  }
}

private struct RichTextHostedRootView: View {
  let snapshot: RichTextHostedSnapshot
  let onOpenURL: (URL) -> Void

  private var shaderSourcePadding: EdgeInsets {
    switch snapshot.shaderPreset {
    case "shader-glow":
      let inset = 12 * snapshot.shaderStrength
      return EdgeInsets(top: inset, leading: inset, bottom: inset, trailing: inset)
    case "shader-wave":
      let vertical = 14 * snapshot.shaderStrength
      return EdgeInsets(top: vertical, leading: 0, bottom: vertical, trailing: 0)
    case "smoke", "disintegrate":
      let inset = 10 * snapshot.shaderStrength
      return EdgeInsets(top: inset, leading: inset, bottom: inset, trailing: inset)
    default:
      return EdgeInsets()
    }
  }

  var body: some View {
    let openURLAction = OpenURLAction { url in
      onOpenURL(url)
      return .handled
    }

    return RichTextWidthFittingLayout {
      content
        .environment(\.openURL, openURLAction)
    }
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.clear)
  }

  @ViewBuilder
  private var content: some View {
    bodyContent(time: snapshot.shaderTime)
  }

  @ViewBuilder
  private func bodyContent(time: TimeInterval) -> some View {
    let resolvedTint = Color(uiColor: snapshot.effectColor)
    let resolvedTextColor = Color(uiColor: snapshot.textColor)
    let fadeRenderer = RichTextFadeTextRenderer()
    let baseText = buildText(from: snapshot.textSegments)
      .textRenderer(fadeRenderer)
    let overlayMaskText = buildText(from: snapshot.overlaySegments)
      .textRenderer(fadeRenderer)
      .multilineTextAlignment(.leading)
      .lineSpacing(snapshot.lineSpacing)
      .padding(shaderSourcePadding)

    let textContent = Group {
      baseText
        .multilineTextAlignment(.leading)
        .lineSpacing(snapshot.lineSpacing)
        .padding(shaderSourcePadding)
    }

    let shaderReadyText = shaderDecoratedText(
      textContent,
      tint: resolvedTint,
      textColor: resolvedTextColor,
      time: time
    )

    let decorated = Group {
      switch snapshot.shaderPreset {
      case "smoke":
        shaderReadyText.overlay(alignment: .topLeading) {
          if !snapshot.overlaySegments.isEmpty {
            Rectangle()
              .fill(resolvedTint)
              .mask(overlayMaskText)
              .blur(radius: 1.5 + (3 * snapshot.shaderStrength))
              .opacity(0.18 + (0.22 * snapshot.shaderStrength))
              .offset(x: 0, y: -4 - (6 * snapshot.shaderStrength))
              .allowsHitTesting(false)
          }
        }
      case "disintegrate":
        shaderReadyText.overlay(alignment: .topLeading) {
          if !snapshot.overlaySegments.isEmpty {
            Rectangle()
              .fill(resolvedTint)
              .mask(overlayMaskText)
              .opacity(0.12 + (0.16 * snapshot.shaderStrength))
              .offset(x: 4 + (10 * snapshot.shaderStrength), y: -2 - (4 * snapshot.shaderStrength))
              .rotationEffect(.degrees(0.8 + (2.8 * snapshot.shaderStrength)))
              .allowsHitTesting(false)
          }
        }
      default:
        shaderReadyText
      }
    }

    if snapshot.selectable && !snapshot.revealActive {
      decorated
        .textSelection(.enabled)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      decorated
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  @ViewBuilder
  private func shaderDecoratedText<V: View>(
    _ view: V,
    tint: Color,
    textColor: Color,
    time: TimeInterval
  ) -> some View {
    let isEnabled = snapshot.shaderStrength > 0.001
    switch snapshot.shaderPreset {
    case "shader-glow":
      view
        .foregroundStyle(
          ExpoRichTextShaderResources.library.richTextGlowFill(
            .color(tint),
            .float(Float(snapshot.shaderStrength)),
            .float(Float(time))
          )
        )
        .layerEffect(
          ExpoRichTextShaderResources.library.richTextGlow(
            .color(tint),
            .float(Float(snapshot.shaderStrength)),
            .float(Float(time))
          ),
          maxSampleOffset: CGSize(width: 12 * snapshot.shaderStrength, height: 12 * snapshot.shaderStrength),
          isEnabled: isEnabled
        )
    case "shader-wave":
      view
        .distortionEffect(
          ExpoRichTextShaderResources.library.richTextWave(
            .float(Float(time)),
            .float(Float(snapshot.shaderStrength))
          ),
          maxSampleOffset: CGSize(width: 22 * snapshot.shaderStrength, height: 14 * snapshot.shaderStrength),
          isEnabled: isEnabled
        )
    case "shader-crt":
      view
        .foregroundStyle(
          ExpoRichTextShaderResources.library.richTextCRTFill(
            .color(tint),
            .float(Float(snapshot.shaderStrength)),
            .float(Float(time))
          )
        )
    case "shader-noise":
      view
        .foregroundStyle(
          ExpoRichTextShaderResources.library.richTextNoiseFill(
            .color(tint),
            .float(Float(snapshot.shaderStrength)),
            .float(Float(time))
          )
        )
    default:
      view
    }
  }

  private func buildText(from segments: [RichTextHostedTextSegment]) -> Text {
    var merged = AttributedString()
    for segment in segments {
      var attributed = segment.attributedText
      if abs(segment.opacity - 1) > 0.0005 {
        var container = AttributeContainer()
        container[RichTextFadeOpacityAttribute.self] = RichTextFadeOpacityAttribute(opacity: segment.opacity)
        attributed.mergeAttributes(container)
      }
      merged.append(attributed)
    }
    return Text(merged)
  }
}

@available(iOS 16.0, *)
private struct RichTextWidthFittingLayout: Layout {
  func sizeThatFits(
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) -> CGSize {
    guard let subview = subviews.first else {
      return .zero
    }

    let idealSize = subview.sizeThatFits(.unspecified)
    let proposedWidth = proposal.width
    let resolvedWidth = proposedWidth ?? idealSize.width
    let measuredHeight = subview.sizeThatFits(
      ProposedViewSize(width: resolvedWidth, height: proposal.height)
    ).height

    return CGSize(
      width: resolvedWidth,
      height: measuredHeight
    )
  }

  func placeSubviews(
    in bounds: CGRect,
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) {
    let childProposal = ProposedViewSize(width: bounds.width, height: bounds.height)
    for subview in subviews {
      subview.place(at: bounds.origin, proposal: childProposal)
    }
  }
}

private enum RichTextSwiftUIAttributedStringBuilder {
  static func buildDocument(
    document: RichTextDocument,
    theme: RichTextTheme,
    renderState: RichTextRenderState?,
    inlineCursor: RichTextInlineCursor?,
    omitsForegroundColor: Bool,
    visibleUnitOrdinals: Set<Int>? = nil
  ) -> [RichTextHostedTextSegment] {
    var result: [RichTextHostedTextSegment] = []
    let blocks = document.blocks.sorted { lhs, rhs in
      lhs.range.start < rhs.range.start
    }
    let unitsBySpanId = Dictionary(
      grouping: document.animationPlan.units.sorted { $0.ordinal < $1.ordinal },
      by: \.spanId
    )

    var renderedAnyBlock = false
    for block in blocks {
      if block.kind == "bullet-list" || block.kind == "ordered-list" {
        continue
      }

      let blockAttributed = buildBlock(
        block: block,
        document: document,
        theme: theme,
        unitsBySpanId: unitsBySpanId,
        renderState: renderState,
        omitsForegroundColor: omitsForegroundColor,
        visibleUnitOrdinals: visibleUnitOrdinals
      )

      guard !blockAttributed.isEmpty else { continue }
      if renderedAnyBlock {
        result.append(RichTextHostedTextSegment(attributedText: AttributedString("\n")))
      }
      result.append(contentsOf: blockAttributed)
      renderedAnyBlock = true
    }

    if let inlineCursor {
      if result.isEmpty {
        result.append(RichTextHostedTextSegment(attributedText: AttributedString("\u{200B}")))
      }
      result.append(cursorAttributedString(inlineCursor))
    }

    return result
  }

  private static func buildBlock(
    block: RichTextDocument.Block,
    document: RichTextDocument,
    theme: RichTextTheme,
    unitsBySpanId: [String: [RichTextDocument.AnimationUnit]],
    renderState: RichTextRenderState?,
    omitsForegroundColor: Bool,
    visibleUnitOrdinals: Set<Int>?
  ) -> [RichTextHostedTextSegment] {
    var result: [RichTextHostedTextSegment] = []

    if block.kind == "blockquote" {
      result.append(
        attributedSegment(
          text: "▍ ",
          font: RichTextAttributedStringBuilder.resolveFont(
            theme.fontFamily,
            size: theme.fontSize,
            monospaced: false
          ),
          color: theme.blockquoteAccentColor ?? UIColor.systemBlue.withAlphaComponent(0.32),
          omitsForegroundColor: omitsForegroundColor
        )
      )
    }

    if block.kind == "list-item" {
      let prefix: String
      if let orderedIndex = block.metadata?.orderedIndex {
        prefix = "\(orderedIndex). "
      } else {
        prefix = "• "
      }
      result.append(
        attributedSegment(
          text: prefix,
          font: RichTextDisplayStyler.fontForSpan(nil, block: block, theme: theme),
          color: theme.textColor,
          omitsForegroundColor: omitsForegroundColor
        )
      )
    }

    let blockSpans = document.spans
      .filter { $0.blockId == block.id }
      .sorted { $0.range.start < $1.range.start }

    for span in blockSpans {
      appendSpan(
        span,
        block: block,
        theme: theme,
        units: unitsBySpanId[span.id] ?? [],
        renderState: renderState,
        omitsForegroundColor: omitsForegroundColor,
        visibleUnitOrdinals: visibleUnitOrdinals,
        to: &result
      )
    }

    return result
  }

  private static func appendSpan(
    _ span: RichTextDocument.Span,
    block: RichTextDocument.Block,
    theme: RichTextTheme,
    units: [RichTextDocument.AnimationUnit],
    renderState: RichTextRenderState?,
    omitsForegroundColor: Bool,
    visibleUnitOrdinals: Set<Int>?,
    to result: inout [RichTextHostedTextSegment]
  ) {
    let visibleUnits =
      visibleUnitOrdinals == nil
        ? units
        : units.filter { visibleUnitOrdinals?.contains($0.ordinal) == true }

    if visibleUnitOrdinals != nil && visibleUnits.isEmpty {
      return
    }

    guard let renderState, !visibleUnits.isEmpty else {
      result.append(
        attributedSegment(
          text: span.text,
          span: span,
          block: block,
          theme: theme,
          color: theme.textColor,
          opacity: 1,
          omitsForegroundColor: omitsForegroundColor
        )
      )
      return
    }

    for unit in visibleUnits where unit.ordinal < renderState.visibleUnitCount {
      let displayText = RichTextDisplayStyler.displayText(
        for: unit,
        renderState: renderState
      )
      let segmentOpacity = RichTextDisplayStyler.segmentOpacity(
        renderState: renderState,
        index: unit.ordinal
      )
      let segmentColor = RichTextDisplayStyler.segmentColor(
        baseColor: theme.textColor,
        renderState: renderState,
        index: unit.ordinal
      )
      let hidden = renderState.hiddenUnitOrdinals.contains(unit.ordinal)
      result.append(
        attributedSegment(
          text: displayText,
          span: span,
          block: block,
          theme: theme,
          color: segmentColor,
          opacity: hidden ? 0.001 : segmentOpacity,
          omitsForegroundColor: omitsForegroundColor
        )
      )
    }
  }

  private static func attributedSegment(
    text: String,
    span: RichTextDocument.Span,
    block: RichTextDocument.Block,
    theme: RichTextTheme,
    color: UIColor,
    opacity: CGFloat,
    omitsForegroundColor: Bool
  ) -> RichTextHostedTextSegment {
    var attributed = AttributedString(text)
    attributed.font = swiftUIFont(
      from: RichTextDisplayStyler.fontForSpan(span, block: block, theme: theme)
    )

    if !omitsForegroundColor {
      // Encode the fade alpha directly into the run color for the standard text
      // path. The renderer-only opacity pass is not reliable here after the
      // SwiftUI hosting refactor, which leaves preview text fully opaque.
      attributed.foregroundColor = Color(
        uiColor: color.withAlphaComponent(opacity)
      )
    }

    if span.kind == "link", let href = span.href, let url = URL(string: href) {
      attributed.link = url
      attributed.underlineStyle = .single
    }

    if span.kind == "strikethrough" {
      attributed.strikethroughStyle = .single
    }

    if span.kind == "code" || block.kind == "code-block" {
      let background = theme.codeBackgroundColor ?? theme.textColor.withAlphaComponent(0.12)
      attributed.backgroundColor = Color(uiColor: background)
    }

    return RichTextHostedTextSegment(
      attributedText: attributed,
      opacity: omitsForegroundColor ? Double(opacity) : 1
    )
  }

  private static func cursorAttributedString(_ cursor: RichTextInlineCursor) -> RichTextHostedTextSegment {
    attributedSegment(
      text: cursor.glyph,
      font: cursor.font,
      color: cursor.color,
      omitsForegroundColor: false
    )
  }

  private static func attributedSegment(
    text: String,
    font: UIFont,
    color: UIColor,
    omitsForegroundColor: Bool
  ) -> RichTextHostedTextSegment {
    var attributed = AttributedString(text)
    attributed.font = swiftUIFont(from: font)
    if !omitsForegroundColor {
      attributed.foregroundColor = Color(uiColor: color)
    }
    return RichTextHostedTextSegment(attributedText: attributed)
  }

  private static func swiftUIFont(from font: UIFont) -> Font {
    Font(font as CTFont)
  }
}

private enum RichTextDisplayStyler {
  private static let matrixCharset = Array("01アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
  private static let neonCharset = Array("@#$%&*+=?<>[]{}\\/|~^!;:-_")
  private static let ghostCharset = Array("·°•∙⋅○◦")

  static func fontForSpan(
    _ span: RichTextDocument.Span?,
    block: RichTextDocument.Block,
    theme: RichTextTheme
  ) -> UIFont {
    let kind = span?.kind ?? "text"
    let isMonospaced = kind == "code" || block.kind == "code-block"
    let baseSize: CGFloat
    let weight: UIFont.Weight

    switch block.kind {
    case "heading":
      switch block.level ?? 1 {
      case 1:
        baseSize = theme.fontSize + 12
        weight = .bold
      case 2:
        baseSize = theme.fontSize + 8
        weight = .bold
      case 3:
        baseSize = theme.fontSize + 4
        weight = kind == "strong" ? .bold : .semibold
      default:
        baseSize = theme.fontSize + 2
        weight = kind == "strong" ? .bold : .semibold
      }
    default:
      baseSize = theme.fontSize
      weight = kind == "strong" ? .semibold : .regular
    }

    let baseFont = RichTextAttributedStringBuilder.resolveFont(
      theme.fontFamily,
      size: isMonospaced ? theme.codeFontSize : baseSize,
      monospaced: isMonospaced
    )
    return styledFont(from: baseFont, weight: weight, italic: kind == "em")
  }

  static func displayText(
    for unit: RichTextDocument.AnimationUnit,
    renderState: RichTextRenderState
  ) -> String {
    switch renderState.shaderPreset {
    case "matrix", "neon", "ghost":
      return scrambledDisplayText(
        text: unit.text,
        preset: renderState.shaderPreset,
        index: unit.ordinal,
        renderState: renderState
      )
    default:
      return unit.text
    }
  }

  static func segmentColor(
    baseColor: UIColor,
    renderState: RichTextRenderState,
    index: Int
  ) -> UIColor {
    guard renderState.shaderPreset != "none",
      renderState.shaderPreset != "smoke",
      renderState.shaderPreset != "disintegrate",
      renderState.shaderPreset != "shader-glow",
      renderState.shaderPreset != "shader-wave",
      renderState.shaderPreset != "shader-crt",
      renderState.shaderPreset != "shader-noise"
    else {
      return baseColor
    }

    let distanceFromHead = max(0, renderState.visibleUnitCount - index - 1)
    guard distanceFromHead < renderState.tailLength else {
      return baseColor
    }

    let tailProgress =
      CGFloat(renderState.tailLength - distanceFromHead) /
      CGFloat(max(renderState.tailLength, 1))
    let revealTime = index < renderState.revealTimes.count ? renderState.revealTimes[index] : 0
    let effectDecaySeconds = RichTextAttributedStringBuilder.resolveEffectDecaySeconds(
      renderState: renderState
    )
    let effectAge =
      revealTime > 0
        ? min(max((renderState.now - revealTime) / effectDecaySeconds, 0), 1)
        : 1
    let styledColor = effectStyledColor(
      baseColor: baseColor,
      customEffectColor: renderState.effectColor,
      effectPreset: renderState.shaderPreset,
      tailProgress: tailProgress,
      effectAge: CGFloat(effectAge)
    )
    return styledColor
  }

  private static func styledFont(
    from font: UIFont,
    weight: UIFont.Weight,
    italic: Bool
  ) -> UIFont {
    var traits = font.fontDescriptor.symbolicTraits
    if italic {
      traits.insert(.traitItalic)
    }
    if weight >= .semibold {
      traits.insert(.traitBold)
    }

    let descriptor = font.fontDescriptor.addingAttributes([
      UIFontDescriptor.AttributeName.traits: [
        UIFontDescriptor.TraitKey.weight: weight,
      ],
    ])

    if let withTraits = descriptor.withSymbolicTraits(traits) {
      return UIFont(descriptor: withTraits, size: font.pointSize)
    }

    if italic, let italicDescriptor = descriptor.withSymbolicTraits(.traitItalic) {
      return UIFont(descriptor: italicDescriptor, size: font.pointSize)
    }

    return UIFont(descriptor: descriptor, size: font.pointSize)
  }

  static func segmentOpacity(
    renderState: RichTextRenderState,
    index: Int
  ) -> CGFloat {
    guard renderState.fadeDurationMs > 0 else { return 1 }
    guard index < renderState.revealTimes.count else { return 1 }
    let revealTime = renderState.revealTimes[index]
    guard revealTime > 0 else { return 1 }

    let fadeDurationSeconds = renderState.fadeDurationMs / 1_000
    let progress = max(0, min((renderState.now - revealTime) / fadeDurationSeconds, 1))
    let easedProgress = pow(progress, 2.1)
    let baseAlpha =
      renderState.fadeStartOpacity
      + (1 - renderState.fadeStartOpacity) * CGFloat(easedProgress)
    return baseAlpha
  }

  private static func scrambledDisplayText(
    text: String,
    preset: String,
    index: Int,
    renderState: RichTextRenderState
  ) -> String {
    guard index < renderState.revealTimes.count else { return text }
    let revealTime = renderState.revealTimes[index]
    guard revealTime > 0 else { return text }

    let effectAge = min(
      max(
        (renderState.now - revealTime)
          / RichTextAttributedStringBuilder.resolveEffectDecaySeconds(renderState: renderState),
        0
      ),
      1
    )
    guard effectAge < 0.999 else { return text }

    let charset: [Character]
    switch preset {
    case "matrix":
      charset = matrixCharset
    case "neon":
      charset = neonCharset
    case "ghost":
      charset = ghostCharset
    default:
      return text
    }

    let phase = Int(floor(renderState.now * 24)) + (index * 17)
    let characters = Array(text)
    if characters.isEmpty { return text }

    var result = ""
    for (offset, character) in characters.enumerated() {
      if character.isWhitespace || character.isNewline {
        result.append(character)
        continue
      }

      let normalizedOffset = CGFloat(offset + 1) / CGFloat(max(characters.count, 1))
      let lockThreshold = min(0.98, effectAge + (normalizedOffset * 0.32))
      if lockThreshold >= 0.995 {
        result.append(character)
        continue
      }

      let isPunctuation = character.unicodeScalars.allSatisfy {
        CharacterSet.alphanumerics.inverted.contains($0)
      }
      if isPunctuation && preset != "ghost" {
        result.append(character)
        continue
      }

      let scrambleIndex = abs((phase * 31) + (offset * 13) + (index * 7)) % charset.count
      let scrambleCharacter = charset[scrambleIndex]
      let settleCutoff = CGFloat(offset + 1) / CGFloat(max(characters.count + 1, 1))
      result.append(effectAge > settleCutoff ? character : scrambleCharacter)
    }

    return result
  }

  private static func effectStyledColor(
    baseColor: UIColor,
    customEffectColor: UIColor?,
    effectPreset: String,
    tailProgress: CGFloat,
    effectAge: CGFloat
  ) -> UIColor {
    let accentColor = resolveAccentColor(
      effectPreset: effectPreset,
      customEffectColor: customEffectColor,
      tailProgress: tailProgress
    )

    switch effectPreset {
    case "ember":
      let headIntensity = 0.45 + 0.45 * tailProgress
      let mixAmount = max(0.22, min(0.96, (1 - effectAge) * headIntensity))
      let brightnessLift = max(0.04, min(0.18, (1 - effectAge) * (0.08 + 0.10 * tailProgress)))
      return liftBrightness(
        color: mix(baseColor: baseColor, accentColor: accentColor, amount: mixAmount),
        amount: brightnessLift
      )
    case "matrix":
      let mixAmount = max(0.30, min(0.92, (1 - effectAge) * (0.52 + 0.34 * tailProgress)))
      let brightnessLift = max(0.06, min(0.20, (1 - effectAge) * (0.10 + 0.08 * tailProgress)))
      return liftBrightness(
        color: mix(baseColor: baseColor, accentColor: accentColor, amount: mixAmount),
        amount: brightnessLift
      )
    case "neon":
      let mixAmount = max(0.26, min(0.95, (1 - effectAge) * (0.46 + 0.38 * tailProgress)))
      let brightnessLift = max(0.05, min(0.22, (1 - effectAge) * (0.12 + 0.10 * tailProgress)))
      return liftBrightness(
        color: mix(baseColor: baseColor, accentColor: accentColor, amount: mixAmount),
        amount: brightnessLift
      )
    case "ghost":
      let mixAmount = max(0.18, min(0.72, (1 - effectAge) * (0.30 + 0.26 * tailProgress)))
      let brightnessLift = max(0.03, min(0.12, (1 - effectAge) * (0.06 + 0.05 * tailProgress)))
      return liftBrightness(
        color: mix(baseColor: baseColor, accentColor: accentColor, amount: mixAmount),
        amount: brightnessLift
      )
    default:
      return baseColor
    }
  }

  private static func resolveAccentColor(
    effectPreset: String,
    customEffectColor: UIColor?,
    tailProgress: CGFloat
  ) -> UIColor {
    if let customEffectColor {
      return customEffectColor
    }

    switch effectPreset {
    case "ember":
      return UIColor(
        red: 1.0,
        green: 0.40 + 0.40 * tailProgress,
        blue: 0.08 + 0.08 * tailProgress,
        alpha: 1
      )
    case "matrix":
      return UIColor(
        red: 0.22 + 0.18 * tailProgress,
        green: 0.95 + 0.05 * tailProgress,
        blue: 0.28 + 0.18 * tailProgress,
        alpha: 1
      )
    case "neon":
      return UIColor(
        red: 0.12 + 0.10 * tailProgress,
        green: 0.78 + 0.16 * tailProgress,
        blue: 1.0,
        alpha: 1
      )
    case "ghost":
      return UIColor(
        red: 0.82 + 0.08 * tailProgress,
        green: 0.88 + 0.07 * tailProgress,
        blue: 1.0,
        alpha: 1
      )
    default:
      return baseColorFallback
    }
  }

  private static var baseColorFallback: UIColor {
    UIColor(red: 0.95, green: 0.95, blue: 0.98, alpha: 1)
  }

  private static func mix(
    baseColor: UIColor,
    accentColor: UIColor,
    amount: CGFloat
  ) -> UIColor {
    let clamped = max(0, min(amount, 1))
    let base = rgbaComponents(of: baseColor)
    let accent = rgbaComponents(of: accentColor)
    return UIColor(
      red: base.red + (accent.red - base.red) * clamped,
      green: base.green + (accent.green - base.green) * clamped,
      blue: base.blue + (accent.blue - base.blue) * clamped,
      alpha: base.alpha + (accent.alpha - base.alpha) * clamped
    )
  }

  private static func liftBrightness(color: UIColor, amount: CGFloat) -> UIColor {
    let clamped = max(0, min(amount, 1))
    let components = rgbaComponents(of: color)
    return UIColor(
      red: components.red + (1 - components.red) * clamped,
      green: components.green + (1 - components.green) * clamped,
      blue: components.blue + (1 - components.blue) * clamped,
      alpha: components.alpha
    )
  }

  private static func rgbaComponents(of color: UIColor) -> (
    red: CGFloat,
    green: CGFloat,
    blue: CGFloat,
    alpha: CGFloat
  ) {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    var alpha: CGFloat = 0
    if color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) {
      return (red, green, blue, alpha)
    }

    let converted = color.cgColor.converted(
      to: CGColorSpace(name: CGColorSpace.sRGB) ?? color.cgColor.colorSpace ?? CGColorSpaceCreateDeviceRGB(),
      intent: .defaultIntent,
      options: nil
    )
    let components = converted?.components ?? color.cgColor.components ?? [1, 1, 1, 1]
    if components.count >= 4 {
      return (components[0], components[1], components[2], components[3])
    }
    if components.count == 2 {
      return (components[0], components[0], components[0], components[1])
    }
    return (1, 1, 1, 1)
  }
}
