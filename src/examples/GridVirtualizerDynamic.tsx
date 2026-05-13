import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

export interface Column {
  key: string;
  name: string;
  width: number;
}
export function GridVirtualizerDynamic({
  columns, data,
}: {
  data: Array<Array<string>>;
  columns: Array<Column>;
}) {
  const parentRef = React.useRef<HTMLDivElement | null>(null);

  const parentOffsetRef = React.useRef(0);

  React.useLayoutEffect(() => {
    parentOffsetRef.current = parentRef.current?.offsetTop ?? 0;
  }, []);

  const getColumnWidth = (index: number) => columns[index].width;

  const virtualizer = useWindowVirtualizer({
    count: data.length,
    estimateSize: () => 350,
    overscan: 5,
    scrollMargin: parentOffsetRef.current,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getColumnWidth,
    overscan: 5,
  });
  const columnItems = columnVirtualizer.getVirtualItems();
  const [before, after] = columnItems.length > 0
    ? [
      columnItems[0].start,
      columnVirtualizer.getTotalSize() -
      columnItems[columnItems.length - 1].end,
    ]
    : [0, 0];

  return (
    <div
      ref={parentRef}
      style={{ overflowY: 'auto', border: '1px solid #c8c8c8' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
                display: 'flex',
              }}
            >
              <div style={{ width: `${before}px` }} />
              {columnItems.map((column) => {
                return (
                  <div
                    key={column.key}
                    style={{
                      minHeight: row.index === 0 ? 50 : row.size,
                      width: getColumnWidth(column.index),
                      borderBottom: '1px solid #c8c8c8',
                      borderRight: '1px solid #c8c8c8',
                      padding: '7px 12px',
                    }}
                  >
                    {row.index === 0 ? (
                      <div>{columns[column.index].name}</div>
                    ) : (
                      <div>{data[row.index][column.index]}</div>
                    )}
                  </div>
                );
              })}
              <div style={{ width: `${after}px` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
