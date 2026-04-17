# Changelog

## Unpublished

### 🛠 Breaking changes

### 🎉 New features

### 🐛 Bug fixes

### 💡 Others

## 0.2.0 — 2026-04-16

### 🎉 New features

- Add `smoothNewLine` animation setting. When enabled, each newly-wrapped line fades in as a group via an Animatable `TextRenderer`, while existing lines stay at full opacity in their natural positions.
- Expose `AGENTS.md` describing the module’s public surfaces, code map, and coordinated-change rules for contributors and agents.

### 🐛 Bug fixes

- Fix typewriter reveal stalling mid-stream when consecutive updates arrived within the same RunLoop turn. Reveal now ticks on a single `CADisplayLink` with a per-target interval instead of stacked `Timer`s.
- Cache computed text segments and skip per-run `GraphicsContext` copies for fully-opaque runs, eliminating redundant work during long fade-trail renders.
