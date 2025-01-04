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
var layer_selector;
var previousElement = null;
var controlLayers = null;
var vehicleSpeedKph = 0.0;
const vehicleSpeedLimitKph = 30.0;
let speed_number = document.getElementById('speed_number');


onDeviceReady();


// Unused
function haversineDistance(lat1, lon1, lat2, lon2){
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

// Using Turf Library
function calculateDistance(lat1, lon1, lat2, lon2) {
    const distance = turf.distance(turf.point([lon1, lat1]), turf.point([lon2, lat2]), { units: 'meters' });
    return distance
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
    addCheckboxListeners();
    
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

    //console.log("Distance Turf: " + calculateDistance(55,-24,44,31))
    //console.log("Distance Haver: " + haversineDistance(55,-24,44,31))

   
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
            trackingButton.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
            trackingButton.title = 'Track my location';
            trackingButton.style.fontSize = '25px';
            trackingButton.style.textAlign = 'center';
            trackingButton.style.lineHeight = '36px';
            trackingButton.style.width = '50px';
            trackingButton.style.height = '50px';
            trackingButton.style.borderRadius = '50%';
            trackingButton.style.backgroundColor = 'white';
            trackingButton.style.display = 'flex';
            trackingButton.style.justifyContent = 'center';
            trackingButton.style.alignItems = 'center';

            L.DomEvent.on(trackingButton, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                toggleTracking();
            });

            return container;
        }
    });

    map.addControl(new TrackingControl());
    startTracking();
}

function handleSchoolZoneAlert() {
    var currentElement = null;
    var checkboxes = controlLayers.getOverlays();
    schoolsLayerCheckbox = checkboxes.Schools;
    universityLayerCheckbox = checkboxes.Universities;
    console.log("schoolsLayerCheckbox: " + schoolsLayerCheckbox + "\n universityLayerCheckbox: " + universityLayerCheckbox)
    var changedZone = false;
    var enteredZone = false;
    var leftZone = false;

    for(var i = 0; i < allElements.length; i++){
        // allElements is sorted by distance --> negative distance means that we are in the radius of that element
        if (allElements[i].distance < 0.0) {
            if (allElements[i].tags.amenity === 'school' && schoolsLayerCheckbox && vehicleSpeedKph > vehicleSpeedLimitKph) {
                currentElement = allElements[i];
                if(previousElement != allElements[i]){
                    changedZone = true;
                }
                if(previousElement === null){
                    enteredZone = true;
                }
                break;
            }
            else if (allElements[i].tags.amenity === 'university' && universityLayerCheckbox && vehicleSpeedKph > vehicleSpeedLimitKph) {
                currentElement = allElements[i];
                if(previousElement != allElements[i]){
                    changedZone = true;
                }
                if(previousElement === null){
                    enteredZone = true;
                }
                break;
            }
        }
        else {
            break;
        }
    }

    leftZone = (previousElement !== null && currentElement === null);


    if(changedZone){
        // If we changed the nearest zone, update the text popup
        previousElement = currentElement;
        const alertBox = document.getElementById('zone_alert');
        alertBox.style.display = 'flex';
        alertBox.style.alignItems = 'center';
        alertBox.style.justifyContent = 'center';
        alertBox.style.gap = '10px';  /* Increased from 25px */
        alertBox.style.flexDirection = 'column'; /* Added to stack the content vertically */
        alertBox.innerHTML = '<div style="font-size: 18px">Faster than ' + vehicleSpeedLimitKph + ' km/h </div>' + 
        '<div style="font-size: 22px">⚠️ School Zone! ⚠️</div>' +
                            '<div style="font-size: 12px">' + currentElement.tags.name + '</div>';
    }
    
    // If we're within the school zone radius and weren't in any zone previously, play the sound and vibrate 
    if (enteredZone) {
        // Set current school zone
        previousElement = currentElement;
        
        // Vibrate twice
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500]);
        }
        
        // Beep
        playBeep();
    }
    // If we're outside the radius of our any school zone, remove the text popup
    else if (leftZone) {
        const alertBox = document.getElementById('zone_alert');
        alertBox.style.display = 'none';
        previousElement = null;
    }

}

