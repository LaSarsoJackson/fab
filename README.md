# Albany Rural Cemetery Burial Locator

An interactive web application for locating and navigating to burial sites at Albany Rural Cemetery.
Hosted at https://www.albany.edu/arce/Burial_Locator/ (not always up to date) and https://lasarsojackson.github.io/fab/ (live)

## Features

- Interactive map with multiple layers including:
  - Cemetery sections with labels
  - Roads and pathways
  - Cemetery boundary
  - All burial locations
- Search functionality for finding burials by:
  - Name
  - Section
  - Lot/Tier
  - Year (birth/death)
- Live location tracking within cemetery grounds
- Turn-by-turn walking directions to burial sites using GraphHopper routing API
- Clustered markers for improved performance
- Responsive design for mobile and desktop use

## Technical Details

- Built with React and Leaflet for mapping functionality
- Uses GraphHopper API for pedestrian routing
- Implements marker clustering for handling large datasets
- Material-UI components for modern UI elements

Local python dev server will deploy on port 8000 unless NODE_ENV is set to production. 

## Getting Started

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Prerequisites

- Node.js and npm installed
- GraphHopper API key (set as REACT_APP_GRAPHHOPPER_API_KEY in .env)

### Installation

1. Clone the repository
2. Install dependencies:
