import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import {
  createChatServer,
  type ChatMessage,
} from "../utils/createChatServer";
import { MessageDivider } from "../components/MessageDivider";

function MessageRow({ message }: { message: ChatMessage }) {
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
  const chatServer = React.useMemo(() => createChatServer(), []);
  const initialMessages = React.useMemo(
    () => chatServer.getInitialMessages("middle", chatServer.pageSize),
    [chatServer],
  );

  const controller = useChatMessagesController<ChatMessage>({
    initialMessages,
    initialHasUpper: chatServer.hasUpperMessages(initialMessages),
    initialLatestMessageId: chatServer.getNewestMessageId(initialMessages),
  });

  const loadUpper = React.useCallback(async () => {
    const startingOldestId = chatServer.getOldestMessageId(controller.messages);
    if (startingOldestId === undefined || startingOldestId <= 0) return;

    const previousMessages = await chatServer.fetchPreviousMessages(
      startingOldestId,
      chatServer.pageSize,
    );

    controller.prependMessages(previousMessages, {
      hasUpper: chatServer.hasUpperMessages(previousMessages),
      guard: (currentMessages) =>
        chatServer.getOldestMessageId(currentMessages) === startingOldestId,
    });
  }, [chatServer, controller.messages, controller.prependMessages]);

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

              if (row.type === "new-divider") {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={scroll.virtualizer.measureElement}
                  >
                    <MessageDivider />
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
