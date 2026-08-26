CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`value` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_name_idx` ON `analytics_events` (`name`,`created_at`);--> statement-breakpoint
CREATE TABLE `survey_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`survey` text DEFAULT 'post_scan' NOT NULL,
	`accuracy` text NOT NULL,
	`missing_text` text,
	`willingness` text DEFAULT 'unanswered' NOT NULL,
	`willingness_text` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_responses_user_survey_idx` ON `survey_responses` (`user_id`,`survey`);