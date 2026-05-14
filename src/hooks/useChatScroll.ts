import { useCallback, useRef, useLayoutEffect, useMemo } from "react";
import {
  useVirtualizer,
  VirtualItem,
  type ScrollToOptions,
  type Virtualizer,
} from "@tanstack/react-virtual";

export type ChatVirtualRow<TMessage> =
  | {
      type: "upper-loading";
      virtualItem: VirtualItem;
    }
  | {
      type: "message";
      virtualItem: VirtualItem;
      message: TMessage;
      messageIndex: number;
    };

export interface UseChatScrollOptions<TMessage> {
  messages: readonly TMessage[];
  getMessageKey?: (message: TMessage, index: number) => string | number;
  getScrollElement: () => Element | null;
  onLoadUpper?: () => Promise<void>;
  hasUpper?: boolean;
}

export interface UseChatScrollReturn<TMessage> {
  virtualizer: Virtualizer<Element, Element>;
  onItemSizeAsyncChange: () => void;
  virtualRows: ChatVirtualRow<TMessage>[];
  scrollToMessageIndex: (index: number, options?: ScrollToOptions) => void;
  totalHeight: number;
}

type MessageKey = string | number;

interface UpperAnchor {
  messageKey: MessageKey;
  offsetFromViewportTop: number;
}

const isAtBottom = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  if (!virtualItems.length) return false;

  const lastIndex = instance.options.count - 1;
  const lastItem = virtualItems.find((item) => item.index === lastIndex);
  if (!lastItem || !instance.scrollRect) return false;

  const scrollOffset = instance.scrollOffset ?? 0;
  const viewportTop = scrollOffset;
  const viewportBottom = scrollOffset + instance.scrollRect.height;

  const atBottom =
    lastItem.end > viewportTop && lastItem.start < viewportBottom;

  return atBottom;
};

const isAtTop = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (virtualItems[0]?.index ?? 0) <= 1;
};

