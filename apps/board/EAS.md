# EAS notes (Board)

- Expo owner `mstrmndgo`, project `mstrmnd-board` (`extra.eas.projectId` in `app.json`, slug matches). Do not run `eas init`.
- Bundle ID / Android package: `ai.mstrmnd.board`. URL scheme: `mstrmnd-board`.
- Profiles in `eas.json`: `development` (dev client, internal, iOS simulator), `preview` (internal, Android APK), `production` (store, `autoIncrement`). App version source is remote. Channels match the profile names; they only take effect once `expo-updates` is installed (planned, not in this change).
- **Android signing: EAS-managed keystore** (`credentialsSource: remote`). On the first Android build let EAS generate it, then back it up with `eas credentials`. Never commit keystores, `.p8` keys or service-account JSON.
- **iOS:** App IDs are not registered yet; EAS can register them on the first iOS build once the Apple Developer Program License Agreement is accepted. `submit.production.ios` has Team ID `7T9W2DC298`, ASC API key ID `76HNAVK2MX` and issuer ID `2693901f-d3ba-42af-98d1-19ecf07129a8`; `ascAppId` stays `TODO` until the App Store Connect app record exists. There is intentionally **no `ascApiKeyPath`**: the `.p8` is never stored in this repo. The ASC API key (EAS, 76HNAVK2MX, App Manager) is uploaded to EAS credentials on @mstrmndgo; the .p8 is never committed. Linking it to an app for submission, and any App Store/TestFlight submit, needs Steele's OK. Verified in App Store Connect: the issuer ID matches, and key `76HNAVK2MX` is App Manager and Active.
- Board sits in a monorepo but outside the pnpm workspace, with its own npm lockfile. Verify on the first build that EAS installs with npm from `apps/board`.
- No builds or submissions are run from CI.
