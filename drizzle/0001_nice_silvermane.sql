CREATE TABLE `national_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `national_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
