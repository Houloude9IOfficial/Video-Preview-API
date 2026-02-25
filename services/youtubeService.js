import ytdl from 'ytdl-core';
import youtubedl from 'youtube-dl-exec';

class YoutubeService {
  async getVideoInfo(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      try {
        const info = await Promise.race([
          ytdl.getInfo(url, {
            requestOptions: {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('YTDL timeout')), 7000)
          )
        ]);
        
        return {
          videoId,
          title: info.videoDetails.title,
          lengthSeconds: parseInt(info.videoDetails.lengthSeconds),
          formats: info.formats,
          useDirectUrl: false
        };
      } catch (ytdlError) {
        console.log('YTDL failed, using youtube-dl-exec for higher quality:', ytdlError.message);
        
        try {
          const info = await Promise.race([
            youtubedl(url, {
              dumpSingleJson: true,
              noCheckCertificates: true,
              noWarnings: true,
              format: 'best[height>=720]/best[height>=480]/best'
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('youtube-dl timeout')), 10000)
            )
          ]);
          
          if (!info || !info.url) {
            throw new Error('No valid video URL found');
          }
          
          console.log(`Using format: ${info.format_id} (${info.width}x${info.height})`);
          
          return {
            videoId,
            title: info.title || 'Unknown Title',
            lengthSeconds: parseInt(info.duration || 0),
            url: info.url,
            useDirectUrl: true,
            formats: null
          };
        } catch (youtubedlError) {
          console.error('Both ytdl and youtube-dl-exec failed:', youtubedlError.message);
          throw new Error('All video extraction methods failed');
        }
      }
    } catch (error) {
      console.error('YouTube info fetch failed:', error.message);
      throw new Error('Video not found or unavailable');
    }
  }

  async searchVideo(query) {
    try {
      const searchVariations = [
        `"${query}" official`,
        `${query} official`,
        `${query}`
      ];
      
      for (const searchQuery of searchVariations) {
        console.log(`Trying search: ${searchQuery}`);
        const encodedQuery = encodeURIComponent(searchQuery);
        const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });
        
        if (!response.ok) continue;
        
        const html = await response.text();
        const videoIdMatches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
        
        if (!videoIdMatches || videoIdMatches.length === 0) continue;
        
        for (const match of videoIdMatches.slice(0, 5)) {
          const videoId = match.match(/"([a-zA-Z0-9_-]{11})"/)[1];
          
          if (!this.validateVideoId(videoId)) continue;
          
          try {
            const videoInfo = await Promise.race([
              this.getVideoInfo(videoId),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 8000)
              )
            ]);
            
            if (this.isValidMusicVideo(videoInfo, query)) {
              console.log(`Found valid video: ${videoInfo.title} (${videoInfo.lengthSeconds}s)`);
              return videoId;
            }
          } catch (error) {
            console.log(`Skipping ${videoId}: ${error.message}`);
            continue;
          }
        }
      }
      
      throw new Error('No suitable music video found');
    } catch (error) {
      console.error('YouTube search failed:', error.message);
      throw new Error(`Search failed: ${error.message}`);
    }
  }
  
  isValidMusicVideo(videoInfo, originalQuery) {
    const title = videoInfo.title.toLowerCase();
    const duration = videoInfo.lengthSeconds;
    const queryLower = originalQuery.toLowerCase();
    
    if (duration < 30 || duration > 1200) {
      console.log(`Invalid duration: ${duration}s (must be 30s-20min)`);
      return false;
    }
    
    const rejectedKeywords = ['cover', 'remix', 'live', 'sped up', 'slowed', 'lyrics', 'fan made'];
    const hasUnwantedKeyword = rejectedKeywords.some(keyword => {
      const inTitle = title.includes(keyword);
      const inOriginal = queryLower.includes(keyword);
      
      if (inTitle && !inOriginal) {
        console.log(`Rejected video with unwanted content '${keyword}' not in original: ${videoInfo.title}`);
        return true;
      }
      return false;
    });
    
    if (hasUnwantedKeyword) {
      return false;
    }
    
    const normalizeText = (text) => {
      return text.replace(/[^\w\s]/g, ' ')
                 .replace(/\s+/g, ' ')
                 .trim()
                 .toLowerCase();
    };

    const normalizedTitle = normalizeText(title);
    const normalizedQuery = normalizeText(queryLower);
    
    const queryWords = normalizedQuery.split(' ').filter(word => word.length > 2);
    
    let matchedWords = queryWords.filter(word => normalizedTitle.includes(word));
    
    if (matchedWords.length < Math.floor(queryWords.length * 0.4)) {
      matchedWords = queryWords.filter(word => {
        const wordStart = word.substring(0, 3);
        return normalizedTitle.includes(wordStart) || 
               normalizedTitle.split(' ').some(titleWord => 
                 titleWord.startsWith(wordStart) || wordStart.startsWith(titleWord.substring(0, 3))
               );
      });
    }
    
    const matchThreshold = Math.max(1, Math.floor(queryWords.length * 0.3));
    if (matchedWords.length < matchThreshold) {
      console.log(`Title '${videoInfo.title}' doesn't match query '${originalQuery}' enough (${matchedWords.length}/${queryWords.length} words)`);
      return false;
    }
    
    const isLikelyMusic = title.includes('official') || 
                         title.includes('music') || 
                         title.includes('video') || 
                         title.includes('clip') || 
                         title.includes('mv') ||
                         title.includes('theme') ||
                         title.includes('soundtrack') ||
                         title.includes('audio');
    
    if (!isLikelyMusic) {
      console.log(`Title might not be music: ${title}`);
      return matchedWords.length >= Math.floor(queryWords.length * 0.6);
    }
    
    return true;
  }

  async getVideoUrl(videoId, quality = 'highest') {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      try {
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { quality });
        return format.url;
      } catch (ytdlError) {
        console.log('YTDL failed for URL, trying youtube-dl-exec');
        const info = await youtubedl(url, {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true
        });
        return info.url;
      }
    } catch (error) {
      console.error('Failed to get video URL:', error.message);
      throw new Error('Failed to get download URL');
    }
  }

  createVideoStream(videoId, options = {}) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    return ytdl(url, {
      quality: 'highestvideo',
      filter: format => {
        return format.container === 'mp4' && 
               format.hasVideo && 
               format.hasAudio && 
               format.qualityLabel && 
               (format.qualityLabel.includes('720p') || 
                format.qualityLabel.includes('1080p') ||
                format.qualityLabel.includes('480p'));
      },
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      },
      ...options
    });
  }
  
  async getDirectVideoUrl(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        format: 'best[height>=720][ext=mp4]/best[height>=720]/best[ext=mp4]/best'
      });
      
      console.log(`Direct URL format: ${info.format_id} (${info.width}x${info.height})`);
      return info.url;
    } catch (error) {
      console.error('Failed to get direct URL:', error.message);
      throw new Error('Failed to get direct video URL');
    }
  }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   

  validateVideoId(videoId) {
    return ytdl.validateID(videoId);
  }
}

export default new YoutubeService();