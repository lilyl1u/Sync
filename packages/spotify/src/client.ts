/**
 * Spotify API client
 */

import axios, { AxiosInstance } from 'axios';
import type {
  SpotifyTrack,
  SpotifySearchResult,
  SpotifyAudioFeatures,
} from './types';

export class SpotifyClient {
  private api: AxiosInstance;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.api = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Update the access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.api.defaults.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Search for tracks
   */
  async searchTracks(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<SpotifyTrack[]> {
    const response = await this.api.get<SpotifySearchResult>('/search', {
      params: {
        q: query,
        type: 'track',
        limit,
        offset,
      },
    });

    return response.data.tracks.items;
  }

  /**
   * Get a track by ID
   */
  async getTrack(trackId: string): Promise<SpotifyTrack> {
    const response = await this.api.get<SpotifyTrack>(`/tracks/${trackId}`);
    return response.data;
  }

  /**
   * Get audio features for a track
   */
  async getAudioFeatures(trackId: string): Promise<SpotifyAudioFeatures> {
    const response = await this.api.get<SpotifyAudioFeatures>(
      `/audio-features/${trackId}`
    );
    return response.data;
  }

  /**
   * Get multiple tracks by IDs
   */
  async getTracks(trackIds: string[]): Promise<SpotifyTrack[]> {
    const response = await this.api.get<{ tracks: SpotifyTrack[] }>('/tracks', {
      params: {
        ids: trackIds.join(','),
      },
    });
    return response.data.tracks;
  }

  /**
   * Get audio features for multiple tracks
   */
  async getMultipleAudioFeatures(
    trackIds: string[]
  ): Promise<SpotifyAudioFeatures[]> {
    const response = await this.api.get<{
      audio_features: SpotifyAudioFeatures[];
    }>('/audio-features', {
      params: {
        ids: trackIds.join(','),
      },
    });
    return response.data.audio_features;
  }
}
