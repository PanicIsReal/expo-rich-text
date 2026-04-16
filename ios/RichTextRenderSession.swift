import CoreGraphics
import Foundation
import UIKit

struct RichTextAppendPayload {
  let generation: Int
  let appendFromUtf16: Int
  let appendedText: String
  let appendedBlocks: [RichTextDocument.Block]
  let appendedSpans: [RichTextDocument.Span]
  let appendedUnits: [RichTextDocument.AnimationUnit]
  let isStreaming: Bool
}

struct RichTextReplacePayload {
  let generation: Int
  let preservedPrefixUtf16: Int
  let document: RichTextDocument
  let isStreaming: Bool
}

final class RichTextRenderSession {
  private(set) var document = RichTextDocument(
    id: "empty",
    version: RichTextDocument.supportedVersion,
    source: .init(kind: "plain", text: ""),
    blocks: [],
    spans: [],
    animationPlan: .init(mode: "static", units: [])
  )
  private(set) var theme = RichTextTheme(
    fontFamily: "Menlo",
    fontSize: 17,
    lineHeight: 22,
    codeFontSize: 15,
    textColor: .label,
    blockquoteAccentColor: nil,
    codeBackgroundColor: nil
  )
  private(set) var settings = RichTextRenderSessionSettings()

  private var lastAppliedGeneration = 0
  private var unitRevealTimes: [CFTimeInterval] = []
  private var revealedUnitCount = 0

  func resetForNewItem(now: CFTimeInterval) {
    resetProgressState()
    lastAppliedGeneration = 0
  }

  func updateDocument(
    document nextDocument: RichTextDocument,
    isStreaming: Bool,
    now: CFTimeInterval
  ) {
    _ = applyReset(
      document: nextDocument,
      isStreaming: isStreaming,
      now: now
    )
  }

  @discardableResult
  func applyReset(
    document nextDocument: RichTextDocument,
    isStreaming: Bool,
    generation: Int? = nil,
    now: CFTimeInterval
  ) -> Bool {
    let nextGeneration = generation ?? (lastAppliedGeneration + 1)
    guard nextGeneration > lastAppliedGeneration else {
      return false
    }

    let previousText = document.source.text
    document = nextDocument
    settings.isStreaming = isStreaming
    lastAppliedGeneration = nextGeneration

    let didAppend =
      !previousText.isEmpty &&
      nextDocument.source.text.hasPrefix(previousText)
    recalculateRevealState(resetProgress: !didAppend, now: now)
    return true
  }

  @discardableResult
  func applyAppend(
    update: RichTextAppendPayload,
    now: CFTimeInterval
  ) -> Bool {
    guard update.generation > lastAppliedGeneration else {
      return false
    }

    let currentSourceLength = utf16Length(document.source.text)
    guard update.appendFromUtf16 >= 0, update.appendFromUtf16 <= currentSourceLength else {
      return false
    }

    let prefixBlocks = document.blocks.filter { $0.range.end <= update.appendFromUtf16 }
    let prefixSpans = document.spans.filter { $0.range.end <= update.appendFromUtf16 }
    let prefixUnits = document.animationPlan.units.filter { $0.range.end <= update.appendFromUtf16 }

    if update.appendedBlocks.contains(where: { $0.range.start < update.appendFromUtf16 }) ||
      update.appendedSpans.contains(where: { $0.range.start < update.appendFromUtf16 }) ||
      update.appendedUnits.contains(where: { $0.range.start < update.appendFromUtf16 })
    {
      return false
    }

    let nextText = utf16Prefix(document.source.text, length: update.appendFromUtf16) + update.appendedText
    let nextAnimationMode =
      update.appendedUnits.isEmpty && prefixUnits.isEmpty
        ? settings.animationMode
        : document.animationPlan.mode

    document = RichTextDocument(
      id: document.id,
      version: RichTextDocument.supportedVersion,
      source: .init(kind: document.source.kind, text: nextText),
      blocks: prefixBlocks + update.appendedBlocks,
      spans: prefixSpans + update.appendedSpans,
      animationPlan: .init(
        mode: nextAnimationMode,
        units: prefixUnits + update.appendedUnits
      )
    )
    settings.isStreaming = update.isStreaming
    lastAppliedGeneration = update.generation
    recalculateRevealState(resetProgress: false, now: now)
    return true
  }

