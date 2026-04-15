import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRichTextDocumentJson,
  RichTextIncrementalCompiler,
  resolveRichTextSourceKind,
  type RichTextContentType,
} from "../src/engine.js";
import { richTextContractFixtureCases } from "./fixture-cases.js";
import { buildTextDocument } from "../src/internal/build-document.js";
import { assertValidTextDocument } from "../src/internal/document-contract.js";
import type { AnimationMode } from "../src/internal/types.js";

const packageRootDir = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);
const fixturesDir = join(packageRootDir, "fixtures");

type GeneratedFixture = {
  fileName: string;
  content: string;
};

type RuntimePlaybackPhase = "idle" | "revealing" | "settling" | "settled";

type RichTextRuntimeScenarioSettings = {
  animationMode: AnimationMode;
  isStreaming: boolean;
  revealUnitsPerStep: number;
  revealIntervalMs: number;
  fadeDurationMs: number;
  fadeStartOpacity: number;
  revealPreset: string;
  shaderPreset: string;
  shaderStrength: number;
  cursorEnabled: boolean;
  cursorGlyph: string;
  tailLength: number;
  smoothReveal: boolean;
  smoothNewLine: boolean;
};

type RichTextRuntimeScenarioExpectation = {
  visibleText: string;
  revealedUnitCount: number;
  playbackPhase: RuntimePlaybackPhase;
  requiresRevealTimer: boolean;
  requiresVisualEffectTimer: boolean;
};

type RichTextRuntimeScenarioStep = {
  action: "applyDocument" | "applyUpdate" | "tick" | "updateSettings";
  now: number;
  payload?: string | RichTextRuntimeScenarioSettings;
  expect: RichTextRuntimeScenarioExpectation;
};

type RichTextRuntimeScenarioFixture = {
  name: string;
  settings: RichTextRuntimeScenarioSettings;
  steps: RichTextRuntimeScenarioStep[];
};

