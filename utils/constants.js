import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

export const PORT = process.env.PORT || 3000;
export const CACHE_TTL = 3600;
export const MAX_CACHE_SIZE = 500;
export const VIDEO_DURATION = 7;
export const TEMP_DIR = path.join(projectRoot, 'temp');
export const CACHE_DIR = path.join(projectRoot, 'cache');
export const METADATA_CACHE_DIR = path.join(projectRoot, 'cache', 'metadata');
export const CLIPS_CACHE_DIR = path.join(projectRoot, 'cache', 'clips');

export const QUALITY_PRESETS = {
  low: {
    videoBitrate: '800k',
    audioBitrate: '96k',
    crf: '28',
    preset: 'fast',
    profile: 'baseline',
    level: '3.0',
    maxBitrate: '1200k',
    bufsize: '1600k'
  },
  medium: {
    videoBitrate: '2500k',
    audioBitrate: '192k', 
    crf: '23',
    preset: 'medium',
    profile: 'high',
    level: '4.0',
    maxBitrate: '3500k',
    bufsize: '5000k'
  },
  max: {
    videoBitrate: '6000k',
    audioBitrate: '320k',
    crf: '18',
    preset: 'medium',
    profile: 'high',
    level: '4.2',
    maxBitrate: '8000k',
    bufsize: '12000k'
  }
};

export const DEFAULT_OPTIONS = {
  quality: 'medium',
  duration: 7,
  audio: true,
  width: 640,
  height: 360
};