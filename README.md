# OEBB API Direct Client

This is a modern JavaScript client for the Austrian Federal Railways (ÖBB) API, created to replace the outdated oebb-api npm package.

## Background

The original [oebb-api](https://github.com/mymro/oebb-api) npm package is no longer maintained (last updated in 2017) and has compatibility issues with the current OEBB API. This project provides a modern ES module alternative that works with the current API.

## Features

- Search for train stations by name
- Get live train departures from a station
- Check for train delays and cancellations
- Modern ES module syntax
- Promise-based API
- Works with current ÖBB API (as of May 2025)

## Installation

```bash
npm install request
```

## Usage

### Station Search

```javascript
import { searchStations } from './oebb-direct.js';

// Search for stations matching "Wien"
searchStations('Wien')
  .then(stations => {
    console.log('Found stations:', stations);
    // stations contains array of objects with station details
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Train Departures

```javascript
import { getTrainDepartures } from './oebb-direct.js';

// Get departures from Wien Hauptbahnhof (station ID: 1290401)
getTrainDepartures('1290401')
  .then(departures => {
    // Process train departures
    departures.forEach(train => {
      const hasDelay = train.rt && train.rt.dlm;
      console.log(`${train.pr} to ${train.lastStop}: ${train.ti} ${hasDelay ? `(Delayed by ${train.rt.dlm} min)` : '(On time)'}`);
    });
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Check Train Delay

```javascript
import { checkTrainDelay } from './oebb-direct.js';

// Check if RJ 373 is delayed at Wien Hauptbahnhof (station ID: 1290401)
checkTrainDelay('1290401', 'RJ 373')
  .then(result => {
    if (result.canceled) {
      console.log('Train is canceled');
    } else if (result.isDelayed) {
      console.log(`Train is delayed by ${result.delayMinutes} minutes`);
      console.log(`Scheduled: ${result.scheduledDeparture}`);
      console.log(`Actual: ${result.actualDeparture}`);
    } else {
      console.log('Train is on time');
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

## Command Line Interface

A command-line demo script is included for quick testing:

```bash
# Search for stations
node demo.js search Wien

# Get departures from a station
node demo.js departures 1290401

# Check if a specific train is delayed
node demo.js delay 1290401 "RJ 373"
```

## API Documentation

### searchStations(name, count = 15)

Searches for stations matching the given name.

- **name** (string): Station name to search for
- **count** (number, optional): Maximum number of results to return (default: 15)
- **returns**: Promise resolving to an array of station objects

### getTrainDepartures(stationId, date = new Date())

Gets train departures from a specific station.

- **stationId** (string): The station ID
- **date** (Date, optional): Date for departures (default: current time)
- **returns**: Promise resolving to an array of departure objects

### checkTrainDelay(stationId, trainNumber)

Checks if a specific train is delayed at a station.

- **stationId** (string): The station ID
- **trainNumber** (string): The train number (e.g., "RJ 373")
- **returns**: Promise resolving to an object with delay information

## Data Structure

### Station Object

```javascript
{
  number: "1290401",          // Station ID
  longitude: 16375326,        // Longitude (multiplied by 1,000,000)
  latitude: 48185507,         // Latitude (multiplied by 1,000,000)
  name: "Wien Hbf (U)",       // Station name
  meta: ""                    // Additional information
}
```

### Train Departure Object

```javascript
{
  id: "110842810",            // Internal ID
  ti: "20:58",                // Scheduled departure time
  da: "07.05.2025",           // Departure date
  pr: "RJ 373",               // Train name/number
  st: "Graz Hbf",             // Destination name
  lastStop: "Graz Hbf",       // Last stop
  ati: "23:33",               // Arrival time at final destination
  tr: "7A-B",                 // Platform
  trChg: false,               // Platform changed flag
  rt: {                       // Realtime information (if delayed)
    status: null,             // Status (null or "Ausfall" for canceled)
    dlm: "25",                // Delay in minutes
    dlt: "21:23",             // Actual departure time
    dld: "07.05.2025"         // Actual departure date
  },
  rta: false                  // Additional realtime flag
}
```

## Notes

This library uses the official ÖBB SCOTTY HAFAS API endpoints to retrieve data. The API is not officially documented, but appears to be stable. This is a third-party library and not affiliated with ÖBB.

## License

MIT