// Function to play beep sound twice
function playBeep() {
    const beep = new Audio('beep.wav');  // Make sure beep.wav is in your www folder
    //beep.play().catch(err => console.error('Error playing beep:', err));
}

// Update the toggle tracking function to modify the icon color when active
function toggleTracking() {
    isTracking = !isTracking;
    
    if (isTracking) {
        // Start tracking
        trackingButton.style.backgroundColor = '#3388ff';
        trackingButton.querySelector('i').style.color = 'white';
    } else {
        // Stop tracking
        trackingButton.style.backgroundColor = 'white';
        trackingButton.querySelector('i').style.color = '#333';
        //alert("Position tracking stopped!");
        //stopTracking()
    }
}

function startTracking() {
    if (!watchId) {
        watchId = navigator.geolocation.watchPosition(
            updatePosition,
            handleLocationError,
            {
                maximumAge: 4000,
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


function updateSpeed(speed) {
    if (speed === null){
        speed = 0.0
    }
    speed *= 3.6;
    vehicleSpeedKph = speed;
    speed_number.textContent = speed.toFixed(0);
}

function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const speed = position.coords.speed;
    updateSpeed(speed);

    console.log("Speed: " + speed)
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
    //console.log(layer_selector)
    
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


    // Add a function to the leaflet control layers which allows to check whether the control layers are active or inactive
    // This function checks for each control if it is an overlay and then checks if it is currently present on the map
    L.Control.Layers.include({
        getOverlays: function() {
          // create hash to hold all layers
          var control, layers;
          layers = {};
          control = this;
      
          // loop thru all layers in control
          control._layers.forEach(function(obj) {
            var layerName;
      
            // check if layer is an overlay
            if (obj.overlay) {
              // get name of overlay
              layerName = obj.name;
              // store whether it's present on the map or not
              return layers[layerName] = control._map.hasLayer(obj.layer);
            }
          });
      
          return layers;
        }
      });


      controlLayers = L.control.layers(null, overlayMaps).addTo(map);

      console.log(controlLayers.getOverlays());




    // Update markers when map moves
    map.on('zoomend', function() {
        updateMarkers(null);
    });

    map.on('dragend', function() {
        updateMarkers(null);
    });
}

function addCheckboxListeners(){   
    
    /*
    layer_selector = document.getElementsByClassName("leaflet-control-layers-selector")
    console.log("checkboxes found: ");
    console.log(layer_selector)
    for (let i = 0; i < layer_selector.length; i++) {
        layer_selector[i].addEventListener('change', (event) => {
            console.log("checkbox action:");
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
          */


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
    // calculate the radius depending on the geometry of the school or university
    // if it is a node, it gets a fixed radius
    // if it is a way or relation, the radius is calculated based on the size of the school or university
    return pois.map(poi => 
        {   
            if (poi.type == "node") {
                poi.radius = addedRadiusNode
            }
            else if (poi.type == "way" || poi.type == "relation") {
                var diag = (calculateDistance(poi.bounds.maxlat, poi.bounds.maxlon, poi.bounds.minlat, poi.bounds.minlon)) 
                poi.lat = poi.bounds.minlat + (poi.bounds.maxlat - poi.bounds.minlat)/2.0
                poi.lon = poi.bounds.minlon + (poi.bounds.maxlon - poi.bounds.minlon)/2.0
                poi.radius = diag/2.0 + addedRadiusWayRel
            }
        return poi;  
    })
}

function sortPOIsByDistance(pois, position) {
    return pois.map(poi => ({
        ...poi,
        distance: position === null ? Infinity : calculateDistance(position.coords.latitude, position.coords.longitude, poi.lat, poi.lon) - poi.radius // negative distance means you are inside the radius
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
