import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import youtubeService from './youtubeService.js';
import { TEMP_DIR, QUALITY_PRESETS, DEFAULT_OPTIONS } from '../utils/constants.js';
import { ensureDirectoryExists, deleteFile, getVideoMiddleTime } from '../utils/helpers.js';

class VideoProcessor {
  constructor() {
    console.log('VideoProcessor - TEMP_DIR:', TEMP_DIR);
    ensureDirectoryExists(TEMP_DIR);
  }

  async processVideo(videoId, outputPath, options = DEFAULT_OPTIONS) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Processing video:', videoId, 'with options:', options);
        console.log('Output path:', outputPath);
        console.log('Temp dir:', TEMP_DIR);
        
        const videoInfo = await youtubeService.getVideoInfo(videoId);
        
        if (!videoInfo) {
          throw new Error('Failed to get video information');
        }
        
        console.log('Video info received:', {
          title: videoInfo.title,
          duration: videoInfo.lengthSeconds,
          hasUrl: !!videoInfo.url,
          hasFormats: !!videoInfo.formats,
          useDirectUrl: !!videoInfo.useDirectUrl
        });
        
        const startTime = getVideoMiddleTime(videoInfo.lengthSeconds, options.duration);
        const qualityPreset = QUALITY_PRESETS[options.quality] || QUALITY_PRESETS.medium;
        
        const tempPath = path.join(TEMP_DIR, `temp_${videoId}_${Date.now()}.mp4`);
        console.log('Temp file path:', tempPath);
        
        let ffmpegProcess;
        
        if (videoInfo.useDirectUrl && videoInfo.url) {
          console.log('Using direct URL method for:', videoInfo.url);
          ffmpegProcess = ffmpeg()
            .input(videoInfo.url)
            .inputOptions([
              '-analyzeduration', '10M',
              '-probesize', '25M',
              '-user_agent', 'Mozilla/5.0 (compatible; bot)',
              '-fflags', '+fastseek'
            ])
            .seekInput(startTime)
            .duration(options.duration)
            .videoCodec('libx264')
            .size(`${options.width}x${options.height}`)
            .format('mp4');
            
          if (options.audio) {
            ffmpegProcess.audioCodec('aac')
                        .audioBitrate(qualityPreset.audioBitrate)
                        .audioChannels(2)
                        .audioFrequency(48000);
          } else {
            ffmpegProcess.noAudio();
          }
          
          const videoFiltersArray = [`scale=${options.width}:${options.height}:flags=lanczos`];
          
          ffmpegProcess.videoFilter(videoFiltersArray)
                      .outputOptions([
            '-movflags', 'faststart',
            '-preset', options.quality === 'max' ? 'medium' : 'fast',
            '-crf', qualityPreset.crf,
            '-profile:v', qualityPreset.profile,
            '-level:v', qualityPreset.level,
            '-maxrate', qualityPreset.maxBitrate,
            '-bufsize', qualityPreset.bufsize,
            '-pix_fmt', 'yuv420p',
            '-g', '25',
            '-avoid_negative_ts', 'make_zero'
          ]);
          
        } else if (videoInfo.formats) {
          console.log('Using ytdl stream method');
          try {
            const videoStream = youtubeService.createVideoStream(videoId);
            if (!videoStream) {
              throw new Error('Failed to create video stream');
            }
            ffmpegProcess = ffmpeg()
              .input(videoStream)
              .inputOptions([
                '-re',
                '-analyzeduration', '10M',
                '-probesize', '25M',
                '-fflags', '+fastseek'
              ])
              .seekInput(startTime)
              .duration(options.duration)
              .videoCodec('libx264')
              .size(`${options.width}x${options.height}`)
              .format('mp4');
              
            if (options.audio) {
              ffmpegProcess.audioCodec('aac')
                          .audioBitrate(qualityPreset.audioBitrate)
                          .audioChannels(2)
                          .audioFrequency(48000);
            } else {
              ffmpegProcess.noAudio();
            }
            
            const videoFiltersArray = [`scale=${options.width}:${options.height}:flags=lanczos`];
            
            ffmpegProcess.videoFilter(videoFiltersArray)
                        .outputOptions([
              '-movflags', 'faststart', 
              '-preset', options.quality === 'max' ? 'medium' : 'fast',
              '-crf', qualityPreset.crf,
              '-profile:v', qualityPreset.profile,
              '-level:v', qualityPreset.level,
              '-maxrate', qualityPreset.maxBitrate,
              '-bufsize', qualityPreset.bufsize,
              '-pix_fmt', 'yuv420p',
              '-g', '25',
              '-avoid_negative_ts', 'make_zero'
            ]);
            
          } catch (streamError) {
            console.log('Stream creation failed, trying direct URL fallback:', streamError.message);
            const directUrl = await youtubeService.getDirectVideoUrl(videoId);
            if (!directUrl) {
              throw new Error('Failed to get any video URL');
            }
            ffmpegProcess = ffmpeg()
              .input(directUrl)
              .inputOptions([
                '-analyzeduration', '10M',
                '-probesize', '25M',
                '-user_agent', 'Mozilla/5.0 (compatible; bot)',
                '-fflags', '+fastseek'
              ])
              .seekInput(startTime)
              .duration(options.duration)
              .videoCodec('libx264')
              .size(`${options.width}x${options.height}`)
              .format('mp4');
              
            if (options.audio) {
              ffmpegProcess.audioCodec('aac')
                          .audioBitrate(qualityPreset.audioBitrate)
                          .audioChannels(2)
                          .audioFrequency(48000);
            } else {
              ffmpegProcess.noAudio();
            }
            
            const videoFiltersArray = [`scale=${options.width}:${options.height}:flags=lanczos`];
            
            ffmpegProcess.videoFilter(videoFiltersArray)
                        .outputOptions([
              '-movflags', 'faststart',
              '-preset', options.quality === 'max' ? 'medium' : 'fast',
              '-crf', qualityPreset.crf,
              '-profile:v', qualityPreset.profile,
              '-level:v', qualityPreset.level,
              '-maxrate', qualityPreset.maxBitrate,
              '-bufsize', qualityPreset.bufsize,
              '-pix_fmt', 'yuv420p',
              '-g', '25',
              '-avoid_negative_ts', 'make_zero'
            ]);
          }
        } else {
          throw new Error('No valid video source available (no URL and no formats)');
        }
        
