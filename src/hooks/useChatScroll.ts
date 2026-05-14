import { useCallback, useRef, useLayoutEffect, useEffect } from "react";
import {
  useVirtualizer,
  VirtualItem,
  type Virtualizer,
} from "@tanstack/react-virtual";

export interface UseChatScrollOptions {
  count: number;
  getItemKey?: (index: number) => string | number;
  getScrollElement: () => Element | null;
  onLoadUpper?: () => Promise<void>;
  hasUpper?: boolean;
}

export interface UseChatScrollReturn {
  virtualizer: Virtualizer<Element, Element>;
  onItemSizeAsyncChange: () => void;
  virtualItems: VirtualItem[];
  totalHeight: number;
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
  return virtualItems[0].index <= 1;
};

export function useChatScroll(
  options: UseChatScrollOptions,
): UseChatScrollReturn {
  const { count, getItemKey, getScrollElement, onLoadUpper, hasUpper } =
    options;

  const stickToBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const pendingScrollRef = useRef(false);

  const isLoadingUpperRef = useRef(false);

  const onLoadUpperRef = useRef(onLoadUpper);
  onLoadUpperRef.current = onLoadUpper;

  const hasUpperRef = useRef(hasUpper);
  hasUpperRef.current = hasUpper;

  const restoreUpperRef = useRef<null | {
    totalSize: number;
  }>(null);

  const loadPrevious = useCallback(async function (
    instance: Virtualizer<Element, Element>,
  ) {
    if (!hasUpperRef.current) return;
    restoreUpperRef.current = {
      totalSize: instance.getTotalSize(),
    };
    await onLoadUpperRef.current?.();
  }, []);

  const virtualizer = useVirtualizer({
    getScrollElement,
    count,
    estimateSize: () => 150,
    overscan: 5,
    getItemKey,
    onChange: async (instance, sync) => {
      if (!sync) return;

      stickToBottomRef.current = isAtBottom(instance);
      if (stickToBottomRef.current) {
        restoreUpperRef.current = null;
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
    if (!count) return;
    virtualizer.scrollToIndex(count - 1, { align: "end" });
  }, [count, virtualizer]);

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
    if (!count) return;
    if (initializedRef.current) return;

    initializedRef.current = true;
    stickToBottomRef.current = true;

    requestAnimationFrame(() => {
      _scrollToBottom();
    });
  }, [count, _scrollToBottom]);

  useLayoutEffect(() => {
    const restore = restoreUpperRef.current;
    if (restore) {
      /**
       * !FIXME
       * 1. 消息组件需要定高，如果异步组件不定高，在 loadUpper 后上方的组件高度变化会导致滚动位置不准
       * 2. 当前没有处理： loadUpper 开始后，向下滚动，loadUpper 完成，滚动位置会跳回 loadUpper 开始时的位置
       */
      const nextTotalSize = virtualizer.getTotalSize();
      const addedHeight = nextTotalSize - restore.totalSize;
      virtualizer.scrollToOffset(addedHeight);
      restoreUpperRef.current = null;
    }
  }, [count, virtualizer]);

  useEffect(() => {}, [virtualizer]);

  return {
    virtualizer,
    onItemSizeAsyncChange,
    virtualItems: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
  };
}
