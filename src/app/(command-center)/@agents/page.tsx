import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'

// Mock server data loader
async function getAgents() {
  // This would be replaced with actual data fetching from your agents service
  return {
    agents: [
      {
        id: 'code-assistant',
        name: 'Code Assistant',
        description: 'Helps with code review, debugging, and refactoring',
        status: 'active' as const,
        capabilities: ['code-review', 'debugging', 'refactoring'],
        lastRun: new Date(Date.now() - 1800000).toISOString(),
        totalRuns: 1247,
        successRate: 0.94,
      },
      {
        id: 'data-analyst',
        name: 'Data Analyst',
        description: 'Analyzes data and generates insights',
        status: 'inactive' as const,
        capabilities: ['data-analysis', 'visualization', 'reporting'],
        lastRun: new Date(Date.now() - 7200000).toISOString(),
        totalRuns: 856,
        successRate: 0.89,
      },
      {
        id: 'research-assistant',
        name: 'Research Assistant',
        description: 'Helps with research and information gathering',
        status: 'active' as const,
        capabilities: ['research', 'summarization', 'fact-checking'],
        lastRun: new Date(Date.now() - 900000).toISOString(),
        totalRuns: 423,
        successRate: 0.91,
      },
    ],
    systemStatus: 'healthy' as const,
  }
}

export default async function AgentsPage() {
  const data = await getAgents()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'online'
      case 'inactive':
        return 'offline'
      case 'error':
        return 'error'
      default:
        return 'offline'
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Agents</PanelTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={data.systemStatus === 'healthy' ? 'online' : 'error'} />
          <span className="text-sm text-muted-foreground capitalize">
            {data.systemStatus}
          </span>
        </div>
      </PanelHeader>
      
      <div className="space-y-3">
        {data.agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-md border border-border p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{agent.name}</h4>
                  <StatusIndicator status={getStatusVariant(agent.status)} />
                  <span className="text-xs text-muted-foreground capitalize">
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {agent.description}
                </p>
                
                <div className="flex flex-wrap gap-1 mt-2">
                  {agent.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Runs: {agent.totalRuns.toLocaleString()}</span>
                  <span>Success: {(agent.successRate * 100).toFixed(1)}%</span>
                  <span>Last run: {new Date(agent.lastRun).toLocaleTimeString()}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                {agent.status === 'inactive' ? (
                  <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90">
                    Activate
                  </button>
                ) : (
                  <button className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded hover:bg-secondary/90">
                    Configure
                  </button>
                )}
                <button className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded hover:bg-destructive/90">
                  {agent.status === 'active' ? 'Stop' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {data.agents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No agents configured</p>
            <button className="mt-2 text-sm bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
              Create Agent
            </button>
          </div>
        )}
        
        <div className="pt-4 border-t border-border">
          <button className="w-full text-sm bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/90">
            + Create New Agent
          </button>
        </div>
      </div>
    </Panel>
  )
}
