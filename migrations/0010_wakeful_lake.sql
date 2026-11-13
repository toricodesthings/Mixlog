CREATE TABLE `artists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `track_artists` (
	`track_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`role` text DEFAULT 'artist' NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`track_id`, `artist_id`),
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "track_artists_role" CHECK("track_artists"."role" IN ('artist', 'featured'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_artists_position` ON `track_artists` (`track_id`,`position`);