  @discardableResult
  func applyReplace(
    update: RichTextReplacePayload,
    now: CFTimeInterval
  ) -> Bool {
    guard update.generation > lastAppliedGeneration else {
      return false
    }

    let previousVisibleEndUtf16Offset = currentVisibleEndUtf16Offset(
      visibleUnitCount: min(revealedUnitCount, document.animationPlan.units.count),
      visibleText: currentVisibleText(
        visibleUnitCount: min(revealedUnitCount, document.animationPlan.units.count)
      )
    )
    let previousRevealTimes = unitRevealTimes

    document = update.document
    settings.isStreaming = update.isStreaming
    lastAppliedGeneration = update.generation

    let preservedPrefixUtf16 = max(
      0,
      min(update.preservedPrefixUtf16, previousVisibleEndUtf16Offset)
    )
    restorePreservedProgress(
      preservedPrefixUtf16: preservedPrefixUtf16,
      previousRevealTimes: previousRevealTimes,
      now: now
    )
    return true
  }

  func updateSettings(
    theme nextTheme: RichTextTheme,
    animation nextSettings: RichTextRenderSessionSettings,
    now: CFTimeInterval
  ) {
    let previousSettings = settings
    theme = nextTheme
    settings = nextSettings

    // Reveal progress is only ever reset through itemId change (which flows
    // through `resetForNewItem`) or through `applyReset` when the new document
    // text is not a prefix extension of the current one. Settings transitions
    // — including isStreaming flipping back to true mid-stream — must preserve
    // the current reveal position so a transient prop oscillation cannot wipe
    // the animation back to zero halfway through a response.
    if previousSettings.animationMode != nextSettings.animationMode
      || previousSettings.isStreaming != nextSettings.isStreaming
      || previousSettings.revealUnitsPerStep != nextSettings.revealUnitsPerStep {
      recalculateRevealState(resetProgress: false, now: now)
    }
  }

  func tick(now: CFTimeInterval) {
    guard shouldAdvanceReveal else { return }
    let totalUnits = document.animationPlan.units.count
    let nextCount = min(totalUnits, revealedUnitCount + settings.revealUnitsPerStep)
    markRevealTimes(from: revealedUnitCount, to: nextCount, now: now)
    revealedUnitCount = nextCount
  }

  func makeSnapshot(now: CFTimeInterval) -> RichTextRenderSnapshot {
    let totalUnits = document.animationPlan.units.count
    let visibleUnitCount = min(revealedUnitCount, totalUnits)
    let hiddenOverlayUnitOrdinals = concealedOverlayUnitOrdinals(now: now)
    let activeOverlayUnitOrdinals = activeOverlayUnitOrdinals(now: now)
    let revealTimerRequired = shouldAdvanceReveal
    let visualEffectsActive = hasActiveVisualEffects(
      now: now,
      activeOverlayUnitOrdinals: activeOverlayUnitOrdinals
    )
    let revealActive = revealTimerRequired || visualEffectsActive
    let visibleText = currentVisibleText(visibleUnitCount: visibleUnitCount)
    let visibleEndUtf16Offset = currentVisibleEndUtf16Offset(
      visibleUnitCount: visibleUnitCount,
      visibleText: visibleText
    )
    let playbackPhase = resolvePlaybackPhase(
      revealActive: revealActive,
      visibleUnitCount: visibleUnitCount,
      visibleText: visibleText
    )
    let renderState =
      settings.animationMode == "static"
        ? nil
        : RichTextRenderState(
            visibleUnitCount: visibleUnitCount,
            revealTimes: unitRevealTimes,
            now: now,
            fadeDurationMs: settings.fadeDurationMs,
            fadeStartOpacity: settings.fadeStartOpacity,
            effectColor: nil,
            revealPreset: settings.revealPreset,
            shaderPreset: settings.shaderPreset,
            shaderStrength: settings.shaderStrength,
            tailLength: settings.tailLength,
            hiddenUnitOrdinals: hiddenOverlayUnitOrdinals
          )

    return RichTextRenderSnapshot(
      document: document,
      renderState: renderState,
      revealedUnitCount: visibleUnitCount,
      visibleText: visibleText,
      visibleEndUtf16Offset: visibleEndUtf16Offset,
      playbackPhase: playbackPhase,
      revealActive: revealActive,
      activeOverlayUnitOrdinals: activeOverlayUnitOrdinals,
      hiddenOverlayUnitOrdinals: hiddenOverlayUnitOrdinals,
      usesSmoothCursorLayer: usesSmoothCursorLayer,
      shouldShowInlineCursor: shouldShowInlineCursor(revealActive: revealActive),
      shouldShowSmoothCursorLayer: shouldShowSmoothCursorLayer(revealActive: revealActive),
      requiresRevealTimer: revealTimerRequired,
      revealTimerInterval: revealTimerRequired
        ? max(0.016, settings.revealIntervalMs / 1_000)
        : nil,
      requiresVisualEffectTimer: visualEffectsActive
    )
  }

