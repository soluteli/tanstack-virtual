import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { isAtBottom, useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import {
  createChatServer,
  type ChatMessage,
} from "../utils/createChatServer";

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

export function ChatMessagesNewMessageToast() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const chatServer = React.useMemo(() => createChatServer(), []);
  const initialMessages = React.useMemo(
    () => chatServer.getInitialMessages("latest", chatServer.pageSize),
    [chatServer],
  );
  const controller = useChatMessagesController<ChatMessage>({
    initialMessages,
    initialHasUpper: chatServer.hasUpperMessages(initialMessages),
    initialHasBottom: chatServer.hasBottomMessages(
      initialMessages,
      chatServer.latestMessageId,
    ),
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

  const loadBottom = React.useCallback(async () => {
    const startingNewestId = chatServer.getNewestMessageId(controller.messages);
    if (startingNewestId === undefined) return;

    const nextMessages = await chatServer.fetchNextMessages(
      startingNewestId,
      chatServer.latestMessageId,
      chatServer.pageSize,
    );
    const nextNewestId =
      chatServer.getNewestMessageId(nextMessages) ?? startingNewestId;

    controller.appendMessages(nextMessages, {
      hasBottom: nextNewestId < chatServer.latestMessageId,
      guard: (currentMessages) =>
        chatServer.getNewestMessageId(currentMessages) === startingNewestId,
    });
  }, [chatServer, controller.appendMessages, controller.messages]);

  const onLatestMessageRead = React.useCallback(async () => {
    controller.clearNewMessageCount()
  }, [controller.clearNewMessageCount])


  const scroll = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: controller.messages,
    getMessageKey: (message) => message.id,
    onLoadUpper: loadUpper,
    hasUpper: controller.hasUpper,
    onLoadBottom: loadBottom,
    hasBottom: controller.hasBottom,
    onLatestMessageRead
  });

  const pushMessages = (count: number) => {
    const previousLatestId = chatServer.latestMessageId;
    const isLoadedAtConversationLatest =
      chatServer.getNewestMessageId(controller.messages) === previousLatestId;
    const nextMessages = chatServer.getRealtimeMessages(count);

    const isNew = !isAtBottom(scroll.virtualizer)
    console.log("🚀 ~ pushMessages ~ isNew:", isNew)

    controller.appendRealtimeMessages(nextMessages, {
      appendToWindow: isLoadedAtConversationLatest,
      hasBottom: !isLoadedAtConversationLatest,
      countAsNew: isNew
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
        {getDebugInfo(
          scroll,
          controller.messages,
          controller.hasUpper,
          controller.hasBottom,
        )}{" "}
      </div>
      <div style={{ position: "relative", height: 400, width: "80%" }}>
        <div
          ref={parentRef}
          className="List"
          style={{
            height: "100%",
            width: "100%",
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
  );
}
