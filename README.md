# Video Preview API

A high-performance API that generates video previews from Spotify tracks and YouTube videos. Extracts 7-second clips from the middle of videos with customizable quality settings and intelligent caching.

## Features

- **Multi-source input**: Spotify song IDs, YouTube URLs, or YouTube video IDs
- **Smart video matching**: Finds official music videos, filters out covers/remixes/live versions
- **High-quality extraction**: Up to 1080p video quality with optimized encoding
- **Customizable clips**: Adjustable duration, quality, resolution, and audio settings
- **Intelligent caching**: Separate metadata and video caching for optimal performance
- **Fast processing**: Optimized search and video processing pipeline

## Installation

```bash
git clone https://github.com/Houloude9IOfficial/Video-Preview-API
cd Video-Preview-API
npm install
npm start
```

### Environment Setup

Create a `.env` file:

```env
PORT=3000
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Dependencies

- FFmpeg (required for video processing)
- Node.js 16+ 

## API Endpoints

### Metadata Endpoint

Get track metadata and preview information without generating the video.

```
GET /api/fetch/metadata?spotifyid=ID
GET /api/fetch/metadata?youtubeid=ID
```

**Response:**
```json
{
  "success": true,
  "metadata": {
    "spotify_id": "4PTG3Z6ehGkBFwjybzWkR8",
    "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    "artist": "Rick Astley",
    "album": "Whenever You Need Somebody",
    "duration_ms": 212000,
    "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "youtube_video_id": "dQw4w9WgXcQ",
    "youtube_metadata": {
      "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
      "duration_seconds": 213,
      "channel": "RickAstleyVEVO"
    },
    "clip_start_ms": 103000,
    "clip_duration_ms": 7000
  },
  "video_preview_url": "http://localhost:3000/api/fetch/preview/..."
}
```

### Preview Endpoint

Get the actual video preview file.

```
GET /api/fetch/preview/{cacheKey}
```

Returns the MP4 video file.

### Legacy Endpoints

Direct preview generation (backwards compatibility):

```
GET /api/preview/{input}?quality=max&duration=7&audio=true&width=1920&height=1080
GET /api/debug/{input}
GET /api/info/{input}
GET /api/health
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `quality` | string | `medium` | `low`, `medium`, `max` |
| `duration` | number | `7` | Clip duration in seconds (1-30) |
| `audio` | boolean | `true` | Include audio track |
| `width` | number | `640` | Video width in pixels |
| `height` | number | `360` | Video height in pixels |

## Quality Presets

| Preset | Video Bitrate | Audio Bitrate | CRF | Use Case |
|--------|---------------|---------------|-----|----------|
| `low` | 800k | 96k | 28 | Fast processing, small files |
| `medium` | 2500k | 192k | 23 | Balanced quality/speed |
| `max` | 6000k | 320k | 18 | High quality, larger files |

## Usage Examples

### Generate metadata for Spotify track
```bash
curl "http://localhost:PORT/api/fetch/metadata?spotifyid=4uLU6hMCjMI75M1QiiBWiw"
```

### Get high-quality preview
```bash
curl "http://localhost:PORT/api/fetch/preview/abc123" --output preview.mp4
```

### Direct preview with custom settings
```bash
curl "http://localhost:PORT/api/preview/dQw4w9WgXcQ?quality=max&duration=10&width=1920&height=1080" --output preview.mp4
```

## Input Formats

### Spotify
- Track ID: `4PTG3Z6ehGkBFwjybzWkR8`
- Full URL: `https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8`

### YouTube
- Video ID: `dQw4w9WgXcQ`
- Full URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Short URL: `https://youtu.be/dQw4w9WgXcQ`

## Cache Structure

```
cache/
├── metadata/
│   └── {cacheKey}.json
└── clips/
    └── {cacheKey}.mp4
```

Cache keys are MD5 hashes of input + options for efficient lookup and deduplication.

## Server Configuration

Start the server:

```bash
npm start
```

Default port: 3000 (configurable via `PORT` environment variable)

## Video Processing Pipeline

1. **Input validation**: Extract and validate Spotify/YouTube IDs
2. **Metadata extraction**: Get track info from Spotify API
3. **Video search**: Find matching YouTube video using smart filtering
4. **Quality selection**: Choose best available video format
5. **Clip extraction**: Extract middle segment with FFmpeg
6. **Caching**: Store metadata and video separately
7. **Delivery**: Serve cached or newly generated content

## Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "error": "Track not found or Spotify unavailable"
}
```

Common error codes:
- `400`: Invalid input format
- `404`: Track/video not found
- `500`: Processing failure

## Performance

- **Search time**: Optimized to seconds vs minutes
- **Processing time**: 3-10 seconds depending on quality
- **Cache hits**: Instant response for cached content
- **File sizes**: 300KB-2MB depending on quality/duration
- **Concurrent requests**: Supported via efficient caching