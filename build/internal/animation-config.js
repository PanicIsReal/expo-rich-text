export const DEFAULT_TEXT_ANIMATION_SETTINGS = {
    enabled: true,
    revealPreset: "fade-trail",
    shaderPreset: "none",
    shaderStrength: 1,
    effectColor: "",
    smoothReveal: false,
    smoothNewLine: false,
    unitMode: "glyph",
    unitsPerStep: 2,
    unitsPerSecond: 18,
    wordsPerMinute: 220,
    fadeDurationMs: 180,
    fadeStartOpacity: 0.22,
    cursorEnabled: true,
    cursorGlyph: "▍",
    tailLength: 4,
};
function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
export function resolveTextAnimationSettings(partial) {
    const next = {
        ...DEFAULT_TEXT_ANIMATION_SETTINGS,
        ...(partial ?? {}),
    };
    return {
        enabled: Boolean(next.enabled),
        revealPreset: next.revealPreset === "typewriter" || next.revealPreset === "fade-trail"
            ? next.revealPreset
            : DEFAULT_TEXT_ANIMATION_SETTINGS.revealPreset,
        shaderPreset: next.shaderPreset === "none" ||
            next.shaderPreset === "ember" ||
            next.shaderPreset === "matrix" ||
            next.shaderPreset === "neon" ||
            next.shaderPreset === "ghost" ||
            next.shaderPreset === "smoke" ||
            next.shaderPreset === "disintegrate" ||
            next.shaderPreset === "shader-glow" ||
            next.shaderPreset === "shader-wave" ||
            next.shaderPreset === "shader-crt" ||
            next.shaderPreset === "shader-noise"
            ? next.shaderPreset
            : DEFAULT_TEXT_ANIMATION_SETTINGS.shaderPreset,
        shaderStrength: clamp(next.shaderStrength, 0, 1),
        effectColor: typeof next.effectColor === "string" && next.effectColor.trim().length > 0
            ? next.effectColor.trim()
            : DEFAULT_TEXT_ANIMATION_SETTINGS.effectColor,
        smoothReveal: Boolean(next.smoothReveal),
        smoothNewLine: Boolean(next.smoothNewLine),
        unitMode: next.unitMode === "glyph" ||
            next.unitMode === "word" ||
            next.unitMode === "token"
            ? next.unitMode
            : DEFAULT_TEXT_ANIMATION_SETTINGS.unitMode,
        unitsPerStep: Math.round(clamp(next.unitsPerStep, 1, 12)),
        unitsPerSecond: clamp(next.unitsPerSecond, 1, 80),
        wordsPerMinute: Math.round(clamp(next.wordsPerMinute, 40, 720)),
        fadeDurationMs: Math.round(clamp(next.fadeDurationMs, 0, 1200)),
        fadeStartOpacity: clamp(next.fadeStartOpacity, 0.05, 1),
        cursorEnabled: Boolean(next.cursorEnabled),
        cursorGlyph: typeof next.cursorGlyph === "string" && next.cursorGlyph.trim().length > 0
            ? next.cursorGlyph
            : DEFAULT_TEXT_ANIMATION_SETTINGS.cursorGlyph,
        tailLength: Math.round(clamp(next.tailLength, 1, 12)),
    };
}
export function resolveTextAnimationRendererClass(shaderPreset) {
    switch (shaderPreset) {
        case "smoke":
        case "disintegrate":
            return "overlay";
        default:
            return "text";
    }
}
export function resolveAnimationUnitsPerSecond(settings) {
    const safeSettings = resolveTextAnimationSettings(settings);
    if (safeSettings.unitMode === "word") {
        return clamp(safeSettings.wordsPerMinute / 60, 0.75, 18);
    }
    return clamp(safeSettings.unitsPerSecond, 1, 80);
}
export function resolveSplitTextAnimationPreset(preset) {
    switch (preset) {
        case "typewriter":
            return {
                revealPreset: "typewriter",
                shaderPreset: "none",
            };
        case "fade-trail":
            return {
                revealPreset: "fade-trail",
                shaderPreset: "none",
            };
        case "ember":
        case "matrix":
        case "neon":
        case "ghost":
        case "smoke":
        case "disintegrate":
        case "shader-glow":
        case "shader-wave":
        case "shader-crt":
        case "shader-noise":
            return {
                revealPreset: "fade-trail",
                shaderPreset: preset,
            };
        default:
            return {
                revealPreset: DEFAULT_TEXT_ANIMATION_SETTINGS.revealPreset,
                shaderPreset: DEFAULT_TEXT_ANIMATION_SETTINGS.shaderPreset,
            };
    }
}
//# sourceMappingURL=animation-config.js.map