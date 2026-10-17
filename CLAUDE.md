# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**Gladys SWDE**: a Gladys Assistant **external integration** that publishes the
water consumption of an SWDE (Société wallonne des eaux) meter — index, period
consumption, daily average — from manual readings or an authorised JSON
endpoint. A Node.js service (Node 22+, ESM,
no build step) that runs in its own sandboxed Docker container and talks to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/devices.test.js          # one file
node --test --test-name-pattern "widget"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: handlers registered before connect()
src/devices/index.js              registry, poller (poll_frequency), transport entries
src/devices/waterMeter.js         the meter: discovery payload, onPoll, scene triggers, badge
src/swdeClient.js                 data sources (manual, JSON endpoint) + local/cloud detection
src/scenes.js                     scene action handlers (manifest `scene_actions`)
src/widgets.js                    dashboard widget handlers (manifest `widgets`)
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
gladys-assistant-integration.json manifest: name, config_schema, actions, triggers, widgets...
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (en + fr mandatory)
test/                             node --test, against the SDK's fake Gladys (integration-sdk/testing)
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** Build them with
  `gladys.externalIds(type, platformId)`, `platformId` being the unique id the
  platform gives the device (serial, cloud id, MAC), never a label. Gladys keys
  devices, their history, scenes and dashboards on them: changing one creates a
  new device and orphans the old one. The same goes for every key users store:
  manifest `config_schema`, `actions`, widget and scene keys, feature keys.
- **The container rootfs is read-only.** Write only under `/data`, the one
  writable volume. Never log tokens, passwords or API keys.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand — except on the README's hand-pushed tag path, which bumps all three
  together before tagging. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section, and it
  becomes the notes of the GitHub Release.
- **Manifest.** Texts are multi-language objects `{ "en": ..., "fr": ... }`:
  `label`, `description` and `placeholder` alike, never a plain string. The
  catalog `description` holds 10 to 100 characters per language. A field the
  older cores do not know needs a higher `gladys_version` minimum
  (`categories`: 4.86.0; `widgets`, `scene_triggers`, `scene_actions`,
  `type: "provider"`: 5.1.0). `test/manifest.test.js` ties the manifest to the
  code (defaults, action, scene and widget handlers): change both sides
  together.
- **User-facing text** is in four languages: English, French, German and
  Spanish (`{ en, fr, de, es }`): manifest texts, action and widget messages,
  connection statuses, and `docs/en.md`, `docs/fr.md`, `docs/de.md`,
  `docs/es.md`, kept in sync. `test/manifest.test.js` fails on a missing
  manifest translation or documentation file.
- **SWDE data.** Never automate the SWDE customer portal nor ask for its
  password: SWDE documents no public API. Only manual readings and endpoints
  the user is authorised to use. The meter external id is built from the
  user's `meter_id`; the feature keys (`total-m3`, `period-m3`,
  `daily-average-liters`) and the trigger keys (`new_reading`,
  `high_consumption`) are forever.
- **Scene events.** One event per transition (index change, upward crossing of
  the threshold), never one per poll; never fire one from a received action
  (`refresh_reading` passes `emitSceneEvents: false`).
- **Transports.** The manifest declares `local` and `cloud`; the badge follows
  the configured source (`sourceTransport`) and turns `unreachable` after a
  failed read. `GLADYS_PREFER_LOCAL` has no effect for a single meter.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
