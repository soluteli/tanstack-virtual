import React, { useEffect } from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { useChatScroll } from "../hooks/useChatScroll";
import type { MessageWithImage } from "../utils/mockdata";
import { getDebugInfo } from "../utils/devHelpers";

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


export function ChatMessagesNewMessageToast() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const controller = useChatMessagesController({ initialMode: "latest" });
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

  const pushMessages = (count: number) => {
    controller.pushMessages(count, {
      countAsNew: !scroll.isAtConversationLatest,
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => pushMessages(1)}>push 1</button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => pushMessages(5)}>push 5</button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => scroll.scrollToLoadedBottom()}>
        scroll to bottom
      </button>
      <hr />
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        {getDebugInfo(scroll, controller.messages, controller.hasUpper, controller.hasBottom)} |  isStickyBottom: {String(scroll.isStickyBottom)}
      </div>
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
            {controller.newMessageCount > 0 ? (
            <button
              onClick={() => {
                scroll.scrollToLoadedBottom();
                controller.clearNewMessageCount();
              }}
              style={{
                position: "absolute",
                right: 24,
                bottom: 24,
                zIndex: 1,
              }}
            >
              {controller.newMessageCount} 条新消息
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
