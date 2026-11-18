# Changelog

What changed in Mixlog, newest first.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/): MAJOR for big releases, MINOR when a feature is added, changed, or removed, PATCH for fixes and tweaks. Each release starts with a one-line summary (its title), then bullets under `### Added`, `### Changed`, `### Removed`, or `### Fixed`. One change per bullet, one line each, 120 characters at most.

## [Unreleased]

## [1.8.2] - 2026-11-18

### Added

- A full-screen button beside Close on the wide meters panel.

### Changed

- Full-screen meters and the public meter: Penalty and More side by side, roomier platform rows warming with the cut.
- Full-screen More stays open, its readings grouped into peaks, loudness, low end and phase, and the file.

## [1.8.1] - 2026-11-17

### Changed

- The public meter fills wide screens: Mixlog's name by the mark, a sliding theme switch and a dropzone that lights up.
- The public meter's dropzone is a frosted window onto Mixlog's loading scene; a bounce in zooms through it to measure.
- The loading scene's valley mist drifts in three wind-blown layers; the meter's window shows fainter stars.
- The public meter is named LoudorNot in its top bar and tab title.
- The public meter plays the measured file on your device, with its loudness wave as the playhead. Nothing is uploaded.
- The public meter refuses a drop of several files at once and says to drop one.

## [1.8.0] - 2026-11-17

### Added

- A public meter page: drop a bounce, read it on your device, nothing uploaded. Its own host comes with the domain.
- Low end: the share of a song's energy below 120 Hz, in the meters' More fold.
- The meter reads Opus files.

### Changed

- Each meter's tip says one more plain fact about what it reads.

## [1.7.5] - 2026-11-17

### Added

- Settings has Profile & Security: who you're signed in as, a display name you can change, and Sign out.
- Artists can be sorted by name, by most tracks or by role.

### Changed

- Settings opens with Mixlog first, and About Mixlog now describes it and links to the repository, issues and licence.
- Settings fills the window on a wide screen, as Cadence's does.
- Upcoming and Releases offer Card then List, as Artists does, with Card first and the default.
- Version rows show the name in full over one quiet line (format, day); its tip has the time, filename and size.
- A lossless file wears a gem beside its format, as a test bounce wears the flask.
- Every drop zone shares one dashed slot that lights solid under a file; empty lanes say what's missing and how to fill.
- A/B's picker marks the newest bounce and the one before it with a pill beside the name.

### Fixed

- Uploading one artist's picture no longer gives it to every artist.

## [1.7.4] - 2026-11-16

### Added

- An artist's picture can follow their Apple Music, Spotify, YouTube, SoundCloud, Deezer or Tidal picture live.

## [1.7.3] - 2026-11-16

### Changed

- Every release draws its own constellation: a ring of stars, sometimes with a tail, in a place of its own.
- Clouds stay high in the sky, at least three a night, and drift with the pointer; the one near the land is a fog.
- The tree over the night is fuller and cosier: a rounded canopy catching the moon, a bough, sometimes a swing.

## [1.7.2] - 2026-11-16

### Added

- A Changelog page lists every release, newest first, opened from Settings → About.

### Changed

- Every song's night is its own: its mountains follow its sound, and a wide or big song gets a coast or highlands.
- The night is warmer and deeper: an afterglow, a lit hearth with smoke, fog in layers, clouds and meteors in depth.
- On a desktop the night leans gently as you move the pointer; the hearth and the amp breathe with the music.
- A phone now sees a song's whole night, recomposed, instead of the middle of it.

### Fixed

- The mountains no longer turn into a flat slab when the window is short or the player bar docks.
- A song's night now updates once its first bounce is measured, with no refresh, and no longer flashes its colours.

## [1.7.1] - 2026-11-16

### Fixed

- A cover with a small contrasting colour (teal in a red artwork) now lights the room's lamps in that second colour.

## [1.7.0] - 2026-11-16

### Changed

- Playing uses far less of a phone's power: the playhead draws only as often as it visibly moves.
- Pages open faster: the app's files stay cached between visits, and a release hovered then opened loads once.
- The tab icon is a small vector mark instead of a large picture.
- Opening a release, a list or an artist asks the server once instead of several times.
- The lock screen shows the cover's light preview, not the full-size original.

### Fixed

- Upcoming and Releases still load with more than 99 releases in one.
- A missing artist's page says Not found instead of failing.
- The listening room's playhead no longer flickers while a song plays: it breathes with the music smoothly.

## [1.6.1] - 2026-11-15

### Added

- Release cards show who they're by: each main artist's face and name under the title.
- A default artist in Settings › Releases, put on every new track; pick another (or none) when starting a release.
- An artist can have supporting roles beside their main one.
- An artist's links take email addresses, shown with an envelope.
- Level match can aim for a custom level, from −32 to 0 LUFS.
- Leaving a page with unsaved changes asks first.