  private var shouldAdvanceReveal: Bool {
    settings.animationMode != "static" &&
      document.animationPlan.units.count > 0 &&
      revealedUnitCount < document.animationPlan.units.count
  }

  private var usesSmoothCursorLayer: Bool {
    settings.cursorEnabled &&
      settings.animationMode != "static" &&
      (settings.smoothReveal || settings.smoothNewLine || effectUsesOverlay)
  }

  private func shouldShowInlineCursor(revealActive: Bool) -> Bool {
    settings.cursorEnabled &&
      settings.animationMode != "static" &&
      !usesSmoothCursorLayer &&
      (revealActive || settings.isStreaming)
  }

  private func shouldShowSmoothCursorLayer(revealActive: Bool) -> Bool {
    usesSmoothCursorLayer &&
      settings.cursorEnabled &&
      settings.animationMode != "static" &&
      (revealActive || settings.isStreaming)
  }

  private func recalculateRevealState(resetProgress: Bool, now: CFTimeInterval) {
    let totalUnits = document.animationPlan.units.count

    if resetProgress {
      resetProgressState()
    }

    syncRevealTimes(to: totalUnits)

    guard settings.animationMode != "static", totalUnits > 0 else {
      revealedUnitCount = totalUnits
      markRevealTimes(from: 0, to: totalUnits, now: now)
      return
    }

    if !settings.isStreaming {
      if revealedUnitCount == 0 {
        revealedUnitCount = totalUnits
        markRevealTimes(from: 0, to: totalUnits, now: now)
      }
      return
    }

    revealedUnitCount = min(revealedUnitCount, totalUnits)
    if revealedUnitCount <= 0 {
      let nextCount = min(totalUnits, max(1, settings.revealUnitsPerStep))
      markRevealTimes(from: 0, to: nextCount, now: now)
      revealedUnitCount = nextCount
    }
  }

  private func restorePreservedProgress(
    preservedPrefixUtf16: Int,
    previousRevealTimes: [CFTimeInterval],
    now: CFTimeInterval
  ) {
    let totalUnits = document.animationPlan.units.count
    let preservedUnitCount = document.animationPlan.units.prefix {
      $0.range.end <= preservedPrefixUtf16
    }.count

    unitRevealTimes = Array(previousRevealTimes.prefix(preservedUnitCount))
    syncRevealTimes(to: totalUnits)
    revealedUnitCount = min(preservedUnitCount, totalUnits)

    guard settings.animationMode != "static", totalUnits > 0 else {
      revealedUnitCount = totalUnits
      markRevealTimes(from: 0, to: totalUnits, now: now)
      return
    }

    if !settings.isStreaming {
      let previousCount = revealedUnitCount
      revealedUnitCount = totalUnits
      markRevealTimes(from: previousCount, to: totalUnits, now: now)
      return
    }

    if revealedUnitCount <= 0 {
      let nextCount = min(totalUnits, max(1, settings.revealUnitsPerStep))
      markRevealTimes(from: 0, to: nextCount, now: now)
      revealedUnitCount = nextCount
    }
  }

  private func resetProgressState() {
    unitRevealTimes = []
    revealedUnitCount = 0
  }

  private func syncRevealTimes(to targetCount: Int) {
    if unitRevealTimes.count > targetCount {
      unitRevealTimes = Array(unitRevealTimes.prefix(targetCount))
      return
    }

    if unitRevealTimes.count < targetCount {
      unitRevealTimes.append(
        contentsOf: Array(repeating: 0, count: targetCount - unitRevealTimes.count)
      )
    }
  }

  private func markRevealTimes(from start: Int, to end: Int, now: CFTimeInterval) {
    guard end > start, !unitRevealTimes.isEmpty else { return }
    let lowerBound = max(0, start)
    let upperBound = min(end, unitRevealTimes.count)
    guard lowerBound < upperBound else { return }

    for index in lowerBound..<upperBound where unitRevealTimes[index] <= 0 {
      unitRevealTimes[index] = now
    }
  }

