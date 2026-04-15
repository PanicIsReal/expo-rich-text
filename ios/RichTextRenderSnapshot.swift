import CoreGraphics
import Foundation

struct RichTextRenderSessionSettings: Equatable {
  var animationMode = "static"
  var isStreaming = false
  var revealIntervalMs: Double = 96
  var revealUnitsPerStep = 2
  var fadeDurationMs: Double = 180
  var fadeStartOpacity: CGFloat = 0.22
  var revealPreset = "fade-trail"
  var shaderPreset = "none"
  var shaderStrength: CGFloat = 1
  var cursorEnabled = true
  var cursorGlyph = "▍"
  var tailLength = 4
  var smoothReveal = false
  var smoothNewLine = false
}

struct RichTextRenderSnapshot {
  let document: RichTextDocument
  let renderState: RichTextRenderState?
  let revealedUnitCount: Int
  let visibleText: String
  let visibleEndUtf16Offset: Int
  let playbackPhase: RichTextPlaybackPhase
  let revealActive: Bool
  let activeOverlayUnitOrdinals: Set<Int>
  let hiddenOverlayUnitOrdinals: Set<Int>
  let usesSmoothCursorLayer: Bool
  let shouldShowInlineCursor: Bool
  let shouldShowSmoothCursorLayer: Bool
  let requiresRevealTimer: Bool
  let revealTimerInterval: TimeInterval?
  let requiresVisualEffectTimer: Bool

  var visibleCharacterCount: Int {
    visibleText.count
  }
}
