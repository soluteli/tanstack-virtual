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
  getMessageKey: (message: TMessage) => string | number;
  getScrollElement: () => Element | null;
  onLoadUpper?: () => Promise<void>;
  hasUpper?: boolean;
  onLoadBottom?: () => Promise<void>;
  hasBottom?: boolean;
  onLatestMessageRead?: () => void;
}

export interface UseChatScrollReturn<TMessage> {
  virtualizer: Virtualizer<Element, Element>;
  onItemSizeAsyncChange: () => void;
  virtualRows: ChatVirtualRow<TMessage>[];
  beginJumpToMessage: (targetId: string | number) => string | number;
  scrollToMessageKey: (
    messageKey: string | number,
    options?: ScrollToOptions,
  ) => void;
  scrollToMessageIndex: (index: number, options?: ScrollToOptions) => void;
  scrollToLoadedBottom: (options?: ScrollToOptions) => void;
  totalHeight: number;
}

export type ScrollPurposeReason = "message-jump";

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

type ScrollPurpose =
  | {
      purpose: "message-jump";
      meta: {
        targetId: number | string;
        count: number;
      };
    }
  | {
      purpose: "stick-at-bottom";
      meta: {
        count: number;
      };
    }
  | {
      purpose: "load-upper";
      meta: {
        count: number;
        upperAnchor: UpperAnchor | null;
      };
    }
  | {
      purpose: "load-bottom";
      meta: {
        count: number;
      };
    };

type ActiveScrollPurpose = ScrollPurpose;

// Overscan 判断到第一个渲染的 item 渲染时，表示已接近到顶部
const isNearTop = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (virtualItems[0]?.index ?? 0) <= 1;
};

// Overscan 判断到最后一个渲染的 item 渲染时，表示已接近到底部
export const isNearBottom = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (
    (virtualItems[virtualItems.length - 1]?.index ?? -1) >=
    instance.options.count - 1
  );
};

