# Luna AI - Solana dApp Store Publishing Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Publisher Wallet](#publisher-wallet)
3. [Required Assets](#required-assets)
4. [Initial Setup](#initial-setup)
5. [First-Time Publishing](#first-time-publishing)
6. [Publishing Updates](#publishing-updates)
7. [Quick Reference Commands](#quick-reference-commands)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

1. **Node.js** (v18-21)
2. **Android SDK Build Tools** (v33+)
3. **Java JDK** (OpenJDK 17 recommended)
4. **Solana CLI** (for keypair management)
5. **pnpm** (package manager)

### Environment Setup

```bash
# verify node version
node -v  # should be 18-21

# set java home (add to shell profile)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

---

## Publisher Wallet

**Address:** `6Z8ZcGhDpQBrgEyMVUxu9vWTaNb6nXirbEf5ZgkbkYnt`

**IMPORTANT:** See `WALLET_INFO.md` for seed phrase and security notes.

### Fund the Wallet

Before publishing, fund with at least 0.5 SOL on mainnet:

```bash
# check balance
solana balance publishing/publisher-keypair.json --url https://api.mainnet-beta.solana.com
```

---

## Required Assets

Place these files in `publishing/media/`:

| File | Dimensions | Status |
|------|------------|--------|
| `icon-512.png` | 512x512 | [ ] TODO |
| `banner-1200x600.png` | 1200x600 | [ ] TODO |
| `screenshot-1.png` | 1080x1920 | [ ] TODO |
| `screenshot-2.png` | 1080x1920 | [ ] TODO |
| `screenshot-3.png` | 1080x1920 | [ ] TODO |
| `screenshot-4.png` | 1080x1920 | [ ] TODO |
| `luna-ai-v1.0.0-signed.apk` | - | [ ] TODO |

### Asset Guidelines

- **Icon:** Pink/dark theme, Luna branding
- **Banner:** Luna avatar with app name
- **Screenshots:**
  1. Payment/welcome screen
  2. Chat conversation
  3. Luna speaking with subtitle
  4. Active session with timer

---

## Initial Setup

### 1. Install dApp Store CLI

```bash
cd publishing
pnpm init -y
pnpm install --save-dev @solana-mobile/dapp-store-cli
```

### 2. Initialize dApp Store

```bash
npx dapp-store init
```

### 3. Create App NFT (First Time Only)

```bash
npx dapp-store create app -k publisher-keypair.json -u https://api.mainnet-beta.solana.com
```

This mints the App NFT and updates `config.yaml` with the app address.

---

## First-Time Publishing

### Step 1: Build Release APK

```bash
cd /Users/bluntbrain/Documents/code/helius/luna-ai

# ensure version in app.json
# version: "1.0.0"
# versionCode: 1

# prebuild android
npx expo prebuild --platform android --clean

# build release APK
cd android && ./gradlew assembleRelease
```

### Step 2: Copy APK

```bash
cp android/app/build/outputs/apk/release/app-release.apk \
   publishing/media/luna-ai-v1.0.0-signed.apk
```

### Step 3: Validate Configuration

```bash
cd publishing
npx dapp-store validate release -k publisher-keypair.json
```

### Step 4: Create Release NFT

```bash
npx dapp-store create release -k publisher-keypair.json -u https://api.mainnet-beta.solana.com
```

### Step 5: Submit for Review

```bash
npx dapp-store publish submit -k publisher-keypair.json \
  -u https://api.mainnet-beta.solana.com \
  --requestor-is-authorized \
  --complies-with-solana-dapp-store-policies
```

---

## Publishing Updates

### Step 1: Update Version Numbers

Edit `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

### Step 2: Build New APK

```bash
cd /Users/bluntbrain/Documents/code/helius/luna-ai
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease

# copy to publishing
cp app/build/outputs/apk/release/app-release.apk \
   ../publishing/media/luna-ai-v1.0.1-signed.apk
```

### Step 3: Update config.yaml

Update these fields:
```yaml
release:
  files:
    - purpose: install
      uri: media/luna-ai-v1.0.1-signed.apk
  catalog:
    en-US:
      new_in_version: Bug fixes and improvements
  android_details:
    version: 1.0.1
    version_code: 2
```

### Step 4: Validate & Create Release

```bash
cd publishing
npx dapp-store validate release -k publisher-keypair.json
npx dapp-store create release -k publisher-keypair.json -u https://api.mainnet-beta.solana.com
```

### Step 5: Submit Update

```bash
npx dapp-store publish update -k publisher-keypair.json \
  -u https://api.mainnet-beta.solana.com \
  --requestor-is-authorized \
  --complies-with-solana-dapp-store-policies
```

---

## Quick Reference Commands

```bash
# check wallet balance
solana balance publishing/publisher-keypair.json --url https://api.mainnet-beta.solana.com

# validate config
npx dapp-store validate release -k publisher-keypair.json

# create release NFT
npx dapp-store create release -k publisher-keypair.json -u https://api.mainnet-beta.solana.com

# submit new app
npx dapp-store publish submit -k publisher-keypair.json \
  -u https://api.mainnet-beta.solana.com \
  --requestor-is-authorized \
  --complies-with-solana-dapp-store-policies

# submit update
npx dapp-store publish update -k publisher-keypair.json \
  -u https://api.mainnet-beta.solana.com \
  --requestor-is-authorized \
  --complies-with-solana-dapp-store-policies

# update CLI
pnpm install --save-dev @solana-mobile/dapp-store-cli@latest
```

---

## Troubleshooting

### "Failed to top up Winston Credits"

Wallet has insufficient SOL. Fund with more SOL (0.5-1 SOL recommended).

### "You've already submitted this version for review"

Increment `versionCode` in both `app.json` and `config.yaml`, then rebuild.

### "devnet or testnet RPC endpoint" Error

Add `-u https://api.mainnet-beta.solana.com` to the command.

### APK Not Found

Verify APK path in `config.yaml` matches actual file location:
```bash
ls -la publishing/media/*.apk
```

---

## Version History

| Version | versionCode | Date | Notes |
|---------|-------------|------|-------|
| 1.0.0 | 1 | 2025-01-18 | Initial release |

---

## Important Notes

1. **Keep keypair safe!** `publisher-keypair.json` controls your app.
2. **versionCode must always increment** - cannot submit same code twice.
3. **Fund wallet before publishing** - need SOL for Arweave + transaction fees.
4. **Review takes 1-2 business days** - join Solana Mobile Discord for updates.

---

## Links

- [Solana Mobile Discord](https://discord.gg/solanamobile)
- [Publisher Policy](https://docs.solanamobile.com/dapp-publishing/policy)
- [dApp Store CLI Docs](https://docs.solanamobile.com/dapp-publishing/intro)
