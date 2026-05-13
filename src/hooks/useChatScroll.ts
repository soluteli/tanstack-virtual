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
  onLoadHistory?: () => void;
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


const isAtTop = (
  instance: Virtualizer<Element, Element>,
) => {
  const virtualItems = instance.getVirtualItems()
  return virtualItems[0].index <= 1
};

export function useChatScroll(
  options: UseChatScrollOptions,
): UseChatScrollReturn {
  const { count, getItemKey, getScrollElement, onLoadHistory } = options;

  const stickToBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const pendingScrollRef = useRef(false);
  const isLoadingHistoryRef = useRef(false);
  const onLoadHistoryRef = useRef(onLoadHistory);
  onLoadHistoryRef.current = onLoadHistory;

  const restoreRef = useRef<null | {
    scrollTop: number
    totalSize: number
  }>(null)

  const loadPrevious = useCallback(
    async function(instance: Virtualizer<Element, Element>,) {
    const el = instance.scrollElement
    if (!el) return

    restoreRef.current = {
      scrollTop: el.scrollTop,
      totalSize: virtualizer.getTotalSize(),
    }

    await onLoadHistoryRef.current?.();
  },[])
  
  const virtualizer = useVirtualizer({
    getScrollElement,
    count,
    estimateSize: () => 100,
    overscan: 5,
    getItemKey,
    onChange: (instance, sync) => {
      if (!sync) return;

      stickToBottomRef.current = isAtBottom(instance);

     const nearTop = isAtTop(instance);
      if (nearTop && !isLoadingHistoryRef.current) {
        isLoadingHistoryRef.current = true;
        setTimeout(() => {
          
          loadPrevious(instance)
        }, 2000);
        // isLoadingHistoryRef.current = false;
      }
    },
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
    if (stickToBottomRef.current && !virtualizer.isScrolling) scheduleScrollToBottom();
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
    if (!count) return;
    if (!initializedRef.current) return;
    const restore = restoreRef.current
    if (!restore) return

    // FIXME: 会有一点偏差,后续固定 image size 后再做调整
    const nextTotalSize = virtualizer.getTotalSize()
    const addedHeight = nextTotalSize - restore.totalSize
    virtualizer.scrollToOffset(restore.scrollTop + addedHeight)
    restoreRef.current = null
  }, [count, virtualizer]);



  useEffect(() => {
  }, [virtualizer]);

  return {
    virtualizer,
    onItemSizeAsyncChange,
    virtualItems: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize()
  };
}
