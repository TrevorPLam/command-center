import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'

// Mock server data loader
async function getChatHistory() {
  // This would be replaced with actual data fetching from your chat service
  return {
    conversations: [
      {
        id: '1',
        title: 'Welcome Chat',
        lastMessage: 'Welcome to Command Center!',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2', 
        title: 'Code Review',
        lastMessage: 'Can you review this function?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    activeConversation: null,
  }
}

export default async function ChatPage() {
  const data = await getChatHistory()

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Chat</PanelTitle>
        <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent">
          New Chat
        </button>
      </PanelHeader>
      
      <div className="flex h-full flex-col">
        {/* Conversation List */}
        <div className="mb-4 space-y-2">
          {data.conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="cursor-pointer rounded-md border border-border p-3 hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">{conversation.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {new Date(conversation.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground truncate">
                {conversation.lastMessage}
              </p>
            </div>
          ))}
        </div>

        {/* Active Chat Area */}
        <div className="flex-1 rounded-md border border-border bg-muted/50 p-4">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-lg bg-background p-3 border border-border">
                    <p className="text-sm text-foreground">Welcome to Command Center!</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[70%] rounded-lg bg-primary p-3">
                    <p className="text-sm text-primary-foreground">Hello! How can I help you today?</p>
                    <p className="text-xs text-primary-foreground/80 mt-1">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Message Input */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
