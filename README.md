# SchoolZone – Campus Safety System

This app assists drivers to safely adapt their driving style around areas where children and students are at risk due to traffic.
The app creates geofences around school/university zones from online databases. It warns the driver as they enter the zone depending on the time (school hours) and their speed (>30kmh) so that they are aware and can adapt their speed.
The driver can configure their warning preferences such as the type of zone they want to be warned about (only school or only university…) and also what kind of warning they want to receive (audio, visual…)

## Features
-	Map centered around current user position (OpenStreetMap)
-	Different types of educational institutes (school, college, university…) and other areas where children or students might be at risk due to traffic are displayed on the map (OpenStreetMap POIs, other data resources such as Ajuntamiento de Valencia)
-	Each risk area has a geozone around it
-	When a user moves into a geozone he will be warned based on different criterias (time, speed, etc.)
-	A menu is added where a user can check which risk zones he wants to be warned about

## Implementation
The implementation was done with HTML and JavaScript using the framework cordova which allows multi-platform app development.
Several libraries and APIs were used to populate the map and access the device position and speed for example.

## Images
<img src="https://github.com/user-attachments/assets/76f4d4cb-0efd-4e96-b6ba-4c592f36359c" width="480">
