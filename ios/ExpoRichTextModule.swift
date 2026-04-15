import ExpoModulesCore
import ExpoUI

public final class ExpoRichTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoRichText")

    ExpoUIView(ExpoRichTextView.self)
  }
}
