import React from "react";
import { useChatMessages } from "../hooks/useChatMessages";
import { useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import {
  createChatServer,
  type ChatMessage,
} from "../utils/createChatServer";
import { MessageDivider } from "../components/MessageDivider";

const INITIAL_TOTAL_MESSAGES_COUNT = 310;
const INITIAL_PAGE_SIZE = 20;
const INITIAL_RANGE_START =
  INITIAL_TOTAL_MESSAGES_COUNT - 1 - INITIAL_PAGE_SIZE * 3;

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
  const chatServer = React.useMemo(
    () =>
      createChatServer({
        pageSize: INITIAL_PAGE_SIZE,
        totalMessagesCount: INITIAL_TOTAL_MESSAGES_COUNT,
        rangeStart: INITIAL_RANGE_START,
        rangeEnd: INITIAL_RANGE_START + INITIAL_PAGE_SIZE,
      }),
    [],
  );
  const initialMessages = React.useMemo(
    () => chatServer.rangeMessages,
    [chatServer],
  );

  const controller = useChatMessages<ChatMessage>({
    initialMessages,
    getMessageKey: (message) => message.id,
    initialCursor: {
      hasPrevious: chatServer.hasPreviousMessages(initialMessages),
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
    onLoadPrevious: loadPrevious,
    hasPrevious: controller.hasPrevious,
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
