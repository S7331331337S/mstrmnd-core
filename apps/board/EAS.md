# EAS notes (Board)

- Expo owner `mstrmndgo`, project `mstrmnd-board` (`extra.eas.projectId` in `app.json`, slug matches). Do not run `eas init`.
- Bundle ID / Android package: `ai.mstrmnd.board`. URL scheme: `mstrmnd-board`.
- Profiles in `eas.json`: `development` (dev client, internal, iOS simulator), `preview` (internal, Android APK), `production` (store, `autoIncrement`). App version source is remote. Channels match the profile names and are live now that `expo-updates` is installed (see OTA updates below).
- **Android signing: EAS-managed keystore** (`credentialsSource: remote`). On the first Android build let EAS generate it, then back it up with `eas credentials`. Never commit keystores, `.p8` keys or service-account JSON.
- **iOS:** App IDs are not registered yet; EAS can register them on the first iOS build once the Apple Developer Program License Agreement is accepted. `submit.production.ios` has Team ID `7T9W2DC298`, ASC API key ID `76HNAVK2MX` and issuer ID `2693901f-d3ba-42af-98d1-19ecf07129a8`; `ascAppId` stays `TODO` until the App Store Connect app record exists. There is intentionally **no `ascApiKeyPath`**: the `.p8` is never stored in this repo. The ASC API key (EAS, 76HNAVK2MX, App Manager) is uploaded to EAS credentials on @mstrmndgo; the .p8 is never committed. Linking it to an app for submission, and any App Store/TestFlight submit, needs Steele's OK. Verified in App Store Connect: the issuer ID matches, and key `76HNAVK2MX` is App Manager and Active.
- Board sits in a monorepo but outside the pnpm workspace, with its own npm lockfile. Verify on the first build that EAS installs with npm from `apps/board`.
- No builds or submissions are run from CI.

## OTA updates (EAS Update)

Configured with `expo-updates` (`updates.url` = `https://u.expo.dev/2787fcb4-95d3-4f61-bd5f-2c6310f74d9c`, `runtimeVersion: { policy: "appVersion" }`). Profiles map to channels: `development` → `development`, `preview` → `preview`, `production` → `production`.

### First binary per channel is still required
An update can only be received by a binary that already embeds `expo-updates` and the channel. Install one signed build per channel first (`eas build --profile preview|production`). iOS is blocked today: the Apple Developer Program License Agreement is not accepted, and there is no App Store Connect API key or interactive Apple sign-in on the EAS account yet. Android can use the EAS-managed keystore. Nothing here runs builds or submissions from CI.

### Publish an update
JS and asset changes only (no native code or dependency changes). Run from `apps/board`:

```
eas update --channel preview --message "what changed"
eas update --channel production --message "what changed"
```

Publish to `preview` first, check it, then `production`. `eas update` is run by hand, never from CI.

### How `runtimeVersion` (appVersion) gates compatibility
The runtime version is the app `version` in `app.json` (currently `1.0.0`). A binary only accepts updates published for its exact runtime version. **Bump `version` whenever native code, native dependencies or the Expo SDK change** (and build a new binary); `appVersion` does not detect native changes on its own. Consider the `fingerprint` policy later if you want that automatic. Check with `npx expo-doctor` and `npx expo config --type public`.

### Roll back
Re-point the channel at a known-good update:

```
eas update:list --branch production
eas update:republish --group <group-id> --destination-branch production
```

or send devices back to the update embedded in the binary (interactive; choose roll back to embedded or republish the previous update):

```
eas update:rollback --branch production
```

### Expo Go
Expo Go ignores `expo-updates` for development; `npx expo start` + Expo Go works unchanged.
