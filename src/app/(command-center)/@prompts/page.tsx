import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'

// Mock server data loader
async function getPrompts() {
  // This would be replaced with actual data fetching from your prompts service
  return {
    systemPrompts: [
      {
        id: 'default-assistant',
        name: 'Default Assistant',
        description: 'General purpose assistant prompt',
        category: 'system',
        usage: 1247,
        lastUsed: new Date(Date.now() - 1800000).toISOString(),
        content: 'You are a helpful AI assistant...',
      },
      {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        description: 'Specialized for code review tasks',
        category: 'system',
        usage: 856,
        lastUsed: new Date(Date.now() - 3600000).toISOString(),
        content: 'You are an expert code reviewer...',
      },
    ],
    userPrompts: [
      {
        id: 'custom-1',
        name: 'Documentation Writer',
        description: 'Helps write technical documentation',
        category: 'user',
        usage: 423,
        lastUsed: new Date(Date.now() - 7200000).toISOString(),
        content: 'You are a technical documentation expert...',
      },
      {
        id: 'custom-2',
        name: 'Debug Helper',
        description: 'Assists with debugging tasks',
        category: 'user',
        usage: 234,
        lastUsed: new Date(Date.now() - 10800000).toISOString(),
        content: 'You are a debugging assistant...',
      },
    ],
    categories: ['system', 'user', 'shared'],
    totalUsage: 2760,
  }
}

export default async function PromptsPage() {
  const data = await getPrompts()

  const allPrompts = [...data.systemPrompts, ...data.userPrompts]

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Prompts</PanelTitle>
        <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent">
          Create Prompt
        </button>
      </PanelHeader>
      
      <div className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border border-border p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{allPrompts.length}</div>
            <div className="text-xs text-muted-foreground">Total Prompts</div>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{data.totalUsage.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Usage</div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          {data.categories.map((category) => (
            <button
              key={category}
              className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded hover:bg-secondary/90 capitalize"
            >
              {category}
            </button>
          ))}
        </div>

        {/* System Prompts */}
        <div>
          <h4 className="font-medium text-foreground mb-3">System Prompts</h4>
          <div className="space-y-2">
            {data.systemPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-foreground text-sm">{prompt.name}</h5>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {prompt.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Used {prompt.usage} times</span>
                      <span>Last: {new Date(prompt.lastUsed).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90">
                      Edit
                    </button>
                    <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90">
                      Use
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Prompts */}
        <div>
          <h4 className="font-medium text-foreground mb-3">User Prompts</h4>
          <div className="space-y-2">
            {data.userPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-foreground text-sm">{prompt.name}</h5>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {prompt.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Used {prompt.usage} times</span>
                      <span>Last: {new Date(prompt.lastUsed).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90">
                      Edit
                    </button>
                    <button className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded hover:bg-destructive/90">
                      Delete
                    </button>
                    <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90">
                      Use
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {allPrompts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No prompts found</p>
            <button className="mt-2 text-sm bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
              Create Your First Prompt
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}
