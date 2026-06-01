import React from "react";
import { useChatMessages } from "../hooks/useChatMessages";
import { useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import { createChatServer, type ChatMessage } from "../utils/createChatServer";
import { MessageDivider } from "../components/MessageDivider";

type MessageKey = string | number;

interface ChatUnreadSnapshot {
  messages: ChatMessage[];
  hasPrevious: boolean;
  hasNext: boolean;
  totalMessagesCount: number;
  latestMessageId: number | null;
  lastReadMessageId: MessageKey | null;
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
  const [snapshot, setSnapshot] = React.useState<ChatUnreadSnapshot | null>(null);

  if (!entered) {
    return (
      <div>
        <button onClick={() => setEntered(true)}>Enter chat</button>
        {snapshot ? (
          <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            Saved messages: {snapshot.messages[0]?.id ?? "-"}-
            {snapshot.messages[snapshot.messages.length - 1]?.id ?? "-"} |
            total: {snapshot.totalMessagesCount} |
            latest: {snapshot.latestMessageId ?? "-"} |
            lastRead: {snapshot.lastReadMessageId ?? "-"}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ChatMessagesNewMessageDividerSession
      initialSnapshot={snapshot}
      onLeave={(nextSnapshot) => {
        setSnapshot(nextSnapshot);
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
  const chatServer = React.useMemo(
    () =>
      createChatServer({
        totalMessagesCount: initialSnapshot?.totalMessagesCount,
        rangeMessages: initialSnapshot?.messages,
        latestMessageId: initialSnapshot?.latestMessageId ?? undefined,
      }),
    [initialSnapshot],
  );
  const getMessageKey = React.useCallback(
    (message: ChatMessage): MessageKey => message.id,
    [],
  );
  const initialMessages = React.useMemo(
    () => chatServer.rangeMessages,
    [chatServer],
  );

  const controller = useChatMessages<ChatMessage>({
    initialMessages,
    getMessageKey,
    initialCursor: {
      hasPrevious:
        initialSnapshot?.hasPrevious ?? chatServer.hasPreviousMessages(initialMessages),
      hasNext:
        initialSnapshot?.hasNext ??
        chatServer.hasNextMessages(initialMessages, chatServer.latestMessageId),
    },
    initialLastReadMessageId: initialSnapshot?.lastReadMessageId ?? null,
  });

  const loadPrevious = React.useCallback(async () => {
    const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
    const startingOldestId = chatServer.getOldestMessageId(currentMessages);
    if (startingOldestId === undefined || startingOldestId <= 0) return;

    const previousMessages = await chatServer.fetchPreviousMessages(
      startingOldestId,
      chatServer.pageSize,
    );

    controller.prepend(previousMessages, {
      hasPrevious: chatServer.hasPreviousMessages(previousMessages),
    });
  }, [chatServer, controller.rows, controller.prepend]);

  const loadNext = React.useCallback(async () => {
    const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
    const startingNewestId = chatServer.getNewestMessageId(currentMessages);
    if (startingNewestId === undefined) return;

    const nextMessages = await chatServer.fetchNextMessages(
      startingNewestId,
      chatServer.latestMessageId,
      chatServer.pageSize,
    );

    controller.append(nextMessages);
  }, [chatServer, controller.append, controller.rows]);

  const onLastMessageRead = React.useCallback(
    (lastMessageKey: string | number) => {
      controller.markMessageRead(lastMessageKey);
    },
    [controller.markMessageRead],
  );

  const scroll = useChatScroll({
    rows: controller.rows,
    getScrollElement: () => parentRef.current,
    onLoadPrevious: loadPrevious,
    hasPrevious: controller.hasPrevious,
    onLoadNext: loadNext,
    hasNext: controller.hasNext,
    onLastMessageRead,
  });

  const pushMessages = React.useCallback(
    (count: number) => {
      const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
      const isLoadedAtConversationLatest =
        chatServer.getNewestMessageId(currentMessages) === chatServer.latestMessageId;
      const nextMessages = chatServer.getRealtimeMessages(count);

      if (isLoadedAtConversationLatest) {
        controller.append(nextMessages, {
          hasNext: !isLoadedAtConversationLatest,
        });
      }
    },
    [chatServer, controller.rows, controller.append],
  );

  const newMessageCount = React.useMemo(() => {
    if (controller.lastReadMessageId === null) return 0;
    let count = 0;
    for (const row of controller.rows) {
      if (row.type === "message" && getMessageKey(row.message) > controller.lastReadMessageId) count++;
    }
    return count;
  }, [controller.rows, controller.lastReadMessageId, getMessageKey]);

  const lastId = React.useMemo(() => {
    const messageRows = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message");
    const last = messageRows[messageRows.length - 1];
    return last ? getMessageKey(last.message) : null;
  }, [controller.rows, getMessageKey]);

  const leaveChat = React.useCallback(() => {
    const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
    onLeave({
      messages: currentMessages,
      hasPrevious: controller.hasPrevious,
      hasNext: controller.hasNext,
      totalMessagesCount: chatServer.totalMessagesCount,
      latestMessageId: chatServer.latestMessageId,
      lastReadMessageId: controller.lastReadMessageId,
    });
  }, [
    chatServer,
    controller.hasNext,
    controller.hasPrevious,
    controller.rows,
    controller.lastReadMessageId,
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
          controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message),
          controller.hasPrevious,
          controller.hasNext,
        )}{" "}
        | LastRead: {controller.lastReadMessageId ?? "-"} | New:{" "}
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

                if (row.type === "previous-loading") {
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

                if (row.type === "next-loading") {
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
              if (lastId !== null) {
                controller.markMessageRead(lastId);
              }
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
