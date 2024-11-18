/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);
var map;  // Base Map
var schoolsLayer; // Overlay Map
var universitiesLayer; // Overlay Map
var schoolsLayerCheckbox = true;
var universityLayerCheckbox = true;
var watchId = null; // Store position watch ID
var isTracking = false; // Track if we're following user position
var userMarker = null; // Marker for user's position
var trackingButton; // Control button for tracking



function haversineDist(lat1, lon1, lat2, lon2) {
    // source: https://www.movable-type.co.uk/scripts/latlong.html
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180; // φ, λ in radians
    const phi2 = lat2 * Math.PI/180;
    const d_phi = (lat2-lat1) * Math.PI/180;
    const d_lam = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(d_phi/2) * Math.sin(d_phi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(d_lam/2) * Math.sin(d_lam/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

function onDeviceReady() {
    // Initialize the map and features once the device is ready
    initMap();
    console.log(haversineDist(39.466, -0.375, 39.978, -0.055)); // valencia - castellon distance
}

function initMap() {
    // Initialize the map
    map = L.map('map', {zoomControl: false});

    // Add OpenStreetMap tile layer
    var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";  // s: server, z: zoom level, x: column, y: row
    var osmAtt = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
    var osm = L.tileLayer(osmURL, {attribution: osmAtt});

    map.setView([39.48, -0.34], 10);
    map.addLayer(osm);

    // Create layer groups
    schoolsLayer = L.layerGroup().addTo(map);
    universitiesLayer = L.layerGroup().addTo(map);

    // Add controls and event listeners
    setupMapControls();
    
    // Initial load of markers
    updateMarkers();

    // Create user location marker with custom style
    userMarker = L.circleMarker([0, 0], {
        radius: 8,
        fillColor: "#3388ff",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    });

    // Tracking (Toggle On/Off)
    addTrackingControl();

    // Try to get user's location
    autocenter();
}

// Button to toggle on and off
function addTrackingControl() {
    const TrackingControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            trackingButton = L.DomUtil.create('a', 'leaflet-control-tracking', container);
            trackingButton.href = '#';
            trackingButton.innerHTML = '📍'; // Location pin emoji
            trackingButton.title = 'Track my location';
            trackingButton.style.fontSize = '18px';
            trackingButton.style.textAlign = 'center';
            trackingButton.style.lineHeight = '30px';
            trackingButton.style.backgroundColor = 'white';
            trackingButton.style.width = '30px';
            trackingButton.style.height = '30px';
            trackingButton.style.display = 'block';

            L.DomEvent.on(trackingButton, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                toggleTracking();
            });

            return container;
        }
    });

    map.addControl(new TrackingControl());
}

function toggleTracking() {
    isTracking = !isTracking;
    
    if (isTracking) {
        // Start tracking
        trackingButton.style.backgroundColor = '#3388ff';
        trackingButton.style.color = 'white';
        startTracking();
    } else {
        // Stop tracking
        trackingButton.style.backgroundColor = 'white';
        trackingButton.style.color = 'black';
        stopTracking();
    }
}

function startTracking() {
    if (!watchId) {
        watchId = navigator.geolocation.watchPosition(
            updatePosition,
            handleLocationError,
            {
                maximumAge: 2000,
                timeout: 5000,
                enableHighAccuracy: true
            }
        );
    }
}

function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
    // Update user marker position
    userMarker.setLatLng([lat, lng]);
    
    // Add marker to map if not already added
    if (!map.hasLayer(userMarker)) {
        userMarker.addTo(map);
    }

    // Only center map if tracking is enabled
    if (isTracking) {
        map.setView([lat, lng], map.getZoom());
    }
}

function handleLocationError(error) {
    console.error('Error getting location:', error);
    // Optionally show error to user
    if (error.code === error.PERMISSION_DENIED) {
        alert('Please enable location services to use tracking features.');
        stopTracking();
        isTracking = false;
        trackingButton.style.backgroundColor = 'white';
        trackingButton.style.color = 'black';
    }
}

function autocenter() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 13);
                
                // Set initial user marker position
                userMarker.setLatLng([lat, lng]);
                userMarker.addTo(map);
                
                updateMarkers();
            },
            handleLocationError
        );
    }
}

function setupMapControls() {
    // Add legend
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `
            <i style="background: #e74c3c"></i>Schools<br>
            <i style="background: #2980b9"></i>Universities
        `;
        return div;
    };
    legend.addTo(map);

    // Add layer controls
    const overlayMaps = {
        "Schools": schoolsLayer,
        "Universities": universitiesLayer
    };
    L.control.layers(null, overlayMaps).addTo(map);

    layer_selector = document.getElementsByClassName("leaflet-control-layers-selector")
    console.log(layer_selector)
    for (let i = 0; i < layer_selector.length; i++) {
        layer_selector[i].addEventListener('change', (event) => {
            if (event.currentTarget.checked) {
              if (i == 0){ schoolsLayerCheckbox = true;}
              else if (i == 1) {universityLayerCheckbox = true;}
            } else {
                if (i == 0){ schoolsLayerCheckbox = false;}
                else if (i == 1) {universityLayerCheckbox = false;}
            }
            console.log("schoolsLayerCheckbox: " + schoolsLayerCheckbox + "\n universityLayerCheckbox: " + universityLayerCheckbox)
          })
    }
    // Update markers when map moves
    map.on('moveend', updateMarkers);
}

// Icons for different types of institutions
const schoolIcon = L.divIcon({
    html: '<div style="background-color: #e74c3c; width: 10px; height: 10px; border-radius: 50%;"></div>',
    className: 'custom-div-icon'
});

const universityIcon = L.divIcon({
    html: '<div style="background-color: #2980b9; width: 10px; height: 10px; border-radius: 50%;"></div>',
    className: 'custom-div-icon'
});

async function fetchEducationalInstitutions(bounds) {
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="school"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
            relation["amenity"="university"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out body;
        >;
        out skel qt;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });
        const data = await response.json();
        return data.elements;
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}

function sortPOIsByDistance(pois, currentLat, currentLon) {
    return pois.map(poi => ({
        ...poi,
        distance: haversineDist(currentLat, currentLon, poi.lat, poi.lon)
    })).sort((a, b) => a.distance - b.distance);
}

async function updateMarkers() {
    const bounds = map.getBounds();
    var elements = await fetchEducationalInstitutions(bounds);

    // Clear existing markers
    schoolsLayer.clearLayers();
    universitiesLayer.clearLayers();

    elements = sortPOIsByDistance(elements, 39.466, -0.375); // TODO: update with current position
    console.log(elements);

    elements.forEach(element => {
        
        if (element.type === 'node') {
            const marker = L.marker([element.lat, element.lon], {
                icon: element.tags.amenity === 'school' ? schoolIcon : universityIcon
            });

            const popupContent = `
                <strong>${element.tags.name || 'Unnamed'}</strong><br>
                Type: ${element.tags.amenity}<br>
                ${element.tags.operator ? 'Operator: ' + element.tags.operator + '<br>' : ''}
            `;

            marker.bindPopup(popupContent);

            if (element.tags.amenity === 'school') {
                schoolsLayer.addLayer(marker);
            } else {
                universitiesLayer.addLayer(marker);
            }
        }
    });
}

function autocenter() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                map.setView([position.coords.latitude, position.coords.longitude], 13);
                updateMarkers();
            },
            function(error) {
                console.error('Error getting location:', error);
            }
        );
    }
}