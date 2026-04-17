# AGENTS.md

## Stack Snapshot
- `expo-rich-text` is an iOS-only Expo module with a SwiftUI-backed native renderer and a TypeScript incremental text/animation engine.
- Public surfaces are the package exports in `package.json`, the documented API in `README.md`, and the native module entry points under `ios/`.
- Changes to parsing, animation, streaming, or renderer behavior can affect both the JS engine and SwiftUI/native playback behavior.

## Code Map
- `src/`: public JS/TS API, engine helpers, animation config, parsing, preview support, fixtures access.
- `ios/`: Expo module, SwiftUI renderer, playback/render session types, Metal shaders.
- `fixtures/`: canonical fixture data used for examples/tests/tooling.
- `scripts/`: fixture generation and package maintenance helpers.

## Working Rules
- Keep the public package API stable unless the user explicitly asks for a breaking change.
- When changing exports, props, event payloads, or animation settings, update all coordinated surfaces:
  - `package.json` exports
  - `src/index.ts` and relevant subpath entry points
  - `README.md`
  - fixtures or tests when behavior changes
- Treat the JS incremental compiler and the native renderer as coordinated surfaces; do not change one side without checking the contract on the other.
- Prefer narrow, library-quality changes over app-specific shortcuts.
- Do not add platform claims beyond current support; this package is iOS-only unless the user explicitly asks to expand platform support.

## Verification Expectations
- Use the existing module scripts first: `npm run build`, `npm run lint`, `npm run test`.
- If native files under `ios/` change, verify the module still builds cleanly and keep README requirements in sync.
- If documentation or exported behavior changes, update the README in the same pass.
