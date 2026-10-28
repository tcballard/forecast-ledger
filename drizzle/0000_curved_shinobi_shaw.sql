CREATE TABLE `forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`probability` real NOT NULL,
	`method` text NOT NULL,
	`rationale` text NOT NULL,
	`evidence` text NOT NULL,
	`created_at` text NOT NULL,
	`author` text NOT NULL,
	`margin` real,
	`sigma` real
);
--> statement-breakpoint
CREATE TABLE `outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`won` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
