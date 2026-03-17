CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`content` text NOT NULL,
	`embedding_id` text,
	`chunk_index` integer NOT NULL,
	`token_count` integer NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunks_document_idx` ON `chunks` (`document_id`);--> statement-breakpoint
CREATE INDEX `chunks_embedding_idx` ON `chunks` (`embedding_id`);--> statement-breakpoint
CREATE INDEX `chunks_chunk_index_idx` ON `chunks` (`chunk_index`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`model_profile_id` text,
	`summary_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `conversations_title_idx` ON `conversations` (`title`);--> statement-breakpoint
CREATE INDEX `conversations_created_at_idx` ON `conversations` (`created_at`);--> statement-breakpoint
CREATE INDEX `conversations_model_profile_idx` ON `conversations` (`model_profile_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`checksum` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_checksum_idx` ON `documents` (`checksum`);--> statement-breakpoint
CREATE INDEX `documents_created_at_idx` ON `documents` (`created_at`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`status` text NOT NULL,
	`results` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `experiments_name_idx` ON `experiments` (`name`);--> statement-breakpoint
CREATE INDEX `experiments_status_idx` ON `experiments` (`status`);--> statement-breakpoint
CREATE TABLE `indexes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`status` text NOT NULL,
	`chunk_count` integer NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `indexes_name_idx` ON `indexes` (`name`);--> statement-breakpoint
CREATE INDEX `indexes_type_idx` ON `indexes` (`type`);--> statement-breakpoint
CREATE INDEX `indexes_status_idx` ON `indexes` (`status`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`result` text,
	`error` text,
	`progress` real DEFAULT 0 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_created_at_idx` ON `jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`token_count` integer,
	`latency_ms` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `messages_created_at_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `messages_role_idx` ON `messages` (`role`);--> statement-breakpoint
CREATE TABLE `metrics_rollups` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`timestamp` integer NOT NULL,
	`metric_name` text NOT NULL,
	`metric_value` real NOT NULL,
	`tags` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metrics_rollups_period_idx` ON `metrics_rollups` (`period`);--> statement-breakpoint
CREATE INDEX `metrics_rollups_timestamp_idx` ON `metrics_rollups` (`timestamp`);--> statement-breakpoint
CREATE INDEX `metrics_rollups_metric_name_idx` ON `metrics_rollups` (`metric_name`);--> statement-breakpoint
CREATE TABLE `model_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`runtime_model_name` text NOT NULL,
	`role` text NOT NULL,
	`max_safe_context` integer NOT NULL,
	`structured_output_reliability` real NOT NULL,
	`tool_calling_reliability` real NOT NULL,
	`performance_score` real,
	`cost_per_token` real,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `model_profiles_runtime_name_idx` ON `model_profiles` (`runtime_model_name`);--> statement-breakpoint
CREATE INDEX `model_profiles_role_idx` ON `model_profiles` (`role`);--> statement-breakpoint
CREATE INDEX `model_profiles_active_idx` ON `model_profiles` (`is_active`);--> statement-breakpoint
CREATE TABLE `prompt_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`variables` text NOT NULL,
	`rendered_prompt` text NOT NULL,
	`result` text,
	`status` text NOT NULL,
	`error` text,
	`duration_ms` integer,
	`token_count` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `prompt_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prompt_runs_template_idx` ON `prompt_runs` (`template_id`);--> statement-breakpoint
CREATE INDEX `prompt_runs_status_idx` ON `prompt_runs` (`status`);--> statement-breakpoint
CREATE INDEX `prompt_runs_created_at_idx` ON `prompt_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`template` text NOT NULL,
	`variables` text,
	`category` text NOT NULL,
	`tags` text,
	`is_active` integer DEFAULT true NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_templates_name_idx` ON `prompt_templates` (`name`);--> statement-breakpoint
CREATE INDEX `prompt_templates_category_idx` ON `prompt_templates` (`category`);--> statement-breakpoint
CREATE INDEX `prompt_templates_active_idx` ON `prompt_templates` (`is_active`);--> statement-breakpoint
CREATE TABLE `runtime_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`latency` integer NOT NULL,
	`uptime` integer NOT NULL,
	`model_count` integer NOT NULL,
	`running_model_count` integer NOT NULL,
	`errors` text,
	`metadata` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runtime_snapshots_timestamp_idx` ON `runtime_snapshots` (`timestamp`);--> statement-breakpoint
CREATE INDEX `runtime_snapshots_status_idx` ON `runtime_snapshots` (`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `settings_category_idx` ON `settings` (`category`);--> statement-breakpoint
CREATE INDEX `settings_public_idx` ON `settings` (`is_public`);--> statement-breakpoint
CREATE TABLE `tool_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`tool_name` text NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`status` text NOT NULL,
	`error` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tool_runs_job_idx` ON `tool_runs` (`job_id`);--> statement-breakpoint
CREATE INDEX `tool_runs_tool_name_idx` ON `tool_runs` (`tool_name`);--> statement-breakpoint
CREATE INDEX `tool_runs_status_idx` ON `tool_runs` (`status`);