ALTER TABLE `photos` ADD `shared` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `category` text DEFAULT 'Reflection' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `walk` text DEFAULT '' NOT NULL;