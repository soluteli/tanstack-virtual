import { useVirtualizer,  } from '@tanstack/react-virtual';
import React, {useCallback, useRef, useLayoutEffect} from 'react';
import { messagesWithImage as items } from '../utils/mockdata';

function isLastItemVisible(instance: any) {
  const virtualItems = instance.getVirtualItems()

  if (!virtualItems.length) return false

  const lastIndex = instance.options.count - 1

  const lastItem = virtualItems.find(
    (item: any) => item.index === lastIndex,
  )

  if (!lastItem) return false

  const viewportTop = instance.scrollOffset
  const viewportBottom =
    instance.scrollOffset + instance.scrollRect.height

  // 最后一条“部分可见”即可认为在底部
  return (
    lastItem.end > viewportTop &&
    lastItem.start < viewportBottom
  )
}

export function RowVirtualizerDynamicWithImages() {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const [enabled, setEnabled] = React.useState(true);

  /// 用户当前是否保持贴底
  const stickToBottomRef = useRef(true)

  // 首次初始化
  const initializedRef = useRef(false)

  // 避免大量图片同时 load 时频繁 scrollToBottom
  const pendingScrollRef = useRef(false)

  const virtualizer = useVirtualizer({
    count: items.length,

    getScrollElement: () => parentRef.current,

    estimateSize: () => 100,

    overscan: 8,

    getItemKey: (index) => items[index].id,

    onChange: (instance, sync) => {
      // 只在真实 scroll 时更新 sticky 状态
      // 避免图片 resize 导致 totalSize 变化时误修改状态
      if (!sync) return

      stickToBottomRef.current =
        isLastItemVisible(instance)
    },
  })

  const scrollToBottom = useCallback(() => {
    if (!items.length) return

    virtualizer.scrollToIndex(items.length - 1, {
      align: 'end',
    })
  }, [items.length, virtualizer])

  const scheduleScrollToBottom =
    useCallback(() => {
      if (pendingScrollRef.current) return

      pendingScrollRef.current = true

      requestAnimationFrame(() => {
        pendingScrollRef.current = false

        scrollToBottom()
      })
    }, [scrollToBottom])


  // 首次进入列表滚到底
  useLayoutEffect(() => {
    if (!items.length) return
    if (initializedRef.current) return

    initializedRef.current = true
    stickToBottomRef.current = true

    requestAnimationFrame(() => {
      scrollToBottom()
    })
  }, [items.length, scrollToBottom])

  // 新消息追加时：
  // 如果用户仍在底部，则继续保持底部
  useLayoutEffect(() => {
    if (!initializedRef.current) return

    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [items.length, scrollToBottom])

  const listData = virtualizer.getVirtualItems();


  const handleImageLoad = useCallback(
    () => {
      if (stickToBottomRef.current) scheduleScrollToBottom()
    },
    [scheduleScrollToBottom],
  )
  

  
  return (
    <div>
      <button
        onClick={() => {
          virtualizer.scrollToIndex(0);
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(items.length / 2, { behavior: 'smooth' });
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(items.length  - 1);
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          setEnabled((prev) => !prev);
        }}
      >
        turn {enabled ? 'off' : 'on'} virtualizer
      </button>
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: 400,
          overflowY: 'auto',
          contain: 'strict',
          overflowAnchor: 'none',
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${listData[0]?.start ?? 0}px)`,
            }}
          >
            {listData.map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              >
                <div style={{ padding: '10px 0' }}>
                  <div>Row {virtualRow.index}</div>
                  <div>{items[virtualRow.index].text}</div>
                  <img width="50%" src={items[virtualRow.index].imageUrl} onLoad={handleImageLoad} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
