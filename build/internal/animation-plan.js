import { createStableId } from "./stable-id.js";
let segmenter;
function getSegmenter() {
    if (segmenter !== undefined) {
        return segmenter;
    }
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        return segmenter;
    }
    segmenter = null;
    return segmenter;
}
export function buildAnimationPlan(spans, mode) {
    if (mode === "static") {
        return { mode, units: [] };
    }
    const units = [];
    let ordinal = 0;
    for (const span of spans) {
        if (!span.text) {
            continue;
        }
        const nextUnits = mode === "token-reveal"
            ? tokenUnits(span, ordinal)
            : mode === "word-reveal"
                ? wordUnits(span, ordinal)
                : graphemeUnits(span, ordinal);
        ordinal += nextUnits.length;
        units.push(...nextUnits);
    }
    return { mode, units };
}
function tokenUnits(span, startOrdinal) {
    const matches = [...span.text.matchAll(/\S+\s*|\s+/g)];
    let localOrdinal = startOrdinal;
    return matches.map((match) => {
        const index = match.index ?? 0;
        const text = match[0];
        return {
            id: createStableId("anim", span.id, "token", index, text),
            spanId: span.id,
            kind: "token",
            text,
            range: [span.range[0] + index, span.range[0] + index + text.length],
            ordinal: localOrdinal++,
        };
    });
}
function wordUnits(span, startOrdinal) {
    const segments = segmentTextByWord(span.text);
    let localOrdinal = startOrdinal;
    let offset = 0;
    return segments.map((text) => {
        const absoluteStart = span.range[0] + offset;
        offset += text.length;
        return {
            id: createStableId("anim", span.id, "word", absoluteStart, text),
            spanId: span.id,
            kind: "word",
            text,
            range: [absoluteStart, absoluteStart + text.length],
            ordinal: localOrdinal++,
        };
    });
}
function graphemeUnits(span, startOrdinal) {
    const graphemeSegmenter = getSegmenter();
    const units = [];
    let localOrdinal = startOrdinal;
    if (!graphemeSegmenter) {
        for (const [index, character] of Array.from(span.text).entries()) {
            const absoluteStart = span.range[0] + index;
            units.push({
                id: createStableId("anim", span.id, "grapheme", absoluteStart, character),
                spanId: span.id,
                kind: "grapheme",
                text: character,
                range: [absoluteStart, absoluteStart + character.length],
                ordinal: localOrdinal++,
            });
        }
        return units;
    }
    for (const segment of graphemeSegmenter.segment(span.text)) {
        units.push({
            id: createStableId("anim", span.id, "grapheme", segment.index, segment.segment),
            spanId: span.id,
            kind: "grapheme",
            text: segment.segment,
            range: [
                span.range[0] + segment.index,
                span.range[0] + segment.index + segment.segment.length,
            ],
            ordinal: localOrdinal++,
        });
    }
    return units;
}
function segmentTextByWord(text) {
    const tokens = [];
    let current = "";
    function flushCurrent() {
        if (!current) {
            return;
        }
        tokens.push(current);
        current = "";
    }
    for (const character of text) {
        if (character === "\n") {
            flushCurrent();
            tokens.push(character);
            continue;
        }
        if (character === " " || character === "\t") {
            if (current) {
                current += character;
            }
            else if (tokens.length > 0 && tokens[tokens.length - 1] !== "\n") {
                tokens[tokens.length - 1] += character;
            }
            else {
                current += character;
            }
            flushCurrent();
            continue;
        }
        if (current && /\s$/.test(current)) {
            flushCurrent();
        }
        current += character;
    }
    flushCurrent();
    return tokens;
}
//# sourceMappingURL=animation-plan.js.map