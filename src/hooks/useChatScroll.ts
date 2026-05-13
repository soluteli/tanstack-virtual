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
}

export interface UseChatScrollReturn {
  virtualizer: Virtualizer<Element, Element>;
  onItemSizeAsyncChange: () => void;
  virtualItems: VirtualItem[];
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

  return atBottom
};

export function useChatScroll(
  options: UseChatScrollOptions,
): UseChatScrollReturn {
  const { count, getItemKey, getScrollElement } = options;

  const itemsLengthRef = useRef(count);
  const stickToBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const pendingScrollRef = useRef(false);

  const virtualizer = useVirtualizer({
    getScrollElement,
    count,
    estimateSize: () => 100,
    overscan: 10,
    getItemKey,
    onChange: (instance, sync) => {
      if (!sync) return;

      stickToBottomRef.current = isAtBottom(instance);
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
    if (stickToBottomRef.current) scheduleScrollToBottom();
  }, [scheduleScrollToBottom, stickToBottomRef]);

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

  // 新消息追加时：如果用户仍在底部，则继续保持底部
  useLayoutEffect(() => {
    if (!initializedRef.current) return;
    if (count === itemsLengthRef.current) return;
    itemsLengthRef.current = count;

    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        _scrollToBottom();
      });
    }
  }, [count, _scrollToBottom]);

  useEffect(() => {
    console.log("virtualizer", virtualizer);
  }, [virtualizer]);

  return {
    virtualizer,
    onItemSizeAsyncChange,
    virtualItems: virtualizer.getVirtualItems(),
  };
}
