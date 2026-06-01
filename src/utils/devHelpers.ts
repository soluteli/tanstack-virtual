import type { useChatScroll } from "../hooks/useChatScroll";

export function getMessageWindow(messages: { id: number }[]) {
  if (!messages.length) return "Messages: -";
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  if (!firstMessage || !lastMessage) return "Messages: -";
  return `Messages: ${firstMessage.id}-${lastMessage.id}`;
}

export function getPreviousLoadingInfo(
  scroll: ReturnType<typeof useChatScroll>,
  hasPrevious: boolean,
) {
  if (!hasPrevious) return "Previous loading: false";
  const row = scroll.virtualRows.find((r) => r.type === "previous-loading");
  if (!row) return "Previous loading: false";
  return `Previous loading: true (${row.virtualItem.start}-${row.virtualItem.end})`;
}

export function getNextLoadingInfo(
  scroll: ReturnType<typeof useChatScroll>,
  hasNext: boolean,
) {
  if (!hasNext) return "Next loading: false";
  const row = scroll.virtualRows.find((r) => r.type === "next-loading");
  if (!row) return "Next loading: false";
  return `Next loading: true (${row.virtualItem.start}-${row.virtualItem.end})`;
}

export function getDebugInfo(
  scroll: ReturnType<typeof useChatScroll>,
  messages: { id: number }[],
  hasPrevious: boolean,
  hasNext: boolean,
) {
  return (
    getMessageWindow(messages) +
    " | " +
    getPreviousLoadingInfo(scroll, hasPrevious) +
    " | " +
    getNextLoadingInfo(scroll, hasNext)
  );
}