### Changed

- An artist's tracks wear their release's artwork when it has one.

## [1.6.0] - 2026-11-15

### Changed

- A calmer, larger loading screen: the mark draws itself in under a quiet night, and the first page arrives whole.

### Fixed

- Mixlog refuses requests sent from other sites and tells browsers never to frame or index it.

## [1.5.0] - 2026-11-15

### Changed

- Cards and their contents now share Apple-style continuous, concentric rounded corners.
- Licenses open in a full-size viewer over the page, with page jumps, zoom and fit to width; full screen on a phone.

### Added

- The listening room splits in two: your newest bounce against the one before, on one playhead, with no gap.
- Switch by pressing a record, the A | B switch or a key; tap to stay, hold to listen and come back.
- Level match plays both sides at the same loudness, shown in dB; off until you turn it on.
- Pick what's on A or B from the release's versions in their lanes, with search and the newest two bounces marked.
- A/B stays on when you lower the listening room, and the player bar switches between A and B.
- The listening room and player bar name the file you hear (what you called it), not just its version.
- Settings › Listening: what Level match aims for, and whether a hold auditions.
- Artists can carry social links, each shown with its platform's icon (Spotify, Instagram, YouTube and more).
- Add artists to each track from Details: pick them from portrait cards, main or featured, or add a new one in place.
- Artists has search and two views, round portraits or a list, and each artist's tracks link straight to the track.
- An EP or album takes another track from its Tracks part, then opens its Upload.
- Each track's Canvas: drop an MP4 on Artwork & Canvas, watch it loop, and see its length and shape against Spotify's.
- A release's artwork and an artist's picture open full size, with zoom and their measured pixels.

### Fixed

- The listening room uses far less CPU while music plays, and reopens in its artwork’s colours at once.
- A new artist picture shows at once instead of the old one for an hour.
- Search boxes no longer draw a second focus ring inside their own.
- Opening a license no longer flickers while it loads.

## [1.4.0] - 2026-11-13

Mixlog answers before the server does: every change instant, every page named, every control in reach.

### Added

- Space plays and pauses; ← and → move five seconds.
- Dates can be typed loosely (Oct 12, 12/10/2026, yesterday), and the field says back what it read.
- Swipe down lowers the listening room.
- Tap a light or a reading's name for what it means, on touch too.
- Every page names itself in the tab and lands focus on its heading.

### Changed

- Moving a version, saving Details, adding an artist and picking a cover show the change at once.
- A whole row plays from anywhere on it, and small touch targets grow to 44px.
- UPC and ISRC are checked after you leave the field, in words, and shown in short runs.
- Search ignores accents and apostrophes, and UPCs accept hyphens and dots.
- Penalty lists platforms by what happens to the song, biggest change first.
- The browser's toolbar follows Daylight, and a theme chosen in one tab reaches the others.
- Text sizes follow the browser's font-size setting, and fields no longer zoom the page on iPhone.
- Raised controls get a little volume, and wells get depth.
- Reduced motion keeps colour and light changes and stops only what travels.
- On a phone, every dialog is one glass sheet: close on the left, the title centred, ✓ to save on the right.
- A release's format, day out and an artist's role are picked from one card of rows; on a phone the day opens a wheel.

- The Mixlog mark holds its peak as a whole note under a hand-drawn fermata, cool bars under one warm stroke.

## [1.3.1] - 2026-11-06

### Changed

- Each song lays out its own valley: where the lake, village, tree, woods, lamps and peaks sit is the song's.
- The wooded hills nearest the glowing trace now follow its path, a step below it.
- Covers of two to five colours blend into one night: sky and hills drift from the trace, lamps take the contrast.

### Fixed

- A release's lights now take its cover's colour truly: red stays red, violet stays violet, yellow glows gold.

## [1.3.0] - 2026-11-05

### Added

- Every song has its own night: a moonlit valley drawn from how it sounds, the same on every visit.
- Songs measured before this update get their night the first time their release opens.

### Changed

- The listening room shows the playing song's own night.

### Fixed

- The hamlet's windows, the beacon and the moon take the artwork's colour instead of a fixed one.
- A release's land now blends into the page below it, lit along the horizon.
- A grey cover makes a grey room; a release's colours follow how colourful its artwork really is.

## [1.2.1] - 2026-11-04

### Changed

- On a wide screen the meters dock at the right edge, wired to the row they read, which lights up.
- The loudness waveform is drawn as amplitude, so a chorus stands clearly above its verse.
- The meters fold into Readings, Penalty (every platform, with its logo) and More, each opening on its own.

## [1.2.0] - 2026-11-04

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

- Covers load a small preview, so lists and the player stay quick; the Artwork part still shows the original.

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
