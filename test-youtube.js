import youtubeService from './services/youtubeService.js';

async function testYoutube() {
  console.log('Testing YouTube service...');
  
  try {
    console.log('Testing with known video ID: FvLDcOIYo5o');
    const info = await youtubeService.getVideoInfo('FvLDcOIYo5o');
    console.log('Success:', {
      title: info.title,
      duration: info.lengthSeconds,
      videoId: info.videoId
    });
  } catch (error) {
    console.error('YouTube test failed:', error.message);
  }
  
  try {
    console.log('\nTesting search for: "Kai Petao Psila"');
    const videoId = await youtubeService.searchVideo('Kai Petao Psila');
    console.log('Found video ID:', videoId);
    
    const info = await youtubeService.getVideoInfo(videoId);
    console.log('Video info:', {
      title: info.title,
      duration: info.lengthSeconds
    });
  } catch (error) {
    console.error('Search test failed:', error.message);
  }
}

testYoutube();