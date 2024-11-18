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

onDeviceReady();

onDeviceReady();

function onDeviceReady() {
    // Initialize the map and features once the device is ready
    initMap();
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
    schoolsLayer = L.layerGroup();
    universitiesLayer = L.layerGroup();

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
            node["amenity"="university"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
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

async function updateMarkers() {
    const bounds = map.getBounds();
    const elements = await fetchEducationalInstitutions(bounds);

    // Clear existing markers
    schoolsLayer.clearLayers();
    universitiesLayer.clearLayers();

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