export function useChatScroll<TMessage>(
  options: UseChatScrollOptions<TMessage>,
): UseChatScrollReturn<TMessage> {
  const { messages, getMessageKey, getScrollElement, onLoadUpper, hasUpper } =
    options;

  const virtualCount = messages.length + Number(hasUpper);

  const stickToBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const pendingScrollRef = useRef(false);

  const isLoadingUpperRef = useRef(false);

  const onLoadUpperRef = useRef(onLoadUpper);
  onLoadUpperRef.current = onLoadUpper;

  const hasUpperRef = useRef(hasUpper);
  hasUpperRef.current = hasUpper;

  const upperAnchorRef = useRef<UpperAnchor | null>(null);

  const getMessageIndex = useCallback(
    (virtualIndex: number) => virtualIndex - Number(hasUpper),
    [hasUpper],
  );

  const getVirtualIndex = useCallback(
    (messageIndex: number) => messageIndex + Number(hasUpper),
    [hasUpper],
  );

  const getResolvedMessageKey = useCallback(
    (message: TMessage, index: number): MessageKey =>
      getMessageKey?.(message, index) ?? index,
    [getMessageKey],
  );

  const getFirstVisibleMessageAnchor = useCallback(
    (instance: Virtualizer<Element, Element>): UpperAnchor | null => {
      const scrollOffset = instance.scrollOffset ?? 0;
      const virtualItems = instance.getVirtualItems();
      const firstVisibleMessage = virtualItems.find((virtualItem) => {
        if (hasUpper && virtualItem.index === 0) return false;
        if (virtualItem.end <= scrollOffset) return false;

        const messageIndex = getMessageIndex(virtualItem.index);
        return messageIndex >= 0 && messageIndex < messages.length;
      });

      if (!firstVisibleMessage) return null;

      const messageIndex = getMessageIndex(firstVisibleMessage.index);
      const message = messages[messageIndex];
      const messageKey = getResolvedMessageKey(message, messageIndex);

      return {
        messageKey,
        offsetFromViewportTop: firstVisibleMessage.start - scrollOffset,
      };
    },
    [getMessageIndex, getResolvedMessageKey, hasUpper, messages],
  );

  const updateUpperAnchor = useCallback(
    (instance: Virtualizer<Element, Element>) => {
      const nextAnchor = getFirstVisibleMessageAnchor(instance);
      if (nextAnchor) {
        upperAnchorRef.current = nextAnchor;
      }
    },
    [getFirstVisibleMessageAnchor],
  );

  const loadPrevious = useCallback(async function (
    instance: Virtualizer<Element, Element>,
  ) {
    if (!hasUpperRef.current) return;
    updateUpperAnchor(instance);
    await onLoadUpperRef.current?.();
  }, [updateUpperAnchor]);

  const virtualizer = useVirtualizer({
    getScrollElement,
    count: virtualCount,
    estimateSize: () => 150,
    overscan: 5,
    getItemKey: (index) => {
      if (hasUpper && index === 0) return "upper-loading";

      const messageIndex = hasUpper ? index - 1 : index;
      if (messageIndex < 0 || messageIndex >= messages.length) {
        return messageIndex;
      }

      const message = messages[messageIndex];
      return getMessageKey?.(message, messageIndex) ?? messageIndex;
    },
    onChange: async (instance, sync) => {
      if (!sync) return;

      stickToBottomRef.current = isAtBottom(instance);
      if (stickToBottomRef.current) {
        upperAnchorRef.current = null;
      }

      if (isLoadingUpperRef.current) {
        updateUpperAnchor(instance);
      }

      const nearTop = isAtTop(instance);
      if (nearTop && !isLoadingUpperRef.current) {
        isLoadingUpperRef.current = true;
        try {
          await loadPrevious(instance);
        } catch (error) {}
        isLoadingUpperRef.current = false;
      }
    },
    useFlushSync: false,
  });

  const _scrollToBottom = useCallback(() => {
    if (!messages.length) return;
    virtualizer.scrollToIndex(virtualCount - 1, { align: "end" });
  }, [messages.length, virtualCount, virtualizer]);

  const scrollToMessageIndex = useCallback(
    (index: number, options?: ScrollToOptions) => {
      if (index < 0 || index >= messages.length) return;

      const virtualIndex = getVirtualIndex(index);
      virtualizer.scrollToIndex(virtualIndex, options);
    },
    [getVirtualIndex, messages.length, virtualizer],
  );

  const scheduleScrollToBottom = useCallback(() => {
    if (pendingScrollRef.current) return;

    pendingScrollRef.current = true;

    requestAnimationFrame(() => {
      pendingScrollRef.current = false;
      _scrollToBottom();
    });
  }, [_scrollToBottom]);

  const onItemSizeAsyncChange = useCallback(() => {
    if (stickToBottomRef.current && !virtualizer.isScrolling)
      scheduleScrollToBottom();
  }, [scheduleScrollToBottom, stickToBottomRef, virtualizer]);

  // 首次进入列表滚到底
  useLayoutEffect(() => {
    if (!messages.length) return;
    if (initializedRef.current) return;

    initializedRef.current = true;
    stickToBottomRef.current = true;

    requestAnimationFrame(() => {
      _scrollToBottom();
    });
  }, [messages.length, _scrollToBottom]);

  useLayoutEffect(() => {
    const anchor = upperAnchorRef.current;
    if (anchor) {
      /**
       * !FIXME
       * 消息组件需要定高，如果异步组件不定高，在 loadUpper 后上方的组件高度变化会导致滚动位置不准
       */
      const messageIndex = messages.findIndex(
        (message, index) =>
          getResolvedMessageKey(message, index) === anchor.messageKey,
      );

      if (messageIndex !== -1) {
        const virtualIndex = getVirtualIndex(messageIndex);
        const measurement = virtualizer.measurementsCache.find(
          (item) => item.index === virtualIndex,
        );
        const itemStart =
          measurement?.start ?? virtualizer.getOffsetForIndex(virtualIndex)?.[0];

        if (itemStart !== undefined) {
          virtualizer.scrollToOffset(itemStart - anchor.offsetFromViewportTop);
        }
      }

      upperAnchorRef.current = null;
      return;
    }

    if (initializedRef.current && stickToBottomRef.current) {
      scheduleScrollToBottom();
    }
  }, [
    getResolvedMessageKey,
    getVirtualIndex,
    messages,
    scheduleScrollToBottom,
    virtualCount,
    virtualizer,
  ]);

  const virtualItems = virtualizer.getVirtualItems();
  const virtualRows = useMemo(
    () =>
      virtualItems
        .map((virtualItem): ChatVirtualRow<TMessage> | null => {
          if (hasUpper && virtualItem.index === 0) {
            return {
              type: "upper-loading",
              virtualItem,
            };
          }

          const messageIndex = getMessageIndex(virtualItem.index);
          if (messageIndex < 0 || messageIndex >= messages.length) {
            return null;
          }

          const message = messages[messageIndex];

          return {
            type: "message",
            virtualItem,
            message,
            messageIndex,
          };
        })
        .filter((row): row is ChatVirtualRow<TMessage> => row !== null),
    [getMessageIndex, hasUpper, messages, virtualItems],
  );

  return {
    virtualizer,
    onItemSizeAsyncChange,
    virtualRows,
    scrollToMessageIndex,
    totalHeight: virtualizer.getTotalSize(),
  };
}
