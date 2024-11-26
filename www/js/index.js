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
var allElements; // all schools and universities
var schoolsLayer; // Overlay Map
var universitiesLayer; // Overlay Map
var schoolsLayerCheckbox = true;
var universityLayerCheckbox = true;
var watchId = null; // Store position watch ID
var isTracking = false; // Track if we're following user position
var userMarker = null; // Marker for user's position
var trackingButton; // Control button for tracking
const addedRadiusNode = 20 // meters of added Radius to nodes for the alarm trigger
const addedRadiusWayRel = 10 // meters of added Radius to ways and relations for the alarm trigger

//onDeviceReady();
var nearestElement = null;



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
}

function initMap() {
    // Initialize the map
    map = L.map('map', {zoomControl: false});

    // Add OpenStreetMap tile layer
    var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";  // s: server, z: zoom level, x: column, y: row
    var osmAtt = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
    var osm = L.tileLayer(osmURL, {attribution: osmAtt});
    map.addLayer(osm);

     // Try to get user's location
    try {
        autocenter();
    }
    catch {
        map.setView([39.48, -0.34], 15);
        updateMarkers(null);
    }

    // Create layer groups
    schoolsLayer = L.layerGroup().addTo(map);
    universitiesLayer = L.layerGroup().addTo(map);

    // Add controls and event listeners
    setupMapControls();
    
    // Initial load of markers


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

function handleSchoolZoneAlert() {
    var currentElement = null;
    console.log(allElements);

    for(var i = 0; i < allElements.length; i++){
        if (allElements[i].distance < 0.0) {
            if (allElements[i].tags.amenity === 'school' && schoolsLayerCheckbox && currentElement === null) {
                currentElement = allElements[i];
                break;
            }
            else if (allElements[i].tags.amenity === 'university' && universityLayerCheckbox && currentElement === null) {
                currentElement = allElements[i];
                break;
            }
        }
        else {
            break;
        }
    }

    
    // If we're within the school zone radius and weren't previously
    if (currentElement != null && nearestElement === null) {
        // Set current school zone
        nearestElement = currentElement;
        
        // Show alert box with simpler styling
        const alertBox = document.getElementById('zone_alert');
        alertBox.style.display = 'flex';  // Changed to flex
        alertBox.style.alignItems = 'center';
        alertBox.style.justifyContent = 'center';
        alertBox.style.gap = '10px';
        alertBox.innerHTML = '⚠️ School Zone! <br>'+currentElement.tags.name;
        
        // Vibrate twice
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500]);
        }
        
        // Beep
        playBeep();
    }
    // If we're outside the radius of our current school zone
    else if (nearestElement !== null && currentElement === null) {
        const alertBox = document.getElementById('zone_alert');
        alertBox.style.display = 'none';
        nearestElement = null;
    }
}

// Function to play beep sound twice
function playBeep() {
    const beep = new Audio('beep.wav');  // Make sure beep.wav is in your www folder
    beep.play().catch(err => console.error('Error playing beep:', err));
}

function toggleTracking() {
    isTracking = !isTracking;
    
    if (isTracking) {
        // Start tracking
        trackingButton.style.backgroundColor = '#3388ff';
        trackingButton.style.color = 'white';
        //alert("Position tracking started!");
        
        startTracking();
    } else {
        // Stop tracking
        trackingButton.style.backgroundColor = 'white';
        trackingButton.style.color = 'black';
        //alert("Position tracking stopped!");
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
    // Check for school zone alerts
    updateMarkers(position);
    
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
                map.setView([lat, lng], 15);
                
                // Set initial user marker position
                userMarker.setLatLng([lat, lng]);
                userMarker.addTo(map);
                
                updateMarkers(position);
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
    //console.log(layer_selector)
    for (let i = 0; i < layer_selector.length; i++) {
        layer_selector[i].addEventListener('change', (event) => {
            if (event.currentTarget.checked) {
              if (i == 0){ schoolsLayerCheckbox = true;}
              else if (i == 1) {universityLayerCheckbox = true;}
            } else {
                if (i == 0){ schoolsLayerCheckbox = false;}
                else if (i == 1) {universityLayerCheckbox = false;}
            }
            //console.log("schoolsLayerCheckbox: " + schoolsLayerCheckbox + "\n universityLayerCheckbox: " + universityLayerCheckbox)
          })
    }
    // Update markers when map moves
    map.on('zoomend', function() {
        updateMarkers(null);
    });

    map.on('dragend', function() {
        updateMarkers(null);
    });
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
    const boundString = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`
    const query = `
        [out:json][timeout:25];
        (
            way[amenity=school](${boundString});
            node[amenity=school](${boundString});
            rel[amenity=school](${boundString});
            way[amenity=university](${boundString});
            node[amenity=university](${boundString});
            rel[amenity=university](${boundString});
        );
        out bb;
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

function calculateRadius(pois) {
    return pois.map(poi => 
        {   
            if (poi.type == "node") {
                poi.radius = addedRadiusNode
            }
            else if (poi.type == "way" || poi.type == "relation") {
                var diag = (haversineDist(poi.bounds.maxlat, poi.bounds.maxlon, poi.bounds.minlat, poi.bounds.minlon)) 
                poi.lat = poi.bounds.minlat + (poi.bounds.maxlat - poi.bounds.minlat)/2.0
                poi.lon = poi.bounds.minlon + (poi.bounds.maxlon - poi.bounds.minlon)/2.0
                poi.radius = diag/2.0 + addedRadiusWayRel
            }
        return poi;  
    })
}

function sortPOIsByDistance(pois, position) {
    /*
    console.log(position);
    if(position != null){
        console.log(position === null ? "position is null" : haversineDist(position.coords.latitude, position.coords.longitude, pois[0].lat, pois[0].lon) - pois[0].radius);
    }
        */
    return pois.map(poi => ({
        ...poi,
        distance: position === null ? Infinity : haversineDist(position.coords.latitude, position.coords.longitude, poi.lat, poi.lon) - poi.radius // negative distance means you are inside the radius
    })).sort((a, b) => a.distance - b.distance);
}

async function updateMarkers(position) {
    const bounds = map.getBounds();
    var elements = await fetchEducationalInstitutions(bounds);
    elements = calculateRadius(elements)

    // Clear existing markers
    schoolsLayer.clearLayers();
    universitiesLayer.clearLayers();
    

    allElements = sortPOIsByDistance(elements, position); 
    //console.log(allElements);

    allElements.forEach(element => {
        
        if (element.type === 'node' || element.type === 'way' || element.type === 'relation') {
            const marker = L.marker([element.lat, element.lon], {
                icon: element.tags.amenity === 'school' ? schoolIcon : universityIcon
            });
            const circleAroundMarker = L.circle([element.lat, element.lon], element.radius, {
                color: element.tags.amenity === 'school' ? "#e74c3c" : "#2980b9"
            } );

            const popupContent = `
                <strong>${element.tags.name || 'Unnamed'}</strong><br>
                Type: ${element.tags.amenity}<br>
                ${element.tags.operator ? 'Operator: ' + element.tags.operator + '<br>' : ''}
            `;

            marker.bindPopup(popupContent);

            if (element.tags.amenity === 'school') {
                schoolsLayer.addLayer(marker);
                schoolsLayer.addLayer(circleAroundMarker);
            } else {
                universitiesLayer.addLayer(marker);
                universitiesLayer.addLayer(circleAroundMarker);
            }
        }
    });
    handleSchoolZoneAlert();
}
