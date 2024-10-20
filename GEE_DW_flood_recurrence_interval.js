///////////////////////////////////////////////////////////////////////////
//                  GEE Flood Recurrence Interval Mapper                  /
//                   Sentinel-2 Dynamic World Edition                     /
//                       Author: Jacob Nesslage                           /
///////////////////////////////////////////////////////////////////////////

// Define time period and area of interest (AOI)
var start_date = '2016-01-01';
var end_date = '2023-10-26';
var aoi = geometry; // Define your area of interest (geometry)

// Load Dynamic World dataset (Sentinel-2 land cover classification with probabilities)
var dynamicWorld = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                    .filterBounds(aoi)
                    .filterDate(start_date, end_date);

// Define probability thresholds for water and flooded vegetation
var waterThreshold = 0.5; // 50% probability
var floodedVegThreshold = 0.5; // 50% probability

// Function to detect flood using probability thresholds for water and flooded vegetation
function detectFlood(image) {
  var waterProb = image.select('water').gt(waterThreshold); // Water probability > threshold
  var floodedVegProb = image.select('flooded_vegetation').gt(floodedVegThreshold); // Flooded vegetation probability > threshold
  var flood = waterProb.or(floodedVegProb); // Water or flooded vegetation
  return image.addBands(flood.rename('flood')).set('system:time_start', image.get('system:time_start')).clip(aoi);
}

// Apply flood detection to Dynamic World images
var floodCollection = dynamicWorld.map(detectFlood);

// Function to calculate flood recurrence interval
function floodRecurrence(collection, totalDays) {
  // Count the number of flood events per pixel
  var floodCount = ee.ImageCollection(collection.map(function(image) {
    return ee.Image.constant(1).updateMask(image.select('flood')).rename('flood_event_count').clip(aoi);
  })).sum();
  
  // Calculate recurrence interval as total days / number of flood events
  var recurrenceInterval = floodCount.gt(0) // Avoid division by zero
    .multiply(totalDays)
    .divide(floodCount)
    .rename('flood_recurrence_interval');
  
  return recurrenceInterval;
}

// Calculate the number of days between start date and end date
var totalDays = ee.Date(end_date).difference(ee.Date(start_date), 'day');

// Calculate the flood recurrence interval
var floodRecurrenceImage = floodRecurrence(floodCollection, totalDays);

// Add the flood recurrence interval layer to the map
Map.addLayer(floodRecurrenceImage, {min: 0, max: totalDays.getInfo(), palette: ['white', 'green']}, 'Flood Recurrence Interval');

// Center the map on the area of interest
Map.centerObject(aoi, 10);
