# How to Restore Working iOS Build

## Problem
If you encounter the iOS build error:
```
Element type is invalid: expected a string (for built-in components) or a class/function 
(for composite components) but got: undefined.
```

## Solution: Restore to Working State

### Quick Restore
The working production build is tagged. To restore:

```bash
# Option 1: Reset to the tagged working state
git checkout v1.0.5-build8-working

# Option 2: Reset to the commit and update build number
git checkout d90cf4a
# Then update app.json iOS buildNumber to "8"
```

## Working Build Details

- **Tag**: `v1.0.5-build8-working`
- **Commit**: `d90cf4a` - "Add unified About copy, adjust modal layout, update feedback email"
- **Date**: Dec 12, 2025
- **Version**: 1.0.5
- **Build Number**: 8
- **EAS Build ID**: b429e9bd
- **Status**: ✅ Deployed to TestFlight and working in production

## What Was in the Stash

The stash contains local work-in-progress changes that were causing the build error:

### Files Modified (13 files):
1. `.npmrc` - whitespace changes
2. `FEEDBACK_DATABASE_SETUP.md` - whitespace changes
3. `LOVABLE_ADMIN_INSTRUCTIONS.md` - whitespace changes
4. `LOVABLE_ADMIN_UPDATE.md` - whitespace changes
5. `WEB_STYLE_GUIDE.md` - whitespace changes
6. `app.json` - build number change
7. **`components/BookmarkListModal.tsx`** - Removed useSettings dependency (79 lines changed)
8. `components/DismissibleToast.tsx` - whitespace changes
9. `components/InlineTimePicker.tsx` - whitespace changes
10. **`components/SettingsContent.tsx`** - MAJOR changes (669 lines deleted!)
11. `hooks/useReadingFeedback.ts` - whitespace changes
12. `utils/deviceIdentity.ts` - whitespace changes
13. `utils/errorLogger.ts` - whitespace changes

**Total**: 43 insertions, 727 deletions

### Key Issues in Stashed Changes
- **SettingsContent.tsx**: 669 lines were removed (likely the cause of the undefined component error)
- **BookmarkListModal.tsx**: Removed `useSettings` and `getTextSizeMetrics` imports/usage

## To Recover Your Stashed Work

If you want to review or recover the stashed changes:

```bash
# View what's in the stash
git stash show -p stash@{0}

# Apply the stash (but keep it in stash list)
git stash apply stash@{0}

# Or pop it (removes from stash list)
git stash pop
```

## Troubleshooting Steps

1. **Clear Metro Cache**: 
   ```bash
   npx expo start --clear
   ```

2. **Clean iOS Build**:
   ```bash
   cd ios && xcodebuild clean && cd ..
   ```

3. **Reinstall Dependencies**:
   ```bash
   rm -rf node_modules
   npm install
   ```

4. **Check You're on Working Commit**:
   ```bash
   git log -1 --oneline
   # Should show: d90cf4a Add unified About copy...
   ```

5. **Verify Build Number**:
   ```bash
   grep buildNumber app.json
   # Should show: "buildNumber": "8",
   ```

## Tags

- `v1.0.5-build8-working` - The known good production build

## Notes

- The production build (b429e9bd) used commit d90cf4a with build number 8
- This was a successful App Store build deployed to TestFlight
- Any changes should be carefully tested before modifying these core modal components

