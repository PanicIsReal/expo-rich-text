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

export function createSseParseState(): SseParseState {
  return {
    buffer: "",
    lastEventId: "",
  };
}

export function appendSseChunk(
  state: SseParseState,
  chunk: string,
): SseParseResult {
  const normalized = `${state.buffer}${chunk}`
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const trailingIncompleteLine = normalized.endsWith("\n")
    ? ""
    : (lines.pop() ?? "");

  const events: SseEvent[] = [];
  let currentEvent = "message";
  let currentData: string[] = [];
  let currentId = state.lastEventId;
  let currentRetry: number | undefined;

  function dispatch() {
    if (currentData.length === 0) {
      currentEvent = "message";
      currentRetry = undefined;
      return;
    }

    events.push({
      event: currentEvent || "message",
      data: currentData.join("\n"),
      id: currentId || undefined,
      retry: currentRetry,
    });
    currentEvent = "message";
    currentData = [];
    currentRetry = undefined;
  }

  for (const line of lines) {
    if (line === "") {
      dispatch();
      continue;
    }

    if (line.startsWith(":")) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    let value = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    switch (field) {
      case "event":
        currentEvent = value || "message";
        break;
      case "data":
        currentData.push(value);
        break;
      case "id":
        currentId = value;
        break;
      case "retry": {
        const nextRetry = Number.parseInt(value, 10);
        if (Number.isFinite(nextRetry)) {
          currentRetry = nextRetry;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    state: {
      buffer: trailingIncompleteLine,
      lastEventId: currentId,
    },
    events,
  };
}

export function parseSseStream(stream: string): SseEvent[] {
  const { events } = appendSseChunk(createSseParseState(), `${stream}\n\n`);
  return events;
}

export function deriveTextFromSseStream(
  stream: string,
  mode: "concatenate-data" | "last-event-data" = "concatenate-data",
): string {
  const events = parseSseStream(stream);
  if (events.length === 0) {
    return "";
  }

  if (mode === "last-event-data") {
    return events[events.length - 1]?.data ?? "";
  }

  return events.map((event) => event.data).join("");
}
