"""
Script to download pretrained models from Hugging Face Hub or other sources
"""

import os
import logging
from pathlib import Path
from huggingface_hub import snapshot_download

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model configurations
MODELS_TO_DOWNLOAD = [
    {
        "name": "genre_classifier",
        "repo_id": "MIT/ast-finetuned-audioset-10-10-0.4593",
        "description": "Audio Spectrogram Transformer for genre classification"
    },
    # Add more models as needed
]

def download_models(output_dir: str = "./pretrained"):
    """
    Download pretrained models to the specified directory

    Args:
        output_dir: Directory to save downloaded models
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    for model_config in MODELS_TO_DOWNLOAD:
        model_name = model_config["name"]
        repo_id = model_config["repo_id"]

        logger.info(f"Downloading {model_name} from {repo_id}...")

        try:
            model_path = output_path / model_name

            # Download model from Hugging Face Hub
            snapshot_download(
                repo_id=repo_id,
                local_dir=str(model_path),
                local_dir_use_symlinks=False
            )

            logger.info(f"Successfully downloaded {model_name} to {model_path}")

        except Exception as e:
            logger.error(f"Failed to download {model_name}: {str(e)}")
            continue

    logger.info("Model download complete!")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download pretrained models")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./pretrained",
        help="Directory to save models"
    )

    args = parser.parse_args()
    download_models(args.output_dir)
