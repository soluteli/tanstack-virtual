import { useCallback, useRef, useLayoutEffect, useMemo } from "react";
import {
  useVirtualizer,
  type ScrollToOptions,
  type Virtualizer,
} from "@tanstack/react-virtual";
import type { ChatRowModel, ChatScrollAnchor, ChatVirtualRow } from "./chat-types";

export type { ChatScrollAnchor, ChatVirtualRow } from "./chat-types";

export type ChatScrollRecovery =
  | { mode: "bottom" }
  | { mode: "anchor"; anchor: ChatScrollAnchor };

export interface UseChatScrollOptions<TMessage> {
  rows: ChatRowModel<TMessage>[];
  getScrollElement: () => Element | null;
  initialScroll?:
    | { type: "bottom" }
    | {
        type: "restore-position";
        meta: {
          anchor: ChatScrollAnchor;
        };
      };
  onLoadPrevious?: () => Promise<void>;
  hasPrevious?: boolean;
  onLoadNext?: () => Promise<void>;
  hasNext?: boolean;
  onLastMessageRead?: (lastMessageKey: string | number) => void;
  onInitialScrollSettled?: () => void;
}

export interface UseChatScrollReturn<TMessage> {
  virtualizer: Virtualizer<Element, Element>;
  onItemSizeAsyncChange: () => void;
  virtualRows: ChatVirtualRow<TMessage>[];
  markPurposeToJumpMessage: (targetId: string | number) => string | number;
  markPurposeToSendMessageBottom: (clientMessageId: string) => void;
  markPurposeToRecovery: (recovery: ChatScrollRecovery) => void;
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
      purpose: "sent-message-to-bottom";
      meta: {
        clientMessageId: string;
      };
    }
  | {
      purpose: "load-previous";
      meta: {
        count: number;
        previousAnchor: ChatScrollAnchor | null;
      };
    }
  | {
      purpose: "load-next";
      meta: {
        count: number;
      };
    }
  | {
      purpose: "reconcile";
      meta:
        | {
            mode: "bottom";
            count: number;
          }
        | {
            mode: "anchor";
            count: number;
            anchor: ChatScrollAnchor;
          };
    };

type ActiveScrollPurpose = ScrollPurpose;

const isScrollPurpose = (
  purpose: ActiveScrollPurpose | null,
  ...targets: ScrollPurpose["purpose"][]
) => purpose !== null && targets.includes(purpose.purpose);

const isNearTop = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (virtualItems[0]?.index ?? 0) <= 1;
};

