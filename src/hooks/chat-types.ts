import type { VirtualItem } from "@tanstack/react-virtual";

export type MessageKey = string | number;
export type ChatRowKey = string | number;

export type ChatRowModel<TMessage> =
  | { type: "previous-loading"; key: ChatRowKey }
  | { type: "next-loading"; key: ChatRowKey }
  | { type: "new-divider"; key: ChatRowKey }
  | { type: "message"; key: ChatRowKey; messageKey: MessageKey; message: TMessage; messageIndex: number };

export type ChatVirtualRow<TMessage> =
  | { type: "previous-loading"; virtualItem: VirtualItem }
  | { type: "next-loading"; virtualItem: VirtualItem }
  | { type: "new-divider"; virtualItem: VirtualItem }
  | { type: "message"; virtualItem: VirtualItem; message: TMessage; messageIndex: number };

export interface CursorState {
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export interface ChatScrollAnchor {
  messageKey: string | number;
  offsetFromViewportTop: number;
}
