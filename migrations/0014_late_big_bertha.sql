CREATE INDEX `current_pins_version` ON `current_pins` (`version_id`);--> statement-breakpoint
CREATE INDEX `track_artists_artist` ON `track_artists` (`artist_id`);--> statement-breakpoint
CREATE INDEX `tracks_release` ON `tracks` (`release_id`,`position`);--> statement-breakpoint
CREATE INDEX `versions_track` ON `versions` (`track_id`,`kind`,`number`);--> statement-breakpoint
CREATE INDEX `versions_pruned` ON `versions` (`pruned_at`) WHERE "versions"."pruned_at" IS NOT NULL;