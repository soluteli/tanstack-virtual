## Features
### 初始化进入滚动到底部 - Done

### 新消息推送 - Done
- 最后一条消息可见 - 
- 最后一条消息不可见 - 展示 “新消息提示”
  - 点击 “新消息提示”，滚动到最后一条新消息
  - 滚动到最后一条消息，不展示 “新消息提示”

### 滚动到顶部 - Done
- 加载历史消息，修正滚动位置


### 消息跳转
- 如果目标消息在 loaded messages 内，直接跳转
- 如果不在， 加载与目标消息的差值，加载完成后做跳转
- 跳转消息后需要短暂高亮
  
**需要考虑被动滚动行为冲突**


### 离开后重新进入滚动位置恢复分析
- 初次加载加载 [ x ~ latest message]
- 离开时记住 第一个 messageIndex
- （**此时当前的 loaded messages 应该是保存的**）
- 重新进入后，渲染 loaded messages ，并滚动到保存的 messageIndex 

### 新消息分隔符号设计
- 加一个 firstUnread messageIndex, 动态计算 new message count 和添加 new divider
- 离开时如果我有看完，不取消 unread message index



## 被动滚动分析

### 被动滚动情况列表
- loadUpper 历史消息 - 修正滚动位置 (利用定位 anchor)
- loadBottom 新消息 -  位置不做处理 （当前应该不需要）
- append 推送新消息 - 当前在列表底部，要把列表滚到底 - (监听 count 增加来处理的)

### 竞态冲突处理
TODO
- 拆分 demo 文件





----



## 另一个方案 （Not Apply）
- 初始化时，通过跳转列表算出 startmessageIndex
- loadUpper 时，也需要递归找出对应的 startIndex，返回 delta 列表
- 递归找的时候做一个最大 delta 限制