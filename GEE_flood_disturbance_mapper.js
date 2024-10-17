///////////////////////////////////////////////////////////////////////////
//                     GEE Flood Disturbance Mapper                       /
//                         Sentinel-2 Edition                             /
//                       Author: Jacob Nesslage                           /
///////////////////////////////////////////////////////////////////////////
// PURPOSE: Flood detection using Sentinel-2 data in Google Earth Engine.
// This GEE script calculates two important metrics that are relevant for
// ecological studies of floodplains - duration of last flood event and
// time since last flood.

// Define time period and area of interest (AOI)
var start_date = '2023-01-01';
var end_date = '2023-12-31';
var aoi = geometry;

// Load Sentinel-2 Surface Reflectance dataset
var sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterBounds(aoi) // Filter by AOI
                  .filterDate(start_date, end_date)
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

// Flood detection using NDWI
function detectFlood(image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  var flood = ndwi.gt(0.00); // Adjust threshold based on your area
  return image.addBands(flood.rename('flood')).set('system:time_start', image.get('system:time_start')).clip(aoi); // Clip to AOI
}

// Map flood detection over all images and clip to AOI
var floodCollection = sentinel2.map(detectFlood);

// Load SRTM DEM for slope calculation and clip to AOI
var dem = ee.Image('USGS/SRTMGL1_003').clip(aoi);
var slope = ee.Terrain.slope(dem);

// Filter out high slope areas (e.g., greater than 10 degrees)
var lowSlope = slope.lt(10);

// Load JRC Global Surface Water dataset and get water occurrence
var waterOccurrence = ee.Image('JRC/GSW1_3/GlobalSurfaceWater').select('occurrence');

// Permanent water mask (areas with 100% water occurrence)
var permanentWater = waterOccurrence.eq(100);

// Apply both the slope and permanent water masks
var maskedFloodCollection = floodCollection.map(function(image) {
  return image.updateMask(lowSlope).updateMask(permanentWater.not()).clip(aoi);
});

// Function to calculate the time since last flood
function timeSinceLastFlood(collection) {
  var daysSinceFlood = ee.ImageCollection(collection.map(function(image) {
    // Calculate time difference in days
    var timeDifference = ee.Date(end_date).difference(ee.Date(image.get('system:time_start')), 'day');
    // Cast the time difference to a consistent float type and clip to AOI
    return ee.Image.constant(timeDifference).float().rename('days_since_flood').updateMask(image.select('flood')).clip(aoi);
  }));
  
  return daysSinceFlood.mosaic(); // Mosaic to get the latest flooded pixels
}

// Function to calculate the duration of the last flood
function floodDuration(collection) {
  var duration = ee.ImageCollection(collection.map(function(image) {
    var durationDays = ee.Image.constant(1).rename('flood_duration').updateMask(image.select('flood')).clip(aoi); // Clip to AOI
    return durationDays;
  })).sum(); // Sum over time to get flood duration in days
  
  return duration;
}

// Calculate time since last flood and flood duration
var timeSinceFloodImage = timeSinceLastFlood(maskedFloodCollection);
var floodDurationImage = floodDuration(maskedFloodCollection);

// Add layers to map
Map.addLayer(timeSinceFloodImage, {min: 0, max: 365, palette: ['white', 'red']}, 'Time Since Last Flood');
Map.addLayer(floodDurationImage, {min: 0, max: 60, palette: ['white', 'blue']}, 'Flood Duration');

// Center the map on the area of interest
Map.centerObject(aoi, 10);
