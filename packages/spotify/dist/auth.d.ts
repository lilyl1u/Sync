/**
 * Spotify authentication utilities
 */
import type { SpotifyAuthConfig, SpotifyTokenResponse } from './types';
export declare class SpotifyAuth {
    private clientId;
    private clientSecret;
    private redirectUri?;
    private accessToken?;
    private tokenExpiry?;
    constructor(config: SpotifyAuthConfig);
    /**
     * Get client credentials access token
     */
    getClientCredentialsToken(): Promise<string>;
    /**
     * Generate authorization URL for user authentication
     */
    getAuthorizationUrl(scopes: string[]): string;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForToken(code: string): Promise<SpotifyTokenResponse>;
    /**
     * Refresh an access token using a refresh token
     */
    refreshToken(refreshToken: string): Promise<SpotifyTokenResponse>;
}
//# sourceMappingURL=auth.d.ts.map