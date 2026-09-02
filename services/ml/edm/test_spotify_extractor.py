#!/usr/bin/env python3
"""
Test script for Spotify Feature Extractor

This demonstrates how to use the spotify_extractor module.

Before running:
1. Install dependencies: pip install -r requirements.txt
2. Set up your Spotify credentials in .env file or as environment variables
   (Get credentials from: https://developer.spotify.com/dashboard)

Example .env file:
    SPOTIFY_CLIENT_ID=your_client_id
    SPOTIFY_CLIENT_SECRET=your_client_secret
"""

from spotify_extractor import SpotifyFeatureExtractor


def test_single_track():
    """Test extracting features from a single track."""
    print("Testing Spotify Feature Extractor")
    print("=" * 70)

    try:
        # Initialize the extractor
        extractor = SpotifyFeatureExtractor()
        print("Successfully authenticated with Spotify API\n")

        # Test different input formats
        test_inputs = [
            "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",  # URI format
            "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp",  # URL format
            "3n3Ppam7vgaVa1iaRUc9Lp",  # Direct ID
        ]

        print("Testing different input formats:")
        print("-" * 70)

        for i, track_input in enumerate(test_inputs, 1):
            print(f"\nTest {i}: {track_input}")
            try:
                features = extractor.extract_features(track_input)
                print(f"  Success! Track: {features['track_name']} by {features['artist_name']}")
                print(f"  Energy: {features['energy']:.3f}, Danceability: {features['danceability']:.3f}")
            except Exception as e:
                print(f"  Error: {e}")

    except ValueError as e:
        print(f"\nAuthentication Error: {e}")
        print("\nMake sure you have set up your Spotify credentials:")
        print("1. Go to https://developer.spotify.com/dashboard")
        print("2. Create an app and get your Client ID and Client Secret")
        print("3. Add them to your .env file or set as environment variables")
        return False
    except Exception as e:
        print(f"\nError: {e}")
        return False

    return True


def test_batch_extraction():
    """Test extracting features from multiple tracks."""
    print("\n\n" + "=" * 70)
    print("Testing Batch Feature Extraction")
    print("=" * 70)

    try:
        extractor = SpotifyFeatureExtractor()

        # Multiple tracks to test
        tracks = [
            "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",  # Mr. Brightside - The Killers
            "spotify:track:60nZcImufyMA1MKQY3dcCH",  # Bohemian Rhapsody - Queen
            "spotify:track:invalid_track_id",  # This should fail
        ]

        results = extractor.extract_features_batch(tracks)

        print(f"\nProcessed {len(results)} tracks:")
        print("-" * 70)

        for track_input, result in results.items():
            print(f"\nInput: {track_input}")
            if result['success']:
                data = result['data']
                print(f"  Success: {data['track_name']} by {data['artist_name']}")
                print(f"  Tempo: {data['tempo']:.1f} BPM, Key: {extractor.get_key_name(data['key'], data['mode'])}")
            else:
                print(f"  Failed: {result['error']}")

    except Exception as e:
        print(f"\nError: {e}")
        return False

    return True


def test_key_conversion():
    """Test the key name conversion utility."""
    print("\n\n" + "=" * 70)
    print("Testing Key Conversion Utility")
    print("=" * 70)

    extractor = SpotifyFeatureExtractor()

    print("\nMajor keys:")
    for i in range(12):
        print(f"  Key {i}: {extractor.get_key_name(i, 1)}")

    print("\nMinor keys:")
    for i in range(12):
        print(f"  Key {i}: {extractor.get_key_name(i, 0)}")


def main():
    """Run all tests."""
    print("Spotify Feature Extractor - Test Suite")
    print("=" * 70)
    print()

    # Run tests
    test_single_track()
    test_batch_extraction()
    test_key_conversion()

    print("\n" + "=" * 70)
    print("Testing complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
