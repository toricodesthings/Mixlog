# Changelog

What changed in Mixlog, newest first.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/): MAJOR for big releases, MINOR when a feature is added, changed, or removed, PATCH for fixes and tweaks. Each release starts with a one-line summary (its title), then bullets under `### Added`, `### Changed`, `### Removed`, or `### Fixed`. One change per bullet, one line each, 120 characters at most.

## [Unreleased]

Meters: every bounce measured for loudness, true peak, phase and dynamics.

### Added

- Every bounce is measured as it uploads: loudness, true peak, phase and dynamics, behind its row's meters.
- A loudness waveform shows each version's whole song and plays from wherever you tap it.
- Versions uploaded earlier are measured overnight, or right away with Measure.
- Move to Releases shows each final's loudness and true peak.

### Changed

- The listening room's playhead is the song's loudness waveform.

## [1.1.1] - 2026-11-03

### Changed

- Covers load a small preview of the artwork, so lists and the player stay quick; the Artwork part still shows the original.

### Fixed

- A WAV sent as a final no longer fails once it's stored with “A final is a WAV, AIFF or FLAC master.”

## [1.1.0] - 2026-11-03

### Added

- Each track in Upcoming has Final, Masters and Mixes lanes: drag a version between them, use Move, or press Alt+↑/↓.
- Add a mix, a master or the final straight into its lane: drop files on it or press its Add button.
- Filing a test as the final asks for its WAV, which lands as the final noted “Final of v3”.
- In Releases, replace a wrong final or alternate: drop the file on its row or press Replace, then confirm.
- A track page has Upload in its header: choose Final, Master, Mix or an alternate, then drop or pick the files.
- Settings → Releases says how many set-aside versions a shorter window would erase tonight.
- Every version shows the day and time it landed, in your time zone, so a night of bounces reads in order.
- Pages on their way show their own shape with a light sweeping across it; covers do too until their artwork arrives.
- Play fills a ring while the file arrives, and the playhead shows how much is already here.
- Uploads fill a ring with a rising arrow; a license being read fills one with a falling arrow.

### Changed

- A new Mixlog mark: a waveform saying the name, lit blue to a warm ember; it’s the tab and home-screen icon too.
- On a phone, the dock is a floating glass pill: the current tab sits in a glass lens you can slide your thumb along.
- On a phone, the player rides on the dock; scroll down and the dock tucks into your tab with the player beside it.
- A track’s mixes and masters share one number, so a move keeps it; existing tracks are renumbered once.
- Releases show only what shipped: the rest is set aside on the move, even when Settings keeps everything.
- Releases already out set aside what didn’t ship, with the full keep window counted from the update.
- The signal path reads Mixes, Masters, Final, Artwork, Details; in Releases, Final, Artwork, Details.
- Play and a track’s length follow its final, else its newest master, else its newest mix.
- Move to Releases uses the same Final lane as Tracks; new releases suggest each song’s WAV master as its final.

## [1.0.0] - 2026-11-02

### Added

- Move to Releases: pick each track's final master (or send the WAV of a test), and only what shipped stays.
- After a move, Move back to Upcoming brings back every older version and mix until they're erased.
- Settings → Releases: keep what didn't ship for a week, two weeks, a month, or keep everything.
- A cover or remix keeps its license: add a PDF or Word document, read it in place, and stack new versions.
- Upcoming and Releases, as panels or a list, with search, format filters and sorting.
- Search, filters, sort, view and open dialogs live in the address bar: a refresh or a link keeps them.
- Drop bounces on Upcoming or Releases, or press Upload: name it, check it, then Save to add a release.
- Uploads show a real progress bar: megabytes sent and time left, for every bounce, the whole release and the cover.
- Releases wear one cover: click it or drop a PNG or JPG on it, or get a monogram until you do.
- Inside a release: a Summary, Details, Artwork & Canvas, and Tracks with every bounce logged.
- A release's Summary is its own night landscape in its artwork's colours, the cover standing on the ground.
- Inside a release, everything takes its artwork's colours; the rail, dock and player stay blue.
- Details picks the format from three panels and keeps the release day, UPC and each track's ISRC.
- A UPC must carry its right check digit, so a mistyped one is caught before a distributor does.
- Lyrics: Musixmatch-style #sections in one click, a full-screen writing room, and they save as you type.
- Mark a track as an original, a cover or a remix; a cover or remix gets a License button (upload comes later).
- Save and exit, at the foot of a release's panel: saves Details and takes you back to the list.
- Play from a release's Summary or tracklist; it keeps playing as you move around, from a player bar along the bottom.
- Play any version straight from Tracks; each row reads play, version, what changed, then format, day and download.
- Skip back or ahead 10 seconds from the player bar, 10 or 30 in the listening room, which also shows the version's day.
- The listening room: open the player full screen, a record spinning in the release's own night sky.
- On a computer, meters read the music, and the listening room's stars pulse with the kick and its glow with the bass.
- The studio comes alive: a dancing meter logo, console LEDs, scope-lit empty pages and one rare magenta light.
- Release cards answer the pointer like glass: they rise softly, lean, and catch the light where you point.
- Pointing along a list slides one soft highlight from row to row.
- Settings: Blue Hour, Daylight or match the system, and reduced motion, kept per device.
- Sign-in through Cloudflare Access: Mixlog never stores a password.
