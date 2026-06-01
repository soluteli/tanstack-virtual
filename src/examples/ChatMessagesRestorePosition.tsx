import React from "react";
import { useChatMessages } from "../hooks/useChatMessages";
import { useChatScroll } from "../hooks/useChatScroll";
import type { ChatScrollAnchor } from "../hooks/chat-types";
import { getDebugInfo } from "../utils/devHelpers";
import { createChatServer, type ChatMessage } from "../utils/createChatServer";
import { MessageDivider } from "../components/MessageDivider";

type MessageKey = string | number;

interface ChatRestoreSnapshot {
  messages: ChatMessage[];
  hasPrevious: boolean;
  hasNext: boolean;
  totalMessagesCount: number;
  latestMessageId: number | null;
  anchor: ChatScrollAnchor | null;
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

export function ChatMessagesRestorePosition() {
  const [entered, setEntered] = React.useState(true);
  const [snapshot, setSnapshot] =
    React.useState<ChatRestoreSnapshot | null>(null);

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
            restore key: {snapshot.anchor?.messageKey ?? "-"}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ChatMessagesRestorePositionSession
      initialSnapshot={snapshot}
      onLeave={(nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setEntered(false);
      }}
    />
  );
}

function ChatMessagesRestorePositionSession({
  initialSnapshot,
  onLeave,
}: {
  initialSnapshot: ChatRestoreSnapshot | null;
  onLeave: (snapshot: ChatRestoreSnapshot) => void;
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

  const scroll = useChatScroll({
    rows: controller.rows,
    getScrollElement: () => parentRef.current,
    initialScroll:
      initialSnapshot?.anchor !== null && initialSnapshot?.anchor !== undefined
        ? {
            type: "restore-position",
            meta: {
              anchor: initialSnapshot.anchor,
            },
          }
        : { type: "bottom" },
    onLoadPrevious: loadPrevious,
    hasPrevious: controller.hasPrevious,
  });

  const getFirstVisibleMessageAnchor = React.useCallback(() => {
    const scrollOffset = scroll.virtualizer.scrollOffset ?? 0;
    const firstVisibleRow = scroll.virtualRows.find((row) => {
      if (row.type !== "message") return false;

      return row.virtualItem.start > scrollOffset;
    });

    if (firstVisibleRow?.type !== "message") return null;

    return {
      messageKey: getMessageKey(firstVisibleRow.message),
      offsetFromViewportTop: firstVisibleRow.virtualItem.start - scrollOffset,
    };
  }, [getMessageKey, scroll.virtualRows, scroll.virtualizer]);

  const leaveChat = React.useCallback(() => {
    const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
    onLeave({
      messages: currentMessages,
      hasPrevious: controller.hasPrevious,
      hasNext: controller.hasNext,
      totalMessagesCount: chatServer.totalMessagesCount,
      latestMessageId: chatServer.latestMessageId,
      anchor: getFirstVisibleMessageAnchor(),
    });
  }, [
    chatServer,
    controller.hasNext,
    controller.hasPrevious,
    controller.rows,
    getFirstVisibleMessageAnchor,
    onLeave,
  ]);

  return (
    <div>
      <button onClick={leaveChat}>Leave chat</button>
      <span style={{ padding: "0 4px" }} />
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
            Math.floor(controller.rows.filter((r) => r.type === "message").length / 2),
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
          controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message),
          controller.hasPrevious,
          controller.hasNext,
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
    </div>
  );
}
