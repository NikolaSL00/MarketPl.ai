from pathlib import Path
import shutil

import kagglehub


DATASET = "jacksoncrow/stock-market-dataset"
LOCAL_DIR = Path("data/stock-market-dataset")

# Download latest version to Kaggle cache
cached_path = Path(kagglehub.dataset_download(DATASET))

# Copy dataset to local project folder
LOCAL_DIR.parent.mkdir(parents=True, exist_ok=True)
if LOCAL_DIR.exists():
	shutil.rmtree(LOCAL_DIR)
shutil.copytree(cached_path, LOCAL_DIR)

print("Dataset downloaded locally to:", LOCAL_DIR.resolve())