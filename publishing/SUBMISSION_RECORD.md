# Luna AI - Solana dApp Store Submission Record

## Submission Date
**January 18, 2025**

## App Information

| Field | Value |
|-------|-------|
| App Name | Luna AI |
| Package Name | com.lunaai.app |
| Version | 1.0.0 |
| Version Code | 1 |
| Min SDK | 24 |

## Publisher Information

| Field | Value |
|-------|-------|
| Publisher Name | Ritik Lakhwani |
| Email | ritiklakhwani28@gmail.com |
| Support Email | ritiklakhwani28@gmail.com |
| Website | https://kraneapps.com |

## On-Chain NFT Addresses

### App NFT
- **Address:** `5wYMXTjyZRCfcMwCQWyS8fw1yofA3jBtPJw7CZZMY7wL`
- **Explorer:** https://explorer.solana.com/address/5wYMXTjyZRCfcMwCQWyS8fw1yofA3jBtPJw7CZZMY7wL?cluster=mainnet

### Release NFT
- **Address:** `BbgnvueEiZRVsTJxLui73ef4LiP8m4Mfeubr8xK5Mgwi`
- **Explorer:** https://explorer.solana.com/address/BbgnvueEiZRVsTJxLui73ef4LiP8m4Mfeubr8xK5Mgwi?cluster=mainnet

### Publisher Wallet
- **Address:** `6Z8ZcGhDpQBrgEyMVUxu9vWTaNb6nXirbEf5ZgkbkYnt`

## APK Details

| Field | Value |
|-------|-------|
| File | luna-ai-v1.0.0-signed.apk |
| APK Hash | zb4rz3zDyu/POeal8zsgryLvNHFwtOHAuwJ9dWBd8Gc= |
| Cert Fingerprint | fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c |

## Arweave URLs

### APK
https://arweave.net/V_If9Sfn_F7SvelgonRZCWu7UTtCyUe3iEuL18f5KB0

### Icon (512x512)
https://arweave.net/RiibP0pX3_YDslkm0JyxjFCmD7MDraSFNtFvo7HRt_Q

### Banner (1200x600)
https://arweave.net/EmBV3aIHpR9e0jWbmRx-A9ns_0iFE3TgvJQenEt5KS4

### Screenshots
1. https://arweave.net/Qh7v2usnw-bagfsTwTYrCPTF-K1f7JQkZp-BPdKZJCA
2. https://arweave.net/fW7yMCeu0Ej6ZLPzcN0nbD548_y_6jb6AJP77gjDPdM
3. https://arweave.net/bORWKAmVBobmb83VGGvfqExiZhdpZBp302lJsDWweCM
4. https://arweave.net/Ku8Y6V5lWChXY1GvMv6gm7W20jTU6kIH4Zhl0-smxaY

## Legal URLs

| Document | URL |
|----------|-----|
| License | https://kraneapps.com/lunaai/license |
| Copyright | https://kraneapps.com/lunaai/copyright |
| Privacy Policy | https://kraneapps.com/lunaai/privacy |

## App Description

**Short Description:**
Your unfiltered AI companion

**Long Description:**
Luna AI is your personal AI companion powered by advanced language models.

Chat freely about anything - Luna listens without judgment. Features include:

- Natural voice conversations with text-to-speech
- Video avatar that responds to your messages
- Secure Solana payments for premium sessions
- Privacy-focused design - your conversations stay private

Built for users who want an authentic AI experience. Pay with SOL for 30-minute conversation sessions.

Age restriction: 18+

**What's New:**
Initial release with voice chat, video avatar, and Solana payments

**Saga Features:**
Optimized for Solana Mobile devices with native wallet integration

## Testing Instructions

1. Install the APK on your Solana Mobile device
2. Open Luna AI - you'll see the payment screen
3. Connect your wallet (Phantom or other Solana wallet)
4. Pay 0.01 SOL to start a 30-minute session
5. Chat with Luna using the text input
6. Luna responds with voice and video avatar

Note: Requires internet connection and a Solana wallet with SOL for payments.

## Review Status

- **Submitted:** January 18, 2025
- **Status:** Pending Review
- **Estimated Review Time:** 3-4 business days

## Next Steps

1. Join the [Solana Mobile Discord](https://discord.gg/solanamobile)
2. Get the developer role in the #developer channel
3. Leave a message in the #dapp-store channel that you've submitted for review
4. Wait for review (3-4 business days)

## Version History

| Version | Version Code | Date | Status | Notes |
|---------|--------------|------|--------|-------|
| 1.0.0 | 1 | 2025-01-18 | Submitted | Initial release |

---

## Important Files

| File | Purpose |
|------|---------|
| `config.yaml` | dApp Store configuration |
| `publisher-keypair.json` | Wallet for publishing (KEEP SAFE!) |
| `.asset-manifest.json` | Tracks uploaded assets |
| `media/` | Publishing assets folder |

## Commands Reference

```bash
# Check wallet balance
solana balance publisher-keypair.json --url https://api.mainnet-beta.solana.com

# Validate config
npx dapp-store validate -k publisher-keypair.json

# Create release (for updates)
npx dapp-store create release -k publisher-keypair.json -u https://api.mainnet-beta.solana.com

# Submit update
npx dapp-store publish update -k publisher-keypair.json -u https://api.mainnet-beta.solana.com --requestor-is-authorized --complies-with-solana-dapp-store-policies
```
