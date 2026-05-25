import os
import requests
from urllib.parse import urljoin

# Base URL of the server
BASE_URL = "https://www.albany.edu/arce/assets/files/"

# List of GeoJSON files to download
files_to_download = [
    "ARC_Boundary.geojson",
    "ARC_Roads.geojson",
    "ARC_Sections.geojson",
    "AfricanAmericanTour20.geojson",
    "AlbanyMayors_fixed.geojson",
    "ArtistTour20.geojson",
    "AssociationsTour20.geojson",
    "AuthorsPublishersTour20.geojson",
    "BusinessFinanceTour20.geojson",
    "CivilWarTour20.geojson",
    "GAR_fixed.geojson",
    "IndependenceTour20.geojson",
    "NotablesTour20.geojson",
    "Projected_Sec49_Headstones.geojson",
    "Projected_Sec75_Headstones.geojson",
    "SocietyPillarsTour20.geojson"
]

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "data")
os.makedirs(data_dir, exist_ok=True)

# Download each file
for filename in files_to_download:
    file_url = urljoin(BASE_URL, filename)
    output_path = os.path.join(data_dir, filename)
    
    print(f"Downloading {filename}...")
    try:
        response = requests.get(file_url)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        print(f"Successfully downloaded {filename}")
        
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {filename}: {e}")

print("\nDownload complete! Files have been saved to the data directory.") 