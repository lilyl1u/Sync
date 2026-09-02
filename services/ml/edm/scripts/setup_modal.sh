#!/bin/bash
# Quick setup script for LMD training with Modal

set -e

echo "================================================"
echo "LMD-Full Dataset Training Setup"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Modal is installed
if ! command -v modal &> /dev/null; then
    echo -e "${YELLOW}Modal CLI not found. Installing...${NC}"
    pip install modal
fi

# Check Modal authentication
echo -e "${GREEN}Checking Modal authentication...${NC}"
if ! modal token list &> /dev/null; then
    echo "Please authenticate with Modal:"
    modal token new
fi

echo ""
echo -e "${GREEN}✓ Modal is set up!${NC}"
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo "  1. Download LMD-full dataset"
echo "  2. Preprocess MIDI files"
echo "  3. Train model"
echo "  4. Run full pipeline (download + preprocess + train)"
echo "  5. Check status"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Downloading LMD-full dataset...${NC}"
        modal run scripts/modal_download_lmd.py
        ;;
    2)
        echo ""
        echo -e "${GREEN}Preprocessing MIDI files...${NC}"
        modal run scripts/modal_preprocess_midi.py
        ;;
    3)
        echo ""
        read -p "Number of epochs (default: 20): " epochs
        epochs=${epochs:-20}
        read -p "Batch size (default: 64): " batch_size
        batch_size=${batch_size:-64}

        echo -e "${GREEN}Training model...${NC}"
        modal run scripts/modal_train.py --epochs $epochs --batch-size $batch_size
        ;;
    4)
        echo ""
        echo -e "${GREEN}Running full pipeline...${NC}"
        echo "This will take several hours. Continue? (y/n)"
        read -p "> " confirm
        if [ "$confirm" = "y" ]; then
            echo ""
            echo "Step 1/3: Downloading dataset..."
            modal run scripts/modal_download_lmd.py

            echo ""
            echo "Step 2/3: Preprocessing..."
            modal run scripts/modal_preprocess_midi.py

            echo ""
            echo "Step 3/3: Training..."
            modal run scripts/modal_train.py --epochs 20 --batch-size 64

            echo ""
            echo -e "${GREEN}✓ Full pipeline complete!${NC}"
        fi
        ;;
    5)
        echo ""
        echo -e "${GREEN}Checking dataset status...${NC}"
        modal run scripts/modal_download_lmd.py --check-only

        echo ""
        echo -e "${GREEN}Checking preprocessing status...${NC}"
        modal run scripts/modal_preprocess_midi.py --check-only

        echo ""
        echo -e "${GREEN}Checking trained models...${NC}"
        modal run scripts/modal_train.py --check-only
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
echo "For more information, see LMD_TRAINING_GUIDE.md"