export const isNearBottom = (instance: Virtualizer<Element, Element>) => {
  const virtualItems = instance.getVirtualItems();
  return (
    (virtualItems[virtualItems.length - 1]?.index ?? -1) >=
    instance.options.count - 1
  );
};

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
    rows,
    getScrollElement,
    initialScroll = { type: "bottom" },
    onLoadPrevious,
    hasPrevious,
    onLoadNext,
    hasNext,
    onLastMessageRead,
    onInitialScrollSettled,
  } = options;

  const initializedRef = useRef(false);
  const scheduledToBottomRafRef = useRef<number | null>(null);
  const scheduledReconcileRafRef = useRef<number | null>(null);

  const nextScrollPurposeRef = useRef<ActiveScrollPurpose | null>(
    initialScroll.type === "bottom"
      ? {
          purpose: "stick-at-bottom",
          meta: {
            count: rows.length,
          },
        }
      : null,
  );

  const onLoadPreviousRef = useRef(onLoadPrevious);
  onLoadPreviousRef.current = onLoadPrevious;

  const hasPreviousRef = useRef(hasPrevious);
  hasPreviousRef.current = hasPrevious;

  const onLoadNextRef = useRef(onLoadNext);
  onLoadNextRef.current = onLoadNext;

  const hasNextRef = useRef(hasNext);
  hasNextRef.current = hasNext;

  const onLastMessageReadRef = useRef(onLastMessageRead);
  onLastMessageReadRef.current = onLastMessageRead;

  const onInitialScrollSettledRef = useRef(onInitialScrollSettled);
  onInitialScrollSettledRef.current = onInitialScrollSettled;

  const setStickAtBottomPurpose = useCallback(() => {
    nextScrollPurposeRef.current = {
      purpose: "stick-at-bottom",
      meta: {
        count: rows.length,
      },
    };
  }, [rows.length]);

  const cancelScheduledScrollToBottom = useCallback(() => {
    if (scheduledToBottomRafRef.current !== null) {
      cancelAnimationFrame(scheduledToBottomRafRef.current);
      scheduledToBottomRafRef.current = null;
    }
  }, []);

  const cancelScheduledReconcile = useCallback(() => {
    if (scheduledReconcileRafRef.current !== null) {
      cancelAnimationFrame(scheduledReconcileRafRef.current);
      scheduledReconcileRafRef.current = null;
    }
  }, []);

  const markPurposeToJumpMessage = useCallback(
    (targetId: MessageKey) => {
      nextScrollPurposeRef.current = {
        purpose: "message-jump",
        meta: {
          targetId,
          count: rows.length,
        },
      };
      cancelScheduledScrollToBottom();
      return targetId;
    },
    [cancelScheduledScrollToBottom, rows.length],
  );

  const markPurposeToSendMessageBottom = useCallback(
    (clientMessageId: string) => {
      nextScrollPurposeRef.current = {
        purpose: "sent-message-to-bottom",
        meta: {
          clientMessageId,
        },
      };
    },
    [],
  );

  const markPurposeToRecovery = useCallback(
    (recovery: ChatScrollRecovery) => {
      const currentPurpose = nextScrollPurposeRef.current;
      if (
        isScrollPurpose(
          currentPurpose,
          "message-jump",
          "sent-message-to-bottom",
          "load-previous",
        )
      ) {
        return;
      }

      cancelScheduledReconcile();
      nextScrollPurposeRef.current =
        recovery.mode === "bottom"
          ? {
              purpose: "reconcile",
              meta: {
                mode: "bottom",
                count: rows.length,
              },
            }
          : {
              purpose: "reconcile",
              meta: {
                mode: "anchor",
                count: rows.length,
                anchor: recovery.anchor,
              },
            };
    },
    [cancelScheduledReconcile, rows.length],
  );

  const getFirstVisibleMessageAnchor = useCallback(
    (instance: Virtualizer<Element, Element>): ChatScrollAnchor | null => {
      const scrollOffset = instance.scrollOffset ?? 0;
      const virtualItems = instance.getVirtualItems();
      const firstVisibleMessage = virtualItems.find((virtualItem) => {
        if (virtualItem.start < scrollOffset) return false;

        const row = rows[virtualItem.index];
        return row?.type === "message";
      });

      if (!firstVisibleMessage) return null;

      const row = rows[firstVisibleMessage.index];
      if (row?.type !== "message") return null;

      return {
        messageKey: row.messageKey,
        offsetFromViewportTop: firstVisibleMessage.start - scrollOffset,
      };
    },
    [rows],
  );

  const updatePreviousAnchor = useCallback(
    (instance: Virtualizer<Element, Element>) => {
      const nextAnchor = getFirstVisibleMessageAnchor(instance);
      if (!nextAnchor) return;

      const currentPurpose = nextScrollPurposeRef.current;
      if (currentPurpose?.purpose !== "load-previous") return;

      nextScrollPurposeRef.current = {
        ...currentPurpose,
        meta: {
          ...currentPurpose.meta,
          previousAnchor: nextAnchor,
        },
      };
    },
    [getFirstVisibleMessageAnchor],
  );

  const loadPrevious = useCallback(
    async function (instance: Virtualizer<Element, Element>) {
      if (!hasPreviousRef.current || !onLoadPreviousRef.current) return;
      updatePreviousAnchor(instance);
      await onLoadPreviousRef.current();
    },
    [updatePreviousAnchor],
  );

  const loadNext = useCallback(async function () {
    if (!hasNextRef.current || !onLoadNextRef.current) return;
    await onLoadNextRef.current();
  }, []);

  const virtualizer = useVirtualizer({
    getScrollElement,
    count: rows.length,
    estimateSize: () => 150,
    overscan: 5,
    getItemKey: (index) => rows[index]?.key ?? index,
    onChange: async (instance, sync) => {
      if (
        !hasNextRef.current &&
        isAtBottom(instance)
      ) {
        const lastMessageRow = [...rows].reverse().find(
          (row) => row.type === "message",
        );
        if (lastMessageRow?.type === "message") {
          onLastMessageReadRef.current?.(lastMessageRow.messageKey);
        }
      }

      if (!sync) return;
      if (isScrollPurpose(nextScrollPurposeRef.current, "message-jump")) return;

      if (
        nextScrollPurposeRef.current?.purpose === "reconcile" &&
        instance.isScrolling
      ) {
        cancelScheduledReconcile();
        nextScrollPurposeRef.current = null;
      }

      const protectedPurpose = isScrollPurpose(
        nextScrollPurposeRef.current,
        "message-jump",
        "sent-message-to-bottom",
        "reconcile",
      );

      const loadingPrevious =
        nextScrollPurposeRef.current?.purpose === "load-previous";
      const loadingNext =
        nextScrollPurposeRef.current?.purpose === "load-next";

      if (!loadingPrevious && !loadingNext && !protectedPurpose) {
        if (isAtBottom(instance)) {
          setStickAtBottomPurpose();
        } else {
          nextScrollPurposeRef.current = null;
        }
      }

      if (loadingPrevious) {
        updatePreviousAnchor(instance);
      }

      const nearTop = isNearTop(instance);
      if (nearTop && hasPreviousRef.current && !protectedPurpose) {
        nextScrollPurposeRef.current = {
          purpose: "load-previous",
          meta: {
            count: rows.length,
            previousAnchor: getFirstVisibleMessageAnchor(instance),
          },
        };
        try {
          await loadPrevious(instance);
        } catch {
          // Loading errors are surfaced by the data layer.
        }
      }

      const nearBottom = isNearBottom(instance);
      if (
        nearBottom &&
        hasNextRef.current &&
        !protectedPurpose &&
        nextScrollPurposeRef.current?.purpose !== "load-next"
      ) {
        nextScrollPurposeRef.current = {
          purpose: "load-next",
          meta: {
            count: rows.length,
          },
        };
        try {
          await loadNext();
        } catch {
          // Loading errors are surfaced by the data layer.
        }
        const completedPurpose = nextScrollPurposeRef.current;
        if (completedPurpose?.purpose === "load-next") {
          nextScrollPurposeRef.current = isAtBottom(instance)
            ? {
                purpose: "stick-at-bottom",
                meta: {
                  count: rows.length,
                },
              }
            : null;
        }
      }
    },
    useFlushSync: false,
  });

  const scrollToMessageIndex = useCallback(
    (index: number, options?: ScrollToOptions) => {
      const virtualIndex = rows.findIndex(
        (row) => row.type === "message" && row.messageIndex === index,
      );
      if (virtualIndex === -1) return;

      virtualizer.scrollToIndex(virtualIndex, options);
    },
    [rows, virtualizer],
  );

  const scrollToMessageKey = useCallback(
    (messageKey: MessageKey, options?: ScrollToOptions) => {
      const virtualIndex = rows.findIndex(
        (row) => row.type === "message" && row.messageKey === messageKey,
      );
      if (virtualIndex === -1) return;

      virtualizer.scrollToIndex(virtualIndex, options);
    },
    [rows, virtualizer],
  );

  const scrollToLoadedBottom = useCallback(
    (options?: ScrollToOptions) => {
      const lastRow = [...rows].reverse().find((row) => row.type === "message");
      if (lastRow?.type !== "message") return;
      scrollToMessageIndex(lastRow.messageIndex, {
        align: "end",
        ...options,
      });
    },
    [rows, scrollToMessageIndex],
  );

  const restoreScrollAnchor = useCallback(
    (anchor: ChatScrollAnchor) => {
      if (scheduledToBottomRafRef.current !== null) {
        cancelScheduledScrollToBottom();
      }

      const restore = () => {
        const virtualIndex = rows.findIndex(
          (row) =>
            row.type === "message" && row.messageKey === anchor.messageKey,
        );

        if (virtualIndex !== -1) {
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
      };

      requestAnimationFrame(restore);
    },
    [rows, cancelScheduledScrollToBottom, virtualizer],
  );

  const scheduleScrollToBottom = useCallback(
    (options?: ScrollToOptions) => {
      if (isScrollPurpose(nextScrollPurposeRef.current, "message-jump")) return;

      if (scheduledToBottomRafRef.current !== null) {
        cancelScheduledScrollToBottom();
      }

      scheduledToBottomRafRef.current = requestAnimationFrame(() => {
        scheduledToBottomRafRef.current = null;
        if (isScrollPurpose(nextScrollPurposeRef.current, "message-jump")) return;
        scrollToLoadedBottom(options);
      });
    },
    [scrollToLoadedBottom, cancelScheduledScrollToBottom],
  );

  const onItemSizeAsyncChange = useCallback(() => {
    if (isScrollPurpose(nextScrollPurposeRef.current, "message-jump")) return;
    if (
      nextScrollPurposeRef.current?.purpose === "stick-at-bottom" &&
      !virtualizer.isScrolling
    ) {
      scheduleScrollToBottom({ behavior: "instant" });
    }
  }, [scheduleScrollToBottom, virtualizer]);

  useLayoutEffect(() => {
    if (initializedRef.current) return;

    initializedRef.current = true;

    if (initialScroll.type === "restore-position") {
      nextScrollPurposeRef.current = null;
      restoreScrollAnchor(initialScroll.meta.anchor);
    } else {
      scheduleScrollToBottom({ behavior: "instant" });
      setStickAtBottomPurpose();
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onInitialScrollSettledRef.current?.();
      });
    });

  }, [
    initialScroll,
    restoreScrollAnchor,
    scheduleScrollToBottom,
    setStickAtBottomPurpose,
  ]);

  useLayoutEffect(() => {
    if (!initializedRef.current) return;

    if (nextScrollPurposeRef.current?.purpose === "stick-at-bottom") {
      const isDataGrow =
        rows.length > nextScrollPurposeRef.current?.meta.count;
      if (isDataGrow) {
        scheduleScrollToBottom();
      }
    }
  }, [rows.length, scheduleScrollToBottom]);

  useLayoutEffect(() => {
    const purpose = nextScrollPurposeRef.current;
    if (purpose?.purpose !== "sent-message-to-bottom") return;

    const clientMessageId = purpose.meta.clientMessageId;
    scheduleScrollToBottom({ behavior: "smooth" });

    const currentPurpose = nextScrollPurposeRef.current;
    if (
      currentPurpose?.purpose === "sent-message-to-bottom" &&
      currentPurpose.meta.clientMessageId === clientMessageId
    ) {
      nextScrollPurposeRef.current = {
        purpose: "stick-at-bottom",
        meta: { count: rows.length },
      };
    }
  }, [rows.length, scheduleScrollToBottom]);

  useLayoutEffect(() => {
    const purpose = nextScrollPurposeRef.current;
    if (purpose?.purpose !== "reconcile") return;

    cancelScheduledReconcile();
    scheduledReconcileRafRef.current = requestAnimationFrame(() => {
      scheduledReconcileRafRef.current = null;
      const currentPurpose = nextScrollPurposeRef.current;
      if (
        currentPurpose?.purpose !== "reconcile" ||
        currentPurpose.meta.count !== purpose.meta.count ||
        currentPurpose.meta.mode !== purpose.meta.mode
      ) {
        return;
      }

      if (currentPurpose.meta.mode === "bottom") {
        scrollToLoadedBottom({ behavior: "instant" });
        setStickAtBottomPurpose();
        return;
      }

      restoreScrollAnchor(currentPurpose.meta.anchor);
      nextScrollPurposeRef.current = null;
    });

    return cancelScheduledReconcile;
  }, [
    cancelScheduledReconcile,
    rows.length,
    restoreScrollAnchor,
    scrollToLoadedBottom,
    setStickAtBottomPurpose,
  ]);

  useLayoutEffect(() => {
    if (!initializedRef.current) return;
    if (nextScrollPurposeRef.current?.purpose === "load-previous") {
      const isDataGrow =
        rows.length > nextScrollPurposeRef.current?.meta.count;
      const anchor = nextScrollPurposeRef.current?.meta.previousAnchor;
      if (anchor && isDataGrow) {
        restoreScrollAnchor(anchor)
        nextScrollPurposeRef.current = null
      }
    }
  }, [rows.length, restoreScrollAnchor]);

  useLayoutEffect(() => {
    const purpose = nextScrollPurposeRef.current;
    if (purpose?.purpose === "message-jump") {
      const firstMessageRow = rows.find(r => r.type === "message");
      const lastMessageRow = [...rows].reverse().find(r => r.type === "message");
      const firstMessageKey = firstMessageRow?.type === "message" ? firstMessageRow.messageKey : undefined;
      const lastMessageKey = lastMessageRow?.type === "message" ? lastMessageRow.messageKey : undefined;

      if (rows.length > 0 && firstMessageKey !== undefined && lastMessageKey !== undefined) {
        const targetId = [firstMessageKey, lastMessageKey].includes(
          purpose.meta.targetId,
        )
          ? purpose.meta.targetId
          : null;
        if (targetId) {
          const align = targetId === firstMessageKey ? "start" : "end";
          requestAnimationFrame(() => {
            const currentPurpose = nextScrollPurposeRef.current;
            if (
              currentPurpose?.purpose !== "message-jump" ||
              currentPurpose.meta.targetId !== targetId
            ) {
              return;
            }

            scrollToMessageKey(targetId, { align });
            if (isAtBottom(virtualizer)) {
              setStickAtBottomPurpose();
            } else {
              nextScrollPurposeRef.current = null;
            }
          });
        }
      }
    }
  }, [
    rows,
    rows.length,
    scrollToMessageKey,
    setStickAtBottomPurpose,
    virtualizer,
  ]);

  const virtualItems = virtualizer.getVirtualItems();
  const virtualRows = useMemo(
    () =>
      virtualItems
        .map((virtualItem): ChatVirtualRow<TMessage> | null => {
          const row = rows[virtualItem.index];
          if (!row) return null;

          if (row.type === "previous-loading") {
            return {
              type: "previous-loading",
              virtualItem,
            };
          }

          if (row.type === "next-loading") {
            return {
              type: "next-loading",
              virtualItem,
            };
          }

          if (row.type === "new-divider") {
            return {
              type: "new-divider",
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
    [rows, virtualItems],
  );

  return {
    virtualizer,
    onItemSizeAsyncChange,
    virtualRows,
    markPurposeToJumpMessage,
    markPurposeToSendMessageBottom,
    markPurposeToRecovery,
    scrollToMessageKey,
    scrollToMessageIndex,
    scrollToLoadedBottom,
    totalHeight: virtualizer.getTotalSize(),
  };
}
