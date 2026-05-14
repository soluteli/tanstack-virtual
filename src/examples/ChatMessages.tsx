import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { useChatScroll } from "../hooks/useChatScroll";
import type { MessageWithImage } from "../utils/mockdata";
import { getDebugInfo } from "../utils/devHelpers";
import {
  CHAT_MESSAGES_DEMO_PAGE_SIZE,
  fetchPreviousChatMessages,
  getInitialChatMessages,
  getOldestMessageId,
  hasUpperMessages,
} from "../utils/chatMessagesDemoData";

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

export function ChatMessages() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const initialMessages = React.useMemo(
    () => getInitialChatMessages("middle", CHAT_MESSAGES_DEMO_PAGE_SIZE),
    [],
  );

  const controller = useChatMessagesController<MessageWithImage>({
    initialMessages,
    initialHasUpper: hasUpperMessages(initialMessages),
  });

  const loadUpper = React.useCallback(async () => {
    const startingOldestId = getOldestMessageId(controller.messages);
    if (startingOldestId === undefined || startingOldestId <= 0) return;

    const previousMessages = await fetchPreviousChatMessages(
      startingOldestId,
      CHAT_MESSAGES_DEMO_PAGE_SIZE,
    );

    controller.prependMessages(previousMessages, {
      hasUpper: hasUpperMessages(previousMessages),
      guard: (currentMessages) =>
        getOldestMessageId(currentMessages) === startingOldestId,
    });
  }, [controller.messages, controller.prependMessages]);

  const scroll = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: controller.messages,
    getMessageKey: (message) => message.id,
    onLoadUpper: loadUpper,
    hasUpper: controller.hasUpper,
  });

  return (
    <div>
      <button
        onClick={() => {
          scroll.scrollToMessageIndex(0);
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          scroll.scrollToMessageIndex(
            Math.floor(controller.messages.length / 2),
            { behavior: "smooth" },
          );
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: "0 4px" }} />
      <button
        onClick={() => {
          scroll.scrollToLoadedBottom();
        }}
      >
        scroll to loaded bottom
      </button>
      <span style={{ padding: "0 4px" }} />
      <hr />
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        {getDebugInfo(
          scroll,
          controller.messages,
          controller.hasUpper,
          controller.hasBottom,
        )}
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
