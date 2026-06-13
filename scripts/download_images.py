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
BASE_URL = "https://www.albany.edu/arce/images/"

# List of all image files from the server
images_to_download = [
    "AMCAGP178a.png", "ARCGravefinder.jpg", "ASG2.jpg", "AfAr2.jpg", "Alexander.jpg",
    "Alexander76a.jpg", "Almshouse19f.png", "Almshouse19g.jpg", "Arsenal179a.jpg",
    "Art2.jpg", "Arthur18a.jpg", "Arthur18c.jpg", "Auth&Pub2.jpg", "B&F2.jpg",
    "Baker117a.jpg", "Barnes50a.jpg", "Begley188a.jpg", "Begley188b.jpg",
    "Bender189a.jpg", "Bender58a.jpg", "Bender58b.jpg", "Bender58c.jpg",
    "Bender59a.jpg", "Bender59b.jpg", "Bender59c.jpg", "Bender59d.jpg",
    "Benedict118a.jpg", "Bennedict118a.jpg", "Bentley119a.jpg", "Berry120a.jpg",
    "Berry120b.jpg", "Blanchard121a.jpg", "Bleecker16a.jpg", "Bleecker16b.jpg",
    "Bleecker65a.jpg", "Bleeker103a.jpg", "Bleeker103b.jpg", "Bleeker16a.jpg",
    "Bleeker16b.jpg", "Bleeker65a.jpg", "Bodnar.jpg", "Bogardus95a.jpg",
    "Bogardus95b.jpg", "Bogardus95c.jpg", "BothLogos.jpg", "Bounty97a.jpg",
    "Bryan123a.jpg", "BurchMOA28a.jpg", "Burden25a.jpg", "Burden25b.jpg",
    "Burden25d.jpg", "Burden25pb.png", "Burden25pc.png", "BurialLocator5.png",
    "Burial_Data_Input_console.jpg", "Burial_Filter_Statistics.jpg",
    "Burial_Locator_Filters.jpg", "Burial_Locator_Map.jpg",
    "Burial_Selected_Location.jpg", "CW2.jpg", "Calhoun28b.jpg", "Calhoun28c.jpg",
    "Calhoun28e.jpg", "Calhoun28fr.jpg", "Calhoun28g.jpg", "Calhoun28h.jpg",
    "Calhoun28i.jpg", "Calhoun28j.jpg", "Calhoun28k.jpg", "Calhoun28l.jpg",
    "Calhoun28m.JPG", "Calverley42a.jpg", "Calverley42b.jpg", "Calverley42f.jpg",
    "Childrens180a.jpg", "Church2.jpg", "Churchgrounds185a.jpg",
    "Churchgrounds185b.jpg", "Churchgrounds185c.jpg", "Clark125a.gif",
    "Clark125b.png", "Cochrane126a.jpg", "Corliss127a.jpg", "Corliss127b.jpg",
    "Corning37d.jpg", "Corning38b.jpg", "Corning38c.jpg", "Corning38d.jpg",
    "Corning39a.jpg", "Corning39b.jpg", "Cross128a.JPG", "Cross128b.jpg",
    "Dalton17a.jpg", "Dalton17c.jpeg", "Dalton17c.png", "Dalton17f.jpg",
    "Dawson129a.jpg", "DePeyster79a.jpg", "Default.jpg", "Delavan12b.jpg",
    "Delavan12c.jpg", "Delavan12d.jpg", "Dempsey130a.jpg", "Dempsey131a.jpg",
    "Deptlogo.jpg", "Dix9a.jpg", "Douge187a.jpg", "Douge187b.jpg", "Douge187c.jpg",
    "Douw134a.jpg", "Douw66a.jpg", "Dudley26a.jpg", "Dudley26e.jpg",
    "DudleyMOA15a.jpg", "Easton109a.jpg", "Easton109b.jpg", "Easton109c.jpg",
    "Eights51a.jpg", "Elkins111a.jpg", "Fairview181c.jpg", "Farnsworth135a.jpg",
    "Follett136a.jpg", "Follett136b.jpg", "Fort31a.jpg", "Frisby137a.jpg",
    "Full Screen.jpg", "GAR.jpg", "Gansevoort138b.jpg", "Gansevoort63a.jpg",
    "Gansevoort85d.jpg", "Gardner116a.jpg", "GausMOA36a.jpg", "Glazier33a.jpg",
    "Glazier33c.jpg", "Grave_Finder_Map.jpg", "GravefinderPopup.jpg",
    "GravefinderRoads.jpg", "GravefinderTOC.jpg", "GravefinderWhereamI_sm.jpg",
    "Gravefinder_selection.jpg", "HackettMOA41a.jpg", "Hall1a.jpg", "Hall1c.jpg",
    "Hamilton14c.JPG", "Hamilton32a.jpg", "Hamilton32c.jpg", "Hand10a.jpg",
    "Hillhouse49a.jpg", "Hillhouse49b.jpg", "Hillhouse49c.jpg", "Hillhouse49d.jpg",
    "Huested139a.jpg", "HumphreyMOA23a.jpg", "Huntley106a.jpg", "Huntley106b.jpg",
    "Huntley106d.jpg", "Indep2.jpg", "James6a.jpg", "James6b.jpg", "James6c.jpg",
    "James6d.jpg", "Jones112a.jpg", "JosephCYates.jpg", "JudsonMOA29a.jpg",
    "King142a.jpg", "King142b.png", "King143a.jpg", "Kinnear47a.jpg",
    "Kinnear47b.jpg", "Kinnear47c.jpg", "Knapp55a.jpg", "Kurt.jpg",
    "Lathrop105a.jpg", "Lathrop105c.jpg", "Lathrop105e.jpg", "Lathrop11a.jpg",
    "Lathrop11c.jpg", "Lathrop144.jpg", "Lathrop144a.jpg", "Layer List.jpg",
    "LivingstonMOA11a.jpg", "Lodge96a.jpg", "Lodge96b.jpg", "Lord145a.jpg",
    "MOA.jpg", "Manning107a.jpg", "Manning44d.jpg", "ManningMOA32a.jpg",
    "March46a.jpg", "Marcy27a.jpg", "Marcy27b.jpg", "Marcy27d.jpg",
    "Matthews101a.jpg", "Matthews101b.jpg", "McAuliffe7a.jpg", "McAuliffe7c.JPG",
    "McElroy174d.jpg", "McEwanMOA38a.jpg", "McIntyre13a.jpg", "McPherson56a.jpg",
    "McPherson56b.jpg", "McPherson56c.jpg", "Menands184a.jpg", "Meneely23a.jpg",
    "Meyers99b.jpg", "Meyers99c.jpg", "Meyers99d.jpg", "Meyers99e.jpg",
    "Miller100a.jpg", "Mingo93a.jpg", "Mink175a.jpg", "Mink175b.jpg",
    "Mink175d.JPG", "MorganWright108a.jpg", "Morris147a.jpg", "Morris148a.jpg",
    "Morrison149a.jpg", "Mott57a.jpg", "Mott57b.jpg", "Munsell15a.jpg",
    "Munsell15b.jpg", "Myers36c.jpg", "Myers36d.jpg", "Notable2.jpg",
    "Oliver150a.jpg", "Orr151a.jpg", "Palmer40a.jpg", "Palmer40d.jpg",
    "Parsons102a.jpg", "Parsons102b.jpg", "Paterson60a.jpg", "Patterson152a.jpg",
    "Patterson152b.png", "Patterson60a.jpg", "Paul186a.jpg", "Paul186b.jpeg",
    "Paula.jpg", "Pease41a.jpg", "Pease41d.jpg", "Pease41e.jpg", "Peckham45a.jpg",
    "PerryMOA25a.jpg", "Phelps3c.jpg", "Phelps3d.jpg", "Phelps3e.jpg",
    "Pillars2.jpg", "Pohlman153a.jpg", "Pratt154b.jpg", "Pruyn155a.jpg",
    "Pruyn20a.jpg", "Pruyn20b.jpg", "Quackenbush86b.jpg", "Rathbone156b.jpg",
    "RathboneMOA21a.jpg", "Reynolds5d.png", "Reynolds5e.jpg", "Rice158.jpg",
    "Rice158a.jpg", "Roads.jpg", "Roessle172a.jpeg", "Roessle172b.jpg",
    "Roessle172c.jpg", "Root34a.jpg", "Root34c.JPG", "Rui.jpg", "S&S2.jpg",
    "Scalebar.jpg", "Schuyler24c.JPG", "Schuyler61d.jpg", "Schuyler70a.jpg",
    "Schuyler70b.jpg", "Schuyler70c.jpg", "Schuyler74a.jpg", "Schuyler94a.jpg",
    "Schuyler94b.jpg", "Search For Name.jpg", "Search.jpg", "Sections.jpg",
    "Seymour8a.jpg", "Seymour8b.jpg", "Shelter177a.jpg", "Sibbie98a.jpg",
    "Sibbie98b.jpg", "Soldier30a.jpg", "Soldier30c.jpg", "Spencer53a.jpg",
    "SpencerMOA16a.jpg", "Sprague160a.jpg", "Springsteed161a.jpg",
    "StaatsMOA22a.jpg", "Stanford2b.jpg", "Stanford2e.jpg", "Stanford2f.jpg",
    "Starr173b.jpg", "Starr173d.jpg", "Steinwehr167b.jpg", "StevensonMOA17a.jpg",
    "Stoneman21d.jpg", "Stoneman21e.jpg", "Strain52a.jpg", "Strain52b.jpg",
    "Street104c.jpg", "Street104d.jpg", "Stringer89a.jpg", "SwinburneMOA30a.jpg",
    "TOC.jpg", "Tayler90a.jpg", "TenBroeck82b.jpg", "TenBroeck87a.jpg",
    "TenEyck163a.jpg", "Thacher22a.jpg", "Thacher35a.jpg", "ThatcherIIMOA42a.jpg",
    "Theme.jpg", "Thompson115a.jpg", "Thompson115b.jpg", "Thompson115c.jpg",
    "Tompkins182a.jpg", "Tompkins182b.jpg", "Topp113a.jpg", "Townsend164b.jpg",
    "TownsendMOA18a.jpg", "TownsendMOA24a.jpg", "Tremain165b.jpg", "Tucker4g.jpg",
    "Tutorial.jpg", "Tyler.jpg", "Valentine176a.jpg", "Valentine176c.jpg",
    "VanAlstyne171a.jpg", "VanAlstyneMOA34a.jpg", "VanAntwerp110a.jpg",
    "VanRensselaer67a.jpg", "VanRensselaer68a.jpg", "VanRensselaer84b.jpg",
    "VanRensselaer91a.jpg", "VanVectenMOA20a.jpg", "Vanderpoel166a.jpg",
    "Vosburgh54a.jpg", "Vosburgh54b.jpg", "Weed43a.jpg", "Welcome.jpg",
    "Where Am I.jpg", "Williams114a.jpg", "Williams114b.jpg", "Williamson168a.jpg",
    "Wilson169a.jpg", "Winslow29a.jpg", "Winslow29b.jpg", "Winslow29c.jpg",
    "Yates62a.jpg", "YatesJr64a.jpg", "Zoom To Selected.jpg", "Zoom.jpg",
    "banner.jpg", "banner1.jpg", "biolist.jpg", "burialorgrave.jpg", "cdtc.png",
    "chapel.png", "chapel.svg", "crtc.png", "footer-logo.jpg", "footer-logo.png",
    "friedman.jpg", "headstone.png", "headstone.svg", "jhu.jpg", "liberty.png",
    "lightbox.png", "mobilemap.png", "no-image.jpg", "no-image_1.jpg", "nydec.png",
    "nynhp.png", "nysag.png", "nysdoh.png", "nysdot.png", "nysits.png",
    "olcott48a.jpg", "olcott48c.jpg", "sponsors.png", "ualbany.png", "usgs.png"
]

# Create images directory if it doesn't exist. The script lives in scripts/, so
# resolve the repo root (its parent) before joining src/data/images, where the
# app actually reads the image assets.
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
images_dir = os.path.join(repo_root, "src", "data", "images")
os.makedirs(images_dir, exist_ok=True)

# Download each file
for filename in images_to_download:
    file_url = urljoin(BASE_URL, filename)
    output_path = os.path.join(images_dir, filename)
    
    print(f"Downloading {filename}...")
    try:
        response = requests.get(file_url)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        print(f"Successfully downloaded {filename}")
        
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {filename}: {e}")

print("\nDownload complete! Images have been saved to the data/images directory.")
