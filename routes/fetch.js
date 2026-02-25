import express from 'express';
import path from 'path';
import spotifyService from '../services/spotifyService.js';
import youtubeService from '../services/youtubeService.js';
import videoProcessor from '../services/videoProcessor.js';
import cacheService from '../services/cacheService.js';
import { extractSpotifyId, extractYoutubeId, validateOptions, getVideoMiddleTime } from '../utils/helpers.js';
import { DEFAULT_OPTIONS } from '../utils/constants.js';

const router = express.Router();

router.get('/metadata', async (req, res) => {
  try {
    const { spotifyid, youtubeid } = req.query;
    
    if (!spotifyid && !youtubeid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either spotifyid or youtubeid parameter is required' 
      });
    }

    let input, inputType, cacheKey;
    
    if (spotifyid) {
      input = extractSpotifyId(spotifyid);
      inputType = 'spotify';
      cacheKey = cacheService.generateCacheKey(input, { type: 'spotify' });
    } else {
      input = extractYoutubeId(youtubeid);
      inputType = 'youtube';
      cacheKey = cacheService.generateCacheKey(input, { type: 'youtube' });
    }

    const cachedMetadata = cacheService.getMetadata(cacheKey);
    if (cachedMetadata) {
      return res.json({
        success: true,
        metadata: cachedMetadata,
        video_preview_url: `${req.protocol}://${req.get('host')}/api/fetch/preview/${cacheKey}`
      });
    }

    let metadata = {};
    let youtubeVideoId;

    if (inputType === 'spotify') {
      try {
        const spotifyTrack = await spotifyService.getTrack(input);
        const searchQuery = await spotifyService.getYoutubeSearchQuery(input);
        
        youtubeVideoId = await youtubeService.searchVideo(searchQuery);
        const youtubeInfo = await youtubeService.getVideoInfo(youtubeVideoId);
        
        const clipStartMs = Math.floor(getVideoMiddleTime(youtubeInfo.lengthSeconds, DEFAULT_OPTIONS.duration) * 1000);
        
        metadata = {
          spotify_id: input,
          title: spotifyTrack.name,
          artist: spotifyTrack.artists.map(a => a.name).join(', '),
          album: spotifyTrack.album.name,
          duration_ms: spotifyTrack.duration_ms,
          thumbnail: spotifyTrack.album.images[0]?.url,
          youtube_video_id: youtubeVideoId,
          youtube_metadata: {
            title: youtubeInfo.title,
            duration_seconds: youtubeInfo.lengthSeconds,
            channel: youtubeInfo.channel || 'Unknown'
          },
          clip_start_ms: clipStartMs,
          clip_duration_ms: DEFAULT_OPTIONS.duration * 1000
        };
      } catch (error) {
        console.error('Spotify processing error:', error.message);
        return res.status(404).json({
          success: false,
          error: 'Track not found or Spotify unavailable'
        });
      }
    } else {
      try {
        youtubeVideoId = input;
        const youtubeInfo = await youtubeService.getVideoInfo(youtubeVideoId);
        
        const clipStartMs = Math.floor(getVideoMiddleTime(youtubeInfo.lengthSeconds, DEFAULT_OPTIONS.duration) * 1000);
        
        metadata = {
          spotify_id: null,
          title: youtubeInfo.title,
          artist: 'Unknown',
          album: 'Unknown',
          duration_ms: youtubeInfo.lengthSeconds * 1000,
          thumbnail: `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
          youtube_video_id: youtubeVideoId,
          youtube_metadata: {
            title: youtubeInfo.title,
            duration_seconds: youtubeInfo.lengthSeconds,
            channel: youtubeInfo.channel || 'Unknown'
          },
          clip_start_ms: clipStartMs,
          clip_duration_ms: DEFAULT_OPTIONS.duration * 1000
        };
      } catch (error) {
        console.error('YouTube processing error:', error.message);
        return res.status(404).json({
          success: false,
          error: 'Video not found or unavailable'
        });
      }
    }

    cacheService.setMetadata(cacheKey, metadata);

    res.json({
      success: true,
      metadata,
      video_preview_url: `${req.protocol}://${req.get('host')}/api/fetch/preview/${cacheKey}`
    });

  } catch (error) {
    console.error('Metadata fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate metadata'
    });
  }
});

router.get('/preview/:cacheKey', async (req, res) => {
  try {
    const { cacheKey } = req.params;
    
    const cachedVideoPath = cacheService.getVideoPath(cacheKey);
    if (cachedVideoPath) {
      return res.sendFile(cachedVideoPath);
    }

    const metadata = cacheService.getMetadata(cacheKey);
    if (!metadata) {
      return res.status(404).json({ 
        error: 'Cache key not found. Generate metadata first.' 
      });
    }

    const options = validateOptions(req.query, DEFAULT_OPTIONS);
    const videoPath = await videoProcessor.downloadVideoSegment(
      metadata.youtube_video_id, 
      options
    );

    if (!videoPath) {
      return res.status(500).json({ 
        error: 'Failed to process video preview' 
      });
    }

    const cachedPath = cacheService.setVideo(cacheKey, videoPath);
    
    videoProcessor.cleanup(videoPath);

    if (cachedPath) {
      res.sendFile(cachedPath);
    } else {
      res.status(500).json({ 
        error: 'Failed to cache video preview' 
      });
    }

  } catch (error) {
    console.error('Preview fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to generate video preview'
    });
  }
});

export default router;