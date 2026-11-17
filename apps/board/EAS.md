# EAS notes (Board)

- Expo owner `mstrmndgo`, project `mstrmnd-board` (`extra.eas.projectId` in `app.json`, slug matches). Do not run `eas init`.
- Bundle ID / Android package: `ai.mstrmnd.board`. URL scheme: `mstrmnd-board`.
- Profiles in `eas.json`: `development` (dev client, internal, iOS simulator), `preview` (internal, Android APK), `production` (store, `autoIncrement`). App version source is remote. Channels match the profile names; they only take effect once `expo-updates` is installed (planned, not in this change).
- **Android signing: EAS-managed keystore** (`credentialsSource: remote`). On the first Android build let EAS generate it, then back it up with `eas credentials`. Never commit keystores, `.p8` keys or service-account JSON.
- **iOS:** App IDs are not registered yet; EAS can register them on the first iOS build once the Apple Developer Program License Agreement is accepted. `submit.production.ios` has Team ID `7T9W2DC298`; `ascAppId`, `ascApiKeyId` and `ascApiKeyIssuerId` are `TODO` until the App Store Connect API key exists.
- Board sits in a monorepo but outside the pnpm workspace, with its own npm lockfile. Verify on the first build that EAS installs with npm from `apps/board`.
- No builds or submissions are run from CI.
