# 🚀 Ultimate YouTube Downloader

A modern, feature-rich YouTube downloader built with **SvelteKit**, **TailwindCSS**, and **yt-dlp**. Designed for speed, usability, and aesthetics.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/sveltekit-2.0-orange.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

## ✨ Features

### 🎨 Modern UI/UX
- **Glassmorphism Design**: Beautiful, responsive interface with neon accents.
- **Real-time Progress**: Live progress bars, speed, and ETA updates via Server-Sent Events (SSE).
- **Themes**: Dark/Light mode and customizable accent colors.
- **Mobile Responsive**: Works perfectly on desktop, tablet, and mobile.
- **Keyboard Shortcuts**: Power user shortcuts for quick actions (`?` for help).

### 📥 Advanced Downloading
- **Format Support**: MP4, MKV, WEBM, and MP3 (audio only).
- **Quality Control**: Select from 4K, 2K, 1080p, down to 480p, or specific audio bitrates (320k, 256k, etc.).
- **Batch Mode**: Download multiple videos at once by pasting a list of URLs.
- **Playlist Support**: Automatically expands playlists and queues videos.
- **Metadata**: Embeds thumbnails, titles, and metadata into files.
- **Subtitles**: Option to download and embed subtitles.
- **SponsorBlock**: Automatically skip non-music/sponsor segments.

### 🛠️ Power Tools
- **Video Trimming**: Download specific time ranges (Start/End time).
- **Audio Normalization**: Normalize audio levels (Loudnorm).
- **Chapter Splitting**: Split long videos into separate files based on chapters.
- **Organization**: Automatically organize files into folders by Uploader/Channel.
- **Custom Filenames**: Define your own naming patterns (e.g., `{uploader} - {date} - {title}`).

### ⚙️ System & Management
- **Queue Management**: Pause, Resume, Cancel, and Retry downloads.
- **History**: Searchable history with "Redownload" and "Delete" options.
- **Library**: Browse, filter, and play downloaded files directly in the browser.
- **System Status**: Monitor disk usage, memory, and uptime.
- **Auto-Cleanup**: Automatically delete old downloads after a configurable number of days.
- **Network**: Proxy support, Rate limiting, and Cookie support (for age-restricted content).

## 🚀 Getting Started

### Docker (Recommended)

The easiest way to run the application is using Docker Compose.

```bash
# Clone the repository
git clone https://github.com/ionutale/youtube-download.git
cd youtube-download

# Start the container
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Files will be saved to the `./download` directory.

### Local Development

Prerequisites: `Node.js 18+`, `pnpm`, `ffmpeg`, and `yt-dlp` must be installed on your system.

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
DOWNLOAD_DIR=download       # Directory to save files
MAX_CONCURRENCY=2           # Max simultaneous downloads
PROGRESS_INTERVAL_MS=200    # Progress update frequency
DEFAULT_QUALITY=highest     # Default video quality
DEFAULT_FORMAT=mp4          # Default format
RETENTION_DAYS=0            # Auto-delete files after X days (0 = disabled)
```

### Settings UI

Most configurations can be changed at runtime via the **Settings** page:
- **File Naming**: Set patterns like `{title}` or `{uploader}/{title}`.
- **Network**: Configure Proxy and Rate Limits.
- **Cookies**: Paste Netscape-formatted cookies to access restricted content.
- **Appearance**: Change accent colors.

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Enter` | Start Download |
| `/` | Focus Input |
| `?` | Show Shortcuts Help |
| `Esc` | Close Modals |

## 🏗️ Tech Stack

- **Frontend**: SvelteKit, TailwindCSS, DaisyUI, Lucide Icons
- **Backend**: Node.js, MongoDB (persistence), EventSource (SSE)
- **Core**: yt-dlp (download engine), ffmpeg (processing)

## 📝 License

MIT
