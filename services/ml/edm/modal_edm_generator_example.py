"""
Example usage of the Modal EDM Generator Service

This script demonstrates various ways to use the EDM generator:
1. Generate tracks with preset Spotify-like feature profiles
2. Call the deployed Modal service
3. Show feature mapping examples
"""

import json


# Preset feature profiles representing different EDM styles
EDM_PRESETS = {
    "high_energy_drop": {
        "name": "High Energy Drop",
        "description": "Aggressive drop with heavy kicks and fast hi-hats",
        "features": {
            "energy": 0.95,
            "danceability": 0.85,
            "valence": 0.7,
            "tempo": 135.0,
            "loudness": -3.0,
            "acousticness": 0.05,
            "instrumentalness": 0.95,
            "speechiness": 0.03,
            "key": 0,  # C
            "mode": 1,  # Major
        }
    },
    "melodic_progressive": {
        "name": "Melodic Progressive House",
        "description": "Uplifting melodies with moderate energy",
        "features": {
            "energy": 0.7,
            "danceability": 0.75,
            "valence": 0.8,
            "tempo": 128.0,
            "loudness": -5.0,
            "acousticness": 0.15,
            "instrumentalness": 0.85,
            "speechiness": 0.05,
            "key": 2,  # D
            "mode": 1,  # Major
        }
    },
    "dark_techno": {
        "name": "Dark Techno",
        "description": "Dark, driving techno with minimal melody",
        "features": {
            "energy": 0.85,
            "danceability": 0.9,
            "valence": 0.2,
            "tempo": 130.0,
            "loudness": -4.0,
            "acousticness": 0.0,
            "instrumentalness": 0.98,
            "speechiness": 0.0,
            "key": 9,  # A
            "mode": 0,  # Minor
        }
    },
    "chill_house": {
        "name": "Chill House",
        "description": "Laid-back house with warm vibes",
        "features": {
            "energy": 0.5,
            "danceability": 0.65,
            "valence": 0.6,
            "tempo": 120.0,
            "loudness": -7.0,
            "acousticness": 0.3,
            "instrumentalness": 0.7,
            "speechiness": 0.08,
            "key": 7,  # G
            "mode": 1,  # Major
        }
    },
    "breakbeat_dnb": {
        "name": "Breakbeat / DnB Style",
        "description": "Fast tempo with complex drum patterns",
        "features": {
            "energy": 0.9,
            "danceability": 0.7,
            "valence": 0.5,
            "tempo": 140.0,
            "loudness": -4.5,
            "acousticness": 0.05,
            "instrumentalness": 0.9,
            "speechiness": 0.02,
            "key": 5,  # F
            "mode": 0,  # Minor
        }
    },
}


def print_feature_mapping_guide():
    """Print guide for how Spotify features map to EDM parameters"""
    print("\n" + "=" * 80)
    print("SPOTIFY FEATURE → EDM PARAMETER MAPPING GUIDE")
    print("=" * 80)

    mappings = [
        ("Energy (0.0-1.0)", [
            "High (0.7-1.0) → Aggressive drums, fast hi-hats, 90-127 kick velocity",
            "Medium (0.4-0.7) → Balanced drum patterns",
            "Low (0.0-0.4) → Lighter drums, slower hi-hats",
        ]),
        ("Danceability (0.0-1.0)", [
            "High (0.7-1.0) → 4/4 kick patterns, syncopated elements, dense hi-hats",
            "Medium (0.4-0.7) → Standard dance patterns",
            "Low (0.0-0.4) → Simpler, less danceable rhythms",
        ]),
        ("Valence (0.0-1.0)", [
            "High (0.7-1.0) → Major keys, uplifting melodies, bright tones",
            "Medium (0.4-0.7) → Balanced emotional tone",
            "Low (0.0-0.4) → Minor keys, darker tones, melancholic",
        ]),
        ("Tempo (BPM)", [
            "→ Mapped to 120-140 BPM for EDM",
            "Low (<100) → Default to 128 BPM",
            "High (>150) → Capped at 135 BPM",
        ]),
        ("Loudness (dB)", [
            "Typically -60 to 0 dB",
            "→ Maps to bass intensity (0.6-1.0)",
            "Louder → More intense bass",
        ]),
        ("Acousticness (0.0-1.0)", [
            "→ Maps to reverb amount (0.2-0.7)",
            "Higher → More reverb/space",
        ]),
        ("Instrumentalness (0.0-1.0)", [
            "→ Maps to melody complexity (0.3-1.0)",
            "Higher → More complex melodic patterns",
        ]),
        ("Key (0-11)", [
            "0=C, 1=C#, 2=D, ... 11=B",
            "→ Sets root note for melody",
        ]),
        ("Mode (0 or 1)", [
            "0 → Minor mode",
            "1 → Major mode",
            "Combined with valence to determine scale",
        ]),
    ]

    for feature, mappings_list in mappings:
        print(f"\n{feature}:")
        for mapping in mappings_list:
            print(f"  • {mapping}")

    print("\n" + "=" * 80)


