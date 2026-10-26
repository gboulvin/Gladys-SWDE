# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Changed

- Requires Gladys 5.3.0 or later: the manifest declares search keywords and
  the countries where the integration works, for the new catalog of Gladys
  5.3.
- Integration SDK 0.16.

## [0.2.1] - 2026-10-22

### Security

- `brace-expansion`, pulled in by ESLint, raised to 5.0.12 against the
  high-severity denial-of-service advisories (GHSA-mh99-v99m-4gvg and
  related). A development tool only: the published image never shipped it.
- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [0.2.0] - 2026-10-17

### Added

- SWDE water meter with three historised sensors: meter index (m³), period
  consumption (m³) and daily average (L/day), from manual readings or an
  authorised JSON endpoint (optional Bearer token stored as a Gladys secret).
- **SWDE water consumption** dashboard widget: live index, period and daily
  average tiles, daily-average chart (1 month, 3 months or 1 year), data-source
  status, last read, alert state and a **Refresh** button.
- Scene triggers **New water-meter reading** (index changed, with the volume
  consumed since the previous reading) and **High water consumption** (daily
  average above the new **Daily alert threshold** setting).
- Scene action **Read the water meter**, returning the index, the period
  consumption, the daily average and whether it is above the threshold.
- Local and cloud transports: the meter badge shows **local** for manual
  readings and LAN endpoints, **cloud** for Internet endpoints, and
  **unreachable** when the last read failed.
- English, French, German and Spanish translations of the manifest, the
  messages, the widget and the documentation (`docs/en.md`, `docs/fr.md`,
  `docs/de.md`, `docs/es.md`).
- `SECURITY.md`, `CLAUDE.md` and this changelog; GitHub Releases with the
  changelog as notes; Dependabot; CI on Node 22 and 24 with a Docker build.

### Changed

- Based on the latest official JavaScript template, with integration SDK
  0.15.0. Gladys 5.1.0 or later and Node.js 22 or later are required.
- Unchanged values are no longer republished, except every 6 hours so the meter
  stays recently dated.

### Fixed

- The meter declared its poll frequency in seconds, a value Gladys refuses: it
  is now polled every minute and read at the configured refresh interval.
- The integration can write to `/data`: the image creates the directory owned
  by the `node` user.

[Unreleased]: https://github.com/gboulvin/Gladys-SWDE/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/gboulvin/Gladys-SWDE/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/gboulvin/Gladys-SWDE/releases/tag/v0.2.0
