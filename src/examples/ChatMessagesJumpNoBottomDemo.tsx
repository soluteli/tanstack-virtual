import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import {
  createChatServer,
  type ChatMessage,
} from "../utils/createChatServer";

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
  const loadGenerationRef = React.useRef(0);
  const jumpRequestIdRef = React.useRef(0);

  const initialMessages = React.useMemo(
    () => chatServer.getInitialMessages("latest", chatServer.pageSize),
    [chatServer],
  );
  const controller = useChatMessagesController<ChatMessage>({
    initialMessages,
    initialHasUpper: chatServer.hasUpperMessages(initialMessages),
    initialHasBottom: false,
  });

  const [loadingUpper, setLoadingUpper] = React.useState(false);
  const [jumpStatus, setJumpStatus] = React.useState("Ready");

  const loadUpper = React.useCallback(async () => {
    const startingOldestId = chatServer.getOldestMessageId(controller.messages);
    if (startingOldestId === undefined || startingOldestId <= 0) return;

    const loadGeneration = loadGenerationRef.current;
    setLoadingUpper(true);

    const previousMessages = await chatServer.fetchPreviousMessages(
      startingOldestId,
      chatServer.pageSize,
    );

    setLoadingUpper(false);

    if (loadGeneration !== loadGenerationRef.current) return;

    controller.prependMessages(previousMessages, {
      hasUpper: chatServer.hasUpperMessages(previousMessages),
      hasBottom: false,
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
    hasBottom: false,
  });
  const scrollRef = React.useRef(scroll);
  scrollRef.current = scroll;

  const isCurrentJump = React.useCallback(
    (requestId: number) => jumpRequestIdRef.current === requestId,
    [],
  );

  const jumpToInRangeMessage = React.useCallback(async (
    targetId: number,
    isolationToken: number,
  ) => {
    setJumpStatus(`Jumping to ${targetId}...`);


    scrollRef.current.scrollToMessageKey(targetId, {
      align: "center",
      behavior: "smooth",
    });

    scrollRef.current.endScrollIsolation(isolationToken);
    controller.highlightMessage(targetId);
    setJumpStatus(`Jumped to ${targetId}`);
  }, [controller]);

  const jumpToOutOfRangeMessage = React.useCallback(async (
    targetId: number,
    requestId: number,
    oldestId: number,
    newestId: number,
  ) => {
    setJumpStatus(`Loading around ${targetId}...`);

    const result = await chatServer.fetchMessagesAround(
      targetId,
      {
        oldestId,
        newestId,
        conversationLatestId: chatServer.latestMessageId,
      }
    );

    if (!isCurrentJump(requestId)) return;

    if (result.direction !== "loaded" && result.messages.length > 0) {
      const targetMessages = result.direction === 'upper' ? [...result.messages, ...controller.messages] : [...controller.messages, ...result.messages]
      controller.replaceWindow(targetMessages, {
        hasUpper: result.hasUpper,
        hasBottom: false,
      });
    }

  }, [chatServer, controller, isCurrentJump, jumpToInRangeMessage]);

  const jumpToMessage = React.useCallback(async (targetId: number) => {
    const oldestId = chatServer.getOldestMessageId(controller.messages);
    const newestId = chatServer.getNewestMessageId(controller.messages);
    if (oldestId === undefined || newestId === undefined) return;

    const requestId = jumpRequestIdRef.current + 1;
    jumpRequestIdRef.current = requestId;
    scroll.beginScrollIsolation("message-jump");
    loadGenerationRef.current += 1;
    setLoadingUpper(false);

    if (targetId < oldestId || targetId > newestId) {
      console.log('jumpToOutOfRangeMessage')
      await jumpToOutOfRangeMessage(
        targetId,
        requestId,
        oldestId,
        newestId,
      );
      return;
    } else {
      console.log('jumpToInRangeMessage')
      await jumpToInRangeMessage(targetId, requestId);
    }

  }, [
    chatServer,
    controller.messages,
    jumpToInRangeMessage,
    jumpToOutOfRangeMessage,
    scroll,
  ]);

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
          controller.messages,
          controller.hasUpper,
          controller.hasBottom,
        )}{" "}
        | Loading upper: {String(loadingUpper)} | Jump: {jumpStatus}
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
                  <MessageRow
                    highlighted={
                      row.message.id === controller.highlightedMessageId
                    }
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