def print_preset_info():
    """Print information about available presets"""
    print("\n" + "=" * 80)
    print("AVAILABLE EDM PRESETS")
    print("=" * 80)

    for preset_id, preset in EDM_PRESETS.items():
        print(f"\n{preset['name']} ({preset_id})")
        print(f"  Description: {preset['description']}")
        print(f"  Features:")
        features = preset['features']
        print(f"    Energy: {features['energy']:.2f}")
        print(f"    Danceability: {features['danceability']:.2f}")
        print(f"    Valence: {features['valence']:.2f}")
        print(f"    Tempo: {features['tempo']:.0f} BPM")
        print(f"    Key: {features['key']} ({'Major' if features['mode'] == 1 else 'Minor'})")

    print("\n" + "=" * 80)


def generate_with_modal_cli(preset_id: str, output_file: str):
    """
    Generate track using Modal CLI

    Args:
        preset_id: ID of the preset to use
        output_file: Output filename
    """
    import subprocess

    if preset_id not in EDM_PRESETS:
        print(f"Error: Unknown preset '{preset_id}'")
        print(f"Available presets: {', '.join(EDM_PRESETS.keys())}")
        return

    preset = EDM_PRESETS[preset_id]
    features = preset['features']

    print(f"\nGenerating track: {preset['name']}")
    print(f"Description: {preset['description']}")
    print(f"Output: {output_file}\n")

    # Build modal command
    cmd = [
        "modal", "run", "modal_edm_generator.py",
        "--energy", str(features['energy']),
        "--danceability", str(features['danceability']),
        "--valence", str(features['valence']),
        "--tempo", str(features['tempo']),
        "--loudness", str(features['loudness']),
        "--acousticness", str(features['acousticness']),
        "--instrumentalness", str(features['instrumentalness']),
        "--speechiness", str(features['speechiness']),
        "--key", str(features['key']),
        "--mode", str(features['mode']),
        "--output", output_file,
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"\n✓ Track generated successfully: {output_file}")
    except subprocess.CalledProcessError as e:
        print(f"\n✗ Error generating track: {e}")
    except FileNotFoundError:
        print("\n✗ Modal CLI not found. Please install: pip install modal")


def generate_with_python_api(preset_id: str, output_file: str):
    """
    Generate track using Modal Python API

    Args:
        preset_id: ID of the preset to use
        output_file: Output filename
    """
    try:
        import modal
    except ImportError:
        print("Error: modal package not installed. Install with: pip install modal")
        return

    if preset_id not in EDM_PRESETS:
        print(f"Error: Unknown preset '{preset_id}'")
        return

    preset = EDM_PRESETS[preset_id]
    features = preset['features']

    print(f"\nGenerating track: {preset['name']}")
    print(f"Description: {preset['description']}")

    # Import the Modal function
    # Note: This assumes modal_edm_generator.py is in the same directory
    try:
        from modal_edm_generator import app, generate_edm_track

        # Call the remote function
        with app.run():
            audio_bytes = generate_edm_track.remote(features)

            # Save to file
            with open(output_file, 'wb') as f:
                f.write(audio_bytes)

            print(f"\n✓ Track generated successfully: {output_file}")
            print(f"  File size: {len(audio_bytes) / 1024 / 1024:.2f} MB")

    except Exception as e:
        print(f"\n✗ Error: {e}")


def call_deployed_api(url: str, preset_id: str, output_file: str):
    """
    Call deployed Modal API endpoint

    Args:
        url: API endpoint URL
        preset_id: ID of the preset to use
        output_file: Output filename
    """
    try:
        import requests
    except ImportError:
        print("Error: requests package not installed. Install with: pip install requests")
        return

    if preset_id not in EDM_PRESETS:
        print(f"Error: Unknown preset '{preset_id}'")
        return

    preset = EDM_PRESETS[preset_id]
    features = preset['features']

    print(f"\nCalling API: {url}")
    print(f"Generating track: {preset['name']}")

    try:
        response = requests.post(
            f"{url}/generate",
            json=features,
            timeout=120
        )
        response.raise_for_status()

        # Save audio
        with open(output_file, 'wb') as f:
            f.write(response.content)

        print(f"\n✓ Track generated successfully: {output_file}")
        print(f"  File size: {len(response.content) / 1024 / 1024:.2f} MB")

    except Exception as e:
        print(f"\n✗ Error: {e}")


