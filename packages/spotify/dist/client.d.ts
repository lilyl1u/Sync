/**
 * Spotify API client
 */
import type { SpotifyTrack, SpotifyAudioFeatures } from './types';
export declare class SpotifyClient {
    private api;
    private accessToken;
    constructor(accessToken: string);
    /**
     * Update the access token
     */
    setAccessToken(token: string): void;
    /**
     * Search for tracks
     */
    searchTracks(query: string, limit?: number, offset?: number): Promise<SpotifyTrack[]>;
    /**
     * Get a track by ID
     */
    getTrack(trackId: string): Promise<SpotifyTrack>;
    /**
     * Get audio features for a track
     */
    getAudioFeatures(trackId: string): Promise<SpotifyAudioFeatures>;
    /**
     * Get multiple tracks by IDs
     */
    getTracks(trackIds: string[]): Promise<SpotifyTrack[]>;
    /**
     * Get audio features for multiple tracks
     */
    getMultipleAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]>;
}
//# sourceMappingURL=client.d.ts.map