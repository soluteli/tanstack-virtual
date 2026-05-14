import { useCallback, useRef, useLayoutEffect, useMemo, useState } from "react";
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
      type: "lower-loading";
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
  onLoadBottom?: () => Promise<void>;
  hasBottom?: boolean;
}

export interface UseChatScrollReturn<TMessage> {
  virtualizer: Virtualizer<Element, Element>;
  onItemSizeAsyncChange: () => void;
  virtualRows: ChatVirtualRow<TMessage>[];
  scrollToMessageIndex: (index: number, options?: ScrollToOptions) => void;
  scrollToLoadedBottom: (options?: ScrollToOptions) => void;
  isStickyBottom: boolean;
  isAtLoadedBottom: boolean;
  isAtConversationLatest: boolean;
  totalHeight: number;
}

type MessageKey = string | number;
type ChatRowKey = string | number;

type ChatRowModel<TMessage> =
  | {
      type: "upper-loading";
      key: ChatRowKey;
    }
  | {
      type: "lower-loading";
      key: ChatRowKey;
    }
  | {
      type: "message";
      key: ChatRowKey;
      messageKey: MessageKey;
      message: TMessage;
      messageIndex: number;
    };

interface UpperAnchor {
  messageKey: MessageKey;
  // prepend 历史消息后，让锚定的 message 维持在同一个 viewport 偏移。
  offsetFromViewportTop: number;
}

interface ScrollFacts {
  isAtLoadedBottom: boolean;
  isStickyBottom: boolean;
}

const LOADED_BOTTOM_THRESHOLD = 4;

const getIsRowBottomReached = (
  instance: Virtualizer<Element, Element>,
  rowIndex: number,
) => {
  const virtualItems = instance.getVirtualItems();
  const item = virtualItems.find(
    (virtualItem) => virtualItem.index === rowIndex,
  );
  if (!item || !instance.scrollRect) return false;

  const scrollOffset = instance.scrollOffset ?? 0;
  const viewportBottom = scrollOffset + instance.scrollRect.height;

  return item.end <= viewportBottom + LOADED_BOTTOM_THRESHOLD;
};

const getLoadedBottomIndex = <TMessage,>(
  rows: readonly ChatRowModel<TMessage>[],
) => {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.type === "message") {
      return index;
    }
  }

  return -1;
};

const getScrollFacts = <TMessage,>(
  instance: Virtualizer<Element, Element>,
  rows: readonly ChatRowModel<TMessage>[],
  hasBottom: boolean | undefined,
): ScrollFacts => {
  const loadedBottomIndex = getLoadedBottomIndex(rows);
  const isAtLoadedBottom =
    loadedBottomIndex !== -1 &&
    getIsRowBottomReached(instance, loadedBottomIndex);

  return {
    isAtLoadedBottom,
    isStickyBottom: !hasBottom && isAtLoadedBottom,
  };
};

const isAtTop = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (virtualItems[0]?.index ?? 0) <= 1;
};

const isAtBottom = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (virtualItems[virtualItems.length - 1]?.index ?? -1) >=
    instance.options.count - 2;
};

