# Chat 虚拟滚动术语速览

本文用聊天消息列表作为例子，解释虚拟滚动里常见的几个术语。命名参考了社区常见说法：`viewport`、`windowing`、`overscan`、`scroll element`、`loaded range/window`、`unloaded before/after`。

## 核心术语

| 中文术语 | 推荐英文名 | 含义 |
| --- | --- | --- |
| 消息视口 | Message viewport / visible window | 用户当前能看到的消息区域。它通常对应滚动容器的可见高度，例如聊天面板中真正显示消息的那一块。 |
| 消息 overscan | Message overscan / render buffer | 视口上下额外渲染的一小段消息缓冲区。它不一定可见，但提前挂载到 DOM 中，用来减少快速滚动时出现空白。 |
| 消息真实列表数据 | Loaded message data / loaded range | 当前前端已经真实持有的消息数组，例如 `messages[]`。虚拟列表只会从这段数据里挑选“可见 + overscan”的项目进行渲染。 |
| 在当前消息真实列表数据前的未加载数据 | Unloaded previous messages / unloaded prefix | 位于 `messages[0]` 之前、服务端存在但前端还没加载的更早消息。常见触发方式是用户滚到顶部附近后向前分页加载。 |
| 在当前消息真实列表数据后的未加载数据 | Unloaded next messages / unloaded suffix | 位于 `messages[messages.length - 1]` 之后、服务端存在但前端还没加载的更新消息。常见于历史窗口浏览、搜索定位、或非实时尾部加载场景。 |

## 一张图看关系

下面的图把“全量消息历史”和“当前前端已加载数据”区分开。虚拟滚动关心的是：在已加载数据中，根据滚动位置计算哪些消息要被渲染。

```text
全量消息历史，按时间从旧到新排列

┌──────────────────────┬──────────────────────────────────────┬──────────────────────┐
│ 未加载：更早消息       │ 当前消息真实列表数据 messages[]          │ 未加载：更新消息       │
│ unloaded prefix      │ loaded message data / loaded range    │ unloaded suffix      │
└──────────────────────┴──────────────────────────────────────┴──────────────────────┘
                       │                                      │
                       ▼                                      ▼
                 messages[0]                         messages[messages.length - 1]


滚动容器内部的渲染窗口

                 ┌──────────────────────────────────────┐
                 │          loaded message data          │
                 │                                      │
                 │  [未渲染但已加载]                    │
                 │                                      │
                 │  ┌────────────────────────────────┐  │
                 │  │ top overscan                   │  │
                 │  ├────────────────────────────────┤  │
                 │  │ message viewport               │  │
                 │  │ 用户当前真正看见的区域            │  │
                 │  ├────────────────────────────────┤  │
                 │  │ bottom overscan                │  │
                 │  └────────────────────────────────┘  │
                 │                                      │
                 │  [未渲染但已加载]                    │
                 └──────────────────────────────────────┘
```

## 术语之间的边界

`viewport` 是用户看见的区域；`overscan` 是为了滚动体验而额外渲染的区域。两者加起来通常称为当前渲染范围。

```text
rendered range = top overscan + viewport + bottom overscan
```

`messages[]` 是真实已加载数据；它不等于全量历史数据，也不等于 DOM 中当前渲染的节点。三者关系可以理解为：

```text
全量历史数据 >= 当前已加载 messages[] >= 当前渲染 DOM 节点
```

在聊天场景里，这个区分很重要：

- 加载更多更早消息时，通常是在 `messages[]` 前面 prepend 数据。
- 收到新消息时，通常是在 `messages[]` 后面 append 数据。
- 虚拟滚动更新时，通常只改变 DOM 中渲染哪些消息，不一定改变 `messages[]`。
- overscan 增大会让滚动更不容易露出空白，但会增加渲染成本。

## 推荐命名

```ts
type ChatVirtualState = {
  messages: Message[]              // 当前消息真实列表数据
  hasPreviousPage: boolean          // 前面是否还有未加载数据
  hasNextPage: boolean              // 后面是否还有未加载数据
  viewportHeight: number            // 消息视口高度
  overscan: number                  // 消息 overscan，通常按条数或像素配置
  visibleRange: { start: number; end: number }
  renderedRange: { start: number; end: number } // visibleRange + overscan
}
```

## 参考

- TanStack Virtual 使用 `count` 表示要虚拟化的总项目数，`overscan` 表示可见区域上下额外渲染的项目数，并提供 `paddingStart/paddingEnd`、`getTotalSize()` 等概念来描述虚拟列表尺寸。
- web.dev 的 react-window 文章把列表虚拟化也称为一次只渲染一个可见 `window`，并说明 `overscanCount` 用于渲染可见窗口之外的项目，过大则会影响性能。
- React Virtuoso 文档也使用 `viewport`、`overscan`、`increaseViewportBy` 等术语，其中消息列表 API 会描述列表相对于 viewport 和 scroll element 的位置。

相关链接：

- [TanStack Virtual: Virtualizer](https://tanstack.com/virtual/latest/docs/api/virtualizer)
- [web.dev: Virtualize large lists with react-window](https://web.dev/articles/virtualize-long-lists-react-window)
- [React Virtuoso API](https://virtuoso.dev/react-virtuoso/api-reference/virtuoso/)
- [React Virtuoso Message List: ListScrollLocation](https://virtuoso.dev/virtuoso-message-list-api/interfaces/ListScrollLocation/)
