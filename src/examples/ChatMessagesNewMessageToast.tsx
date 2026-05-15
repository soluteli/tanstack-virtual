import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { isAtBottom, useChatScroll } from "../hooks/useChatScroll";
import type { MessageWithImage } from "../utils/mockdata";
import { getDebugInfo } from "../utils/devHelpers";
import {
  CHAT_MESSAGES_DEMO_INITIAL_LATEST_ID,
  CHAT_MESSAGES_DEMO_PAGE_SIZE,
  fetchNextChatMessages,
  fetchPreviousChatMessages,
  getInitialChatMessages,
  getNewestMessageId,
  getOldestMessageId,
  getRealtimeChatMessages,
  hasBottomMessages,
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

export function ChatMessagesNewMessageToast() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const conversationLatestIdRef = React.useRef(
    CHAT_MESSAGES_DEMO_INITIAL_LATEST_ID,
  );
  const initialMessages = React.useMemo(
    () => getInitialChatMessages("latest", CHAT_MESSAGES_DEMO_PAGE_SIZE),
    [],
  );
  const controller = useChatMessagesController<MessageWithImage>({
    initialMessages,
    initialHasUpper: hasUpperMessages(initialMessages),
    initialHasBottom: hasBottomMessages(
      initialMessages,
      conversationLatestIdRef.current,
    ),
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

  const loadBottom = React.useCallback(async () => {
    const startingNewestId = getNewestMessageId(controller.messages);
    if (startingNewestId === undefined) return;

    const nextMessages = await fetchNextChatMessages(
      startingNewestId,
      conversationLatestIdRef.current,
      CHAT_MESSAGES_DEMO_PAGE_SIZE,
    );
    const nextNewestId = getNewestMessageId(nextMessages) ?? startingNewestId;

    controller.appendMessages(nextMessages, {
      hasBottom: nextNewestId < conversationLatestIdRef.current,
      guard: (currentMessages) =>
        getNewestMessageId(currentMessages) === startingNewestId,
    });
  }, [controller.appendMessages, controller.messages]);

  const scroll = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: controller.messages,
    getMessageKey: (message) => message.id,
    onLoadUpper: loadUpper,
    hasUpper: controller.hasUpper,
    onLoadBottom: loadBottom,
    hasBottom: controller.hasBottom,
  });

  const pushMessages = (count: number) => {
    const previousLatestId = conversationLatestIdRef.current;
    const nextMessages = getRealtimeChatMessages(previousLatestId, count);
    const nextLatestId = getNewestMessageId(nextMessages) ?? previousLatestId;
    const isLoadedAtConversationLatest =
      getNewestMessageId(controller.messages) === previousLatestId;

    const isNew = !isAtBottom(scroll.virtualizer)
    console.log("🚀 ~ pushMessages ~ isNew:", isNew)

    conversationLatestIdRef.current = nextLatestId;
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
