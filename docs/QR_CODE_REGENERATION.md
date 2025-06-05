# QR Code Regeneration and Validation

## Overview

This document explains how QR code regeneration works in the Treasures app and why regenerated QR codes invalidate previous ones.

## How QR Code Regeneration Works

### 1. Initial QR Code Creation
When a geocache is first created:
- A new verification key pair is generated (public/private key)
- The public key is stored in the geocache event (kind 37515) as a `verification` tag
- The private key (nsec) is embedded in the QR code URL: `https://treasures.to/{naddr}#verify={nsec}`

### 2. QR Code Regeneration Process
When a cache owner regenerates a QR code:
1. **New Key Generation**: A completely new verification key pair is generated
2. **New Event Creation**: A new geocache event (kind 37515) is published with the same d-tag but new verification key
3. **Event Replacement**: The new event replaces the old one (same d-tag = same cache, but updated)
4. **Old Keys Invalidated**: The old verification key is no longer associated with the cache

### 3. Why Old QR Codes Stop Working
- **Old QR codes** contain the old verification key (nsec)
- **Current geocache** has the new verification key (pubkey)
- **Verification fails** because `verifyKeyPair(old_nsec, new_pubkey)` returns `false`

## User Experience Flow

### For Cache Owners
1. **Regeneration Warning**: Clear warning that old QR codes will stop working
2. **New QR Download**: Immediate access to download the new QR code
3. **Physical Replacement**: Must print and place the new QR code at cache location
4. **Old QR Removal**: Should remove or cover old QR codes to avoid confusion

### For Finders with Old QR Codes
1. **Scan Old QR Code**: QR scanner successfully reads the URL
2. **Navigate to Cache**: App navigates to cache page with old verification key
3. **Validation Fails**: `verifyKeyPair()` returns false for old key
4. **Clear Error Message**: "Outdated QR Code - This QR code has been replaced by the cache owner. Please look for a newer QR code at the cache location."

### For Finders with New QR Codes
1. **Scan New QR Code**: QR scanner reads the URL with new verification key
2. **Navigate to Cache**: App navigates to cache page with new verification key
3. **Validation Succeeds**: `verifyKeyPair()` returns true for current key
4. **Success Message**: "Verification Key Detected - You can now submit verified logs!"
5. **Verified Logging**: Can submit verified "Found it" logs

## Technical Implementation

### Verification Process
```typescript
// Extract verification key from QR code URL
const nsec = parseVerificationFromHash(window.location.hash);

// Get current verification key from latest geocache event
const currentPubkey = geocache.verificationPubkey;

// Verify the scanned key matches the current key
const isValid = await verifyKeyPair(nsec, currentPubkey);

if (isValid) {
  // Show success message and enable verified logging
} else {
  // Show "Outdated QR Code" error
}
```

### Key Functions
- `parseVerificationFromHash()`: Extracts nsec from URL hash
- `verifyKeyPair()`: Compares private key against expected public key
- `generateVerificationKeyPair()`: Creates new key pairs during regeneration
- `useRegenerateVerificationKey()`: Hook that handles the regeneration process

## Error Handling and User Guidance

### Error Messages
- **Outdated QR Code**: "This QR code has been replaced by the cache owner. Please look for a newer QR code at the cache location."
- **Missing Verification Key**: "This QR code appears to be damaged or incomplete. Please try scanning again or look for a replacement QR code at the cache location."
- **Invalid Format**: "This QR code may be outdated or from an older version. Please look for a newer QR code at the cache location."

### Best Practices for Cache Owners
1. **Plan Regeneration**: Only regenerate when necessary (lost QR code, security concerns)
2. **Immediate Replacement**: Replace physical QR codes as soon as possible after regeneration
3. **Clear Old QR Codes**: Remove or cover old QR codes to prevent confusion
4. **Communication**: Consider logging a maintenance note about QR code replacement

### Best Practices for Finders
1. **Check QR Code Date**: Look for newer QR codes if getting "outdated" errors
2. **Report Issues**: Contact cache owner if no valid QR code can be found
3. **Regular Logs**: Can still submit regular (non-verified) logs without QR code

## Security Considerations

### Why Invalidation is Important
- **Prevents Replay Attacks**: Old verification keys cannot be used maliciously
- **Maintains Cache Integrity**: Only current cache owner can generate valid verification
- **Clear Ownership**: Each regeneration creates a clear audit trail

### Verification Event Security
- **Signed by Verification Key**: Each verification event is cryptographically signed
- **Embedded in Logs**: Verification events are embedded in log events for tamper resistance
- **Pubkey Validation**: System validates that verification events come from expected verification key

## Troubleshooting

### Common Issues
1. **"Outdated QR Code" Error**: Look for newer QR code at cache location
2. **"No QR Code Found"**: Cache may not have verification enabled
3. **"Invalid QR Code"**: QR code may be damaged or from wrong source

### For Developers
- Check `verifyKeyPair()` implementation for key comparison logic
- Verify `parseVerificationFromHash()` correctly extracts nsec from URL
- Ensure `useRegenerateVerificationKey()` properly updates cache data
- Test error handling in both `CacheDetail` and `Claim` components

## Testing

### Test Coverage
- ✅ QR URL validation logic
- ✅ Verification key comparison
- ✅ Error message generation
- ✅ Regeneration process
- ✅ Cache invalidation

### Key Test Cases
- Valid QR codes with current verification keys
- Invalid QR codes with outdated verification keys
- Malformed QR codes and URLs
- Missing verification keys
- Cross-domain security validation

## Conclusion

QR code regeneration is a security feature that ensures only current, valid verification keys can be used to submit verified logs. While this means old QR codes stop working, it maintains the integrity of the verification system and provides clear error messages to guide users to the correct QR code.