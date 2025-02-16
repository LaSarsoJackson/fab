import { React, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, Popup, Marker, GeoJSON, LayersControl, LayerGroup, useMap } from "react-leaflet";
import L from 'leaflet';
import "./index.css";
import 'leaflet.markercluster/dist/leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import geo_burials from "./data/Geo_Burials.json";
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-material.css';
import Button from '@mui/material/Button';
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import PinDropIcon from '@mui/icons-material/PinDrop';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import * as turf from '@turf/turf';
import { BasemapLayer } from 'react-esri-leaflet';
import { 
  Autocomplete, 
  TextField, 
  Paper, 
  InputAdornment, 
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  Typography,
  ButtonGroup
} from '@mui/material';
import { divIcon } from 'leaflet';

const columns = [
  { field: 'OBJECTID', sortable: true, hide: true },
  {
    field: 'First_Name', sortable: true, checkboxSelection: true, headerName: 'First Name',
  },
  {
    field: 'Last_Name', sortable: true, headerName: 'Last Name',
  },
  {
    field: 'Birth', sortable: true,
  },
  {
    field: 'Death', sortable: true,
  },
  {
    field: 'Section', sortable: true,
  },
  {
    field: 'Lot', sortable: true,
  },
  {
    field: 'Pvt_Pub', sortable: true, hide: true
  },
  {
    field: 'Tier', sortable: true,
  },
  {
    field: 'Grave', sortable: true,
  },
  {
    field: 'Sec_Disp', sortable: true, hide: true
  },
  {
    field: 'ARC_GeoID', sortable: true, headerName: 'GeoID',
  },
  {
    field: 'Geotype', sortable: true, hide: true
  },
  {
    field: 'Coordinates', sortable: true, hide: true
  },
];

const defaultColDef = {
  // set filtering on for all columns
  filter: true,
  floatingFilter: true,
};

let geo_burials_rows = [];
for (let i = 0; i < geo_burials.features.length; i++) {
  let feature = geo_burials.features[i];
  let row = {
    OBJECTID: feature.properties.OBJECTID,
    First_Name: feature.properties.First_Name,
    Last_Name: feature.properties.Last_Name,
    Section: feature.properties.Section,
    Lot: feature.properties.Lot,
    Pvt_Pub: feature.properties.Pvt_Pub,
    Tier: feature.properties.Tier,
    Grave: feature.properties.Grave,
    Sec_Disp: feature.properties.Sec_Disp,
    ARC_GeoID: feature.properties.ARC_GeoID,
    Birth: feature.properties.Birth,
    Death: feature.properties.Death,
    Geotype: feature.geometry.type,
    Coordinates: feature.geometry.coordinates,
  };
  geo_burials_rows.push(row);
}

// Custom Zoom Control Component
function CustomZoomControl() {
  const map = useMap();
  
  return (
    <Paper 
      elevation={3}
      sx={{
        position: 'absolute',
        top: '80px',
        right: '10px',
        zIndex: 1000,
      }}
    >
      <ButtonGroup
        orientation="vertical"
        variant="contained"
        size="small"
      >
        <IconButton onClick={() => map.zoomIn()} size="small">
          <AddIcon />
        </IconButton>
        <IconButton onClick={() => map.zoomOut()} size="small">
          <RemoveIcon />
        </IconButton>
      </ButtonGroup>
    </Paper>
  );
}

// MapBounds component to restrict zoom and pan
function MapBounds() {
  const map = useMap();
  const boundaryPolygon = ARC_Boundary.features[0];
  
  useEffect(() => {
    // Calculate the bounds of the boundary polygon
    const bounds = turf.bbox(boundaryPolygon);
    
    // Add significant padding to the bounds (about 1km)
    const padding = 0.01; // roughly 1km in decimal degrees
    const southWest = [bounds[1] - padding, bounds[0] - padding];
    const northEast = [bounds[3] + padding, bounds[2] + padding];
    
    const paddedBounds = [southWest, northEast];
    
    // Set less restrictive bounds
    map.setMaxBounds(paddedBounds);
    map.setMinZoom(13);
    map.setMaxZoom(25);

    // Initial fit to bounds, but don't force recenter after
    map.once('load', () => {
      map.fitBounds(paddedBounds);
    });
  }, [map, boundaryPolygon]);
  
  return null;
}

