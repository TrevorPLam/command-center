/**
 * Database Schema
 * 
 * Core schema definitions for the Command Center persistence layer.
 * Follows the canonical architecture from the master guide.
 */

import { 
  sqliteTable, 
  text, 
  integer, 
  real, 
  blob,
  primaryKey,
  index
} from 'drizzle-orm/sqlite-core'

// Core entities as specified in the master guide
export const CORE_TABLES = [
  'conversations',
  'messages', 
  'model_profiles',
  'runtime_snapshots',
  'documents',
  'chunks',
  'indexes',
  'jobs',
  'tool_runs',
  'prompt_templates',
  'prompt_runs',
  'experiments',
  'metrics_rollups',
  'logs',
  'settings'
] as const

// ============================================================================
// CONVERSATIONS & MESSAGES
// ============================================================================

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  modelProfileId: text('model_profile_id'),
  summaryJson: text('summary_json'), // JSON-structured summary
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  metadata: text('metadata'), // JSON metadata
}, (table) => ({
  titleIdx: index('conversations_title_idx').on(table.title),
  createdAtIdx: index('conversations_created_at_idx').on(table.createdAt),
  modelProfileIdx: index('conversations_model_profile_idx').on(table.modelProfileId),
}))

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'system' | 'user' | 'assistant' | 'tool'
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  latencyMs: integer('latency_ms'),
  metadata: text('metadata'), // JSON metadata (tool calls, thinking traces, etc.)
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  roleIdx: index('messages_role_idx').on(table.role),
}))

// ============================================================================
// MODEL PROFILES & RUNTIME
// ============================================================================

export const modelProfiles = sqliteTable('model_profiles', {
  id: text('id').primaryKey(),
  runtimeModelName: text('runtime_model_name').notNull(),
  role: text('role').notNull(), // 'general' | 'code' | 'reasoning' | 'vision' | 'embedding' | 'router' | 'judge'
  maxSafeContext: integer('max_safe_context').notNull(),
  structuredOutputReliability: real('structured_output_reliability').notNull(),
  toolCallingReliability: real('tool_calling_reliability').notNull(),
  performanceScore: real('performance_score'),
  costPerToken: real('cost_per_token'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata'), // JSON metadata (family, quantization, etc.)
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  runtimeNameIdx: index('model_profiles_runtime_name_idx').on(table.runtimeModelName),
  roleIdx: index('model_profiles_role_idx').on(table.role),
  activeIdx: index('model_profiles_active_idx').on(table.isActive),
}))

export const runtimeSnapshots = sqliteTable('runtime_snapshots', {
  id: text('id').primaryKey(),
  status: text('status').notNull(), // 'healthy' | 'degraded' | 'unhealthy'
  latency: integer('latency').notNull(),
  uptime: integer('uptime').notNull(),
  modelCount: integer('model_count').notNull(),
  runningModelCount: integer('running_model_count').notNull(),
  errors: text('errors'), // JSON array of error messages
  metadata: text('metadata'), // JSON metadata (version, capabilities, etc.)
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  timestampIdx: index('runtime_snapshots_timestamp_idx').on(table.timestamp),
  statusIdx: index('runtime_snapshots_status_idx').on(table.status),
}))

// ============================================================================
// DOCUMENTS & VECTOR SEARCH
// ============================================================================

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON metadata (source, type, tags, etc.)
  checksum: text('checksum').notNull(), // Content checksum for deduplication
  size: integer('size').notNull(), // Content size in bytes
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  checksumIdx: index('documents_checksum_idx').on(table.checksum),
  createdAtIdx: index('documents_created_at_idx').on(table.createdAt),
}))

export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  embeddingId: text('embedding_id'), // Reference to LanceDB embedding
  chunkIndex: integer('chunk_index').notNull(),
  tokenCount: integer('token_count').notNull(),
  metadata: text('metadata'), // JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  documentIdx: index('chunks_document_idx').on(table.documentId),
  embeddingIdx: index('chunks_embedding_idx').on(table.embeddingId),
  chunkIndexIdx: index('chunks_chunk_index_idx').on(table.chunkIndex),
}))

export const indexes = sqliteTable('indexes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'vector' | 'keyword' | 'hybrid'
  config: text('config').notNull(), // JSON configuration
  status: text('status').notNull(), // 'building' | 'ready' | 'error'
  chunkCount: integer('chunk_count').notNull(),
  metadata: text('metadata'), // JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  nameIdx: index('indexes_name_idx').on(table.name),
  typeIdx: index('indexes_type_idx').on(table.type),
  statusIdx: index('indexes_status_idx').on(table.status),
}))

// ============================================================================
// JOBS & TOOL EXECUTION
// ============================================================================

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'rag_index' | 'model_sync' | 'batch_process' | 'export' | 'agent_run'
  status: text('status').notNull(), // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying'
  config: text('config').notNull(), // JSON configuration
  result: text('result'), // JSON result data
  error: text('error'), // Error message
  progress: real('progress').notNull().default(0), // 0.0 to 1.0
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  // Agent-specific fields
  maxSteps: integer('max_steps'), // Maximum steps for agent jobs
  currentStep: integer('current_step').default(0), // Current step in agent execution
  retryCount: integer('retry_count').default(0), // Number of retries attempted
  maxRetries: integer('max_retries').default(3), // Maximum retry attempts
  nextRetryAt: integer('next_retry_at', { mode: 'timestamp_ms' }), // When to retry failed job
  priority: integer('priority').default(0), // Job priority (higher = more important)
  workerId: text('worker_id'), // ID of worker processing this job
  timeoutMs: integer('timeout_ms'), // Job timeout in milliseconds
  metadata: text('metadata'), // Additional JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  typeIdx: index('jobs_type_idx').on(table.type),
  statusIdx: index('jobs_status_idx').on(table.status),
  createdAtIdx: index('jobs_created_at_idx').on(table.createdAt),
  priorityIdx: index('jobs_priority_idx').on(table.priority),
  nextRetryIdx: index('jobs_next_retry_idx').on(table.nextRetryAt),
  workerIdx: index('jobs_worker_idx').on(table.workerId),
}))

