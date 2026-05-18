import * as React from 'react'
import { createRoot } from 'react-dom/client'


import { ColumnVirtualizerDynamic } from './examples/ColumnVirtualizerDynamic'
import { GridVirtualizerDynamic } from './examples/GridVirtualizerDynamic'
import { generateColumns, generateData, RowVirtualizerExperimental } from './examples/RowVirtualizerExperimental'
import { RowVirtualizerDynamic } from './examples/RowVirtualizerDynamic'
import { ChatMessages } from './examples/ChatMessages'
import { ChatMessagesJumpNoBottomDemo } from './examples/ChatMessagesJumpNoBottomDemo'
import { ChatMessagesNewMessageToast } from './examples/ChatMessagesNewMessageToast'
import { ChatMessagesRestorePosition } from './examples/ChatMessagesRestorePosition'

import './index.css'

function App() {
  const pathname = location.pathname
  return (
    <div>
      <p>
        These components are using <strong>dynamic</strong> sizes. This means
        that each element's exact dimensions are unknown when rendered. An
        estimated dimension is used as the initial measurement, then this
        measurement is readjusted on the fly as each element is rendered.
      </p>
      <nav>
        <ul>
          <li>
            <a href="/">List</a>
          </li>
          <li>
            <a href="/columns">Column</a>
          </li>
          <li>
            <a href="/grid">Grid</a>
          </li>
          <li>
            <a href="/experimental">Experimental</a>
          </li>
          <li>
            <a href="/chat">chat</a>
          </li>
          <li>
            <a href="/chat-restore-position">chat restore position</a>
          </li>
          <li>
            <a href="/chat-new-message-toast">chat new message toast</a>
          </li>
          <li>
            <a href="/chat-jump-no-bottom">chat jump no bottom</a>
          </li>
        </ul>
      </nav>
      {(() => {
        switch (pathname) {
          case '/':
            return <RowVirtualizerDynamic />
          case '/columns':
            return <ColumnVirtualizerDynamic />
          case '/grid': {
            const columns = generateColumns(30)
            const data = generateData(columns)
            return <GridVirtualizerDynamic columns={columns} data={data} />
          }
          case '/experimental':
            return <RowVirtualizerExperimental />
          case '/chat':
            return <ChatMessages />
          case '/chat-restore-position':
            return <ChatMessagesRestorePosition />
          case '/chat-new-message-toast':
            return <ChatMessagesNewMessageToast />
          case '/chat-jump-no-bottom':
            return <ChatMessagesJumpNoBottomDemo />
          default:
            return <div>Not found</div>
        }
      })()}
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is built for production.
        </p>
      ) : null}
    </div>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)
const { StrictMode } = React

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
