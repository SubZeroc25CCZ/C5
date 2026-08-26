CREATE TABLE `scanned_messages` (
	`user_id` text NOT NULL,
	`message_ref` text NOT NULL,
	`scanned_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `message_ref`)
);
