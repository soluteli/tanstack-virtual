import React, { useEffect, useLayoutEffect, useState } from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { useChatScroll } from "../hooks/useChatScroll";
import type { MessageWithImage } from "../utils/mockdata";

function MessageRow({ message }: { message: MessageWithImage }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div>Row {message.id}</div>
      <div>{message.text}</div>
      {message.imageUrl ? (
        <img height={30} src={message.imageUrl} alt="" />
      ) : null}
    </div>
  );
}

export function ChatMessagesFullDemo() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [shouldScrollAfterJump, setShouldScrollAfterJump] = useState(false);
  const controller = useChatMessagesController({ initialMode: "middle" });
  const scroll = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: controller.messages,
    getMessageKey: (message) => message.id,
    onLoadUpper: controller.loadUpper,
    hasUpper: controller.hasUpper,
    onLoadBottom: controller.loadBottom,
    hasBottom: controller.hasBottom,
  });

  useEffect(() => {
    if (scroll.isAtConversationLatest) {
      controller.clearNewMessageCount();
    }
  }, [controller.clearNewMessageCount, scroll.isAtConversationLatest]);

  useLayoutEffect(() => {
    if (!shouldScrollAfterJump) return;

    requestAnimationFrame(() => {
      scroll.scrollToLoadedBottom();
      setShouldScrollAfterJump(false);
    });
  }, [scroll.scrollToLoadedBottom, shouldScrollAfterJump]);

  const pushMessages = (count: number) => {
    controller.pushMessages(count, {
      countAsNew: !scroll.isAtConversationLatest,
    });
  };

  const jumpToLatest = () => {
    controller.jumpToLatest();
    setShouldScrollAfterJump(true);
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => pushMessages(1)}>push 1</button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => pushMessages(5)}>push 5</button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={jumpToLatest}>跳到真正最新</button>
      <span style={{ padding: "0 8px" }}>
        isAtLoadedBottom: {String(scroll.isAtLoadedBottom)}
      </span>
      <span style={{ padding: "0 8px" }}>
        isAtConversationLatest: {String(scroll.isAtConversationLatest)}
      </span>
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: "80%",
          overflowY: "auto",
          contain: "strict",
          overflowAnchor: "none",
        }}
      >
        <div
          style={{
            height: scroll.totalHeight,
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
              transform: `translateY(${
                scroll.virtualRows[0]?.virtualItem.start ?? 0
              }px)`,
            }}
          >
            {scroll.virtualRows.map((row) => {
              const virtualRow = row.virtualItem;

              if (row.type === "upper-loading") {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={scroll.virtualizer.measureElement}
                  >
                    loading previous...
                  </div>
                );
              }

              if (row.type === "lower-loading") {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={scroll.virtualizer.measureElement}
                  >
                    loading next...
                  </div>
                );
              }

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={scroll.virtualizer.measureElement}
                  className={
                    virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"
                  }
                >
                  <MessageRow message={row.message} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {controller.newMessageCount > 0 ? (
        <button
          onClick={jumpToLatest}
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 1,
          }}
        >
          {controller.newMessageCount} 条新消息
        </button>
      ) : null}
    </div>
  );
}
