"""
Modal script to download and prepare the Lakh MIDI Dataset (LMD-full)

This script uses Modal to download the LMD-full dataset to a persistent volume,
making it available for training and preprocessing jobs.

Usage:
    modal run scripts/modal_download_lmd.py
"""

import modal
import tarfile
from pathlib import Path

# Create Modal app
app = modal.App("lmd-dataset-download")

# Create a persistent volume for the dataset
volume = modal.Volume.from_name("lmd-dataset", create_if_missing=True)

# Define the image with required dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "requests",
        "tqdm",
    )
)

# LMD-full dataset URLs
LMD_FULL_URL = "http://hog.ee.columbia.edu/craffel/lmd/lmd_full.tar.gz"
LMD_FULL_ALT_URL = "https://storage.googleapis.com/magentadata/datasets/lmd/lmd_full.tar.gz"

VOLUME_PATH = "/data"

@app.function(
    image=image,
    volumes={VOLUME_PATH: volume},
    timeout=3600 * 4,  # 4 hour timeout for large download
)
def download_lmd_full():
    """Download and extract LMD-full dataset to Modal volume"""
    import requests
    from tqdm import tqdm

    dataset_dir = Path(VOLUME_PATH) / "lmd_full"
    archive_path = Path(VOLUME_PATH) / "lmd_full.tar.gz"

    print("=" * 60)
    print("Lakh MIDI Dataset (LMD-full) Download")
    print("=" * 60)

    # Check if dataset already exists
    if dataset_dir.exists() and any(dataset_dir.iterdir()):
        midi_files = list(dataset_dir.rglob("*.mid")) + list(dataset_dir.rglob("*.midi"))
        print(f"\n✓ Dataset already exists with {len(midi_files):,} MIDI files")
        print(f"  Location: {dataset_dir}")

        if len(midi_files) > 170000:  # Expected ~176k files
            print("\n✓ Dataset appears complete. Skipping download.")
            volume.commit()
            return {
                "status": "already_exists",
                "total_files": len(midi_files),
                "location": str(dataset_dir)
            }

    # Download the dataset
    print(f"\nDownloading LMD-full dataset...")
    print(f"Target: {archive_path}")

    success = False
    for url in [LMD_FULL_URL, LMD_FULL_ALT_URL]:
        try:
            print(f"\nTrying: {url}")
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))

            archive_path.parent.mkdir(parents=True, exist_ok=True)

            with open(archive_path, 'wb') as f, tqdm(
                desc="Downloading",
                total=total_size,
                unit='iB',
                unit_scale=True,
                unit_divisor=1024,
            ) as progress_bar:
                for chunk in response.iter_content(chunk_size=8192):
                    size = f.write(chunk)
                    progress_bar.update(size)

            success = True
            print(f"\n✓ Download complete! Size: {archive_path.stat().st_size / (1024**3):.2f} GB")
            break

        except Exception as e:
            print(f"✗ Failed: {e}")
            continue

    if not success:
        raise Exception("Failed to download dataset from all sources")

    # Extract the dataset
    print(f"\nExtracting to {dataset_dir}...")
    dataset_dir.mkdir(parents=True, exist_ok=True)

    with tarfile.open(archive_path, 'r:gz') as tar:
        members = tar.getmembers()
        print(f"Found {len(members)} files in archive")

        with tqdm(total=len(members), desc="Extracting") as progress_bar:
            for member in members:
                tar.extract(member, VOLUME_PATH)
                progress_bar.update(1)

    print("\n✓ Extraction complete!")

    # Get dataset statistics
    midi_files = list(dataset_dir.rglob("*.mid")) + list(dataset_dir.rglob("*.midi"))
    total_size_mb = sum(f.stat().st_size for f in midi_files) / (1024 * 1024)

    print(f"\nDataset Statistics:")
    print(f"  Total MIDI files: {len(midi_files):,}")
    print(f"  Total size: {total_size_mb:.2f} MB")
    print(f"  Location: {dataset_dir}")

    # Clean up archive to save space
    print(f"\nRemoving archive to save space...")
    archive_path.unlink()

    # Commit changes to volume
    print("\nCommitting changes to volume...")
    volume.commit()

    print("\n" + "=" * 60)
    print("✓ Download and setup complete!")
    print("=" * 60)

    return {
        "status": "success",
        "total_files": len(midi_files),
        "total_size_mb": total_size_mb,
        "location": str(dataset_dir)
    }

@app.function(
    image=image,
    volumes={VOLUME_PATH: volume},
)
def check_dataset():
    """Check if dataset exists and get statistics"""
    dataset_dir = Path(VOLUME_PATH) / "lmd_full"

    if not dataset_dir.exists():
        return {
            "exists": False,
            "message": "Dataset not found. Run download_lmd_full() first."
        }

    midi_files = list(dataset_dir.rglob("*.mid")) + list(dataset_dir.rglob("*.midi"))

    if not midi_files:
        return {
            "exists": False,
            "message": "Dataset directory exists but is empty."
        }

    total_size_mb = sum(f.stat().st_size for f in midi_files) / (1024 * 1024)

    # Sample some file paths to show structure
    sample_files = [str(f.relative_to(dataset_dir)) for f in midi_files[:5]]

    return {
        "exists": True,
        "total_files": len(midi_files),
        "total_size_mb": total_size_mb,
        "location": str(dataset_dir),
        "sample_files": sample_files
    }

@app.function(
    image=image,
    volumes={VOLUME_PATH: volume},
)
def list_midi_files(limit: int = 100):
    """List MIDI files in the dataset"""
    dataset_dir = Path(VOLUME_PATH) / "lmd_full"

    if not dataset_dir.exists():
        return {"error": "Dataset not found"}

    midi_files = list(dataset_dir.rglob("*.mid")) + list(dataset_dir.rglob("*.midi"))
    midi_files = midi_files[:limit]

    return {
        "total_found": len(midi_files),
        "files": [str(f.relative_to(dataset_dir)) for f in midi_files]
    }

@app.local_entrypoint()
def main(check_only: bool = False):
    """
    Main entry point for the script

    Args:
        check_only: If True, only check if dataset exists without downloading
    """
    if check_only:
        print("Checking dataset status...")
        result = check_dataset.remote()

        if result["exists"]:
            print(f"\n✓ Dataset exists!")
            print(f"  Total files: {result['total_files']:,}")
            print(f"  Total size: {result['total_size_mb']:.2f} MB")
            print(f"  Location: {result['location']}")
            print(f"\n  Sample files:")
            for f in result.get('sample_files', []):
                print(f"    - {f}")
        else:
            print(f"\n✗ {result['message']}")
    else:
        print("Starting LMD-full dataset download...")
        result = download_lmd_full.remote()

        if result["status"] == "success":
            print(f"\n✓ Success!")
            print(f"  Downloaded {result['total_files']:,} MIDI files")
            print(f"  Total size: {result['total_size_mb']:.2f} MB")
        elif result["status"] == "already_exists":
            print(f"\n✓ Dataset already exists with {result['total_files']:,} files")

        print(f"\nDataset is now available in Modal volume 'lmd-dataset'")
        print(f"Use this volume in your training scripts!")

if __name__ == "__main__":
    # For local testing without Modal
    print("To run this script, use: modal run scripts/modal_download_lmd.py")
    print("To check dataset status: modal run scripts/modal_download_lmd.py --check-only")
