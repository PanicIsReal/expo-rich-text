import Foundation

enum RichTextDocumentDecodeFailureClass: String {
  case invalidUTF8 = "invalid-utf8"
  case invalidJSON = "invalid-json"
  case unsupportedVersion = "unsupported-version"
  case invalidRange = "invalid-range"
}

struct RichTextDocumentDecodeFailure: Error {
  let failureClass: RichTextDocumentDecodeFailureClass
  let fixtureName: String?
  let documentVersion: Int?
  let reason: String
}

enum RichTextDocumentDecoder {
  static func decode(
    json: String,
    fixtureName: String? = nil
  ) -> Result<RichTextDocument, RichTextDocumentDecodeFailure> {
    guard let data = json.data(using: .utf8) else {
      let failure = RichTextDocumentDecodeFailure(
        failureClass: .invalidUTF8,
        fixtureName: fixtureName,
        documentVersion: nil,
        reason: "Unable to encode JSON string as UTF-8"
      )
      return .failure(failure)
    }

    do {
      return .success(try JSONDecoder().decode(RichTextDocument.self, from: data))
    } catch let error as RichTextDocumentContractError {
      return .failure(
        RichTextDocumentDecodeFailure(
          failureClass: error.failureClass,
          fixtureName: fixtureName,
          documentVersion: extractDocumentVersion(from: data),
          reason: String(describing: error)
        )
      )
    } catch {
      return .failure(
        RichTextDocumentDecodeFailure(
          failureClass: .invalidJSON,
          fixtureName: fixtureName,
          documentVersion: extractDocumentVersion(from: data),
          reason: error.localizedDescription
        )
      )
    }
  }

  static func decodeOrFallback(
    json: String,
    fallbackText: String = "",
    fixtureName: String? = nil
  ) -> RichTextDocument {
    switch decode(json: json, fixtureName: fixtureName) {
    case .success(let document):
      return document
    case .failure(let failure):
      logDecodeFailure(failure)
      return emptyFallbackDocument(text: fallbackText)
    }
  }

  static func emptyFallbackDocument(text: String = "") -> RichTextDocument {
    RichTextDocument(
      id: "fallback",
      version: RichTextDocument.supportedVersion,
      source: .init(kind: "plain", text: text),
      blocks: [],
      spans: [],
      animationPlan: .init(mode: "static", units: [])
    )
  }

  private static func logDecodeFailure(_ failure: RichTextDocumentDecodeFailure) {
    NSLog(
      "[ExpoRichText] document-decode-failed failureClass=%@ version=%@ fixture=%@ reason=%@",
      failure.failureClass.rawValue,
      failure.documentVersion.map(String.init) ?? "unknown",
      failure.fixtureName ?? "runtime",
      failure.reason
    )
  }

  private static func extractDocumentVersion(from data: Data) -> Int? {
    guard
      let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let version = raw["version"] as? Int
    else {
      return nil
    }
    return version
  }
}