export const toolRuns = sqliteTable('tool_runs', {
  id: text('id').primaryKey(),
  jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  toolName: text('tool_name').notNull(),
  input: text('input').notNull(), // JSON input
  output: text('output'), // JSON output
  status: text('status').notNull(), // 'pending' | 'running' | 'completed' | 'failed'
  error: text('error'), // Error message
  durationMs: integer('duration_ms'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  jobIdIdx: index('tool_runs_job_idx').on(table.jobId),
  toolNameIdx: index('tool_runs_tool_name_idx').on(table.toolName),
  statusIdx: index('tool_runs_status_idx').on(table.status),
}))

// ============================================================================
// PROMPTS & EXPERIMENTS
// ============================================================================

export const promptTemplates = sqliteTable('prompt_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  template: text('template').notNull(),
  variables: text('variables'), // JSON array of variable names
  category: text('category').notNull(),
  tags: text('tags'), // JSON array of tags
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
  metadata: text('metadata'), // JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  nameIdx: index('prompt_templates_name_idx').on(table.name),
  categoryIdx: index('prompt_templates_category_idx').on(table.category),
  activeIdx: index('prompt_templates_active_idx').on(table.isActive),
}))

export const promptRuns = sqliteTable('prompt_runs', {
  id: text('id').primaryKey(),
  templateId: text('template_id').references(() => promptTemplates.id, { onDelete: 'set null' }),
  variables: text('variables').notNull(), // JSON key-value pairs
  renderedPrompt: text('rendered_prompt').notNull(),
  result: text('result'), // JSON result
  status: text('status').notNull(), // 'pending' | 'running' | 'completed' | 'failed'
  error: text('error'), // Error message
  durationMs: integer('duration_ms'),
  tokenCount: integer('token_count'),
  metadata: text('metadata'), // JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  templateIdIdx: index('prompt_runs_template_idx').on(table.templateId),
  statusIdx: index('prompt_runs_status_idx').on(table.status),
  createdAtIdx: index('prompt_runs_created_at_idx').on(table.createdAt),
}))

export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config').notNull(), // JSON experiment configuration
  status: text('status').notNull(), // 'draft' | 'running' | 'completed' | 'failed'
  results: text('results'), // JSON results data
  metadata: text('metadata'), // JSON metadata
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  nameIdx: index('experiments_name_idx').on(table.name),
  statusIdx: index('experiments_status_idx').on(table.status),
}))

// ============================================================================
// METRICS & SETTINGS
// ============================================================================

export const metricsRollups = sqliteTable('metrics_rollups', {
  id: text('id').primaryKey(),
  period: text('period').notNull(), // 'minute' | 'hour' | 'day' | 'week' | 'month'
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  metricName: text('metric_name').notNull(),
  value: real('value').notNull(),
  tags: text('tags'), // JSON key-value pairs for filtering
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  periodIdx: index('metrics_rollups_period_idx').on(table.period),
  timestampIdx: index('metrics_rollups_timestamp_idx').on(table.timestamp),
  metricNameIdx: index('metrics_rollups_metric_name_idx').on(table.metricName),
}))

// Structured logs table
export const logs = sqliteTable('logs', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  level: text('level').notNull(), // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  category: text('category').notNull(), // 'inference' | 'retrieval' | 'tool' | 'queue' | 'auth' | 'metrics' | 'system'
  message: text('message').notNull(),
  metadata: text('metadata'), // JSON metadata
  error: text('error'), // JSON error details
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  timestampIdx: index('logs_timestamp_idx').on(table.timestamp),
  levelIdx: index('logs_level_idx').on(table.level),
  categoryIdx: index('logs_category_idx').on(table.category),
  messageIdx: index('logs_message_idx').on(table.message),
}))

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON value
  type: text('type').notNull(), // 'string' | 'number' | 'boolean' | 'object' | 'array'
  category: text('category').notNull(), // 'ui' | 'runtime' | 'security' | 'features'
  description: text('description'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false), // Whether setting is user-visible
  metadata: text('metadata'), // JSON metadata (validation rules, etc.)
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  categoryIdx: index('settings_category_idx').on(table.category),
  publicIdx: index('settings_public_idx').on(table.isPublic),
}))

// ============================================================================
// TYPES
// ============================================================================

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type ModelProfile = typeof modelProfiles.$inferSelect
export type NewModelProfile = typeof modelProfiles.$inferInsert

export type RuntimeSnapshot = typeof runtimeSnapshots.$inferSelect
export type NewRuntimeSnapshot = typeof runtimeSnapshots.$inferInsert

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

export type Chunk = typeof chunks.$inferSelect
export type NewChunk = typeof chunks.$inferInsert

export type Index = typeof indexes.$inferSelect
export type NewIndex = typeof indexes.$inferInsert

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

export type ToolRun = typeof toolRuns.$inferSelect
export type NewToolRun = typeof toolRuns.$inferInsert

export type PromptTemplate = typeof promptTemplates.$inferSelect
export type NewPromptTemplate = typeof promptTemplates.$inferInsert

export type PromptRun = typeof promptRuns.$inferSelect
export type NewPromptRun = typeof promptRuns.$inferInsert

export type Experiment = typeof experiments.$inferSelect
export type NewExperiment = typeof experiments.$inferInsert

export type MetricsRollup = typeof metricsRollups.$inferSelect
export type NewMetricsRollup = typeof metricsRollups.$inferInsert

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
