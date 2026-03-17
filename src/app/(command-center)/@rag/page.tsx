import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { IngestionDropzone } from '@/components/rag/ingestion-dropzone'
import { getIngestionJobsAction, getDocumentStatsAction, getIndexesAction } from '@/app/actions/ingestion'
import type { UploadFilesActionResult } from '@/app/actions/ingestion'

// Server data loader
async function getRagStatus() {
  // Get real data from actions
  const [statsResult, indexesResult, jobsResult] = await Promise.all([
    getDocumentStatsAction(),
    getIndexesAction(),
    getIngestionJobsAction()
  ])

  return {
    documents: statsResult.success ? {
      total: statsResult.stats?.totalDocuments || 0,
      indexed: statsResult.stats?.indexedDocuments || 0,
      failed: statsResult.stats?.failedDocuments || 0,
      processing: statsResult.stats?.processingDocuments || 0,
    } : {
      total: 0,
      indexed: 0,
      failed: 0,
      processing: 0,
    },
    embeddings: {
      model: 'text-embedding-ada-002', // Would come from settings
      dimensions: 1536,
      totalVectors: statsResult.stats?.totalEmbeddings || 0,
      indexSize: statsResult.stats?.indexSize || '0MB',
    },
    indexes: indexesResult.success ? indexesResult.indexes || [] : [],
    jobs: jobsResult.success ? jobsResult.jobs || [] : [],
    retrieval: {
      topK: 5,
      similarityThreshold: 0.7,
      lastQuery: 'How to implement authentication?',
      queryTime: 145, // ms
    },
  }
}

export default async function RagPage() {
  const data = await getRagStatus()

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>RAG</PanelTitle>
      </PanelHeader>
      
      <div className="space-y-6">
        {/* Document Ingestion */}
        <IngestionDropzone 
          onUploadStart={(jobId) => {
            console.log('Upload started:', jobId)
          }}
          onUploadComplete={(result) => {
            console.log('Upload completed:', result)
          }}
        />

        {/* Documents Overview */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">Documents</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{data.documents.total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.documents.indexed.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Indexed</div>
            </div>
          </div>
          {data.documents.processing > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              {data.documents.processing} documents currently processing...
            </div>
          )}
        </div>

        {/* Active Jobs */}
        {data.jobs.length > 0 && (
          <div className="rounded-md border border-border p-4">
            <h4 className="font-medium text-foreground mb-3">Active Jobs</h4>
            <div className="space-y-3">
              {data.jobs.slice(0, 3).map((job) => (
                <div key={job.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">{job.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.type} • {job.status} • Started {new Date(job.startedAt || job.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={job.status === 'running' ? 'online' : job.status === 'completed' ? 'online' : 'offline'} />
                    <div className="text-xs text-muted-foreground">
                      {Math.round((job.progress || 0) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embeddings Status */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">Embeddings</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Model</span>
              <span className="text-foreground">{data.embeddings.model}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dimensions</span>
              <span className="text-foreground">{data.embeddings.dimensions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Vectors</span>
              <span className="text-foreground">{data.embeddings.totalVectors.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Index Size</span>
              <span className="text-foreground">{data.embeddings.indexSize}</span>
            </div>
          </div>
        </div>

        {/* Indexes */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">Indexes</h4>
          <div className="space-y-3">
            {data.indexes.map((index) => (
              <div key={index.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">{index.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {index.documents} documents • {index.type} • Updated {new Date(index.lastUpdated).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={index.status === 'ready' ? 'online' : 'offline'} />
                  <button className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90">
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retrieval Settings */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">Retrieval Settings</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Top-K</span>
              <span className="text-foreground">{data.retrieval.topK}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Similarity Threshold</span>
              <span className="text-foreground">{data.retrieval.similarityThreshold}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Query</span>
              <span className="text-foreground truncate max-w-[200px]">{data.retrieval.lastQuery}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Query Time</span>
              <span className="text-foreground">{data.retrieval.queryTime}ms</span>
            </div>
          </div>
          <button className="mt-3 text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded hover:bg-secondary/90">
            Configure Retrieval
          </button>
        </div>
      </div>
    </Panel>
  )
}