def create_custom_features():
    """Interactive function to create custom Spotify features"""
    print("\n" + "=" * 80)
    print("CREATE CUSTOM FEATURES")
    print("=" * 80)

    def get_float_input(prompt: str, min_val: float, max_val: float, default: float) -> float:
        while True:
            try:
                value = input(f"{prompt} [{min_val}-{max_val}] (default: {default}): ").strip()
                if not value:
                    return default
                value = float(value)
                if min_val <= value <= max_val:
                    return value
                print(f"Please enter a value between {min_val} and {max_val}")
            except ValueError:
                print("Please enter a valid number")

    def get_int_input(prompt: str, min_val: int, max_val: int, default: int) -> int:
        while True:
            try:
                value = input(f"{prompt} [{min_val}-{max_val}] (default: {default}): ").strip()
                if not value:
                    return default
                value = int(value)
                if min_val <= value <= max_val:
                    return value
                print(f"Please enter a value between {min_val} and {max_val}")
            except ValueError:
                print("Please enter a valid integer")

    features = {
        "energy": get_float_input("Energy", 0.0, 1.0, 0.7),
        "danceability": get_float_input("Danceability", 0.0, 1.0, 0.7),
        "valence": get_float_input("Valence", 0.0, 1.0, 0.5),
        "tempo": get_float_input("Tempo (BPM)", 60.0, 200.0, 128.0),
        "loudness": get_float_input("Loudness (dB)", -60.0, 0.0, -5.0),
        "acousticness": get_float_input("Acousticness", 0.0, 1.0, 0.1),
        "instrumentalness": get_float_input("Instrumentalness", 0.0, 1.0, 0.8),
        "speechiness": get_float_input("Speechiness", 0.0, 1.0, 0.05),
        "key": get_int_input("Key (0=C, 1=C#, ..., 11=B)", 0, 11, 0),
        "mode": get_int_input("Mode (0=Minor, 1=Major)", 0, 1, 1),
    }

    print("\n" + "-" * 80)
    print("Custom Features JSON:")
    print("-" * 80)
    print(json.dumps(features, indent=2))
    print("-" * 80)

    return features


if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="EDM Generator Example Usage")
    parser.add_argument(
        "command",
        choices=["info", "presets", "mapping", "generate-cli", "generate-api", "custom"],
        help="Command to run"
    )
    parser.add_argument("--preset", type=str, help="Preset ID to use")
    parser.add_argument("--output", type=str, default="output.wav", help="Output filename")
    parser.add_argument("--api-url", type=str, help="Deployed API URL")

    args = parser.parse_args()

    if args.command == "info":
        print("\n" + "=" * 80)
        print("EDM GENERATOR - EXAMPLE USAGE")
        print("=" * 80)
        print("\nThis service generates EDM tracks from Spotify audio features.")
        print("\nUsage examples:")
        print("  1. Show presets:       python modal_edm_generator_example.py presets")
        print("  2. Show mapping guide: python modal_edm_generator_example.py mapping")
        print("  3. Generate with CLI:  python modal_edm_generator_example.py generate-cli --preset high_energy_drop")
        print("  4. Generate with API:  python modal_edm_generator_example.py generate-api --preset melodic_progressive")
        print("  5. Create custom:      python modal_edm_generator_example.py custom")
        print("\n" + "=" * 80)

    elif args.command == "presets":
        print_preset_info()

    elif args.command == "mapping":
        print_feature_mapping_guide()

    elif args.command == "generate-cli":
        if not args.preset:
            print("Error: --preset required")
            print(f"Available presets: {', '.join(EDM_PRESETS.keys())}")
            sys.exit(1)
        generate_with_modal_cli(args.preset, args.output)

    elif args.command == "generate-api":
        if not args.preset:
            print("Error: --preset required")
            sys.exit(1)
        if args.api_url:
            call_deployed_api(args.api_url, args.preset, args.output)
        else:
            generate_with_python_api(args.preset, args.output)

    elif args.command == "custom":
        features = create_custom_features()
        save = input("\nGenerate track with these features? [y/N]: ").strip().lower()
        if save == 'y':
            # Save features to file for use with modal run
            with open("custom_features.json", "w") as f:
                json.dump(features, f, indent=2)
            print("\n✓ Features saved to custom_features.json")
            print("\nTo generate, run:")
            print(f"  modal run modal_edm_generator.py \\")
            for key, value in features.items():
                print(f"    --{key} {value} \\")
            print(f"    --output {args.output}")
