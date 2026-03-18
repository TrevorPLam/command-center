CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `logs_timestamp_idx` ON `logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `logs_level_idx` ON `logs` (`level`);--> statement-breakpoint
CREATE INDEX `logs_category_idx` ON `logs` (`category`);--> statement-breakpoint
CREATE INDEX `logs_message_idx` ON `logs` (`message`);--> statement-breakpoint
ALTER TABLE `jobs` ADD `max_steps` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `current_step` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `jobs` ADD `retry_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `jobs` ADD `max_retries` integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE `jobs` ADD `next_retry_at` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `priority` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `jobs` ADD `worker_id` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `timeout_ms` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `metadata` text;--> statement-breakpoint
CREATE INDEX `jobs_priority_idx` ON `jobs` (`priority`);--> statement-breakpoint
CREATE INDEX `jobs_next_retry_idx` ON `jobs` (`next_retry_at`);--> statement-breakpoint
CREATE INDEX `jobs_worker_idx` ON `jobs` (`worker_id`);--> statement-breakpoint
ALTER TABLE `metrics_rollups` ADD `value` real NOT NULL;--> statement-breakpoint
ALTER TABLE `metrics_rollups` DROP COLUMN `metric_value`;