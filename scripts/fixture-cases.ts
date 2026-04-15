import type { RichTextContentType } from "../src/engine.js";
import type { AnimationMode } from "../src/internal/types.js";

export type RichTextContractFixtureCase = {
  name: string;
  text: string;
  contentType: RichTextContentType;
  animationMode: AnimationMode;
  expectedRenderedText: string;
};

export const richTextContractFixtureCases: RichTextContractFixtureCase[] = [
  {
    name: "plain-paragraph",
    text: "Hello world",
    contentType: "plain",
    animationMode: "glyph-reveal",
    expectedRenderedText: "Hello world",
  },
  {
    name: "streaming-paragraph-tail",
    text: "Hello world again",
    contentType: "plain",
    animationMode: "glyph-reveal",
    expectedRenderedText: "Hello world again",
  },
  {
    name: "streaming-paragraph-newline",
    text: "First paragraph\n\nSecond paragraph",
    contentType: "markdown",
    animationMode: "word-reveal",
    expectedRenderedText: "First paragraph\nSecond paragraph",
  },
  {
    name: "heading-emphasis-link",
    text: "# Title with **bold** and [link](https://example.com)",
    contentType: "markdown",
    animationMode: "word-reveal",
    expectedRenderedText: "Title with bold and link",
  },
  {
    name: "blockquote",
    text: "> quoted line",
    contentType: "markdown",
    animationMode: "glyph-reveal",
    expectedRenderedText: "▍ quoted line",
  },
  {
    name: "bullet-list",
    text: "- First item\n- Second item",
    contentType: "markdown",
    animationMode: "token-reveal",
    expectedRenderedText: "• First item\n• Second item",
  },
  {
    name: "streaming-bullet-list-continuation",
    text: "- First item\n- Second item\n- Third item",
    contentType: "markdown",
    animationMode: "token-reveal",
    expectedRenderedText: "• First item\n• Second item\n• Third item",
  },
  {
    name: "ordered-list",
    text: "1. First\n2. Second",
    contentType: "markdown",
    animationMode: "token-reveal",
    expectedRenderedText: "1. First\n2. Second",
  },
  {
    name: "fenced-code-block",
    text: "```ts\nconst x = 1;\n```",
    contentType: "markdown",
    animationMode: "glyph-reveal",
    expectedRenderedText: "const x = 1;",
  },
  {
    name: "streaming-fenced-code-block-tail",
    text: "```ts\nconst x = 1;\nconst y = 2;\n```",
    contentType: "markdown",
    animationMode: "glyph-reveal",
    expectedRenderedText: "const x = 1;\nconst y = 2;",
  },
  {
    name: "streaming-blockquote-continuation",
    text: "> first line\n> second line",
    contentType: "markdown",
    animationMode: "glyph-reveal",
    expectedRenderedText: "▍ first line\n▍ second line",
  },
  {
    name: "mixed-markdown-animated",
    text: "# Intro\n\n- Alpha\n- **Beta**\n\n`gamma`\n> delta",
    contentType: "markdown",
    animationMode: "word-reveal",
    expectedRenderedText: "Intro\n• Alpha\n• Beta\ngamma\n▍ delta",
  },
];