        ffmpegProcess
          .on('start', (commandLine) => {
            console.log('FFmpeg started:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('end', () => {
            console.log('FFmpeg processing completed');
            if (fs.existsSync(tempPath)) {
              try {
                fs.renameSync(tempPath, outputPath);
                console.log('File moved to output path:', outputPath);
                resolve(outputPath);
              } catch (moveError) {
                console.error('Error moving file:', moveError);
                reject(new Error('Failed to move output file'));
              }
            } else {
              console.error('Temp file does not exist:', tempPath);
              reject(new Error('Output file not created'));
            }
          })
          .on('error', (error) => {
            console.error('FFmpeg error:', error.message);
            deleteFile(tempPath);
            reject(new Error(`Video processing failed: ${error.message}`));
          })
          .save(tempPath);
          
        setTimeout(() => {
          if (ffmpegProcess) {
            console.log('Processing timeout, killing FFmpeg');
            ffmpegProcess.kill('SIGTERM');
            deleteFile(tempPath);
            reject(new Error('Video processing timeout'));
          }
        }, 120000);
          
      } catch (error) {
        console.error('Video processing error:', error.message);
        reject(new Error(`Failed to process video: ${error.message}`));
      }
    });
  }

  async downloadVideoSegment(videoId, options = DEFAULT_OPTIONS) {
    const outputPath = path.join(TEMP_DIR, `preview_${videoId}_${Date.now()}.mp4`);
    console.log('Download output path:', outputPath);
    try {
      return await this.processVideo(videoId, outputPath, options);
    } catch (error) {
      deleteFile(outputPath);
      throw error;
    }
  }

  cleanup(filePath) {
    console.log('Cleaning up file:', filePath);
    deleteFile(filePath);
  }
}

export default new VideoProcessor();