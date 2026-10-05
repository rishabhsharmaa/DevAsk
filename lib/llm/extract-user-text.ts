/**
 * Extract the latest user text from an AI SDK chat-transport payload.
 *
 * DefaultChatTransport posts the conversation as `messages[]` (UIMessage
 * objects with `parts`), not a top-level `message` string. This helper
 * pulls the most recent user-authored text out of that envelope.
 * Pure function — kept separate so the parsing rule is easy to probe.
 */

interface UIMessageTextPart {
  type: string;
  text?: string;
}

interface UIMessageLike {
  role?: string;
  parts?: UIMessageTextPart[];
}

export function extractLastUserText(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as UIMessageLike;
    if (!msg || msg.role !== 'user' || !Array.isArray(msg.parts)) continue;

    const text = msg.parts
      .filter(
        (part): part is { type: string; text: string } =>
          part?.type === 'text' && typeof part.text === 'string'
      )
      .map((part) => part.text)
      .join('');

    if (text.trim().length > 0) return text.trim();
    // Empty user message — keep scanning earlier ones.
  }

  return null;
}
