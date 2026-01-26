# Luna AI

AI companion app built with React Native and Expo.

## Setup

```bash
npm install
```

## Development

```bash
npm start
```

## Building APK

### 1. Generate native Android project

```bash
npx expo prebuild --platform android
```

Or with clean rebuild (recommended after version changes):

```bash
npx expo prebuild --platform android --clean
```

### 2. Build Debug APK

```bash
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build Release APK (Production)

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Copy builds to builds folder

```bash
mkdir -p builds
cp android/app/build/outputs/apk/debug/app-debug.apk builds/luna-ai-DEV-v1.0.2.apk
cp android/app/build/outputs/apk/release/app-release.apk builds/luna-ai-PRODUCTION-v1.0.2.apk
```

## Configuration

### DEV_MODE

In `src/constants/config.ts`, set `DEV_MODE`:
- `true` - Shows bypass button on payment screen (for testing)
- `false` - Hides bypass button (for production release)

```typescript
export const DEV_MODE = true // change to false before publishing
```

## Version Management

Update versions in these files before building:

| File | Field | Description |
|------|-------|-------------|
| `app.json` | `version` | Display version (e.g., "1.0.2") |
| `app.json` | `android.versionCode` | Integer, must increment for Play Store |
| `package.json` | `version` | Should match app.json version |
