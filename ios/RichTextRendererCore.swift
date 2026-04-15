import CoreGraphics
import Foundation

final class RichTextRendererCore {
  private let renderSession = RichTextRenderSession()

  func resetForNewItem(now: CFTimeInterval) {
    renderSession.resetForNewItem(now: now)
  }

  @discardableResult
  func applyDocumentJson(
    _ json: String,
    isStreaming: Bool,
    now: CFTimeInterval
  ) -> Bool {
    renderSession.applyReset(
      document: RichTextDocumentDecoder.decodeOrFallback(json: json),
      isStreaming: isStreaming,
      now: now
    )
  }

  @discardableResult
  func applyUpdateJson(_ json: String, now: CFTimeInterval) -> Bool {
    switch RichTextIncrementalUpdateDecoder.decode(json: json) {
    case .success(let payload):
      switch payload {
      case .reset(let generation, let document, let isStreaming):
        return renderSession.applyReset(
          document: document,
          isStreaming: isStreaming,
          generation: generation,
          now: now
        )
      case .append(let appendPayload):
        return renderSession.applyAppend(update: appendPayload, now: now)
      case .replace(let replacePayload):
        return renderSession.applyReplace(update: replacePayload, now: now)
      }

    case .failure(let failure):
      NSLog(
        "[ExpoRichText] incremental-update-decode-failed failureClass=%@ reason=%@",
        failure.failureClass.rawValue,
        failure.reason
      )
      return false
    }
  }

  func updateSettings(
    theme: RichTextTheme,
    settings: RichTextRenderSessionSettings,
    now: CFTimeInterval
  ) {
    renderSession.updateSettings(theme: theme, animation: settings, now: now)
  }

  func tick(now: CFTimeInterval) {
    renderSession.tick(now: now)
  }
  func makeSnapshot(now: CFTimeInterval) -> RichTextRenderSnapshot {
    renderSession.makeSnapshot(now: now)
  }
}
