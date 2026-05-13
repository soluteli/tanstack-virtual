import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import { Column } from './GridVirtualizerDynamic';
import { faker } from '@faker-js/faker';
import { sentences, randomNumber } from '../utils/mockdata';

export const generateColumns = (count: number) => {
  return new Array(count).fill(0).map((_, i) => {
    const key: string = i.toString();
    return {
      key,
      name: `Column ${i}`,
      width: randomNumber(75, 300),
    };
  });
};
export const generateData = (columns: Array<Column>, count = 300) => {
  return new Array(count).fill(0).map((_, rowIndex) => columns.reduce<Array<string>>((acc, _curr, colIndex) => {
    // simulate dynamic size cells
    const val = faker.lorem.lines(((rowIndex + colIndex) % 10) + 1);

    acc.push(val);

    return acc;
  }, [])
  );
};
export function RowVirtualizerExperimental() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const rowRefsMap = React.useRef(new Map<number, HTMLDivElement>());

  const [enabled, setEnabled] = React.useState(true);

  const count = sentences.length;
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    enabled,
    onChange: (instance) => {
      innerRef.current!.style.height = `${instance.getTotalSize()}px`;
      instance.getVirtualItems().forEach((virtualRow) => {
        const rowRef = rowRefsMap.current.get(virtualRow.index);
        if (!rowRef) return;
        rowRef.style.transform = `translateY(${virtualRow.start}px)`;
      });
    },
  });

  const indexes = virtualizer.getVirtualIndexes();

  React.useEffect(() => {
    virtualizer.measure();
  }, []);

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
          virtualizer.scrollToIndex(count / 2);
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count - 1);
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
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: '100%',
            position: 'relative',
          }}
        >
          {indexes.map((index) => (
            <div
              key={index}
              data-index={index}
              ref={(el) => {
                if (el) {
                  virtualizer.measureElement(el);
                  rowRefsMap.current.set(index, el);
                }
              }}
              className={index % 2 ? 'ListItemOdd' : 'ListItemEven'}
            >
              <div style={{ padding: '10px 0' }}>
                <div>Row {index}</div>
                <div>{sentences[index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


