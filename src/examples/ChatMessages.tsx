import React from 'react';
import { messagesWithImage as items } from '../utils/mockdata';
import { useChatScroll } from '../hooks/useChatScroll';
import { VirtualItem } from '@tanstack/react-virtual';

export function ChatMessages() {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const { virtualizer, onItemSizeAsyncChange, virtualItems: listData } = useChatScroll(
    {
      getScrollElement: () => parentRef.current,
      count: items.length,
      getItemKey: (index: number) => items[index].id,
    },
  );

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
          virtualizer.scrollToIndex(items.length - 1);
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: '0 4px' }} />
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
            {listData.map((virtualRow: VirtualItem) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              >
                <div style={{ padding: '10px 0' }}>
                  <div>Row {virtualRow.index}</div>
                  <div>{items[virtualRow.index].text}</div>
                  <img width="50%" src={items[virtualRow.index].imageUrl} onLoad={onItemSizeAsyncChange} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}