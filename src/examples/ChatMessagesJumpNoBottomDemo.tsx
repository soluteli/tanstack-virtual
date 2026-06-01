import React from "react";
import { useChatMessages } from "../hooks/useChatMessages";
import { useMessageHighlight } from "../hooks/useMessageHighlight";
import { useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import { createChatServer, type ChatMessage } from "../utils/createChatServer";
import { MessageDivider } from "../components/MessageDivider";

function MessageRow({
  highlighted,
  message,
}: {
  highlighted: boolean;
  message: ChatMessage;
}) {
  return (
    <div
      className={highlighted ? "ChatMessageJumpHighlight" : undefined}
      style={{ padding: "10px 0" }}
    >
      <div>Row {message.id}</div>
      <div>{message.text}</div>
      {message.imageUrl ? (
        <img height={30} src={message.imageUrl} alt="" />
      ) : null}
    </div>
  );
}

export function ChatMessagesJumpNoBottomDemo() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const chatServer = React.useMemo(() => createChatServer(), []);
  const requestIdRef = React.useRef(0);

  const initialMessages = React.useMemo(
    () => chatServer.rangeMessages,
    [chatServer],
  );
  const controller = useChatMessages<ChatMessage>({
    initialMessages,
    getMessageKey: (message) => message.id,
    initialCursor: {
      hasPrevious: chatServer.hasPreviousMessages(initialMessages),
      hasNext: false,
    },
  });

  const { highlightedMessageId, highlightMessage } = useMessageHighlight();

  const [loadingPrevious, setLoadingPrevious] = React.useState(false);
  const [jumpStatus, setJumpStatus] = React.useState("Ready");

  const loadPrevious = React.useCallback(async () => {
    const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
    const startingOldestId = chatServer.getOldestMessageId(currentMessages);
    if (startingOldestId === undefined || startingOldestId <= 0) return;

    const requestId = requestIdRef.current;
    setLoadingPrevious(true);

    const previousMessages = await chatServer.fetchPreviousMessages(
      startingOldestId,
      chatServer.pageSize,
    );

    setLoadingPrevious(false);

    if (requestId !== requestIdRef.current) return;

    controller.prepend(previousMessages, {
      hasPrevious: chatServer.hasPreviousMessages(previousMessages),
      hasNext: false,
    });
  }, [chatServer, controller.rows, controller.prepend]);

  const scroll = useChatScroll({
    rows: controller.rows,
    getScrollElement: () => parentRef.current,
    onLoadPrevious: loadPrevious,
    hasPrevious: controller.hasPrevious,
    hasNext: false,
  });
  const scrollRef = React.useRef(scroll);
  React.useLayoutEffect(() => {
    scrollRef.current = scroll;
  }, [scroll]);

  const isCurrentJump = React.useCallback(
    (requestId: number) => requestIdRef.current === requestId,
    [],
  );

  const jumpToInRangeMessage = React.useCallback(
    async (targetId: number) => {
      setJumpStatus(`Jumping to ${targetId}...`);

      highlightMessage(targetId);
      scrollRef.current.scrollToMessageKey(targetId, { align: "center" });

      setJumpStatus(`Jumped to ${targetId}`);
    },
    [highlightMessage],
  );

  const jumpToOutOfRangeMessage = React.useCallback(
    async (targetId: number) => {
      const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
      const oldestId = chatServer.getOldestMessageId(currentMessages);
      const newestId = chatServer.getNewestMessageId(currentMessages);
      const requestId = requestIdRef.current + 1;
      if (oldestId === undefined || newestId === undefined) return;

      requestIdRef.current = requestId;
      setLoadingPrevious(false);

      setJumpStatus(`Loading around ${targetId}...`);
      scrollRef.current.markPurposeToJumpMessage(targetId);

      const result = await chatServer.fetchMessagesAround(targetId, {
        oldestId,
        newestId,
        conversationLatestId: chatServer.latestMessageId,
      });

      if (!isCurrentJump(requestId)) return;

      if (result.direction !== "loaded" && result.messages.length > 0) {
        const targetMessages =
          result.direction === "previous"
            ? [...result.messages, ...currentMessages]
            : [...currentMessages, ...result.messages];

        controller.setMessages(targetMessages, {
          hasPrevious: result.hasPrevious,
          hasNext: false,
        });
        highlightMessage(targetId);
      }
    },
    [chatServer, controller, isCurrentJump, jumpToInRangeMessage, highlightMessage],
  );

  const jumpToMessage = React.useCallback(
    async (targetId: number) => {
      const currentMessages = controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message);
      const oldestId = chatServer.getOldestMessageId(currentMessages);
      const newestId = chatServer.getNewestMessageId(currentMessages);

      if (oldestId === undefined || newestId === undefined) return;

      if (targetId < oldestId || targetId > newestId) {
        await jumpToOutOfRangeMessage(targetId);
      } else {
        await jumpToInRangeMessage(targetId);
      }
    },
    [
      chatServer,
      controller.rows,
      jumpToInRangeMessage,
      jumpToOutOfRangeMessage,
      scroll,
    ],
  );

  return (
    <div>
      <button onClick={() => void jumpToMessage(300)}>
        jump loaded target 300
      </button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => void jumpToMessage(40)}>
        jump upper target 40
      </button>
      <hr />
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        {getDebugInfo(
          scroll,
          controller.rows.filter((r): r is typeof r & { type: "message" } => r.type === "message").map(r => r.message),
          controller.hasPrevious,
          controller.hasNext,
        )}{" "}
        | Loading upper: {String(loadingPrevious)} | Jump: {jumpStatus}
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
                  <MessageRow
                    highlighted={row.message.id === highlightedMessageId}
                    message={row.message}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
