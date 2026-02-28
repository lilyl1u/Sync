"use strict";
/**
 * Spotify authentication utilities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyAuth = void 0;
const axios_1 = __importDefault(require("axios"));
class SpotifyAuth {
    constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
    }
    /**
     * Get client credentials access token
     */
    async getClientCredentialsToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'client_credentials',
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
        });
        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
        return this.accessToken;
    }
    /**
     * Generate authorization URL for user authentication
     */
    getAuthorizationUrl(scopes) {
        if (!this.redirectUri) {
            throw new Error('Redirect URI is required for user authentication');
        }
        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            scope: scopes.join(' '),
        });
        return `https://accounts.spotify.com/authorize?${params.toString()}`;
    }
    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code) {
        if (!this.redirectUri) {
            throw new Error('Redirect URI is required for token exchange');
        }
        const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.redirectUri,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
        });
        return response.data;
    }
    /**
     * Refresh an access token using a refresh token
     */
    async refreshToken(refreshToken) {
        const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
        });
        return response.data;
    }
}
exports.SpotifyAuth = SpotifyAuth;
