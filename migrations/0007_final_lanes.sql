DROP INDEX `versions_track_stack`;--> statement-breakpoint
-- A track's mixes and masters share one number sequence from here on (Mix v1, Mix v2, Master v3), so moving one between
-- lanes keeps its number. Renumbered once, oldest first, a mix before a master bounced at the same moment.
UPDATE `versions` SET `number` = r.n FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY created_at, kind = 'master', number) AS n
  FROM `versions` WHERE track_id IS NOT NULL AND kind IN ('mix', 'master')
) AS r WHERE `versions`.id = r.id;--> statement-breakpoint
-- A master pin is now the track's final. Every final 1.0.0 would have shipped stays one: an unpinned track's newest master,
-- when it's lossless. A pin on a test is dropped after, since a test is never the final.
INSERT INTO `current_pins` (version_id, track_id, kind)
SELECT v.id, v.track_id, 'master' FROM `versions` v
WHERE v.kind = 'master' AND v.track_id IS NOT NULL AND v.pruned_at IS NULL AND v.content_type IN ('audio/wav', 'audio/aiff', 'audio/flac')
  AND v.id = (SELECT n.id FROM `versions` n WHERE n.track_id = v.track_id AND n.kind = 'master' AND n.pruned_at IS NULL ORDER BY n.number DESC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM `current_pins` p WHERE p.track_id = v.track_id AND p.kind = 'master');--> statement-breakpoint
DELETE FROM `current_pins` WHERE kind = 'master' AND track_id IS NOT NULL
  AND version_id IN (SELECT id FROM `versions` WHERE content_type NOT IN ('audio/wav', 'audio/aiff', 'audio/flac'));--> statement-breakpoint
-- Releases keep only what shipped: what 1.0.0 kept on a released release (Settings keeping everything) is set aside now,
-- with the full keep window counted from today.
UPDATE `versions` SET pruned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE track_id IN (SELECT t.id FROM `tracks` t JOIN `releases` r ON r.id = t.release_id WHERE r.released_at IS NOT NULL)
  AND released_at IS NULL AND kind <> 'license' AND pruned_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `versions_track_bounce` ON `versions` (`track_id`,`number`) WHERE "versions"."track_id" IS NOT NULL AND "versions"."kind" IN ('mix', 'master');--> statement-breakpoint
CREATE UNIQUE INDEX `versions_track_stack` ON `versions` (`track_id`,`kind`,`number`) WHERE "versions"."track_id" IS NOT NULL AND "versions"."kind" NOT IN ('mix', 'master');
