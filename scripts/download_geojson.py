#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests>=2.32.0",
# ]
# ///

import os
import requests
from urllib.parse import urljoin

# Base URL of the server
BASE_URL = "https://www.albany.edu/arce/assets/files/"

# Remote source filenames still use .geojson, while the checked-in app sources
# are .json modules consumed by src/features/fab/profile.js and tours.js.
files_to_download = [
    ("ARC_Boundary.geojson", "ARC_Boundary.json"),
    ("ARC_Roads.geojson", "ARC_Roads.json"),
    ("ARC_Sections.geojson", "ARC_Sections.json"),
    ("AfricanAmericanTour20.geojson", "AfricanAmericanTour20.json"),
    ("AlbanyMayors_fixed.geojson", "AlbanyMayors_fixed.json"),
    ("ArtistTour20.geojson", "ArtistTour20.json"),
    ("AssociationsTour20.geojson", "AssociationsTour20.json"),
    ("AuthorsPublishersTour20.geojson", "AuthorsPublishersTour20.json"),
    ("BusinessFinanceTour20.geojson", "BusinessFinanceTour20.json"),
    ("CivilWarTour20.geojson", "CivilWarTour20.json"),
    ("GAR_fixed.geojson", "GAR_fixed.json"),
    ("IndependenceTour20.geojson", "IndependenceTour20.json"),
    ("NotablesTour20.geojson", "NotablesTour20.json"),
    ("Projected_Sec49_Headstones.geojson", "Projected_Sec49_Headstones.json"),
    ("Projected_Sec75_Headstones.geojson", "Projected_Sec75_Headstones.json"),
    ("SocietyPillarsTour20.geojson", "SocietyPillarsTour20.json"),
]

# Create data directory if it doesn't exist. The script lives in scripts/, so
# resolve the repo root (its parent) before joining src/data, where the app
# actually reads the source files.
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(repo_root, "src", "data")
os.makedirs(data_dir, exist_ok=True)

# Download each file
for remote_filename, local_filename in files_to_download:
    file_url = urljoin(BASE_URL, remote_filename)
    output_path = os.path.join(data_dir, local_filename)
    
    print(f"Downloading {remote_filename}...")
    try:
        response = requests.get(file_url)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        print(f"Successfully downloaded {remote_filename} to {local_filename}")
        
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {remote_filename}: {e}")

print("\nDownload complete! Files have been saved to the data directory.")
