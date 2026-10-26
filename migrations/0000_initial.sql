CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text NOT NULL,
	`settings` text NOT NULL,
	`custom_domain` text,
	`custom_domain_verified` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_slug_unique` ON `sites` (`slug`);--> statement-breakpoint
CREATE INDEX `sites_owner_created` ON `sites` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sites_custom_domain` ON `sites` (`custom_domain`) WHERE "sites"."custom_domain" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`lang` text,
	`device_info` text,
	`geo` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_site_endpoint` ON `subscriptions` (`site_id`,`endpoint`);--> statement-breakpoint
CREATE INDEX `subscriptions_site_created` ON `subscriptions` (`site_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `subscriptions_endpoint` ON `subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);