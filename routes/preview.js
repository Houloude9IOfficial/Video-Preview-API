import express from 'express';
import path from 'path';
import spotifyService from '../services/spotifyService.js';
import youtubeService from '../services/youtubeService.js';
import videoProcessor from '../services/videoProcessor.js';
import cacheService from '../services/cacheService.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { extractSpotifyId, extractYoutubeId, validateOptions } from '../utils/helpers.js';

const router = express.Router();

router.get('/preview/:input', cacheMiddleware, async (req, res) => {
  let filePath = null;
  
  try {
    const { input } = req.params;
    let videoId;
    
    if (input.includes('spotify.com') || /^[a-zA-Z0-9]{22}$/.test(input)) {
      const spotifyId = extractSpotifyId(input);
      try {
        const searchQuery = await spotifyService.getYoutubeSearchQuery(spotifyId);
        videoId = await youtubeService.searchVideo(searchQuery);
      } catch (spotifyError) {
        console.warn('Spotify lookup failed, trying as YouTube ID:', spotifyError.message);
        videoId = spotifyId;
        if (!youtubeService.validateVideoId(videoId)) {
          return res.status(400).json({ error: 'Invalid Spotify ID and not a valid YouTube ID, or music video not found' });
        }
      }
    } else if (input.includes('youtube.com') || input.includes('youtu.be')) {
      videoId = extractYoutubeId(input);
    } else if (youtubeService.validateVideoId(input)) {
      videoId = input;
    } else {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    if (!youtubeService.validateVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }

    filePath = await videoProcessor.downloadVideoSegment(videoId, req.videoOptions);
    
    if (!filePath) {
      return res.status(500).json({ error: 'Failed to process video' });
    }

    const cachedPath = cacheService.set(req.cacheKey, filePath);
    
    console.log('Sending file:', cachedPath || filePath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(cachedPath || filePath);
    
  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate preview',
      message: error.message 
    });
  } finally {
    if (filePath) {
      setTimeout(() => {
        videoProcessor.cleanup(filePath);
      }, 5000);
    }
  }
});

router.get('/debug/:input', async (req, res) => {
  try {
    const { input } = req.params;
    const options = validateOptions(req.query);
    const result = { input, options, steps: [] };
    
    if (input.includes('spotify.com') || /^[a-zA-Z0-9]{22}$/.test(input)) {
      const spotifyId = extractSpotifyId(input);
      result.spotifyId = spotifyId;
      result.steps.push('Extracted Spotify ID');
      
      try {
        const searchQuery = await spotifyService.getYoutubeSearchQuery(spotifyId);
        result.searchQuery = searchQuery;
        result.steps.push('Got search query from Spotify');
        
        const videoId = await youtubeService.searchVideo(searchQuery);
        result.youtubeId = videoId;
        result.steps.push('Found YouTube video');
        
        const videoInfo = await youtubeService.getVideoInfo(videoId);
        result.videoInfo = {
          title: videoInfo.title,
          duration: videoInfo.lengthSeconds,
          videoId: videoInfo.videoId
        };
        result.steps.push('Got video info');
        
      } catch (error) {
        result.error = error.message;
        result.steps.push(`Error: ${error.message}`);
      }
    } else {
      const videoId = extractYoutubeId(input);
      result.youtubeId = videoId;
      result.steps.push('Extracted YouTube ID');
      
      try {
        const videoInfo = await youtubeService.getVideoInfo(videoId);
        result.videoInfo = {
          title: videoInfo.title,
          duration: videoInfo.lengthSeconds,
          videoId: videoInfo.videoId
        };
        result.steps.push('Got video info');
      } catch (error) {
        result.error = error.message;
        result.steps.push(`Error: ${error.message}`);
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/info', (req, res) => {
  res.json({
    name: 'Video Preview API',
    version: '1.0.0',
    description: 'Generate video previews from Spotify songs or YouTube videos',
    endpoints: {
      '/api/preview/:input': {
        description: 'Generate a video preview',
        input: 'Spotify ID/URL or YouTube ID/URL',
        parameters: {
          quality: {
            type: 'string',
            options: ['low', 'medium', 'max'],
            default: 'medium',
            description: 'Video quality: low (400k), medium (1200k), max (8000k YouTube-quality)'
          },
          duration: {
            type: 'integer', 
            min: 3,
            max: 10,
            default: 7,
            description: 'Clip duration in seconds'
          },
          audio: {
            type: 'boolean',
            default: true,
            description: 'Include audio track'
          },
          width: {
            type: 'integer',
            min: 240,
            max: 1920,
            default: 640,
            description: 'Video width (must be even)'
          },
          height: {
            type: 'integer',
            min: 180,
            max: 1080,
            default: 360,
            description: 'Video height (must be even)'
          }
        },
        examples: [
          '/api/preview/3jEqW8QNyPB5MxWEGc8tJK',
          '/api/preview/FvLDcOIYo5o?quality=max&duration=5',
          '/api/preview/3jEqW8QNyPB5MxWEGc8tJK?width=1280&height=720&audio=false'
        ]
      },
      '/api/debug/:input': 'Debug processing pipeline',
      '/api/health': 'Health check',
      '/api/info': 'API information'
    }
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

router.delete('/cache', (req, res) => {
  try {
    cacheService.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;