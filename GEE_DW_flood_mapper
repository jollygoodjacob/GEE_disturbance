///////////////////////////////////////////////////////////////////////////
//                     GEE Flood Disturbance Mapper                       /
//                   Sentinel-2 Dyamic World Edition                      /
//                       Author: Jacob Nesslage                           /
///////////////////////////////////////////////////////////////////////////
// PURPOSE: Flood detection using Sentinel-2 data and Dynamic World.
// This GEE script calculates two important metrics that are relevant for
// ecological studies of floodplains - duration of last flood event and
// time since last flood, while considering both water and flooded vegetation.

// Define time period and area of interest (AOI)
var start_date = '2022-01-01';
var end_date = '2023-12-31';
var aoi = geometry;

// Load Sentinel-2 Surface Reflectance dataset
var sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterBounds(aoi) // Filter by AOI
                  .filterDate(start_date, end_date)
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

// Load Dynamic World dataset (Sentinel-2 land cover classification with probabilities)
var dynamicWorld = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                    .filterBounds(aoi)
                    .filterDate(start_date, end_date);

// Define threshold values for probability of water and flooded vegetation
var waterThreshold = 0.5; // 50% probability
var floodedVegThreshold = 0.5; // 50% probability

// Function to detect flood using probability thresholds
function detectFlood(image) {
  var waterProb = image.select('water').gt(waterThreshold); // Water probability > threshold
  var floodedVegProb = image.select('flooded_vegetation').gt(floodedVegThreshold); // Flooded vegetation probability > threshold
  var flood = waterProb.or(floodedVegProb); // Water or flooded vegetation
  
  return image.addBands(flood.rename('flood')).set('system:time_start', image.get('system:time_start')).clip(aoi); // Clip to AOI
}

// Map flood detection over all Dynamic World images and clip to AOI
var floodCollection = dynamicWorld.map(detectFlood);

// Load SRTM DEM for slope calculation and clip to AOI
var dem = ee.Image('USGS/SRTMGL1_003').clip(aoi);
var slope = ee.Terrain.slope(dem);

// Filter out high slope areas (e.g., greater than 10 degrees)
var lowSlope = slope.lt(10);

// Load JRC Global Surface Water dataset and get water occurrence
var waterOccurrence = ee.Image('JRC/GSW1_3/GlobalSurfaceWater').select('occurrence');

// Permanent water mask (areas with 100% water occurrence)
//var permanentWater = waterOccurrence.eq(100);

// Apply both the slope and permanent water masks
var maskedFloodCollection = floodCollection.map(function(image) {
  return image.updateMask(lowSlope).clip(aoi);
  //return image.updateMask(lowSlope).updateMask(permanentWater.not()).clip(aoi);
});

// Function to calculate the time since the last flood, relative to end date
function timeSinceLastFlood(collection) {
  // Map over each image and calculate the time since flood for that image
  var daysSinceFloodCollection = collection.map(function(image) {
    var timeDifference = ee.Date(end_date).difference(ee.Date(image.get('system:time_start')), 'day');
    return ee.Image.constant(timeDifference).float().rename('days_since_last_flood')
              .updateMask(image.select('flood')).clip(aoi);
  });
  
  // Use mosaic to get the most recent flood event at each pixel
  return daysSinceFloodCollection.mosaic();
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

// Calculate the number of days between start date and end date
var daysBetween = ee.Date(end_date).difference(ee.Date(start_date), 'day').getInfo(); // Get client-side value

// Add layers to the map with dynamically calculated max values
Map.addLayer(timeSinceFloodImage, {min: 0, max: daysBetween, palette: ['white', 'red']}, 'Time Since Last Flood');
Map.addLayer(floodDurationImage, {min: 0, max: 60, palette: ['white', 'blue']}, 'Flood Duration');

// Center the map on the area of interest
Map.centerObject(aoi, 10);
