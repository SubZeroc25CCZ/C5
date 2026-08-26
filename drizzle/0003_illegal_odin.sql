CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`detail` text,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_created_idx` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email_account_id` integer NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`failed_stage` text,
	`error` text,
	`messages_touched` integer DEFAULT 0 NOT NULL,
	`charges_found` integer DEFAULT 0 NOT NULL,
	`trigger` text DEFAULT 'user' NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	`duration_ms` integer
);
--> statement-breakpoint
CREATE INDEX `scan_runs_started_idx` ON `scan_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `scan_runs_user_idx` ON `scan_runs` (`user_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `merchants` ADD `cancel_url_verified_at` integer;--> statement-breakpoint
ALTER TABLE `merchants` ADD `cancel_url_verified_by` text;--> statement-breakpoint
ALTER TABLE `merchants` ADD `cancel_url_source` text;