// Create a custom component for the vector basemap
function VectorBasemap({ name }) {
  return <BasemapLayer name={name} maxZoom={25} maxNativeZoom={19} />;
}

// Add this after the VectorBasemap component and before the Map component
function MapController({ selectedBurials, hoveredIndex }) {
  const map = useMap();
  
  useEffect(() => {
    // Store the map instance in the window for access from outside
    window.mapInstance = map;
  }, [map]);
  
  return null;
}

// Add this before the Map component
const MARKER_COLORS = [
  '#e41a1c', // red
  '#377eb8', // blue
  '#4daf4a', // green
  '#984ea3', // purple
  '#ff7f00', // orange
  '#ffff33', // yellow
  '#a65628', // brown
  '#f781bf', // pink
  '#999999'  // grey
];

// Add this before the Map component
const ZOOM_LEVEL = 18;

// Add before the Map component
const createNumberedIcon = (number, isHighlighted = false) => {
  const colorIndex = (number - 1) % MARKER_COLORS.length;
  const color = MARKER_COLORS[colorIndex];
  
  return divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: ${isHighlighted ? '32px' : '24px'};
        height: ${isHighlighted ? '32px' : '24px'};
        border-radius: 50%;
        border: ${isHighlighted ? '3px' : '2px'} solid white;
        box-shadow: ${isHighlighted ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)'};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isHighlighted ? '16px' : '14px'};
        transition: all 0.2s ease;
      ">
        ${number}
      </div>
    `,
    iconSize: [isHighlighted ? 32 : 24, isHighlighted ? 32 : 24],
    iconAnchor: [isHighlighted ? 16 : 12, isHighlighted ? 16 : 12],
    popupAnchor: [0, isHighlighted ? -16 : -12]
  });
};

// Add this before the Map component
const createUniqueKey = (burial, index) => {
  // Create a unique key combining multiple properties
  return `${burial.OBJECTID}_${burial.Section}_${burial.Lot}_${burial.Grave}_${index}`;
};

// Add before the Map component
const UNIQUE_SECTIONS = Array.from(new Set(geo_burials.features.map(f => f.properties.Section))).sort((a, b) => {
  // Handle special case for section 100A
  if (a === '100A') return 1;
  if (b === '100A') return -1;
  return a - b;
});

export default function BurialMap() {
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [status, setStatus] = useState('Find me');
  const [selectedBurials, setSelectedBurials] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentSelection, setCurrentSelection] = useState(null);
  const [showAllBurials, setShowAllBurials] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [lotTierFilter, setLotTierFilter] = useState('');
  const [filterType, setFilterType] = useState('lot'); // 'lot' or 'tier'
  const [currentZoom, setCurrentZoom] = useState(14);
  const { BaseLayer } = LayersControl;
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const markerClusterRef = useRef(null);
  const markersRef = useRef(new Map()); // Store marker references
  const [hoveredMarker, setHoveredMarker] = useState(null);

  // Adjust zoom levels
  const ZOOM_LEVELS = {
    SECTION: 16,    // Show section info
    CLUSTER: 17,    // Show clusters
    INDIVIDUAL: 20  // Show individual markers (reduced from 25, clusters disappear earlier)
  };

  // Create searchable options from burial data with enhanced search capabilities
  const searchOptions = useMemo(() => 
    geo_burials.features.map(feature => ({
      label: `${feature.properties.First_Name} ${feature.properties.Last_Name}`,
      searchableLabel: `${feature.properties.First_Name} ${feature.properties.Last_Name} (Section ${feature.properties.Section}, Lot ${feature.properties.Lot})`,
      ...feature.properties,
      coordinates: feature.geometry.coordinates
    })).filter(option => option.First_Name || option.Last_Name)
  , []);

  // Filter burials based on section/lot/tier
  const filteredBurials = useMemo(() => {
    if (!showAllBurials || !sectionFilter) return [];
    
    return geo_burials.features.filter(feature => {
      const props = feature.properties;
      
      // Always require a section filter
      if (props.Section !== sectionFilter) {
        return false;
      }
      
      // Apply lot/tier filter if present
      if (lotTierFilter) {
        if (filterType === 'lot' && props.Lot !== lotTierFilter) {
          return false;
        }
        if (filterType === 'tier' && props.Tier !== lotTierFilter) {
          return false;
        }
      }
      
      return true;
    }).map(feature => ({
      ...feature.properties,
      coordinates: feature.geometry.coordinates
    }));
  }, [showAllBurials, sectionFilter, lotTierFilter, filterType]);

  const exteriorStyle = useMemo(() => ({
    "color": "#ffffff",
    "weight": 1.5,
    "fillOpacity": .08
  }), []);

  const roadStyle = useMemo(() => ({
    color: '#000000',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.1
  }), []);

  const onLocateMarker = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser');
    } else {
      setStatus('Locating...');
      navigator.geolocation.watchPosition((position) => {
        const point = turf.point([position.coords.longitude, position.coords.latitude]);
        const boundaryPolygon = ARC_Boundary.features[0];
        const bufferedBoundary = turf.buffer(boundaryPolygon, 8, { units: 'kilometers' });
        const isWithinBuffer = turf.booleanPointInPolygon(point, bufferedBoundary);
        
        if (isWithinBuffer) {
          setStatus('Find me');
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
        } else {
          setStatus('You must be within 5 miles of Albany Rural Cemetery');
          setLat(null);
          setLng(null);
        }
      }, () => {
        setStatus('Unable to retrieve your location');
      });
    }
  }

  // Smart search function that detects search type and filters accordingly
  const smartSearch = (options, searchInput) => {
    const input = searchInput.toLowerCase().trim();
    if (!input) return [];

    // Check if input is a year (4 digits)
    const yearPattern = /^\d{4}$/;
    if (yearPattern.test(input)) {
      return options.filter(option => 
        (option.Birth && option.Birth.includes(input)) ||
        (option.Death && option.Death.includes(input))
      );
    }

    // Check if input is looking for section (e.g., "section 1" or "sec 1")
    const sectionPattern = /^(section|sec)\s*([a-zA-Z0-9]+)$/i;
    const sectionMatch = input.match(sectionPattern);
    if (sectionMatch) {
      const sectionQuery = sectionMatch[2];
      return options.filter(option => 
        option.Section && option.Section.toString().toLowerCase() === sectionQuery.toLowerCase()
      );
    }

    // Check if input is looking for lot (e.g., "lot 123")
    const lotPattern = /^lot\s*(\d+)$/i;
    const lotMatch = input.match(lotPattern);
    if (lotMatch) {
      const lotQuery = lotMatch[1];
      return options.filter(option => 
        option.Lot && option.Lot.toString() === lotQuery
      );
    }

    // Check if input is just a number (assume it could be section, lot, or year)
    const numberPattern = /^\d+$/;
    if (numberPattern.test(input)) {
      return options.filter(option => 
        (option.Section && option.Section.toString() === input) ||
        (option.Lot && option.Lot.toString() === input) ||
        (option.Birth && option.Birth.includes(input)) ||
        (option.Death && option.Death.includes(input))
      );
    }

    // Default: search by name
    return options.filter(option => 
      option.searchableLabel.toLowerCase().includes(input)
    );
  };

  const handleSearch = (event, value) => {
    if (value) {
      if (typeof value === 'string') {
        // If it's a string, find the matching burial
        const matches = smartSearch(searchOptions, value);
        if (matches.length > 0) {
          addToResults(matches[0]);
        }
      } else {
        addToResults(value);
      }
    }
  };

  const addToResults = (burial) => {
    if (burial && !selectedBurials.some(b => b.OBJECTID === burial.OBJECTID)) {
      setSelectedBurials(prev => [...prev, burial]);
      setCurrentSelection(null);
      setInputValue('');
      
      // Only pan to location when adding
      if (window.mapInstance) {
        window.mapInstance.panTo([burial.coordinates[1], burial.coordinates[0]], {
          duration: 1.5
        });
      }
    }
  };

  const removeFromResults = (objectId) => {
    setSelectedBurials(prev => prev.filter(burial => burial.OBJECTID !== objectId));
  };

  const clearSearch = () => {
    setSelectedBurials([]);
    setInputValue('');
    setCurrentSelection(null);
  };

  const handleResultClick = (burial, index) => {
    if (window.mapInstance) {
      const map = window.mapInstance;
      // Always zoom when clicking in search results
      map.flyTo(
        [burial.coordinates[1], burial.coordinates[0]],
        ZOOM_LEVEL,
        {
          duration: 1.5,
          easeLinearity: 0.25
        }
      );
    }
  };

  const handleMarkerClick = (burial, index) => {
    if (window.mapInstance) {
      const map = window.mapInstance;
      // Just pan for marker clicks
      map.panTo([burial.coordinates[1], burial.coordinates[0]], {
        duration: 1.5
      });
    }
  };

  // Function to create marker cluster group - optimized
  const createClusterGroup = useCallback(() => {
    return L.markerClusterGroup({
      maxClusterRadius: (zoom) => {
        // More granular cluster sizing based on zoom
        if (zoom >= 19) return 10;      // Very small clusters at high zoom
        if (zoom >= 17) return 20;      // Small clusters at high zoom
        if (zoom >= 15) return 40;      // Medium clusters at medium zoom
        if (zoom >= 13) return 60;      // Larger clusters at lower zoom
        return 80;                      // Largest clusters at lowest zoom
      },
      disableClusteringAtZoom: 20,     // Show individual markers earlier (was 22)
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 2,   // Increase spacing between spiderfied markers
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      chunkedLoading: true,
      chunkInterval: 200,
      chunkDelay: 50,
      animate: true,
      animateAddingMarkers: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
        const sizeMap = {
          small: 30,
          medium: 35,
          large: 40
        };
        
        return L.divIcon({
          html: `
            <div class="cluster-marker ${size}">
              <span>${count}</span>
            </div>
          `,
          className: 'custom-cluster-marker',
          iconSize: L.point(sizeMap[size], sizeMap[size])
        });
      }
    });
  }, []);

  // Handle map zoom changes
  const handleZoomEnd = useCallback((e) => {
    const map = e.target;
    setCurrentZoom(map.getZoom());
  }, []);

  // Update marker clusters when filtered burials change
  useEffect(() => {
    if (!window.mapInstance || !showAllBurials || !sectionFilter) return;

    // Remove existing cluster group if it exists
    if (markerClusterRef.current) {
      markerClusterRef.current.clearLayers();
      window.mapInstance.removeLayer(markerClusterRef.current);
    }

    // Create new cluster group
    const clusterGroup = createClusterGroup();
    markerClusterRef.current = clusterGroup;

    // Add markers to cluster group
    filteredBurials.forEach(burial => {
      const marker = L.marker([burial.coordinates[1], burial.coordinates[0]], {
        icon: L.divIcon({
          className: 'burial-marker',
          html: `
            <div style="
              width: 8px;
              height: 8px;
              background-color: #666;
              border-radius: 50%;
              border: 1px solid white;
              box-shadow: 0 0 4px rgba(0,0,0,0.4);
            "></div>
          `,
          iconSize: [8, 8],
          iconAnchor: [4, 4]
        })
      });

      marker.bindPopup(`
        <div>
          <h3>${burial.First_Name} ${burial.Last_Name}</h3>
          <p>Section: ${burial.Section}</p>
          <p>Lot: ${burial.Lot}</p>
          <p>Tier: ${burial.Tier}</p>
          <p>Grave: ${burial.Grave}</p>
          <p>Birth: ${burial.Birth}</p>
          <p>Death: ${burial.Death}</p>
        </div>
      `);

      clusterGroup.addLayer(marker);
    });

    // Add cluster group to map
    window.mapInstance.addLayer(clusterGroup);

    // Clean up on unmount
    return () => {
      if (markerClusterRef.current) {
        window.mapInstance.removeLayer(markerClusterRef.current);
      }
    };
  }, [filteredBurials, showAllBurials, sectionFilter, createClusterGroup]);

  // Add zoom handler to map
  useEffect(() => {
    if (!window.mapInstance) return;
    
    window.mapInstance.on('zoomend', handleZoomEnd);
    
    return () => {
      window.mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [handleZoomEnd]);

  return (
    <div className="map-container">
      {/* Left sidebar with search and filters */}
      <Paper 
        elevation={3}
        className="left-sidebar"
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Autocomplete
              freeSolo
              options={searchOptions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option;
                }
                return option.searchableLabel || '';
              }}
              onChange={handleSearch}
              value={currentSelection || null}
              inputValue={inputValue}
              onInputChange={(event, newInputValue, reason) => {
                setInputValue(newInputValue);
                if (reason === 'clear') {
                  setCurrentSelection(null);
                }
              }}
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Name, year, sec, or lot..."
                  variant="outlined"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) => {
                return smartSearch(options, inputValue).slice(0, 100);
              }}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.First_Name} {option.Last_Name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Section {option.Section}, Lot {option.Lot}
                      {option.Birth && ` • Born ${option.Birth}`}
                      {option.Death && ` • Died ${option.Death}`}
                    </Typography>
                  </Box>
                </li>
              )}
            />
            {currentSelection && (
              <IconButton 
                onClick={() => addToResults(currentSelection)}
                color="primary"
                size="small"
                sx={{ alignSelf: 'center' }}
              >
                <AddIcon />
              </IconButton>
            )}
          </Box>
          
          {/* Section Filter */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filter by Section
            </Typography>
            <Autocomplete
              options={UNIQUE_SECTIONS}
              value={sectionFilter || null}
              onChange={(event, newValue) => {
                setSectionFilter(newValue || '');
                if (newValue && !showAllBurials) {
                  setShowAllBurials(true);
                }
                if (newValue && window.mapInstance) {
                  // Find the section in ARC_Sections and zoom to it
                  const section = ARC_Sections.features.find(f => f.properties.Section === newValue);
                  if (section) {
                    const layer = L.geoJSON(section);
                    const bounds = layer.getBounds();
                    window.mapInstance.fitBounds(bounds, {
                      padding: [50, 50],
                      maxZoom: ZOOM_LEVELS.CLUSTER
                    });
                  }
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Section"
                  size="small"
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  Section {option}
                </li>
              )}
              getOptionLabel={(option) => `Section ${option}`}
              isOptionEqualToValue={(option, value) => option === value}
            />
          </Box>

          {/* Show All Burials Toggle - Only show when a section is selected */}
          {sectionFilter && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant={showAllBurials ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                fullWidth
                onClick={() => setShowAllBurials(!showAllBurials)}
                startIcon={showAllBurials ? <RemoveIcon /> : <AddIcon />}
              >
                {showAllBurials ? 'Hide Section Burials' : 'Show Section Burials'}
              </Button>
            </Box>
          )}

          {/* Filters - only shown when a section is selected */}
          {sectionFilter && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Filter Section {sectionFilter} Burials
              </Typography>
              
              {/* Lot/Tier Toggle */}
              <ButtonGroup 
                fullWidth 
                size="small" 
                sx={{ mt: 1 }}
              >
                <Button
                  variant={filterType === 'lot' ? 'contained' : 'outlined'}
                  onClick={() => setFilterType('lot')}
                >
                  Lot
                </Button>
                <Button
                  variant={filterType === 'tier' ? 'contained' : 'outlined'}
                  onClick={() => setFilterType('tier')}
                >
                  Tier
                </Button>
              </ButtonGroup>
              
              {/* Lot/Tier Filter */}
              <TextField
                fullWidth
                size="small"
                label={filterType === 'lot' ? 'Lot Number' : 'Tier Number'}
                value={lotTierFilter}
                onChange={(e) => setLotTierFilter(e.target.value)}
                margin="dense"
              />
              
              {/* Clear Filters */}
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                onClick={() => {
                  setLotTierFilter('');
                  setFilterType('lot');
                  setSectionFilter('');
                  setShowAllBurials(false);
                  // Reset map view to original bounds
                  if (window.mapInstance) {
                    const bounds = turf.bbox(ARC_Boundary.features[0]);
                    const padding = 0.01; // roughly 1km in decimal degrees
                    const southWest = [bounds[1] - padding, bounds[0] - padding];
                    const northEast = [bounds[3] + padding, bounds[2] + padding];
                    window.mapInstance.fitBounds([southWest, northEast]);
                  }
                }}
              >
                Clear Filters
              </Button>
            </Box>
          )}
          
          {/* Location Button */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button 
              onClick={onLocateMarker} 
              variant='contained' 
              color='secondary' 
              size='small' 
              startIcon={<PinDropIcon />}
              sx={{ flex: 1 }}
            >
              {status}
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Search Results */}
        {selectedBurials.length > 0 && (
          <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Search Results ({selectedBurials.length})</Typography>
              <IconButton onClick={clearSearch} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <List>
              {selectedBurials.map((burial, index) => (
                <ListItem 
                  key={createUniqueKey(burial, index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleResultClick(burial, index)}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: hoveredIndex === index ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      aria-label="remove" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromResults(burial.OBJECTID);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Box
                    sx={{
                      width: hoveredIndex === index ? '32px' : '24px',
                      height: hoveredIndex === index ? '32px' : '24px',
                      borderRadius: '50%',
                      backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length],
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 1,
                      fontWeight: 'bold',
                      fontSize: hoveredIndex === index ? '16px' : '14px',
                      border: hoveredIndex === index ? '3px solid white' : '2px solid white',
                      boxShadow: hoveredIndex === index ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {index + 1}
                  </Box>
                  <ListItemText
                    primary={`${burial.First_Name} ${burial.Last_Name}`}
                    secondary={
                      <Box component="span">
                        <Typography component="span" variant="body2" display="block">Section: {burial.Section}</Typography>
                        <Typography component="span" variant="body2" display="block">Lot: {burial.Lot}</Typography>
                        <Typography component="span" variant="body2" display="block">Tier: {burial.Tier}</Typography>
                        <Typography component="span" variant="body2" display="block">Grave: {burial.Grave}</Typography>
                        <Typography component="span" variant="body2" display="block">Birth: {burial.Birth}</Typography>
                        <Typography component="span" variant="body2" display="block">Death: {burial.Death}</Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>

      <MapContainer
        center={[42.704180, -73.731980]}
        zoom={14}
        className="map"
        zoomControl={false}
        maxZoom={25}
      >
        <CustomZoomControl />
        <MapBounds />
        <MapController selectedBurials={selectedBurials} hoveredIndex={hoveredIndex} />
        <LayersControl>
          <BaseLayer checked name="Imagery">
            <VectorBasemap name="ImageryClarity" />
          </BaseLayer>
          <BaseLayer name="Streets">
            <VectorBasemap name="Streets" />
          </BaseLayer>
          <LayerGroup>
            <LayersControl.Overlay name="Roads">
              <GeoJSON data={ARC_Roads} style={roadStyle} />
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay checked name="Boundary">
              <GeoJSON data={ARC_Boundary} style={exteriorStyle} />
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay checked name="Sections">
              <GeoJSON 
                data={ARC_Sections}
                style={(feature) => ({
                  fillColor: feature.properties.Section === sectionFilter ? '#4a90e2' : '#f8f9fa',
                  fillOpacity: feature.properties.Section === sectionFilter ? 0.4 : 0.05,
                  color: feature.properties.Section === sectionFilter ? '#2c5282' : '#999',
                  weight: feature.properties.Section === sectionFilter ? 2 : 1
                })}
                onEachFeature={(feature, layer) => {
                  // Create tooltip but don't bind it yet
                  const tooltip = L.tooltip({
                    permanent: true,
                    direction: 'center',
                    className: 'section-label'
                  });
                  
                  layer.on({
                    click: (e) => {
                      // Only handle section click if we didn't click a marker
                      if (!hoveredMarker) {
                        setSectionFilter(feature.properties.Section);
                        if (!showAllBurials) {
                          setShowAllBurials(true);
                        }
                        // Zoom to section bounds with lower max zoom
                        const bounds = layer.getBounds();
                        window.mapInstance.fitBounds(bounds, {
                          padding: [50, 50],
                          maxZoom: 17  // Reduced from ZOOM_LEVELS.CLUSTER
                        });
                      }
                      // Prevent event from propagating
                      L.DomEvent.stopPropagation(e);
                    },
                    // Show label on mouseover if not already selected
                    mouseover: () => {
                      if (feature.properties.Section !== sectionFilter && currentZoom < ZOOM_LEVELS.SECTION) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      }
                    },
                    // Hide label on mouseout if not selected
                    mouseout: () => {
                      if (feature.properties.Section !== sectionFilter && currentZoom < ZOOM_LEVELS.SECTION) {
                        layer.unbindTooltip();
                      }
                    },
                    // Update tooltip visibility on zoom
                    add: () => {
                      // Initial state - show if selected or zoomed in
                      if (feature.properties.Section === sectionFilter || currentZoom >= ZOOM_LEVELS.SECTION) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      }
                    }
                  });

                  // Watch for zoom changes to update label visibility
                  if (window.mapInstance) {
                    window.mapInstance.on('zoomend', () => {
                      const zoom = window.mapInstance.getZoom();
                      if (zoom >= ZOOM_LEVELS.SECTION || feature.properties.Section === sectionFilter) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      } else {
                        layer.unbindTooltip();
                      }
                    });
                  }
                }}
              />
            </LayersControl.Overlay>
          </LayerGroup>
          
          {/* Location Marker */}
          {lat && lng && (
            <Marker position={[lat, lng]}>
              <Popup>You are here.</Popup>
            </Marker>
          )}
          
          {/* Update marker cluster creation */}
          {showAllBurials && filteredBurials.map((burial, index) => {
            const marker = (
              <Marker
                key={`all-${burial.OBJECTID}`}
                position={[burial.coordinates[1], burial.coordinates[0]]}
                icon={L.divIcon({
                  className: 'burial-marker',
                  html: `
                    <div style="
                      width: 6px;
                      height: 6px;
                      background-color: #666;
                      border-radius: 50%;
                      border: 1px solid white;
                      box-shadow: 0 0 4px rgba(0,0,0,0.4);
                    "></div>
                  `,
                  iconSize: [6, 6],
                  iconAnchor: [3, 3]
                })}
                eventHandlers={{
                  mouseover: () => setHoveredMarker(burial.OBJECTID),
                  mouseout: () => setHoveredMarker(null),
                  click: (e) => {
                    // Prevent section click when clicking marker
                    L.DomEvent.stopPropagation(e);
                    handleMarkerClick(burial, index);
                  }
                }}
              >
                <Popup>
                  <div>
                    <h3>{burial.First_Name} {burial.Last_Name}</h3>
                    <p>Section: {burial.Section}</p>
                    <p>Lot: {burial.Lot}</p>
                    <p>Tier: {burial.Tier}</p>
                    <p>Grave: {burial.Grave}</p>
                    <p>Birth: {burial.Birth}</p>
                    <p>Death: {burial.Death}</p>
                  </div>
                </Popup>
              </Marker>
            );
            return marker;
          })}
          
          {/* Search Result Markers - Always on top */}
          {selectedBurials.map((burial, index) => (
            <Marker 
              key={createUniqueKey(burial, index)}
              position={[burial.coordinates[1], burial.coordinates[0]]}
              icon={createNumberedIcon(index + 1, hoveredIndex === index)}
              eventHandlers={{
                mouseover: () => setHoveredIndex(index),
                mouseout: () => setHoveredIndex(null),
                click: () => handleMarkerClick(burial, index)
              }}
              zIndexOffset={1000} // Ensure search results are always on top
            >
              <Popup>
                <div>
                  <h3>{burial.First_Name} {burial.Last_Name}</h3>
                  <p>Section: {burial.Section}</p>
                  <p>Lot: {burial.Lot}</p>
                  <p>Tier: {burial.Tier}</p>
                  <p>Grave: {burial.Grave}</p>
                  <p>Birth: {burial.Birth}</p>
                  <p>Death: {burial.Death}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
