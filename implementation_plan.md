# Implementation Plan - Missing Features (Proposals 1)

This plan addresses the remaining unimplemented features from `proposals_1.md` to allow for its completion and deletion.

## Goal
Implement the following features:
1.  **Dark/Light Mode Toggle** (Feature 21)
2.  **History Export** (Feature 34)
3.  **File Renaming Patterns UI** (Feature 17)
4.  **Audio Removal (Video Only)** (Feature 19)
5.  **Clipboard Monitoring** (Feature 29)
6.  **Browser Extension** (Feature 45)
7.  **User Accounts** (Feature 41)

## Proposed Changes

### 1. Dark/Light Mode Toggle
*   **File**: `src/routes/+layout.svelte`
*   **Change**: Add a theme toggle button in the header/footer. Use DaisyUI themes (`light`, `dark`). Persist preference in `localStorage`.

### 3. File Renaming Patterns UI
*   **File**: `src/routes/settings/+page.svelte` (or wherever settings are)
*   **Change**: Add input field for `filenamePattern`.
*   **File**: `src/lib/server/settings.ts`
*   **Change**: Ensure `filenamePattern` is saved in server settings (it might be per-download currently, but a global default is good).

### 5. Clipboard Monitoring
*   **File**: `src/routes/+page.svelte`
*   **Change**: Implement `checkClipboard` function using `navigator.clipboard.readText()`. Add a "Paste from Clipboard" button as browsers often block auto-read.

### 6. Browser Extension
*   **Directory**: `extension/` (NEW)
*   **Files**: `manifest.json`, `background.js`, `popup.html`.
*   **Functionality**: Context menu "Download with YouTube Downloader" that sends URL to the running instance (configurable URL).

### 7. User Accounts
*   **File**: `src/lib/server/db.ts`
*   **Change**: Add `users` collection.
*   **File**: `src/lib/server/auth.ts`
*   **Change**: Add `register`, `login`, `verifySession` functions.
*   **File**: `src/routes/login/+page.svelte` (NEW)
*   **Change**: Login page.
*   **File**: `src/hooks.server.ts`
*   **Change**: Protect routes if auth is enabled.

## Verification Plan
*   **Manual**:
    *   Toggle themes.
    *   Export history and check file content.
    *   Change filename pattern and download a video.
    *   Download "Video Only" and check if it has sound.
    *   Use "Paste from Clipboard".
    *   Load unpacked extension in Chrome and test.
    *   Register/Login and check if downloads are isolated (or just access control).
