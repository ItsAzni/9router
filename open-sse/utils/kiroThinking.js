const THINKING_START = "<thinking>";
const THINKING_END = "</thinking>";

function longestPrefixSuffix(text, prefix) {
  const max = Math.min(text.length, prefix.length - 1);
  for (let len = max; len > 0; len--) {
    if (text.endsWith(prefix.slice(0, len))) return len;
  }
  return 0;
}

function pushSegment(segments, type, text) {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last?.type === type) {
    last.text += text;
  } else {
    segments.push({ type, text });
  }
}

/**
 * Split Kiro assistant text into normal content and OpenAI reasoning deltas.
 *
 * Some Kiro thinking models stream reasoning inside literal
 * <thinking>...</thinking> tags in assistantResponseEvent.content instead of
 * sending reasoningContentEvent. Keep parsing state so tags split across chunks
 * are removed and their inner text is surfaced as reasoning_content.
 */
export function splitKiroThinkingContent(content, state = {}) {
  const segments = [];
  let text = `${state.kiroThinkingPending || ""}${content || ""}`;
  state.kiroThinkingPending = "";

  while (text) {
    if (state.kiroInThinkingBlock) {
      const endIndex = text.indexOf(THINKING_END);
      if (endIndex >= 0) {
        pushSegment(segments, "reasoning", text.slice(0, endIndex));
        text = text.slice(endIndex + THINKING_END.length);
        state.kiroInThinkingBlock = false;
        continue;
      }

      const keep = longestPrefixSuffix(text, THINKING_END);
      const emitEnd = keep ? text.length - keep : text.length;
      pushSegment(segments, "reasoning", text.slice(0, emitEnd));
      state.kiroThinkingPending = keep ? text.slice(emitEnd) : "";
      break;
    }

    const startIndex = text.indexOf(THINKING_START);
    if (startIndex >= 0) {
      pushSegment(segments, "content", text.slice(0, startIndex));
      text = text.slice(startIndex + THINKING_START.length);
      state.kiroInThinkingBlock = true;
      continue;
    }

    const keep = longestPrefixSuffix(text, THINKING_START);
    const emitEnd = keep ? text.length - keep : text.length;
    pushSegment(segments, "content", text.slice(0, emitEnd));
    state.kiroThinkingPending = keep ? text.slice(emitEnd) : "";
    break;
  }

  return segments;
}

export function flushKiroThinkingContent(state = {}) {
  const pending = state.kiroThinkingPending || "";
  state.kiroThinkingPending = "";
  if (!pending) return [];
  return [{ type: state.kiroInThinkingBlock ? "reasoning" : "content", text: pending }];
}