function stringifyFixture(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createRuntimeSettings(
  overrides: Partial<RichTextRuntimeScenarioSettings>,
): RichTextRuntimeScenarioSettings {
  return {
    animationMode: "glyph-reveal",
    isStreaming: true,
    revealUnitsPerStep: 1,
    revealIntervalMs: 96,
    fadeDurationMs: 0,
    fadeStartOpacity: 0.22,
    revealPreset: "fade-trail",
    shaderPreset: "none",
    shaderStrength: 1,
    cursorEnabled: false,
    cursorGlyph: "▍",
    tailLength: 4,
    smoothReveal: false,
    smoothNewLine: false,
    ...overrides,
  };
}

function expectScenario(
  visibleText: string,
  revealedUnitCount: number,
  playbackPhase: RuntimePlaybackPhase,
  requiresRevealTimer: boolean,
  requiresVisualEffectTimer: boolean,
): RichTextRuntimeScenarioExpectation {
  return {
    visibleText,
    revealedUnitCount,
    playbackPhase,
    requiresRevealTimer,
    requiresVisualEffectTimer,
  };
}

function createDocumentPayload(
  text: string,
  contentType: RichTextContentType,
  animationMode: AnimationMode,
): string {
  return buildRichTextDocumentJson({
    text,
    contentType,
    animationMode,
  });
}

function createUpdatePayloads(
  input: {
    text: string;
    contentType: RichTextContentType;
    animationMode: AnimationMode;
    isStreaming: boolean;
  }[],
): string[] {
  const compiler = new RichTextIncrementalCompiler();
  return input.map((value) => compiler.buildUpdateJson(value));
}

function rewriteUpdatePayload(
  json: string,
  transform: (payload: Record<string, unknown>) => Record<string, unknown>,
): string {
  return JSON.stringify(transform(JSON.parse(json) as Record<string, unknown>));
}

export function generateRichTextContractFixtures(): GeneratedFixture[] {
  return richTextContractFixtureCases.map((fixtureCase) => {
    const sourceKind = resolveRichTextSourceKind(
      fixtureCase.text,
      fixtureCase.contentType,
    );
    const document = buildTextDocument({
      text: fixtureCase.text,
      sourceKind,
      animationMode: fixtureCase.animationMode,
    });

    assertValidTextDocument(document);

    return {
      fileName: `${fixtureCase.name}.fixture.json`,
      content: stringifyFixture({
        ...fixtureCase,
        document,
      }),
    };
  });
}

export function generateRichTextRuntimeScenarioFixtures(): GeneratedFixture[] {
  const initialResetSettings = createRuntimeSettings({});
  const initialResetFixture: RichTextRuntimeScenarioFixture = {
    name: "initial-reset-from-document",
    settings: initialResetSettings,
    steps: [
      {
        action: "applyDocument",
        now: 0,
        payload: createDocumentPayload("Hi", "plain", "glyph-reveal"),
        expect: expectScenario("H", 1, "revealing", true, false),
      },
      {
        action: "tick",
        now: 0.1,
        expect: expectScenario("Hi", 2, "settling", false, true),
      },
    ],
  };

  const [suffixResetPayload, suffixAppendPayload] = createUpdatePayloads([
    {
      text: "Hi",
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
    {
      text: "Hi!",
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
  ]);
  const suffixAppendFixture: RichTextRuntimeScenarioFixture = {
    name: "suffix-append-from-update",
    settings: createRuntimeSettings({}),
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: suffixResetPayload,
        expect: expectScenario("H", 1, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: suffixAppendPayload,
        expect: expectScenario("H", 1, "revealing", true, false),
      },
      {
        action: "tick",
        now: 0.2,
        expect: expectScenario("Hi", 2, "revealing", true, true),
      },
      {
        action: "tick",
        now: 0.3,
        expect: expectScenario("Hi!", 3, "settling", false, true),
      },
    ],
  };

  const [nonPrefixResetPayload, nonPrefixEditPayload] = createUpdatePayloads([
    {
      text: "Hi",
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
    {
      text: "Bye",
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
  ]);
  const nonPrefixFixture: RichTextRuntimeScenarioFixture = {
    name: "non-prefix-edit-forces-reset",
    settings: createRuntimeSettings({}),
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: nonPrefixResetPayload,
        expect: expectScenario("H", 1, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: nonPrefixEditPayload,
        expect: expectScenario("B", 1, "revealing", true, true),
      },
    ],
  };

  const [kindResetPayload, kindChangePayload] = createUpdatePayloads([
    {
      text: "Plain text",
      contentType: "auto",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
    {
      text: "Plain text\n- now markdown",
      contentType: "auto",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
  ]);
  const sourceKindFixture: RichTextRuntimeScenarioFixture = {
    name: "source-kind-change-forces-reset",
    settings: createRuntimeSettings({}),
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: kindResetPayload,
        expect: expectScenario("P", 1, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: kindChangePayload,
        expect: expectScenario("P", 1, "revealing", true, false),
      },
    ],
  };

  const [staleBasePayload, staleAppendPayload] = createUpdatePayloads([
    {
      text: "A",
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
    {
      text: "AB",
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
  ]);
  const staleGenerationFixture: RichTextRuntimeScenarioFixture = {
    name: "stale-generation-is-ignored",
    settings: createRuntimeSettings({}),
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: staleBasePayload,
        expect: expectScenario("A", 1, "settled", false, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: staleAppendPayload,
        expect: expectScenario("A", 1, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.2,
        payload: staleBasePayload,
        expect: expectScenario("A", 1, "revealing", true, false),
      },
    ],
  };

  const [invalidBasePayload, validAppendPayload] = createUpdatePayloads([
    {
      text: "A",
      contentType: "markdown",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
    {
      text: "A\n\nB",
      contentType: "markdown",
      animationMode: "glyph-reveal",
      isStreaming: true,
    },
  ]);
  const invalidAppendPayload = rewriteUpdatePayload(
    validAppendPayload,
    (payload) => ({
      ...payload,
      appendFromUtf16: 999,
    }),
  );
  const invalidBoundaryFixture: RichTextRuntimeScenarioFixture = {
    name: "invalid-append-boundary-is-rejected",
    settings: createRuntimeSettings({}),
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: invalidBasePayload,
        expect: expectScenario("A", 1, "settled", false, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: invalidAppendPayload,
        expect: expectScenario("A", 1, "settled", false, false),
      },
    ],
  };

  const monotonicCompiler = new RichTextIncrementalCompiler();
  const monotonicTexts = ["a", "ab", "abc", "abcd", "abcde"];
  const monotonicSteps: RichTextRuntimeScenarioStep[] = [];
  for (const [index, text] of monotonicTexts.entries()) {
    const updateJson = monotonicCompiler.buildUpdateJson({
      text,
      contentType: "plain",
      animationMode: "glyph-reveal",
      isStreaming: true,
    });
    const revealedBeforeTick = Math.max(1, index);
    const visibleBeforeTick = text.slice(0, revealedBeforeTick);
    monotonicSteps.push({
      action: "applyUpdate",
      now: index * 0.2,
      payload: updateJson,
      expect: expectScenario(
        visibleBeforeTick,
        revealedBeforeTick,
        revealedBeforeTick < text.length ? "revealing" : "settled",
        revealedBeforeTick < text.length,
        false,
      ),
    });

    if (index > 0) {
      monotonicSteps.push({
        action: "tick",
        now: index * 0.2 + 0.1,
        expect: expectScenario(text, text.length, "settling", false, true),
      });
    }
  }
  const monotonicFixture: RichTextRuntimeScenarioFixture = {
    name: "reveal-count-remains-monotonic-across-many-chunks",
    settings: createRuntimeSettings({}),
    steps: monotonicSteps,
  };

  const markdownReplaceSettings = createRuntimeSettings({
    revealUnitsPerStep: 4,
  });
  const markdownReplaceInitialText = "Cats are small, adaptable mammals.";
  const markdownReplaceExpandedText = `${markdownReplaceInitialText} They are known for agility and sharp senses.`;
  const [markdownReplaceBasePayload, markdownReplacePayload] =
    createUpdatePayloads([
      {
        text: markdownReplaceInitialText,
        contentType: "markdown",
        animationMode: "glyph-reveal",
        isStreaming: true,
      },
      {
        text: markdownReplaceExpandedText,
        contentType: "markdown",
        animationMode: "glyph-reveal",
        isStreaming: true,
      },
    ]);
  const markdownReplaceFixture: RichTextRuntimeScenarioFixture = {
    name: "markdown-prose-growth-preserves-visible-prefix",
    settings: markdownReplaceSettings,
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: markdownReplaceBasePayload,
        expect: expectScenario("Cats", 4, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: markdownReplacePayload,
        expect: expectScenario("Cats", 4, "revealing", true, false),
      },
      {
        action: "tick",
        now: 0.2,
        expect: expectScenario("Cats are", 8, "revealing", true, true),
      },
    ],
  };

  const markdownAppendSettings = createRuntimeSettings({
    revealUnitsPerStep: 4,
  });
  const markdownAppendFirstParagraph =
    "Cats are small, adaptable mammals that live comfortably alongside humans.";
  const markdownAppendExpandedText = `${markdownAppendFirstParagraph}\n\nTheir communication is subtle but rich.`;
  const [markdownAppendBasePayload, markdownAppendPayload] =
    createUpdatePayloads([
      {
        text: markdownAppendFirstParagraph,
        contentType: "markdown",
        animationMode: "glyph-reveal",
        isStreaming: true,
      },
      {
        text: markdownAppendExpandedText,
        contentType: "markdown",
        animationMode: "glyph-reveal",
        isStreaming: true,
      },
    ]);
  const markdownAppendFixture: RichTextRuntimeScenarioFixture = {
    name: "markdown-paragraph-append-preserves-visible-prefix",
    settings: markdownAppendSettings,
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: markdownAppendBasePayload,
        expect: expectScenario("Cats", 4, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: markdownAppendPayload,
        expect: expectScenario("Cats", 4, "revealing", true, false),
      },
      {
        action: "tick",
        now: 0.2,
        expect: expectScenario("Cats are", 8, "revealing", true, true),
      },
    ],
  };

  const settlingSettings = createRuntimeSettings({
    revealUnitsPerStep: 2,
    fadeDurationMs: 180,
  });
  const settlingFixture: RichTextRuntimeScenarioFixture = {
    name: "streaming-false-transition-settles-after-effects",
    settings: settlingSettings,
    steps: [
      {
        action: "applyDocument",
        now: 0,
        payload: createDocumentPayload("ABCD", "plain", "glyph-reveal"),
        expect: expectScenario("AB", 2, "revealing", true, false),
      },
      {
        action: "tick",
        now: 0.1,
        expect: expectScenario("ABCD", 4, "settling", false, true),
      },
      {
        action: "updateSettings",
        now: 0.2,
        payload: {
          ...settlingSettings,
          isStreaming: false,
        },
        expect: expectScenario("ABCD", 4, "settling", false, true),
      },
      {
        action: "tick",
        now: 1,
        expect: expectScenario("ABCD", 4, "settled", false, false),
      },
    ],
  };

  const wordSettings = createRuntimeSettings({
    animationMode: "word-reveal",
  });
  const [wordResetPayload, wordAppendPayload] = createUpdatePayloads([
    {
      text: "Hello world",
      contentType: "plain",
      animationMode: "word-reveal",
      isStreaming: true,
    },
    {
      text: "Hello world again",
      contentType: "plain",
      animationMode: "word-reveal",
      isStreaming: true,
    },
  ]);
  const wordRevealFixture: RichTextRuntimeScenarioFixture = {
    name: "word-reveal-preserves-visible-text-across-append",
    settings: wordSettings,
    steps: [
      {
        action: "applyUpdate",
        now: 0,
        payload: wordResetPayload,
        expect: expectScenario("Hello ", 1, "revealing", true, false),
      },
      {
        action: "applyUpdate",
        now: 0.1,
        payload: wordAppendPayload,
        expect: expectScenario("Hello ", 1, "revealing", true, false),
      },
      {
        action: "tick",
        now: 0.2,
        expect: expectScenario("Hello world ", 2, "revealing", true, true),
      },
      {
        action: "tick",
        now: 0.3,
        expect: expectScenario("Hello world again", 3, "settling", false, true),
      },
    ],
  };

  const stableSettings = createRuntimeSettings({
    animationMode: "static",
    isStreaming: false,
  });
  const stableFixture: RichTextRuntimeScenarioFixture = {
    name: "repeated-snapshots-are-stable-without-state-changes",
    settings: stableSettings,
    steps: [
      {
        action: "applyDocument",
        now: 0,
        payload: createDocumentPayload("Stable", "plain", "static"),
        expect: expectScenario("Stable", 0, "settled", false, false),
      },
      {
        action: "tick",
        now: 0.1,
        expect: expectScenario("Stable", 0, "settled", false, false),
      },
    ],
  };

  return [
    initialResetFixture,
    suffixAppendFixture,
    nonPrefixFixture,
    sourceKindFixture,
    staleGenerationFixture,
    invalidBoundaryFixture,
    monotonicFixture,
    markdownReplaceFixture,
    markdownAppendFixture,
    settlingFixture,
    wordRevealFixture,
    stableFixture,
  ].map((fixture) => ({
    fileName: `${fixture.name}.scenario.json`,
    content: stringifyFixture(fixture),
  }));
}

export function writeRichTextFixtures(): void {
  mkdirSync(fixturesDir, { recursive: true });

  for (const fixture of [
    ...generateRichTextContractFixtures(),
    ...generateRichTextRuntimeScenarioFixtures(),
  ]) {
    writeFileSync(join(fixturesDir, fixture.fileName), fixture.content);
  }
}

if (
  typeof process !== "undefined" &&
  process.argv[1] === fileURLToPath(import.meta.url)
) {
  writeRichTextFixtures();
}
