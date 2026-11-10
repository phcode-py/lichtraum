CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`author_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_created` ON `messages` (`created_at`);--> statement-breakpoint
ALTER TABLE `photos` ADD `author_name` text DEFAULT 'Photographer' NOT NULL;