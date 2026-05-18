import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { isAtBottom, useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import { createChatServer, type ChatMessage } from "../utils/createChatServer";
import { MessageDivider } from "../components/MessageDivider";

type MessageKey = string | number;

interface ChatUnreadSnapshot {
  messages: ChatMessage[];
  hasUpper: boolean;
  hasBottom: boolean;
  initialFirstUnreadMessageKey: MessageKey | null;
}

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

export function ChatMessagesNewMessageDivider() {
  const [entered, setEntered] = React.useState(true);
  const snapshotRef = React.useRef<ChatUnreadSnapshot | null>(null);

  if (!entered) {
    const snapshot = snapshotRef.current;

    return (
      <div>
        <button onClick={() => setEntered(true)}>Enter chat</button>
        {snapshot ? (
          <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            Saved messages: {snapshot.messages[0]?.id ?? "-"}-
            {snapshot.messages[snapshot.messages.length - 1]?.id ?? "-"} |
            first unread: {snapshot.initialFirstUnreadMessageKey ?? "-"}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ChatMessagesNewMessageDividerSession
      initialSnapshot={snapshotRef.current}
      onLeave={(snapshot) => {
        snapshotRef.current = snapshot;
        setEntered(false);
      }}
    />
  );
}

function ChatMessagesNewMessageDividerSession({
  initialSnapshot,
  onLeave,
}: {
  initialSnapshot: ChatUnreadSnapshot | null;
  onLeave: (snapshot: ChatUnreadSnapshot) => void;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const chatServer = React.useMemo(() => createChatServer(), []);
  const getMessageKey = React.useCallback(
    (message: ChatMessage): MessageKey => message.id,
    [],
  );
  const initialMessages = React.useMemo(
    () =>
      initialSnapshot?.messages ??
      chatServer.getInitialMessages("latest", chatServer.pageSize),
    [chatServer, initialSnapshot],
  );
  const [initialFirstUnreadMessageKey, setFirstUnreadMessageKey] =
    React.useState<MessageKey | null>(
      initialSnapshot?.initialFirstUnreadMessageKey ?? null,
    );

  const controller = useChatMessagesController<ChatMessage>({
    initialMessages,
    initialHasUpper:
      initialSnapshot?.hasUpper ?? chatServer.hasUpperMessages(initialMessages),
    initialHasBottom: initialSnapshot?.hasBottom ?? false,
    initialLatestMessageId: chatServer.getNewestMessageId(initialMessages),
  });

  console.log("🚀 ~ ChatMessagesNewMessageDividerSession ~ initialFirstUnreadMessageKey:", initialFirstUnreadMessageKey)
  const firstUnreadIndex = React.useMemo(
    () => {
      return initialFirstUnreadMessageKey === null
        ? -1
        : controller.messages.findIndex(
            (message) => getMessageKey(message) === initialFirstUnreadMessageKey,
          );
    },
    [controller.messages, initialFirstUnreadMessageKey, getMessageKey],
  );
  const newMessageCount =
    firstUnreadIndex === -1 ? 0 : controller.messages.length - firstUnreadIndex;

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
      latestMessageId: nextNewestId,
      guard: (currentMessages) =>
        chatServer.getNewestMessageId(currentMessages) === startingNewestId,
    });
  }, [chatServer, controller.appendMessages, controller.messages]);

  const onLatestMessageRead = React.useCallback(() => {
    setFirstUnreadMessageKey(null);
    
    console.log("🚀 ~ ChatMessagesNewMessageDividerSession ~ onLatestMessageRead:")
  }, []);

  const scroll = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: controller.messages,
    getMessageKey,
    initialFirstUnreadMessageKey: initialFirstUnreadMessageKey,
    onLoadUpper: loadUpper,
    hasUpper: controller.hasUpper,
    onLoadBottom: loadBottom,
    hasBottom: controller.hasBottom,
    onLatestMessageRead,
  });

  const pushMessages = React.useCallback(
    (count: number) => {
      const previousLatestId =
        controller.latestMessageId ?? chatServer.latestMessageId;
      const isLoadedAtConversationLatest =
        chatServer.getNewestMessageId(controller.messages) === previousLatestId;
      const nextMessages = chatServer.getRealtimeMessages(count);
      const shouldMarkUnread = !isAtBottom(scroll.virtualizer);

      if (shouldMarkUnread && initialFirstUnreadMessageKey === null) {
        const firstUnreadMessage = nextMessages[0];
        if (firstUnreadMessage) {
          setFirstUnreadMessageKey(getMessageKey(firstUnreadMessage));
        }
      }

      controller.appendRealtimeMessages(nextMessages, {
        appendToWindow: isLoadedAtConversationLatest,
        latestMessageId: chatServer.latestMessageId,
      });
    },
    [
      chatServer,
      controller,
      initialFirstUnreadMessageKey,
      getMessageKey,
      scroll.virtualizer,
    ],
  );

    console.log("🚀 ~ ChatMessagesNewMessageDividerSession ~ initialFirstUnreadMessageKey:", initialFirstUnreadMessageKey)
  const leaveChat = React.useCallback(() => {
      console.log("🚀 ~ ChatMessagesNewMessageDividerSession ~ controller.messages:", controller.messages)
    onLeave({
      messages: controller.messages,
      hasUpper: controller.hasUpper,
      hasBottom: controller.hasBottom,
      initialFirstUnreadMessageKey,
    });
  }, [
    controller.hasBottom,
    controller.hasUpper,
    controller.messages,
    initialFirstUnreadMessageKey,
    onLeave,
  ]);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={leaveChat}>Leave chat</button>
      <span style={{ padding: "0 4px" }} />
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
        | First unread: {initialFirstUnreadMessageKey ?? "-"} | New:{" "}
        {newMessageCount}
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
        {newMessageCount > 0 ? (
          <button
            onClick={() => {
              scroll.scrollToLoadedBottom();
              setFirstUnreadMessageKey(null);
            }}
            style={{
              position: "absolute",
              right: 24,
              bottom: 24,
              zIndex: 1,
            }}
          >
            {newMessageCount} new messages
          </button>
        ) : null}
      </div>
    </div>
  );
}
