import React from "react";
import { useChatMessagesController } from "../hooks/useChatMessagesController";
import { isAtBottom, useChatScroll } from "../hooks/useChatScroll";
import { getDebugInfo } from "../utils/devHelpers";
import {
  createChatServer,
  type ChatMessage,
} from "../utils/createChatServer";

interface PendingJump {
  requestId: number;
  targetId: number;
  isolationToken: number;
}

const waitForFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const mergeMessagesById = (
  currentMessages: readonly ChatMessage[],
  nextMessages: readonly ChatMessage[],
) => {
  const messagesById = new Map<number, ChatMessage>();

  currentMessages.forEach((message) => {
    messagesById.set(message.id, message);
  });
  nextMessages.forEach((message) => {
    messagesById.set(message.id, message);
  });

  return Array.from(messagesById.values()).sort((a, b) => a.id - b.id);
};

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

export function ChatMessagesJumpDemo() {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const chatServer = React.useMemo(() => createChatServer(), []);
  const jumpRequestIdRef = React.useRef(0);
  const pendingJumpRef = React.useRef<PendingJump | null>(null);
  const highlightTimeoutRef = React.useRef<number | null>(null);
  const messagesRef = React.useRef<readonly ChatMessage[]>([]);

  const initialMessages = React.useMemo(
    () => chatServer.getInitialMessages("middle", chatServer.pageSize),
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

  const [targetInput, setTargetInput] = React.useState("100");
  const [jumpStatus, setJumpStatus] = React.useState("Ready");
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<
    number | null
  >(null);

  messagesRef.current = controller.messages;

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

  const scroll = useChatScroll({
    getScrollElement: () => parentRef.current,
    messages: controller.messages,
    getMessageKey: (message) => message.id,
    onLoadUpper: loadUpper,
    hasUpper: controller.hasUpper,
    onLoadBottom: loadBottom,
    hasBottom: controller.hasBottom,
  });

  const isCurrentJump = React.useCallback(
    (requestId: number) => jumpRequestIdRef.current === requestId,
    [],
  );

  const finishJump = React.useCallback(
    async ({ isolationToken, requestId, targetId }: PendingJump) => {
      if (!isCurrentJump(requestId)) return;

      setJumpStatus(`Scrolling to ${targetId}...`);
      const scrollToTarget = () =>
        scroll.scrollToMessageKey(targetId, {
          align: "center",
          behavior: "instant",
        });
      const didScroll = scrollToTarget();

      if (!didScroll) {
        if (isCurrentJump(requestId)) {
          scroll.endScrollIsolation(isolationToken);
          setJumpStatus(`Message ${targetId} is not loaded`);
        }
        return;
      }

      await waitForFrame();
      if (!isCurrentJump(requestId)) return;
      scrollToTarget();

      await waitForFrame();
      if (!isCurrentJump(requestId)) return;
      scrollToTarget();

      if (!isCurrentJump(requestId)) return;

      scroll.endScrollIsolation(isolationToken);
      setHighlightedMessageId(targetId);
      setJumpStatus(`Jumped to ${targetId}`);

      if (highlightTimeoutRef.current !== null) {
        clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId((currentId) =>
          currentId === targetId ? null : currentId,
        );
        highlightTimeoutRef.current = null;
      }, 1400);
    },
    [isCurrentJump, scroll],
  );

  React.useLayoutEffect(() => {
    const pendingJump = pendingJumpRef.current;
    if (!pendingJump) return;

    const targetLoaded = controller.messages.some(
      (message) => message.id === pendingJump.targetId,
    );
    if (!targetLoaded) return;

    pendingJumpRef.current = null;
    void finishJump(pendingJump);
  }, [controller.messages, finishJump]);

  React.useEffect(
    () => () => {
      if (highlightTimeoutRef.current !== null) {
        clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );

  const jumpToMessage = React.useCallback(async (_targetId: number) => {
    const parsedTargetId = Number(_targetId);
    if (!Number.isInteger(parsedTargetId)) {
      setJumpStatus("Enter an integer message id");
      return;
    }

    const targetId = Math.max(
      0,
      Math.min(parsedTargetId, chatServer.latestMessageId),
    );
    const oldestId = chatServer.getOldestMessageId(controller.messages);
    const newestId = chatServer.getNewestMessageId(controller.messages);
    if (oldestId === undefined || newestId === undefined) return;

    const requestId = jumpRequestIdRef.current + 1;
    jumpRequestIdRef.current = requestId;
    const isolationToken = scroll.beginScrollIsolation("message-jump");

    const pendingJump = { requestId, targetId, isolationToken };
    if (targetId >= oldestId && targetId <= newestId) {
      void finishJump(pendingJump);
      return;
    }

    setJumpStatus(`Loading around ${targetId}...`);
    const result = await chatServer.fetchMessagesAround(
      targetId,
      {
        oldestId,
        newestId,
        conversationLatestId: chatServer.latestMessageId,
      },
      chatServer.pageSize,
    );

    if (!isCurrentJump(requestId)) return;

    if (result.direction === "loaded" || result.messages.length === 0) {
      void finishJump(pendingJump);
      return;
    }

    pendingJumpRef.current = pendingJump;
    const mergedMessages = mergeMessagesById(
      messagesRef.current,
      result.messages,
    );

    controller.replaceWindow(mergedMessages, {
      hasUpper: (chatServer.getOldestMessageId(mergedMessages) ?? 0) > 0,
      hasBottom:
        (chatServer.getNewestMessageId(mergedMessages) ??
          chatServer.latestMessageId) < chatServer.latestMessageId,
    });
  }, [
    chatServer,
    controller,
    finishJump,
    isCurrentJump,
    scroll,
  ]);

  const pushMessages = (count: number) => {
    const previousLatestId = chatServer.latestMessageId;
    const isLoadedAtConversationLatest =
      chatServer.getNewestMessageId(controller.messages) === previousLatestId;
    const nextMessages = chatServer.getRealtimeMessages(count);

    controller.appendRealtimeMessages(nextMessages, {
      appendToWindow: isLoadedAtConversationLatest,
      hasBottom: !isLoadedAtConversationLatest,
      countAsNew: !isAtBottom(scroll.virtualizer),
    });
  };

  return (
    <div>
        <button onClick={() => jumpToMessage(Number(targetInput))}>jump</button>to
      <label>
        <input
          type="number"
          min={0}
          max={chatServer.latestMessageId}
          value={targetInput}
          onChange={(event) => setTargetInput(event.target.value)}
          style={{ width: 80 }}
        />
      </label>
      <span style={{ padding: "0 4px" }} /> 
      |
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => jumpToMessage(20)}>target 20</button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => jumpToMessage(200)}>target 200</button>
      <span style={{ padding: "0 4px" }} />
      <button onClick={() => pushMessages(1)}>push 1</button>
      <hr />
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        {getDebugInfo(
          scroll,
          controller.messages,
          controller.hasUpper,
          controller.hasBottom,
        )}{" "}
        | Jump: {jumpStatus}
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
