import type { useChatScroll } from "../hooks/useChatScroll";

export function getMessageWindow(messages: { id: number }[]) {
  if (!messages.length) return "Messages: -";
  return `Messages: ${messages[0].id}-${messages[messages.length - 1].id}`;
}

export function getUpperLoadingInfo(
  scroll: ReturnType<typeof useChatScroll>,
  hasUpper: boolean,
) {
  if (!hasUpper) return "Upper loading: false";
  const row = scroll.virtualRows.find((r) => r.type === "upper-loading");
  if (!row) return "Upper loading: false";
  return `Upper loading: true (${row.virtualItem.start}-${row.virtualItem.end})`;
}

export function getLowerLoadingInfo(
  scroll: ReturnType<typeof useChatScroll>,
  hasBottom: boolean,
) {
  if (!hasBottom) return "Lower loading: false";
  const row = scroll.virtualRows.find((r) => r.type === "lower-loading");
  if (!row) return "Lower loading: false";
  return `Lower loading: true (${row.virtualItem.start}-${row.virtualItem.end})`;
}

export function getDebugInfo(
  scroll: ReturnType<typeof useChatScroll>,
  messages: { id: number }[],
  hasUpper: boolean,
  hasBottom: boolean,
) {
  return (
    getMessageWindow(messages) +
    " | " +
    getUpperLoadingInfo(scroll, hasUpper) +
    " | " +
    getLowerLoadingInfo(scroll, hasBottom)
  );
}