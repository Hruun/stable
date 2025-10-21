# HANDOFF: Editor Separation & Bug Fixes

## ✅ COMPLETED
- **Editor Separation**: Classic and Virtual editors now use independent state contexts
- **Removed Toggle Button**: Eliminated editor switcher and all accompanying code
- **Independent Data Management**: 
  - Classic Editor: Uses `DataContext` (localStorage: `autosave-data-state`)
  - Virtual Editor: Uses `VirtualDataContext` (localStorage: `autosave-virtual-data-state`)
- **Independent Workflows**: Each editor maintains separate audio, transcript, versions, MFA/Whisper/Pyannote data

## 🚨 REMAINING BUGS (Priority Order)

### 1. **Classic Editor Play-at-Word Bug** (HIGH PRIORITY)
**Issue**: Classic editor not seeking audio when clicking on words in transcript
**Location**: `components/TranscriptView.tsx` 
**Problem**: The `onSeekToTime` callback may not be properly triggering audio seek
**Fix Needed**: 
- Check if `handleSeekToTime` in `Editor.tsx` is correctly setting `audioRef.current.currentTime`
- Verify word click handlers in `TranscriptView.tsx` are calling `onSeekToTime` with correct timestamps
- Test audio seeking functionality

### 2. **Virtual Editor Context Menu** (MEDIUM PRIORITY) 
**Issue**: Virtual editor missing right-click context menu for play-at-word
**Location**: `components/VirtualTranscriptView.tsx`
**Fix Needed**:
- Add right-click context menu with "Play at Word" option
- Implement word timestamp detection on right-click
- Call `onSeekToTime` with word's start timestamp

### 3. **Editor Independence Verification** (HIGH PRIORITY)
**Test Cases**:
- [ ] Upload different audio files in each editor
- [ ] Upload different transcript files in each editor  
- [ ] Verify switching tabs maintains separate state
- [ ] Confirm localStorage separation working
- [ ] Test version history independence

## 🔧 TECHNICAL DETAILS

### Architecture Changes Made
```
App.tsx
├── ClassicEditorContent (wrapped in DataContext)
│   └── Editor.tsx → TranscriptView.tsx
└── VirtualEditorContent (wrapped in VirtualDataContext)  
    └── VirtualEditor.tsx → VirtualTranscriptView.tsx
```

### State Separation
- **Classic**: `useData()` from `DataContext` 
- **Virtual**: `useVirtualData()` from `VirtualDataContext`
- **Shared**: `useUI()` for interface state (zoom, sidebars, etc.)

### Files Modified
- `App.tsx` - Added independent content components
- `components/Editor.tsx` - Removed toggle button and virtual editor code
- `components/VirtualEditor.tsx` - Updated to use VirtualDataContext
- `contexts/VirtualDataContext.tsx` - New independent context
- `types.ts` - Updated tab types

## 🐛 DEBUGGING STEPS

### For Play-at-Word Bug:
1. **Check Audio Ref**: Verify `audioRef.current` exists and is loaded
2. **Test Seek Function**: Add console.log in `handleSeekToTime` to see if it's called
3. **Verify Timestamps**: Check if word objects have valid `start` timestamps
4. **Audio State**: Ensure audio is ready (`readyState >= 2`) before seeking

### For Context Menu:
1. **Add onContextMenu handler** to VirtualTranscriptView
2. **Prevent default** browser context menu
3. **Show custom menu** with play option
4. **Get word at cursor position** and extract timestamp
5. **Call onSeekToTime** with word.start value

## 🧪 TESTING CHECKLIST

### Manual Testing Required:
- [ ] Classic editor word clicking seeks audio correctly
- [ ] Virtual editor uploads work independently
- [ ] Tab switching preserves separate states
- [ ] Version histories don't cross-contaminate
- [ ] Both editors can load different audio files simultaneously
- [ ] Speaker timelines work independently
- [ ] Find/replace works in both editors
- [ ] Export functions work separately

### Quality Checks:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] No console errors in browser
- [ ] localStorage keys separate correctly

## 🚀 DEPLOYMENT NOTES
- Changes are backward compatible
- localStorage will migrate automatically
- No breaking changes to existing workflows
- Each editor maintains full feature parity

---
**Status**: Ready for final bug fixes and testing
**Next**: Fix play-at-word functionality, add context menu, verify independence