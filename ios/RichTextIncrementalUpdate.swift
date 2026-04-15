import Foundation

enum RichTextIncrementalUpdateFailureClass: String {
  case invalidJSON = "invalid-json"
  case unsupportedVersion = "unsupported-version"
  case invalidKind = "invalid-kind"
  case missingField = "missing-field"
  case invalidDocument = "invalid-document"
  case invalidArrayPayload = "invalid-array-payload"
}

struct RichTextIncrementalUpdateFailure: Error {
  let failureClass: RichTextIncrementalUpdateFailureClass
  let reason: String
}

enum RichTextIncrementalUpdate {
  case reset(generation: Int, document: RichTextDocument, isStreaming: Bool)
  case append(RichTextAppendPayload)
  case replace(RichTextReplacePayload)
}

enum RichTextIncrementalUpdateDecoder {
  private static let supportedVersions: Set<Int> = [1, 2]

  private struct RawPayload: Decodable {
    let version: Int
    let kind: String
    let generation: Int
    let documentJson: String?
    let preservedPrefixUtf16: Int?
    let appendFromUtf16: Int?
    let appendedText: String?
    let appendedBlocksJson: String?
    let appendedSpansJson: String?
    let appendedUnitsJson: String?
    let isStreaming: Bool
  }

  static func decode(json: String) -> Result<RichTextIncrementalUpdate, RichTextIncrementalUpdateFailure> {
    guard let data = json.data(using: .utf8) else {
      return .failure(
        RichTextIncrementalUpdateFailure(
          failureClass: .invalidJSON,
          reason: "Unable to encode update JSON as UTF-8"
        )
      )
    }

    do {
      let payload = try JSONDecoder().decode(RawPayload.self, from: data)
      guard supportedVersions.contains(payload.version) else {
        return .failure(
          RichTextIncrementalUpdateFailure(
            failureClass: .unsupportedVersion,
            reason: "Unsupported update version \(payload.version)"
          )
        )
      }

      switch payload.kind {
      case "reset":
        guard let documentJson = payload.documentJson else {
          return .failure(missingField("documentJson"))
        }

        switch RichTextDocumentDecoder.decode(json: documentJson, fixtureName: "incremental-reset") {
        case .success(let document):
          return .success(
            .reset(
              generation: payload.generation,
              document: document,
              isStreaming: payload.isStreaming
            )
          )
        case .failure(let failure):
          return .failure(
            RichTextIncrementalUpdateFailure(
              failureClass: .invalidDocument,
              reason: failure.reason
            )
          )
        }

      case "replace":
        guard let documentJson = payload.documentJson else {
          return .failure(missingField("documentJson"))
        }
        guard let preservedPrefixUtf16 = payload.preservedPrefixUtf16 else {
          return .failure(missingField("preservedPrefixUtf16"))
        }

        switch RichTextDocumentDecoder.decode(json: documentJson, fixtureName: "incremental-replace") {
        case .success(let document):
          return .success(
            .replace(
              RichTextReplacePayload(
                generation: payload.generation,
                preservedPrefixUtf16: preservedPrefixUtf16,
                document: document,
                isStreaming: payload.isStreaming
              )
            )
          )
        case .failure(let failure):
          return .failure(
            RichTextIncrementalUpdateFailure(
              failureClass: .invalidDocument,
              reason: failure.reason
            )
          )
        }

      case "append":
        guard let appendFromUtf16 = payload.appendFromUtf16 else {
          return .failure(missingField("appendFromUtf16"))
        }
        guard let appendedText = payload.appendedText else {
          return .failure(missingField("appendedText"))
        }
        guard let appendedBlocksJson = payload.appendedBlocksJson else {
          return .failure(missingField("appendedBlocksJson"))
        }
        guard let appendedSpansJson = payload.appendedSpansJson else {
          return .failure(missingField("appendedSpansJson"))
        }
        guard let appendedUnitsJson = payload.appendedUnitsJson else {
          return .failure(missingField("appendedUnitsJson"))
        }

        do {
          let appendPayload = RichTextAppendPayload(
            generation: payload.generation,
            appendFromUtf16: appendFromUtf16,
            appendedText: appendedText,
            appendedBlocks: try decodeArray(from: appendedBlocksJson),
            appendedSpans: try decodeArray(from: appendedSpansJson),
            appendedUnits: try decodeArray(from: appendedUnitsJson),
            isStreaming: payload.isStreaming
          )
          return .success(.append(appendPayload))
        } catch let failure as RichTextIncrementalUpdateFailure {
          return .failure(failure)
        } catch {
          return .failure(
            RichTextIncrementalUpdateFailure(
              failureClass: .invalidArrayPayload,
              reason: error.localizedDescription
            )
          )
        }

      default:
        return .failure(
          RichTextIncrementalUpdateFailure(
            failureClass: .invalidKind,
            reason: "Unsupported update kind \(payload.kind)"
          )
        )
      }
    } catch {
      return .failure(
        RichTextIncrementalUpdateFailure(
          failureClass: .invalidJSON,
          reason: error.localizedDescription
        )
      )
    }
  }

  private static func decodeArray<Element: Decodable>(
    from json: String
  ) throws -> [Element] {
    guard let data = json.data(using: .utf8) else {
      throw RichTextIncrementalUpdateFailure(
        failureClass: .invalidArrayPayload,
        reason: "Unable to encode array payload as UTF-8"
      )
    }

    do {
      return try JSONDecoder().decode([Element].self, from: data)
    } catch {
      throw RichTextIncrementalUpdateFailure(
        failureClass: .invalidArrayPayload,
        reason: error.localizedDescription
      )
    }
  }

  private static func missingField(_ fieldName: String) -> RichTextIncrementalUpdateFailure {
    RichTextIncrementalUpdateFailure(
      failureClass: .missingField,
      reason: "Missing required field \(fieldName)"
    )
  }
}