  private func activeOverlayUnitOrdinals(now: CFTimeInterval) -> Set<Int> {
    guard effectUsesOverlay else { return [] }

    let visibleCount = min(revealedUnitCount, document.animationPlan.units.count)
    guard visibleCount > 0 else { return [] }

    let settleDuration = settleDurationSeconds
    guard settleDuration > 0 else { return [] }

    var ordinals = Set<Int>()
    for index in 0..<min(visibleCount, unitRevealTimes.count) {
      let revealTime = unitRevealTimes[index]
      guard revealTime > 0 else { continue }
      if now - revealTime < settleDuration {
        ordinals.insert(index)
      }
    }
    return ordinals
  }

  private func concealedOverlayUnitOrdinals(now: CFTimeInterval) -> Set<Int> {
    guard effectUsesOverlay else { return [] }

    let visibleCount = min(revealedUnitCount, document.animationPlan.units.count)
    guard visibleCount > 0 else { return [] }

    let concealDuration = concealDurationSeconds
    guard concealDuration > 0 else { return [] }

    var ordinals: [Int] = []
    for index in 0..<min(visibleCount, unitRevealTimes.count) {
      let revealTime = unitRevealTimes[index]
      guard revealTime > 0 else { continue }
      if now - revealTime < concealDuration {
        ordinals.append(index)
      }
    }

    let concealedTail = ordinals.suffix(max(1, min(settings.tailLength, 4)))
    return Set(concealedTail)
  }

  private func hasActiveVisualEffects(
    now: CFTimeInterval,
    activeOverlayUnitOrdinals: Set<Int>
  ) -> Bool {
    if effectUsesOverlay {
      return !activeOverlayUnitOrdinals.isEmpty
    }

    guard revealedUnitCount > 0 else { return false }
    let settleDuration = settleDurationSeconds
    guard settleDuration > 0 else { return false }

    for index in 0..<min(revealedUnitCount, unitRevealTimes.count) {
      let revealTime = unitRevealTimes[index]
      if revealTime > 0, now - revealTime < settleDuration {
        return true
      }
    }
    return false
  }

  private func resolvePlaybackPhase(
    revealActive: Bool,
    visibleUnitCount: Int,
    visibleText: String
  ) -> RichTextPlaybackPhase {
    let totalUnits = document.animationPlan.units.count

    if totalUnits == 0 && visibleText.isEmpty {
      return .idle
    }

    if settings.animationMode == "static" {
      return visibleText.isEmpty ? .idle : .settled
    }

    if revealActive {
      return visibleUnitCount < totalUnits ? .revealing : .settling
    }

    if visibleUnitCount < totalUnits {
      return .idle
    }

    return .settled
  }

  private func currentVisibleText(visibleUnitCount: Int) -> String {
    guard settings.animationMode != "static" else {
      return document.source.text
    }
    return document.animationPlan.units.prefix(visibleUnitCount).map(\.text).joined()
  }

  private func currentVisibleEndUtf16Offset(
    visibleUnitCount: Int,
    visibleText: String
  ) -> Int {
    let sourceLength = utf16Length(document.source.text)
    guard settings.animationMode != "static",
      document.animationPlan.mode != "static",
      !document.animationPlan.units.isEmpty
    else {
      return visibleText.isEmpty ? 0 : sourceLength
    }

    guard visibleUnitCount > 0 else { return 0 }
    let lastVisibleIndex = min(visibleUnitCount, document.animationPlan.units.count) - 1
    return max(
      0,
      min(document.animationPlan.units[lastVisibleIndex].range.end, sourceLength)
    )
  }

  private var effectUsesOverlay: Bool {
    switch settings.shaderPreset {
    case "smoke", "disintegrate":
      return true
    default:
      return false
    }
  }

  private var settleDurationSeconds: CFTimeInterval {
    let decayPreset = settings.shaderPreset == "none"
      ? settings.revealPreset
      : settings.shaderPreset
    return RichTextAttributedStringBuilder.resolveEffectDecaySeconds(
      effectPreset: decayPreset,
      fadeDurationMs: settings.fadeDurationMs
    )
  }

  private var concealDurationSeconds: CFTimeInterval {
    let settleDuration = settleDurationSeconds
    switch settings.shaderPreset {
    case "smoke":
      return max(0.08, min(0.22, settleDuration * 0.24))
    case "disintegrate":
      return max(0.05, min(0.16, settleDuration * 0.18))
    default:
      return 0
    }
  }

  private func utf16Length(_ text: String) -> Int {
    (text as NSString).length
  }

  private func utf16Prefix(_ text: String, length: Int) -> String {
    (text as NSString).substring(to: max(0, min(length, utf16Length(text))))
  }
}
