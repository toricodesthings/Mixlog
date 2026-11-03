PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text,
	`release_id` text,
	`kind` text NOT NULL,
	`number` integer NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`duration_ms` integer,
	`note` text,
	`released_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "versions_kind" CHECK("__new_versions"."kind" IN ('mix', 'master', 'instrumental', 'acapella', 'stems', 'artwork', 'canvas', 'video', 'license', 'other')),
	CONSTRAINT "versions_owner" CHECK(("__new_versions"."track_id" IS NULL) <> ("__new_versions"."release_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_versions`("id", "track_id", "release_id", "kind", "number", "r2_key", "filename", "content_type", "size", "duration_ms", "note", "released_at", "created_at") SELECT "id", "track_id", "release_id", "kind", "number", "r2_key", "filename", "content_type", "size", "duration_ms", "note", "released_at", "created_at" FROM `versions`;--> statement-breakpoint
-- D1 enforces foreign keys whatever the PRAGMA says, so dropping versions cascades into current_pins and notes:
-- they're set aside first and put back after (OR IGNORE: where the PRAGMA holds, nothing was lost to put back).
CREATE TABLE `__kept_pins` AS SELECT * FROM `current_pins`;--> statement-breakpoint
CREATE TABLE `__kept_notes` AS SELECT * FROM `notes`;--> statement-breakpoint
DROP TABLE `versions`;--> statement-breakpoint
ALTER TABLE `__new_versions` RENAME TO `versions`;--> statement-breakpoint
INSERT OR IGNORE INTO `current_pins` SELECT * FROM `__kept_pins`;--> statement-breakpoint
INSERT OR IGNORE INTO `notes` SELECT * FROM `__kept_notes`;--> statement-breakpoint
DROP TABLE `__kept_pins`;--> statement-breakpoint
DROP TABLE `__kept_notes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `versions_r2_key_unique` ON `versions` (`r2_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `versions_track_stack` ON `versions` (`track_id`,`kind`,`number`) WHERE "versions"."track_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `versions_release_stack` ON `versions` (`release_id`,`kind`,`number`) WHERE "versions"."release_id" IS NOT NULL;