import cacheService from '../services/cacheService.js';
import { generateCacheKey, validateOptions } from '../utils/helpers.js';

export const cacheMiddleware = (req, res, next) => {
  const { input } = req.params;
  const options = validateOptions(req.query);
  const cacheKey = generateCacheKey(input, options);
  
  if (cacheService.has(cacheKey)) {
    const cachedFile = cacheService.get(cacheKey);
    if (cachedFile) {
      console.log('Serving cached file:', cachedFile);
      return res.sendFile(cachedFile);
    }
  }
  
  req.cacheKey = cacheKey;
  req.videoOptions = options;
  next();
};