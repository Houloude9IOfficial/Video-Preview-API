import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';
import { CACHE_TTL, MAX_CACHE_SIZE, METADATA_CACHE_DIR, CLIPS_CACHE_DIR } from '../utils/constants.js';
import { ensureDirectoryExists } from '../utils/helpers.js';
import { createHash } from 'crypto';

class CacheService {
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: CACHE_TTL, 
      checkperiod: 120,
      maxKeys: MAX_CACHE_SIZE 
    });
    ensureDirectoryExists(METADATA_CACHE_DIR);
    ensureDirectoryExists(CLIPS_CACHE_DIR);
  }

  generateCacheKey(input, options = {}) {
    const optionsString = Object.keys(options)
      .sort()
      .map(key => `${key}=${options[key]}`)
      .join('&');
    
    const inputString = `${input}_${optionsString}`;
    return createHash('md5').update(inputString).digest('hex');
  }

  getMetadata(cacheKey) {
    const cachedData = this.cache.get(`meta_${cacheKey}`);
    if (cachedData) {
      console.log('Memory cache hit for metadata:', cacheKey);
      return cachedData;
    }
    
    const filePath = path.join(METADATA_CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const metadata = JSON.parse(fileContent);
        this.cache.set(`meta_${cacheKey}`, metadata);
        console.log('File cache hit for metadata:', cacheKey);
        return metadata;
      } catch (error) {
        console.error('Error reading metadata cache file:', error.message);
        fs.unlinkSync(filePath);
      }
    }
    
    return null;
  }

  setMetadata(cacheKey, metadata) {
    this.cache.set(`meta_${cacheKey}`, metadata);
    
    const filePath = path.join(METADATA_CACHE_DIR, `${cacheKey}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
      console.log('Metadata cached:', cacheKey);
      return cacheKey;
    } catch (error) {
      console.error('Error writing metadata cache file:', error.message);
      return null;
    }
  }

  getVideoPath(cacheKey) {
    const filePath = path.join(CLIPS_CACHE_DIR, `${cacheKey}.mp4`);
    if (fs.existsSync(filePath)) {
      console.log('Video cache hit:', cacheKey);
      return filePath;
    }
    return null;
  }

  setVideo(cacheKey, videoPath) {
    if (!fs.existsSync(videoPath)) {
      console.error('Source video file does not exist:', videoPath);
      return null;
    }
    
    const targetPath = path.join(CLIPS_CACHE_DIR, `${cacheKey}.mp4`);
    try {
      fs.copyFileSync(videoPath, targetPath);
      console.log('Video cached:', cacheKey);
      return targetPath;
    } catch (error) {
      console.error('Error caching video file:', error.message);
      return null;
    }
  }

  get(key) {
    return this.getVideoPath(key);
  }

  set(key, filePath) {
    return this.setVideo(key, filePath);
  }

  delete(key) {
    this.cache.del(`meta_${key}`);
    
    const metadataPath = path.join(METADATA_CACHE_DIR, `${key}.json`);
    const videoPath = path.join(CLIPS_CACHE_DIR, `${key}.mp4`);
    
    [metadataPath, videoPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('Deleted cache file:', filePath);
        } catch (error) {
          console.error('Error deleting cache file:', error.message);
        }
      }
    });
  }

  clear() {
    this.cache.flushAll();
    
    [METADATA_CACHE_DIR, CLIPS_CACHE_DIR].forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.error('Error clearing cache file:', error.message);
          }
        });
      }
    });
    
    console.log('Cache cleared');
  }

  has(key) {
    return fs.existsSync(path.join(CLIPS_CACHE_DIR, `${key}.mp4`));
  }
}

export default new CacheService();