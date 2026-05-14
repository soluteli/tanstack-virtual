import React, { useState, useCallback } from "react";
import { genMessagesListHistory } from "../utils/mockdata";
import { useChatScroll } from "../hooks/useChatScroll";
import { VirtualItem } from "@tanstack/react-virtual";

const PAGE_SIZE = 20

const delay = (duration: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, duration);
})

export function ChatMessages() {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const [messagesList, setMessagesListData] = useState(() =>
    genMessagesListHistory({ start: 90, size: PAGE_SIZE }),
  );

  const handleLoadUpper = useCallback(async () => {
    const oldestId = messagesList[0].id
    console.log("🚀 ~ ChatMessages ~ oldestId:", oldestId)
    const newPrependData = genMessagesListHistory({ end: oldestId, size: PAGE_SIZE })
    await delay(2000)
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
    onItemSizeAsyncChange,
    virtualItems: listData,
    totalHeight
  } = useChatScroll({
    getScrollElement: () => parentRef.current,
    count: messagesList.length,
    getItemKey: (index: number) => messagesList[index].id,
    onLoadUpper: handleLoadUpper
  });

  return (
    <div>
      <button
        onClick={() => {
          virtualizer.scrollToIndex(0);
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(messagesList.length / 2, {
            behavior: "smooth",
          });
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(messagesList.length - 1);
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: "0 4px" }} />
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: 400,
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
              transform: `translateY(${listData[0]?.start ?? 0}px)`,
            }}
          >
            {listData.map((virtualRow: VirtualItem) => {
              const currentItem = messagesList[virtualRow.index]
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
                      width="auto"
                      height={30}
                      src={currentItem.imageUrl}
                      onLoad={onItemSizeAsyncChange}
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
