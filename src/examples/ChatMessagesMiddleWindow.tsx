import React, { useLayoutEffect, useState } from "react";
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


export function ChatMessagesMiddleWindow() {
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

  useLayoutEffect(() => {
    if (!shouldScrollAfterJump) return;

    requestAnimationFrame(() => {
      scroll.scrollToLoadedBottom();
      setShouldScrollAfterJump(false);
    });
  }, [scroll.scrollToLoadedBottom, shouldScrollAfterJump]);

  return (
    <div>
      <button
        onClick={() => {
          controller.jumpToLatest();
          setShouldScrollAfterJump(true);
        }}
      >
        跳到真正最新
      </button>
      <span style={{ padding: "0 8px" }}>
        isAtLoadedBottom: {String(scroll.isAtLoadedBottom)}
      </span>
      <span style={{ padding: "0 8px" }}>
        isAtConversationLatest: {String(scroll.isAtConversationLatest)}
      </span>
      <hr />
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        {getDebugInfo(scroll, controller.messages, controller.hasUpper, controller.hasBottom)}
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
        </div>
      </div>
    </div>
  );
}
