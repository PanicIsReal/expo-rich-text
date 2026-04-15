import Foundation

enum RichTextDocumentContractError: Error {
  case unsupportedVersion(Int)
  case invalidRangeLength(Int)
  case descendingRange(start: Int, end: Int)

  var failureClass: RichTextDocumentDecodeFailureClass {
    switch self {
    case .unsupportedVersion:
      return .unsupportedVersion
    case .invalidRangeLength, .descendingRange:
      return .invalidRange
    }
  }
}

struct RichTextRange: Decodable, Equatable {
  let start: Int
  let end: Int

  var nsRange: NSRange {
    NSRange(location: start, length: max(0, end - start))
  }

  init(start: Int, end: Int) throws {
    guard end >= start else {
      throw RichTextDocumentContractError.descendingRange(start: start, end: end)
    }
    self.start = start
    self.end = end
  }

  init(from decoder: Decoder) throws {
    var container = try decoder.unkeyedContainer()
    let count = container.count ?? 0
    guard count == 2 else {
      throw RichTextDocumentContractError.invalidRangeLength(count)
    }

    let start = try container.decode(Int.self)
    let end = try container.decode(Int.self)
    try self.init(start: start, end: end)
  }
}

struct RichTextDocument: Decodable {
  private enum CodingKeys: String, CodingKey {
    case id
    case version
    case source
    case blocks
    case spans
    case animationPlan
  }

  static let supportedVersion = 1

  struct Source: Decodable {
    let kind: String
    let text: String
  }

  struct Block: Decodable {
    private enum CodingKeys: String, CodingKey {
      case id
      case kind
      case level
      case parentBlockId
      case range
      case childSpanIds
      case childBlockIds
      case metadata
    }

    let id: String
    let kind: String
    let level: Int?
    let parentBlockId: String?
    let range: RichTextRange
    let childSpanIds: [String]
    let childBlockIds: [String]
    let metadata: BlockMetadata?

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      id = try container.decode(String.self, forKey: .id)
      kind = try container.decode(String.self, forKey: .kind)
      level = try container.decodeIfPresent(Int.self, forKey: .level)
      parentBlockId = try container.decodeIfPresent(String.self, forKey: .parentBlockId)
      range = try container.decode(RichTextRange.self, forKey: .range)
      childSpanIds = try container.decode([String].self, forKey: .childSpanIds)
      childBlockIds = try container.decodeIfPresent([String].self, forKey: .childBlockIds) ?? []
      metadata = try container.decodeIfPresent(BlockMetadata.self, forKey: .metadata)
    }
  }

  struct BlockMetadata: Decodable {
    let orderedIndex: Int?
    let fenceLanguage: String?
  }

  struct Span: Decodable {
    let id: String
    let blockId: String
    let kind: String
    let text: String
    let range: RichTextRange
    let href: String?
    let styleKey: String
    let animationGroupId: String
  }

  struct AnimationPlan: Decodable {
    let mode: String
    let units: [AnimationUnit]
  }

  struct AnimationUnit: Decodable {
    let id: String
    let spanId: String
    let kind: String
    let text: String
    let range: RichTextRange
    let ordinal: Int
  }

  let id: String
  let version: Int
  let source: Source
  let blocks: [Block]
  let spans: [Span]
  let animationPlan: AnimationPlan

  init(
    id: String,
    version: Int,
    source: Source,
    blocks: [Block],
    spans: [Span],
    animationPlan: AnimationPlan
  ) {
    self.id = id
    self.version = version
    self.source = source
    self.blocks = blocks
    self.spans = spans
    self.animationPlan = animationPlan
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let version = try container.decode(Int.self, forKey: .version)
    guard version == Self.supportedVersion else {
      throw RichTextDocumentContractError.unsupportedVersion(version)
    }

    self.id = try container.decode(String.self, forKey: .id)
    self.version = version
    self.source = try container.decode(Source.self, forKey: .source)
    self.blocks = try container.decode([Block].self, forKey: .blocks)
    self.spans = try container.decode([Span].self, forKey: .spans)
    self.animationPlan = try container.decode(AnimationPlan.self, forKey: .animationPlan)
  }
}
