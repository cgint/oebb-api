#!/usr/bin/env node

import { searchStations, searchAndDisplayStations, getTrainDepartures, checkTrainDelay, trackTrainJourney } from './oebb-direct.js';

// Get the command and arguments
const command = process.argv[2] || 'search';
const arg1 = process.argv[3] || 'Wien';
const arg2 = process.argv[4];

// Handle different commands
switch(command) {
  case 'search':
    // Search for stations
    console.log(`Searching for stations matching "${arg1}"...`);
    searchAndDisplayStations(arg1)
      .then(stations => {
        console.log('\nFull station details:');
        console.log(JSON.stringify(stations, null, 2));
      })
      .catch(error => {
        console.error('Failed to search for stations:', error);
        process.exit(1);
      });
    break;
    
  case 'departures':
    // Get departures from a station
    const stationId = arg1;
    console.log(`Getting departures from station ID: ${stationId}`);
    getTrainDepartures(stationId)
      .then(departures => {
        console.log(`Found ${departures.length} departures:`);
        departures.forEach(train => {
          // Check if train has real-time information
          const hasDelay = train.rt && train.rt.dlm;
          const delayInfo = hasDelay ? 
            ` (DELAYED by ${train.rt.dlm} min)` : 
            ' (on time)';
          const destination = train.lastStop || 'Unknown';
          console.log(`- ${train.pr || 'Unknown'} to ${destination}: ${train.ti}${delayInfo} - Platform: ${train.tr || 'N/A'}`);
        });
        
        // Print a few full train details as sample
        console.log('\nSample train details:');
        if (departures.length > 0) {
          console.log(JSON.stringify(departures[0], null, 2));
        }
      })
      .catch(error => {
        console.error('Failed to get departures:', error);
        process.exit(1);
      });
    break;
    
  case 'delay':
    // Check if a specific train is delayed
    const delayStationId = arg1;
    const trainNumber = arg2;
    
    if (!trainNumber) {
      console.error('Missing train number! Usage: node demo.js delay [stationId] [trainNumber]');
      process.exit(1);
    }
    
    console.log(`Checking delay for train ${trainNumber} at station ID: ${delayStationId}`);
    checkTrainDelay(delayStationId, trainNumber)
      .then(result => {
        if (result.canceled) {
          console.log(`🚫 Train ${trainNumber} is CANCELED`);
        } else if (result.isDelayed) {
          console.log(`🚨 Train ${trainNumber} is DELAYED by ${result.delayMinutes} minutes`);
          console.log(`Scheduled departure: ${result.scheduledDeparture}`);
          console.log(`Actual departure: ${result.actualDeparture}`);
        } else {
          console.log(`✅ Train ${trainNumber} is on time`);
          console.log(`Departure: ${result.scheduledDeparture}`);
        }
        console.log(`Direction: ${result.direction}`);
        console.log(`Platform: ${result.platform}`);
        
        console.log('\nFull train details:');
        console.log(JSON.stringify(result.train, null, 2));
      })
      .catch(error => {
        console.error('Failed to check train delay:', error);
        process.exit(1);
      });
    break;

  case 'track':
    // Track a train's journey through multiple stations
    const trainName = arg1;
    const stationIdsArg = arg2;
    
    if (!trainName) {
      console.error('Missing train number! Usage: node demo.js track [trainNumber] [stationId1,stationId2,...]');
      process.exit(1);
    }
    
    if (!stationIdsArg) {
      console.error('Missing station IDs! Usage: node demo.js track [trainNumber] [stationId1,stationId2,...]');
      process.exit(1);
    }
    
    const stationIds = stationIdsArg.split(',');
    
    console.log(`Tracking train ${trainName} through stations: ${stationIds.join(', ')}`);
    trackTrainJourney(trainName, stationIds)
      .then(results => {
        console.log(`\nResults for train ${trainName}:`);
        
        let currentLocation = 'unknown';
        let lastDeparted = null;
        let nextArrival = null;
        
        results.forEach(station => {
          const stationId = station.stationId;
          
          if (station.found) {
            const statusIcon = station.status === 'departed' ? '✓' : 
                              station.status === 'delayed' ? '🕒' : '⏳';
            
            console.log(`${statusIcon} Station ID ${stationId}: ${station.status.toUpperCase()}`);
            console.log(`  Scheduled departure: ${station.scheduledDeparture}`);
            
            if (station.delayMinutes > 0) {
              console.log(`  Actual departure: ${station.actualDeparture} (${station.delayMinutes} min delay)`);
            }
            
            console.log(`  Platform: ${station.platform}`);
            
            if (station.status === 'departed') {
              lastDeparted = {
                stationId,
                time: station.actualDeparture
              };
            } else if (station.status === 'scheduled' || station.status === 'delayed') {
              if (!nextArrival) {
                nextArrival = {
                  stationId,
                  time: station.actualDeparture
                };
              }
            }
          } else {
            console.log(`❌ Station ID ${stationId}: Train not found`);
          }
        });
        
        console.log('\nCurrent status:');
        if (lastDeparted) {
          console.log(`- Last departure: Station ${lastDeparted.stationId} at ${lastDeparted.time}`);
          
          if (nextArrival) {
            console.log(`- Current location: Between stations ${lastDeparted.stationId} and ${nextArrival.stationId}`);
            console.log(`- Next arrival: Station ${nextArrival.stationId} at ${nextArrival.time}`);
          } else {
            console.log(`- Train has departed from all checked stations. Last seen at ${lastDeparted.stationId}`);
          }
        } else if (nextArrival) {
          console.log(`- Has not yet departed from first station (${nextArrival.stationId})`);
          console.log(`- Expected departure: ${nextArrival.time}`);
        } else {
          console.log('- Unable to determine train location');
        }
      })
      .catch(error => {
        console.error('Failed to track train journey:', error);
        process.exit(1);
      });
    break;
    
  default:
    console.log(`
Usage:
  node demo.js search [stationName]       - Search for stations
  node demo.js departures [stationId]     - Get departures from a station
  node demo.js delay [stationId] [train]  - Check if a specific train is delayed
  node demo.js track [train] [stationIds] - Track a train through multiple stations
  
Examples:
  node demo.js search Wien
  node demo.js departures 1290401
  node demo.js delay 1290401 "RJ 840"
  node demo.js track "RJ 840" 1290401,8100008,8100013
`);
    break;
} 