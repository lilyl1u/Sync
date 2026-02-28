"use strict";
/**
 * Spotify API client
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyClient = void 0;
const axios_1 = __importDefault(require("axios"));
class SpotifyClient {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.api = axios_1.default.create({
            baseURL: 'https://api.spotify.com/v1',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }
    /**
     * Update the access token
     */
    setAccessToken(token) {
        this.accessToken = token;
        this.api.defaults.headers.Authorization = `Bearer ${token}`;
    }
    /**
     * Search for tracks
     */
    async searchTracks(query, limit = 20, offset = 0) {
        const response = await this.api.get('/search', {
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
    async getTrack(trackId) {
        const response = await this.api.get(`/tracks/${trackId}`);
        return response.data;
    }
    /**
     * Get audio features for a track
     */
    async getAudioFeatures(trackId) {
        const response = await this.api.get(`/audio-features/${trackId}`);
        return response.data;
    }
    /**
     * Get multiple tracks by IDs
     */
    async getTracks(trackIds) {
        const response = await this.api.get('/tracks', {
            params: {
                ids: trackIds.join(','),
            },
        });
        return response.data.tracks;
    }
    /**
     * Get audio features for multiple tracks
     */
    async getMultipleAudioFeatures(trackIds) {
        const response = await this.api.get('/audio-features', {
            params: {
                ids: trackIds.join(','),
            },
        });
        return response.data.audio_features;
    }
}
exports.SpotifyClient = SpotifyClient;
