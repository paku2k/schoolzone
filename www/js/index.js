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

onDeviceReady();


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

    // Try to get user's location
    autocenter();
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