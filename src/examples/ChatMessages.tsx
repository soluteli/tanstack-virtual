import React, { useState, useCallback } from "react";
import { genMessagesListHistory } from "../utils/mockdata";
import { useChatScroll } from "../hooks/useChatScroll";

const PAGE_SIZE = 20

const delay = (duration: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, duration);
})

export function ChatMessages() {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const [hasUpper, setHasUpper] = useState(true)


  const [messagesList, setMessagesListData] = useState(() =>
    genMessagesListHistory({ start: 90, size: PAGE_SIZE }),
  );

  const handleLoadUpper = useCallback(async () => {
    const oldestId = messagesList[0].id
    console.log("🚀 ~ ChatMessages ~ oldestId:", oldestId)
    const newPrependData = genMessagesListHistory({ end: oldestId, size: PAGE_SIZE })
    const _hasUpper = newPrependData.length === PAGE_SIZE
    await delay(2000)
    setHasUpper(_hasUpper)
    setMessagesListData([
        ...newPrependData,
        ...messagesList,
      ])
  }, [messagesList])

  const handleLoadBottom = () => {
    const newestId = messagesList[messagesList.length - 1].id
    setMessagesListData((prev) => [
      ...prev,
      ...genMessagesListHistory({ start: newestId + 1, size: PAGE_SIZE }),
    ])
  }

  const {
    virtualizer,
    // onItemSizeAsyncChange,
    virtualRows: listData,
    scrollToMessageIndex,
    totalHeight
  } = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: messagesList,
    getMessageKey: (message) => message.id,
    onLoadUpper: handleLoadUpper,
    hasUpper
  });

  return (
    <div>
      <button
        onClick={() => {
          scrollToMessageIndex(0);
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          scrollToMessageIndex(Math.floor(messagesList.length / 2), {
            behavior: "smooth",
          });
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          scrollToMessageIndex(messagesList.length - 1);
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={handleLoadBottom}>
        load bottom
      </button>
      <span style={{ padding: "0 4px" }} />
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: '80%',
          overflowY: "auto",
          contain: "strict",
          overflowAnchor: "none",
        }}
      >
        <div
          style={{
            height:    totalHeight,
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${listData[0]?.virtualItem.start ?? 0}px)`,
            }}
          >
            {listData.map((row) => {
              const virtualRow = row.virtualItem
              if (row.type === 'upper-loading') {
                return <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                >
                  loading...
                </div>
              }
              const currentItem = row.message
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={
                    virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"
                  }
                >
                  <div style={{ padding: "10px 0" }}>
                    <div>Row {currentItem.id}</div>
                    <div>{currentItem.text}</div>
                    {
                      currentItem.imageUrl &&
                    <img
                      // width="50%"
                      height={30}
                      src={currentItem.imageUrl}
                      // onLoad={onItemSizeAsyncChange}
                    />
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
