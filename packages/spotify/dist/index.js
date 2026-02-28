"use strict";
/**
 * Spotify API integration for Geometry Dash
 * @module @geometrydash/spotify
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyAuth = exports.SpotifyClient = void 0;
var client_1 = require("./client");
Object.defineProperty(exports, "SpotifyClient", { enumerable: true, get: function () { return client_1.SpotifyClient; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "SpotifyAuth", { enumerable: true, get: function () { return auth_1.SpotifyAuth; } });
