export type TextAnimationRevealPreset = "typewriter" | "fade-trail";
export type TextAnimationShaderPreset = "none" | "ember" | "matrix" | "neon" | "ghost" | "smoke" | "disintegrate" | "shader-glow" | "shader-wave" | "shader-crt" | "shader-noise";
export type TextAnimationPreset = TextAnimationRevealPreset | Exclude<TextAnimationShaderPreset, "none">;
export type TextAnimationRendererClass = "text" | "overlay";
export type TextAnimationUnitMode = "glyph" | "word" | "token";
export type TextAnimationSettings = {
    enabled: boolean;
    revealPreset: TextAnimationRevealPreset;
    shaderPreset: TextAnimationShaderPreset;
    shaderStrength: number;
    effectColor: string;
    smoothReveal: boolean;
    smoothNewLine: boolean;
    unitMode: TextAnimationUnitMode;
    unitsPerStep: number;
    unitsPerSecond: number;
    wordsPerMinute: number;
    fadeDurationMs: number;
    fadeStartOpacity: number;
    cursorEnabled: boolean;
    cursorGlyph: string;
    tailLength: number;
};
export declare const DEFAULT_TEXT_ANIMATION_SETTINGS: TextAnimationSettings;
export declare function resolveTextAnimationSettings(partial?: Partial<TextAnimationSettings> | null): TextAnimationSettings;
export declare function resolveTextAnimationRendererClass(shaderPreset: TextAnimationShaderPreset): TextAnimationRendererClass;
export declare function resolveAnimationUnitsPerSecond(settings: TextAnimationSettings): number;
export declare function resolveSplitTextAnimationPreset(preset: TextAnimationPreset | null | undefined): Pick<TextAnimationSettings, "revealPreset" | "shaderPreset">;
//# sourceMappingURL=animation-config.d.ts.map