export function useChatScroll<TMessage>(
  options: UseChatScrollOptions<TMessage>,
): UseChatScrollReturn<TMessage> {
  const {
    messages,
    getMessageKey,
    getScrollElement,
    onLoadUpper,
    hasUpper,
    onLoadBottom,
    hasBottom,
  } = options;

  const stickToBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const pendingScrollToBottomRef = useRef(false);
  const isLoadingUpperRef = useRef(false);
  const isLoadingBottomRef = useRef(false);
  const [scrollFacts, setScrollFacts] = useState<ScrollFacts>({
    isAtLoadedBottom: true,
    isStickyBottom: true,
  });

  const onLoadUpperRef = useRef(onLoadUpper);
  onLoadUpperRef.current = onLoadUpper;

  const hasUpperRef = useRef(hasUpper);
  hasUpperRef.current = hasUpper;

  const onLoadBottomRef = useRef(onLoadBottom);
  onLoadBottomRef.current = onLoadBottom;

  const hasBottomRef = useRef(hasBottom);
  hasBottomRef.current = hasBottom;

  const upperAnchorRef = useRef<UpperAnchor | null>(null);

  const getMessageKeyValue = useCallback(
    (message: TMessage, index: number): MessageKey =>
      getMessageKey?.(message, index) ?? index,
    [getMessageKey],
  );

  const chatRows = useMemo(() => {
    const rows: ChatRowModel<TMessage>[] = [];

    if (hasUpper) {
      rows.push({
        type: "upper-loading",
        key: "chat-row:upper-loading",
      });
    }

    messages.forEach((message, messageIndex) => {
      const messageKey = getMessageKeyValue(message, messageIndex);
      rows.push({
        type: "message",
        key: messageKey,
        messageKey,
        message,
        messageIndex,
      });
    });

    if (hasBottom) {
      rows.push({
        type: "lower-loading",
        key: "chat-row:lower-loading",
      });
    }

    return rows;
  }, [getMessageKeyValue, hasBottom, hasUpper, messages]);

  const getFirstVisibleMessageAnchor = useCallback(
    (instance: Virtualizer<Element, Element>): UpperAnchor | null => {
      const scrollOffset = instance.scrollOffset ?? 0;
      const virtualItems = instance.getVirtualItems();
      const firstVisibleMessage = virtualItems.find((virtualItem) => {
        // upper-loading 是列表状态 UI，不作为用户正在阅读的 message 锚点。
        if (virtualItem.start < scrollOffset) return false;

        const row = chatRows[virtualItem.index];
        return row?.type === "message";
      });

      if (!firstVisibleMessage) return null;

      const row = chatRows[firstVisibleMessage.index];
      if (row?.type !== "message") return null;

      return {
        messageKey: row.messageKey,
        // 用这个偏移在 prepend 后把同一条 message 恢复到相同 viewport 位置。
        offsetFromViewportTop: firstVisibleMessage.start - scrollOffset,
      };
    },
    [chatRows],
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
    if (!hasUpperRef.current || !onLoadUpperRef.current) return;
    // 在异步 prepend 改变 index 之前，先记录当前 viewport 锚点。
    updateUpperAnchor(instance);
    await onLoadUpperRef.current();
  }, [updateUpperAnchor]);

  const loadNext = useCallback(async function () {
    if (!hasBottomRef.current || !onLoadBottomRef.current) return;
    await onLoadBottomRef.current();
  }, []);

  const virtualizer = useVirtualizer({
    getScrollElement,
    count: chatRows.length,
    estimateSize: () => 150,
    overscan: 5,
    getItemKey: (index) => chatRows[index]?.key ?? index,
    onChange: async (instance, sync) => {
      const nextScrollFacts = getScrollFacts(
        instance,
        chatRows,
        hasBottomRef.current,
      );
      stickToBottomRef.current = nextScrollFacts.isStickyBottom;
      setScrollFacts((currentFacts) => {
        if (
          currentFacts.isAtLoadedBottom === nextScrollFacts.isAtLoadedBottom &&
          currentFacts.isStickyBottom === nextScrollFacts.isStickyBottom
        ) {
          return currentFacts;
        }

        return nextScrollFacts;
      });

      if (!sync) return;

      if (stickToBottomRef.current) {
        upperAnchorRef.current = null;
      }

      if (isLoadingUpperRef.current) {
        // loading 期间如果用户继续滚动，以用户最新看到的 message 作为锚点。
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

      const nearBottom = isAtBottom(instance);
      if (nearBottom && !isLoadingBottomRef.current) {
        isLoadingBottomRef.current = true;
        try {
          await loadNext();
        } catch (error) {}
        isLoadingBottomRef.current = false;
      }
    },
    useFlushSync: false,
  });

  const scrollToLoadedBottom = useCallback(
    (options?: ScrollToOptions) => {
      if (!messages.length) return;
      const loadedBottomIndex = getLoadedBottomIndex(chatRows);
      if (loadedBottomIndex === -1) return;

      virtualizer.scrollToIndex(loadedBottomIndex, {
        align: "end",
        ...options,
      });
    },
    [chatRows, messages.length, virtualizer],
  );

  const scrollToMessageIndex = useCallback(
    (index: number, options?: ScrollToOptions) => {
      if (index < 0 || index >= messages.length) return;

      const virtualIndex = chatRows.findIndex(
        (row) => row.type === "message" && row.messageIndex === index,
      );
      if (virtualIndex === -1) return;

      virtualizer.scrollToIndex(virtualIndex, options);
    },
    [chatRows, messages.length, virtualizer],
  );

  const scheduleScrollToBottom = useCallback(() => {
    if (pendingScrollToBottomRef.current) return;

    pendingScrollToBottomRef.current = true;

    requestAnimationFrame(() => {
      pendingScrollToBottomRef.current = false;
      scrollToLoadedBottom();
    });
  }, [scrollToLoadedBottom]);

  const onItemSizeAsyncChange = useCallback(() => {
    if (stickToBottomRef.current && !virtualizer.isScrolling)
      scheduleScrollToBottom();
  }, [scheduleScrollToBottom, stickToBottomRef, virtualizer]);

  useLayoutEffect(() => {
    if (initializedRef.current && !hasBottom && stickToBottomRef.current) {
      scheduleScrollToBottom();
    }
  }, [scheduleScrollToBottom])
  
  useLayoutEffect(() => {
    stickToBottomRef.current = !hasBottom && scrollFacts.isAtLoadedBottom;
  }, [hasBottom, scrollFacts.isAtLoadedBottom]);

  // 首次进入列表滚到底
  useLayoutEffect(() => {
    if (!messages.length) return;
    if (initializedRef.current) return;

    initializedRef.current = true;
    stickToBottomRef.current = !hasBottom;

    if (!hasBottom) {
      requestAnimationFrame(() => {
        scrollToLoadedBottom();
      });
    }
  }, [hasBottom, messages.length, scrollToLoadedBottom]);

  useLayoutEffect(() => {
    const anchor = upperAnchorRef.current;
    if (anchor) {
      /**
       * !FIXME
       * 消息组件需要定高，如果异步组件不定高，在 loadUpper 后上方的组件高度变化会导致滚动位置不准
       */
      const virtualIndex = chatRows.findIndex(
        (row) => row.type === "message" && row.messageKey === anchor.messageKey,
      );

      if (virtualIndex !== -1) {
        // 优先使用 measured data，必要时 fallback 到 TanStack 计算出的 offset。
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
  }, [chatRows, hasBottom, scheduleScrollToBottom, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const virtualRows = useMemo(
    () =>
      virtualItems
        .map((virtualItem): ChatVirtualRow<TMessage> | null => {
          const row = chatRows[virtualItem.index];
          if (!row) return null;

          if (row.type === "upper-loading") {
            return {
              type: "upper-loading",
              virtualItem,
            };
          }

          if (row.type === "lower-loading") {
            return {
              type: "lower-loading",
              virtualItem,
            };
          }

          return {
            type: "message",
            virtualItem,
            message: row.message,
            messageIndex: row.messageIndex,
          };
        })
        .filter((row): row is ChatVirtualRow<TMessage> => row !== null),
    [chatRows, virtualItems],
  );

  return {
    virtualizer,
    onItemSizeAsyncChange,
    virtualRows,
    scrollToMessageIndex,
    scrollToLoadedBottom,
    isStickyBottom: !hasBottom && scrollFacts.isAtLoadedBottom,
    isAtLoadedBottom: scrollFacts.isAtLoadedBottom,
    isAtConversationLatest: !hasBottom && scrollFacts.isAtLoadedBottom,
    totalHeight: virtualizer.getTotalSize(),
  };
}
