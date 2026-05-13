import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { sentences } from '../utils/mockdata'

export function ColumnVirtualizerDynamic() {
  const parentRef = React.useRef<HTMLDivElement | null>(null)

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: sentences.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{ width: 400, height: 400, overflowY: 'auto' }}
      >
        <div
          style={{
            width: virtualizer.getTotalSize(),
            height: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualColumn) => (
            <div
              key={virtualColumn.key}
              data-index={virtualColumn.index}
              ref={virtualizer.measureElement}
              className={
                virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                transform: `translateX(${virtualColumn.start}px)`,
              }}
            >
              <div style={{ width: sentences[virtualColumn.index].length }}>
                <div>Column {virtualColumn.index}</div>
                <div>{sentences[virtualColumn.index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}