#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>

using namespace metal;

static inline float richTextHash(float2 point) {
  return fract(sin(dot(point, float2(127.1, 311.7))) * 43758.5453123);
}

[[ stitchable ]] half4 richTextGlow(
  float2 position,
  SwiftUI::Layer layer,
  half4 tint,
  float strength,
  float time
) {
  const half4 base = layer.sample(position);
  const float pulse = 0.6 + 0.4 * sin(time * 2.4);
  const float radius = max(1.5, 9.0 * max(strength, 0.0));
  const float2 offsets[8] = {
    float2(-radius, 0.0),
    float2(radius, 0.0),
    float2(0.0, -radius),
    float2(0.0, radius),
    float2(-radius * 0.7, -radius * 0.7),
    float2(radius * 0.7, -radius * 0.7),
    float2(-radius * 0.7, radius * 0.7),
    float2(radius * 0.7, radius * 0.7),
  };

  float glowAlpha = 0.0;
  for (int index = 0; index < 8; index += 1) {
    glowAlpha += layer.sample(position + offsets[index]).a;
  }
  glowAlpha = min(glowAlpha / 8.0, 1.0);

  const half3 glowColor = half3(tint.rgb) * half(glowAlpha * pulse * 0.85);
  const half3 brightened = max(base.rgb, glowColor * half(0.6) + base.rgb);
  return half4(brightened + glowColor, max(base.a, half(glowAlpha * 0.5)));
}

[[ stitchable ]] half4 richTextGlowFill(
  float2 position,
  half4 tint,
  float strength,
  float time
) {
  const float pulse = 0.72 + 0.28 * sin(time * 2.6 + position.y * 0.015);
  const float shimmer = 0.5 + 0.5 * sin(position.x * 0.035 + time * 1.7);
  const float intensity = clamp(0.22 + (max(0.0, strength) * 0.78), 0.0, 1.25);
  const half3 base = half3(tint.rgb);
  const half3 luminous =
    base * half(0.72 + intensity * pulse)
    + half3(0.22 * shimmer * intensity);
  return half4(clamp(luminous, half3(0.0), half3(1.0)), 1.0);
}

[[ stitchable ]] float2 richTextWave(
  float2 position,
  float time,
  float strength
) {
  const float amplitude = max(0.0, strength) * 7.0;
  const float frequency = 0.02;
  const float phase = time * 2.0;
  const float xShift = sin(position.y * frequency + phase) * amplitude;
  const float yShift = cos(position.x * frequency * 0.75 + phase * 1.15) * amplitude * 0.18;
  return float2(position.x + xShift, position.y + yShift);
}

[[ stitchable ]] half4 richTextCRTFill(
  float2 position,
  half4 tint,
  float strength,
  float time
) {
  const float scanline = 0.82 + 0.18 * sin(position.y * 1.25 + time * 8.0);
  const float subpixel = 0.5 + 0.5 * sin(position.x * 0.24);
  const float phosphor = clamp(0.18 + max(0.0, strength) * 0.82, 0.0, 1.2);
  const half3 base = half3(tint.rgb);
  const half3 striped = half3(
    base.r * half(0.86 + 0.14 * subpixel),
    base.g * half(0.94 + 0.06 * (1.0 - subpixel)),
    base.b * half(0.82 + 0.18 * subpixel)
  );
  const half3 crt = striped * half(scanline * phosphor);
  return half4(clamp(crt, half3(0.0), half3(1.0)), 1.0);
}

[[ stitchable ]] half4 richTextNoiseFill(
  float2 position,
  half4 tint,
  float strength,
  float time
) {
  const float animatedTime = time * 21.0;
  const float grain = richTextHash(position * 1.75 + animatedTime) - 0.5;
  const float scanline = sin(position.y * 0.9 + animatedTime * 0.35) * 0.5 + 0.5;
  const float shimmer = sin(position.x * 0.04 + animatedTime * 0.22) * 0.5 + 0.5;
  const float intensity = 0.14 + max(0.0, strength) * 0.42;
  const half3 base = half3(tint.rgb);
  const half3 colorized =
    base
    + half3(grain * intensity)
    + half3((scanline - 0.5) * intensity * 0.6)
    + half3((shimmer - 0.5) * intensity * 0.35);
  return half4(clamp(colorized, half3(0.0), half3(1.0)), 1.0);
}
