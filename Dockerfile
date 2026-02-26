# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm ci --omit=dev

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

# Install system dependencies:
#   ffmpeg          - video processing
#   python3 + pip   - required by youtube-dl-exec / yt-dlp fallback
#   curl            - used to fetch yt-dlp binary
#   ca-certificates - HTTPS support
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp as a system binary so youtube-dl-exec can find it.
# Pinning to a recent stable version; bump as needed.
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

# Copy production node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create runtime directories (these must exist before the app starts)
RUN mkdir -p /app/temp /app/cache/clips /app/cache/metadata

# Configure youtube-dl-exec to use the system yt-dlp binary
ENV YOUTUBE_DL_PATH=/usr/local/bin/yt-dlp

# Expose the port the app listens on (default 3000, override with PORT env var)
EXPOSE 3000

# Run as a non-root user for security
RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["node", "main.js"]
