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

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');
}

var map = L.map("map", {zoomControl: false});  // L = Leaflet object ("map" --> id of the html section), zoomControl = switch off zoom buttons


// Tile Map Server (TMS)

// OpenStreetMap

var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";  // s: server, z: zoom level, x: column, y: row


// Attribution

var osmAtt = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";


// Leaflet Layer

var osm = L.tileLayer(osmURL, {attribution: osmAtt});


// Show Map

map.setView([0.0, 0.0], 1); // [0.0, 0.0] = screen center, Zoom level = 1
map.addLayer(osm)


function centerMap(){
	if (point.geometry.coordinates.length === 0){
		showToast("Geolocation not available.");
		return;
	}
	
	map.setView(point.geometry.coordinates.toReversed(), 20);
}