// 判断可 virtualItems 中最后一个是否在视口内
export const isAtBottom = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  const viewportEnd =
    (instance.scrollOffset ?? 0) + (instance.scrollRect?.height ?? 0);
  const isLastVirtualItemInViewport =
    (virtualItems[virtualItems.length - 1]?.start ?? 0) < viewportEnd;
  const nearBottom = isNearBottom(instance);
  return nearBottom && isLastVirtualItemInViewport;
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
    onLatestMessageRead,
  } = options;

  const initializedRef = useRef(false);
  const scheduledToBottomRafRef = useRef<number | null>(null);

  const nextScrollPurposeRef = useRef<ActiveScrollPurpose | null>({
    purpose: "stick-at-bottom",
    meta: {
      count: messages.length,
    },
  });

  const onLoadUpperRef = useRef(onLoadUpper);
  onLoadUpperRef.current = onLoadUpper;

  const hasUpperRef = useRef(hasUpper);
  hasUpperRef.current = hasUpper;

  const onLoadBottomRef = useRef(onLoadBottom);
  onLoadBottomRef.current = onLoadBottom;

  const hasBottomRef = useRef(hasBottom);
  hasBottomRef.current = hasBottom;

  const onLatestMessageReadRef = useRef(onLatestMessageRead);
  onLatestMessageReadRef.current = onLatestMessageRead;

  const isDuringJump = useCallback(
    () => nextScrollPurposeRef.current?.purpose === "message-jump",
    [],
  );

  const setStickAtBottomPurpose = useCallback(() => {
    nextScrollPurposeRef.current = {
      purpose: "stick-at-bottom",
      meta: {
        count: messages.length,
      },
    };
  }, [messages.length]);

  const cancelScheduledScrollToBottom = useCallback(() => {
    if (scheduledToBottomRafRef.current !== null) {
      cancelAnimationFrame(scheduledToBottomRafRef.current);
      scheduledToBottomRafRef.current = null;
    }
  }, []);

  const beginJumpToMessage = useCallback(
    (targetId: MessageKey) => {
      nextScrollPurposeRef.current = {
        purpose: "message-jump",
        meta: {
          targetId,
          count: messages.length,
        },
      };
      cancelScheduledScrollToBottom();
      return targetId;
    },
    [cancelScheduledScrollToBottom, messages.length],
  );

  const getMessageKeyValue = useCallback(
    (message: TMessage, index: number): MessageKey =>
      getMessageKey(message) ?? index,
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
      if (!nextAnchor) return;

      const currentPurpose = nextScrollPurposeRef.current;
      if (currentPurpose?.purpose !== "load-upper") return;

      nextScrollPurposeRef.current = {
        ...currentPurpose,
        meta: {
          ...currentPurpose.meta,
          upperAnchor: nextAnchor,
        },
      };
    },
    [getFirstVisibleMessageAnchor],
  );

  const loadPrevious = useCallback(
    async function (instance: Virtualizer<Element, Element>) {
      if (!hasUpperRef.current || !onLoadUpperRef.current) return;
      // 在异步 prepend 改变 index 之前，先记录当前 viewport 锚点。
      updateUpperAnchor(instance);
      await onLoadUpperRef.current();
    },
    [updateUpperAnchor],
  );

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
      if (!isDuringJump() && !hasBottomRef.current && isAtBottom(instance)) {
        onLatestMessageReadRef.current?.();
      }

      if (!sync) return;
      if (isDuringJump()) return;

      const loadingUpper =
        nextScrollPurposeRef.current?.purpose === "load-upper";
      const loadingBottom =
        nextScrollPurposeRef.current?.purpose === "load-bottom";
      if (!loadingUpper && !loadingBottom) {
        if (isAtBottom(instance)) {
          setStickAtBottomPurpose();
        } else {
          nextScrollPurposeRef.current = null;
        }
      }

      if (loadingUpper) {
        // loading 期间如果用户继续滚动，以用户最新看到的 message 作为锚点。
        updateUpperAnchor(instance);
      }

      const nearTop = isNearTop(instance);
      if (nearTop) {
        nextScrollPurposeRef.current = {
          purpose: "load-upper",
          meta: {
            count: messages.length,
            upperAnchor: getFirstVisibleMessageAnchor(instance),
          },
        };
        try {
          await loadPrevious(instance);
        } catch (error) {}
        if (isDuringJump()) return;
      }

      const nearBottom = isNearBottom(instance);
      if (
        nearBottom &&
        nextScrollPurposeRef.current?.purpose !== "load-bottom"
      ) {
        nextScrollPurposeRef.current = {
          purpose: "load-bottom",
          meta: {
            count: messages.length,
          },
        };
        try {
          await loadNext();
        } catch (error) {}
        const completedPurpose = nextScrollPurposeRef.current;
        if (completedPurpose?.purpose === "load-bottom") {
          nextScrollPurposeRef.current = isAtBottom(instance)
            ? {
                purpose: "stick-at-bottom",
                meta: {
                  count: messages.length,
                },
              }
            : null;
        }
        if (isDuringJump()) return;
      }
    },
    useFlushSync: false,
  });

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

  const scrollToMessageKey = useCallback(
    (messageKey: MessageKey, options?: ScrollToOptions) => {
      const virtualIndex = chatRows.findIndex(
        (row) => row.type === "message" && row.messageKey === messageKey,
      );
      if (virtualIndex === -1) return;

      virtualizer.scrollToIndex(virtualIndex, options);
    },
    [chatRows, virtualizer],
  );

  const scrollToLoadedBottom = useCallback(
    (options?: ScrollToOptions) => {
      if (!messages.length) return;
      if (messages.length > 0) {
        scrollToMessageIndex(messages.length - 1, {
          align: "end",
          ...options,
        });
      }
    },
    [chatRows, messages.length, virtualizer],
  );

  const scheduleScrollToBottom = useCallback(
    (options?: ScrollToOptions) => {
      if (isDuringJump()) return;

      if (scheduledToBottomRafRef.current !== null) {
        cancelScheduledScrollToBottom();
      }

      scheduledToBottomRafRef.current = requestAnimationFrame(() => {
        scheduledToBottomRafRef.current = null;
        if (isDuringJump()) return;
        scrollToLoadedBottom(options);
      });
    },
    [isDuringJump, scrollToLoadedBottom, cancelScheduledScrollToBottom],
  );

  const onItemSizeAsyncChange = useCallback(() => {
    if (isDuringJump()) return;
    if (
      nextScrollPurposeRef.current?.purpose === "stick-at-bottom" &&
      !virtualizer.isScrolling
    ) {
      scheduleScrollToBottom({ behavior: "instant" });
    }
  }, [isDuringJump, scheduleScrollToBottom, virtualizer]);

  // 首次进入列表滚到底
  useLayoutEffect(() => {
    if (initializedRef.current) return;

    initializedRef.current = true;
    scheduleScrollToBottom({ behavior: "instant" });
    setStickAtBottomPurpose();
  }, [messages.length, scheduleScrollToBottom]);

  // 新消息 append 进入列表滚到底
  useLayoutEffect(() => {
    if (!initializedRef.current) return;

    if (nextScrollPurposeRef.current?.purpose === "stick-at-bottom") {
      const isDataGrow =
        messages.length > nextScrollPurposeRef.current?.meta.count;
      // 数量变多，并且在底部
      // USE stick-at-bottom purpose as it can get prev atBottom status
      if (isDataGrow) {
        scheduleScrollToBottom();
      }
    }
  }, [messages.length, scheduleScrollToBottom]);

  // 维持 prepend 场景下的滚动位置
  useLayoutEffect(() => {
    if (!initializedRef.current) return;
    if (nextScrollPurposeRef.current?.purpose === "load-upper") {
      const isDataGrow =
        messages.length > nextScrollPurposeRef.current?.meta.count;
      const anchor = nextScrollPurposeRef.current?.meta.upperAnchor;
      debugger;
      if (anchor && isDataGrow) {
        /**
         * !FIXME
         * 消息组件需要定高，如果异步组件不定高，在 loadUpper 后上方的组件高度变化会导致滚动位置不准
         */
        const virtualIndex = chatRows.findIndex(
          (row) =>
            row.type === "message" && row.messageKey === anchor.messageKey,
        );

        if (virtualIndex !== -1) {
          // 优先使用 measured data，必要时 fallback 到 TanStack 计算出的 offset。
          const measurement = virtualizer.measurementsCache.find(
            (item) => item.index === virtualIndex,
          );
          const itemStart =
            measurement?.start ??
            virtualizer.getOffsetForIndex(virtualIndex)?.[0];

          if (itemStart !== undefined) {
            virtualizer.scrollToOffset(
              itemStart - anchor.offsetFromViewportTop,
            );
          }
        }
      }
    }
  }, [messages.length, virtualizer]);

  useLayoutEffect(() => {
    if (nextScrollPurposeRef.current?.purpose === "message-jump") {
      const currentFirstMessageKey = getMessageKey(messages[0]);
      const currentLastMessageKey = getMessageKey(
        messages[messages.length - 1],
      );
      const targetId = [currentFirstMessageKey, currentLastMessageKey].includes(
        nextScrollPurposeRef.current.meta.targetId,
      )
        ? nextScrollPurposeRef.current.meta.targetId
        : null;
      if (targetId) {
        const align = targetId === currentFirstMessageKey ? 'start' : 'end'
        requestAnimationFrame(() => {
          scrollToMessageKey(targetId, {align});
          if (isAtBottom(virtualizer)) {
            setStickAtBottomPurpose();
          } else {
            nextScrollPurposeRef.current = null;
          }
        });
      }
    }
  }, [messages.length, virtualizer, scrollToMessageKey]);

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
    beginJumpToMessage,
    scrollToMessageKey,
    scrollToMessageIndex,
    scrollToLoadedBottom,
    totalHeight: virtualizer.getTotalSize(),
  };
}
