import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

class SpotifyService {
  constructor() {
    this.spotify = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    });
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async authenticate() {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.warn('Spotify credentials not configured');
      return false;
    }
    
    try {
      const data = await this.spotify.clientCredentialsGrant();
      this.accessToken = data.body['access_token'];
      this.tokenExpiry = Date.now() + data.body['expires_in'] * 1000;
      this.spotify.setAccessToken(this.accessToken);
      return true;
    } catch (error) {
      console.error('Spotify auth failed:', error);
      return false;
    }
  }

  async ensureValidToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Failed to authenticate with Spotify');
      }
    }
  }

  async getTrack(trackId) {
    try {
      await this.ensureValidToken();
      
      if (!this.accessToken) {
        throw new Error('Spotify authentication failed');
      }
      
      const track = await this.spotify.getTrack(trackId);
      return track.body;
    } catch (error) {
      console.error('Failed to get Spotify track details:', error);
      throw new Error('Track not found or Spotify unavailable');
    }
  }

  async getTrackInfo(trackId) {
    try {
      const track = await this.getTrack(trackId);
      const { name, artists } = track;
      const artistNames = artists.map(artist => artist.name).join(' ');
      return `${artistNames} ${name}`;
    } catch (error) {
      console.error('Failed to get Spotify track:', error);
      throw new Error('Track not found or Spotify unavailable');
    }
  }

  async getYoutubeSearchQuery(spotifyId) {
    return await this.getTrackInfo(spotifyId);
  }
}

export default new SpotifyService();