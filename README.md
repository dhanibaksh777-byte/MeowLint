# MeowLint Extension

**Tagline:** Your code has feelings. Your cat doesn't care.

MeowLint is a VS Code extension that adds a cat-themed sidebar view to monitor code quality and provide playful roasts of your code.

## Features

### Sidebar Cat
- Displays a logo with header and tagline
- Shows speech bubble with mood-based messages
- Mood-driven animations:
  - **Idle**: Breathing and bobbing animation
  - **Sleeping**: Dimmed, slower animation with "Zzz" message
  - **Angry**: Red tint with shaking animation

### Moods
- **Idle**: Default state
- **Sleeping**: No typing for 30 seconds (configurable)
- **Angry**: File has diagnostic errors
- Angry mood has priority over sleeping mood

### AI Roasts
- Send code to Gemini API for sarcastic cat reviews
- Max 2 short sentences per roast
- Focus on actual code issues (naming, nesting, duplication, error handling)
- Truncates content to ~4000 characters
- Skips non-code files

### Settings
- `meowlint.enableRoasts`: Enable/disable roasts (default: true)
- `meowlint.sleepAfterSeconds`: Seconds before cat sleeps (default: 30)

## Commands

### MeowLint: Hello
Shows "Meow! MeowLint is alive"

### MeowLint: Set Gemini API Key
Opens input box to set your Gemini API key (password mode)

### MeowLint: Roast Current File
Manually trigger a roast of the current file

## API Key

### How to Get a Free Gemini API Key
1. Go to [Google AI Studio](https://ai.google.dev/studio/)
2. Sign in with your Google account
3. Click on "Get API Key"
4. Copy the generated API key
5. Use "MeowLint: Set Gemini API Key" command in VS Code to set it

## Project Structure

```
/src/
  ├── extension.ts              # Main extension entry point
  ├── catViewProvider.ts        # Webview view provider for sidebar cat
  ├── moodManager.ts            # Mood state management based on editor events
  ├── roaster.ts                # AI roast functionality
  └── media/
      ├── icon.svg              # Activity Bar icon (monochrome cat)
      └── logo.png              # Extension logo (grumpy orange cartoon cat)
      # NOTE: For fallback, emoji faces are included in catViewProvider.ts
```

## Files to Replace for Per-Mood Images

Currently, all moods use the same `logo.png`. To add per-mood sprite sheets:

1. Replace `src/media/logo.png` with individual mood-specific images:
   - `src/media/cat-idle.png`
   - `src/media/cat-sleeping.png` 
   - `src/media/cat-angry.png`

2. Update the `spriteConfig` object in `src/catViewProvider.ts`:
   ```typescript
   private spriteConfig = {
     frameWidth: 32,
     frameCount: 8,
     fileNamePerMood: {
       idle: 'cat-idle.png',
       sleeping: 'cat-sleeping.png',
       angry: 'cat-angry.png'
     }
   };
   ```

## Testing

### Manual Testing
1. Press **F5** to launch Extension Development Host
2. In VS Code, go to **Command Palette** (Ctrl+Shift+P)
3. Search for and run **MeowLint: Hello**
4. Open the **MeowLint** tab in the Activity Bar
5. Create or edit a file to trigger different moods

### Test Checklist
- [ ] Extension compiles without errors
- [ ] F5 launches Extension Development Host
- [ ] MeowLint: Hello shows information message
- [ ] Activity Bar shows MeowLint icon
- [ ] Sidebar cat displays with header and tagline
- [ ] Cat emoji changes for different moods
- [ ] Speech bubble updates for mood changes
- [ ] Cat sleeps after period of inactivity
- [ ] Cat becomes angry with file errors
- [ ] Cat wakes on typing when sleeping
- [ ] MeowLint: Set Gemini API Key command works
- [ ] MeowLint: Roast Current File command works
- [ ] Settings are accessible and persistent

## Development Notes

### Code Comments
- Added only where logic is non-obvious
- Focus on clarity for future maintainers
- Follow existing codebase conventions

### Dependencies
- Built with TypeScript 5.0.0+
- Uses VS Code Extension API
- No external npm packages required

### Files
- **src/extension.ts**: Main extension activation and command registration
- **src/catViewProvider.ts**: Webview implementation with mood animations
- **src/moodManager.ts**: Mood state machine based on editor events
- **src/roaster.ts**: Gemini API integration for code roasts
- **package.json**: Extension metadata and configuration
- **tsconfig.json**: TypeScript configuration
- **src/media/**: Assets for the extension UI

## Troubleshooting

### Image Files
If you want to use actual images instead of emojis, download:
- A grumpy orange cartoon cat image (logo.png)
- Place it in `src/media/logo.png`
- The extension will use this as the default cat image

### Gemini API Errors
- **API Key Errors**: Make sure your key is valid and has billing set up
- **Rate Limits**: The extension handles these gracefully with cat messages
- **Network Issues**: Cat shows appropriate in-character messages

### Compilation Issues
- If TypeScript compilation fails, check for syntax errors in the source files
- Ensure all imports are correctly referenced
- Verify TypeScript version matches tsconfig.json
