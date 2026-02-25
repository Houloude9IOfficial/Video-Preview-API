import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const generateCacheKey = (input, options = {}) => {
  const optionsStr = JSON.stringify(options);
  return crypto.createHash('md5').update(input + optionsStr).digest('hex');
};

export const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const extractSpotifyId = (url) => {
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : url;
};

export const extractYoutubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : url;
};

export const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
};

export const getVideoMiddleTime = (durationInSeconds, clipDuration = 7) => {
  return Math.max(0, Math.floor(durationInSeconds / 2) - Math.floor(clipDuration / 2));
};

export const validateOptions = (query) => {
  const options = {
    quality: ['low', 'medium', 'max'].includes(query.quality) ? query.quality : 'medium',
    duration: Math.min(Math.max(parseInt(query.duration) || 7, 3), 10),
    audio: query.audio !== 'false',
    width: Math.min(Math.max(parseInt(query.width) || 640, 240), 1920),
    height: Math.min(Math.max(parseInt(query.height) || 360, 180), 1080)
  };
  
  if (options.width % 2 !== 0) options.width += 1;
  if (options.height % 2 !== 0) options.height += 1;
  
  return options;
};