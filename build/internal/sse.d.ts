export type SseEvent = {
    event: string;
    data: string;
    id?: string;
    retry?: number;
};
export type SseParseState = {
    buffer: string;
    lastEventId: string;
};
export type SseParseResult = {
    state: SseParseState;
    events: SseEvent[];
};
export declare function createSseParseState(): SseParseState;
export declare function appendSseChunk(state: SseParseState, chunk: string): SseParseResult;
export declare function parseSseStream(stream: string): SseEvent[];
export declare function deriveTextFromSseStream(stream: string, mode?: "concatenate-data" | "last-event-data"): string;
//# sourceMappingURL=sse.d.ts.map