import Foundation
import UIKit

struct RichTextRenderState {
  let visibleUnitCount: Int
  let revealTimes: [CFTimeInterval]
  let now: CFTimeInterval
  let fadeDurationMs: Double
  let fadeStartOpacity: CGFloat
  let effectColor: UIColor?
  let revealPreset: String
  let shaderPreset: String
  let shaderStrength: CGFloat
  let tailLength: Int
  let hiddenUnitOrdinals: Set<Int>
}

struct RichTextTheme {
  let fontFamily: String
  let fontSize: CGFloat
  let lineHeight: CGFloat
  let codeFontSize: CGFloat
  let textColor: UIColor
  let blockquoteAccentColor: UIColor?
  let codeBackgroundColor: UIColor?
}

struct RichTextAttributedStringBuilder {
  static func resolveFont(_ family: String, size: CGFloat, monospaced: Bool) -> UIFont {
    let trimmedFamily = family.trimmingCharacters(in: .whitespacesAndNewlines)
    if monospaced {
      return UIFont.monospacedSystemFont(ofSize: size, weight: .regular)
    }
    if trimmedFamily.isEmpty || trimmedFamily.caseInsensitiveCompare("System") == .orderedSame {
      return UIFont.systemFont(ofSize: size, weight: .regular)
    }
    if let customFont = UIFont(name: trimmedFamily, size: size) {
      return customFont
    }
    return UIFont.systemFont(ofSize: size, weight: .regular)
  }

  static func resolveEffectDecaySeconds(
    effectPreset: String,
    fadeDurationMs: Double
  ) -> CFTimeInterval {
    let baseFadeSeconds = max(fadeDurationMs / 1_000, 0.001)
    switch effectPreset {
    case "ember":
      return max(0.65, min(1.8, baseFadeSeconds * 2.75))
    case "matrix":
      return max(0.85, min(2.2, baseFadeSeconds * 3.25))
    case "neon":
      return max(0.55, min(1.4, baseFadeSeconds * 2.0))
    case "ghost":
      return max(0.9, min(2.4, baseFadeSeconds * 3.6))
    case "smoke":
      return max(1.1, min(2.8, baseFadeSeconds * 4.0))
    case "disintegrate":
      return max(0.8, min(2.1, baseFadeSeconds * 3.0))
    default:
      return baseFadeSeconds
    }
  }

  static func resolveEffectDecaySeconds(
    renderState: RichTextRenderState
  ) -> CFTimeInterval {
    resolveEffectDecaySeconds(
      effectPreset: renderState.shaderPreset,
      fadeDurationMs: renderState.fadeDurationMs
    )
  }
}
