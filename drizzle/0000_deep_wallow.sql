CREATE TABLE `cancellation_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`method` text NOT NULL,
	`draft_subject` text,
	`draft_body` text,
	`sent_at` integer,
	`confirmed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cancellation_requests_user_idx` ON `cancellation_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `charges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`merchant_id` integer,
	`merchant_name` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`charged_at` integer NOT NULL,
	`source_message_ref` text,
	`source_subject` text,
	`extraction_confidence` integer,
	`reviewed_at` integer,
	`detected_from` text DEFAULT 'email' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `charges_user_idx` ON `charges` (`user_id`);--> statement-breakpoint
CREATE INDEX `charges_user_merchant_idx` ON `charges` (`user_id`,`merchant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `charges_user_message_idx` ON `charges` (`user_id`,`source_message_ref`);--> statement-breakpoint
CREATE TABLE `email_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`address` text NOT NULL,
	`encrypted_refresh_token` text,
	`sync_cursor` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_accounts_user_idx` ON `email_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_accounts_user_address_idx` ON `email_accounts` (`user_id`,`address`);--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`domains` text NOT NULL,
	`category` text NOT NULL,
	`logo_url` text,
	`cancel_url` text,
	`cancel_method` text DEFAULT 'unknown' NOT NULL,
	`cancel_email` text,
	`difficulty` integer DEFAULT 3 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchants_slug_idx` ON `merchants` (`slug`);--> statement-breakpoint
CREATE TABLE `price_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`old_amount_minor` integer NOT NULL,
	`new_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`observed_at` integer NOT NULL,
	`user_notified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `price_changes_subscription_idx` ON `price_changes` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spend_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`totals_by_currency` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spend_snapshots_user_month_idx` ON `spend_snapshots` (`user_id`,`month`);--> statement-breakpoint
CREATE TABLE `subscription_evidence` (
	`subscription_id` integer NOT NULL,
	`charge_id` integer NOT NULL,
	PRIMARY KEY(`subscription_id`, `charge_id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`merchant_id` integer,
	`name` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`cycle` text NOT NULL,
	`status` text NOT NULL,
	`detected_from` text DEFAULT 'email' NOT NULL,
	`confidence` integer,
	`first_charge_at` integer,
	`last_charge_at` integer,
	`next_renewal_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`processed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
