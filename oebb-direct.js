/**
 * Direct OEBB API client
 * 
 * This is a clean implementation that works with the current OEBB API,
 * bypassing the outdated oebb-api package
 */

import request from 'request';

/**
 * Search for stations by name
 * @param {string} name - The station name to search for
 * @param {number} count - Maximum number of results (default: 15)
 * @returns {Promise<Array>} - Array of station objects
 */
export function searchStations(name, count = 15) {
    return authenticate()
        .then(auth => {
            return getStations(auth, name, count);
        });
}

/**
 * Get train departures from a station
 * @param {string} stationId - The station ID (e.g., "1290401" for Wien Hbf)
 * @param {Date} [date] - Optional date for departures (defaults to current time)
 * @returns {Promise<Array>} - Array of departure objects
 */
export function getTrainDepartures(stationId, date = new Date()) {
    return authenticate()
        .then(auth => {
            return getBoardData(auth, stationId, date);
        });
}

/**
 * Check if a specific train is delayed
 * @param {string} stationId - The station ID (e.g., "1290401" for Wien Hbf)
 * @param {string} trainNumber - The train number (e.g., "RJ 840")
 * @returns {Promise<Object>} - Train information including delay status
 */
export function checkTrainDelay(stationId, trainNumber) {
    return authenticate()
        .then(auth => {
            return getBoardData(auth, stationId)
                .then(departures => {
                    console.log(`Searching for train ${trainNumber} in ${departures.length} departures`);
                    
                    // Normalize the search pattern by removing spaces
                    const searchPattern = trainNumber.replace(/\s+/g, '').toLowerCase();
                    
                    // Find the specific train - try different matching approaches
                    const train = departures.find(d => {
                        // Try various formats for matching
                        const fullName = (d.pr || '').toLowerCase().replace(/\s+/g, '');
                        
                        return fullName === searchPattern || 
                               d.pr === trainNumber ||
                               (d.pr && d.pr.toLowerCase().includes(trainNumber.toLowerCase()));
                    });
                    
                    if (!train) {
                        throw new Error(`Train ${trainNumber} not found at station ${stationId}`);
                    }
                    
                    // Format the train information
                    const departureTime = train.ti || '';
                    const departureDate = train.da || '';
                    const delay = train.rt && train.rt.dlm ? parseInt(train.rt.dlm) : 0;
                    const actualTime = train.rt && train.rt.dlt ? train.rt.dlt : departureTime;
                    const actualDate = train.rt && train.rt.dld ? train.rt.dld : departureDate;
                    const status = train.rt && train.rt.status ? train.rt.status : null;
                    
                    return {
                        train,
                        isDelayed: delay > 0,
                        delayMinutes: delay,
                        scheduledDeparture: `${departureDate} ${departureTime}`,
                        actualDeparture: `${actualDate} ${actualTime}`,
                        platform: train.tr || '',
                        direction: train.lastStop || '',
                        status: status,
                        canceled: status === 'Ausfall'
                    };
                });
        });
}

/**
 * Track a train's journey through multiple stations
 * @param {string} trainName - Train name/number (e.g., "RJ 840")
 * @param {Array<string>} stationIds - Array of station IDs to check
 * @returns {Promise<Array>} - Array of station status objects
 */
export function trackTrainJourney(trainName, stationIds) {
    // Use the authentication once for all stations
    return authenticate()
        .then(auth => {
            // Create an array of promises for each station check
            const stationPromises = stationIds.map(stationId => {
                return getBoardData(auth, stationId)
                    .then(departures => {
                        // Try to find the train at this station
                        const train = departures.find(d => {
                            const fullName = (d.pr || '').toLowerCase().replace(/\s+/g, '');
                            return fullName === trainName.toLowerCase().replace(/\s+/g, '') || 
                                   d.pr === trainName ||
                                   (d.pr && d.pr.toLowerCase().includes(trainName.toLowerCase()));
                        });
                        
                        if (!train) {
                            // Train not found at this station - might have already departed
                            return {
                                stationId,
                                found: false,
                                status: 'not_found'
                            };
                        }
                        
                        // Check if the train has already departed from this station
                        const now = new Date();
                        const scheduledTime = train.ti.split(':');
                        const scheduledHour = parseInt(scheduledTime[0]);
                        const scheduledMinute = parseInt(scheduledTime[1]);
                        
                        const scheduledDate = new Date();
                        scheduledDate.setHours(scheduledHour, scheduledMinute, 0, 0);
                        
                        // If train has real-time data with delay
                        const hasDelay = train.rt && train.rt.dlm;
                        const delayMinutes = hasDelay ? parseInt(train.rt.dlm) : 0;
                        
                        // Adjust for delay
                        const actualDepartureDate = new Date(scheduledDate);
                        actualDepartureDate.setMinutes(actualDepartureDate.getMinutes() + delayMinutes);
                        
                        let status = 'scheduled';
                        
                        if (now > actualDepartureDate) {
                            status = 'departed';
                        } else if (hasDelay) {
                            status = 'delayed';
                        }
                        
                        return {
                            stationId,
                            found: true,
                            train,
                            status,
                            scheduledDeparture: `${train.da} ${train.ti}`,
                            actualDeparture: hasDelay ? `${train.rt.dld} ${train.rt.dlt}` : `${train.da} ${train.ti}`,
                            delayMinutes,
                            platform: train.tr || 'N/A',
                            departed: now > actualDepartureDate
                        };
                    })
                    .catch(error => {
                        console.error(`Error checking station ${stationId}:`, error.message);
                        return {
                            stationId,
                            found: false,
                            error: error.message
                        };
                    });
            });
            
            // Execute all promises and return the combined results
            return Promise.all(stationPromises);
        });
}

/**
 * Authenticate with the OEBB API
 * @returns {Promise<Object>} - Authentication object
 */
function authenticate() {
    return new Promise((resolve, reject) => {
        const userId = Math.random().toString(36).substring(2, 15);
        
        request({
            url: "https://tickets.oebb.at/api/domain/v3/init",
            method: "GET",
            json: true,
            headers: { Channel: "inet" },
            qs: { userId: userId },
            timeout: 10000
        }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }
            
            if (!body) {
                reject(new Error("No body in auth response"));
                return;
            }
            
            if (body.accessToken && body.accessToken !== "") {
                resolve({
                    accessToken: body.accessToken,
                    channel: body.channel,
                    sessionId: body.sessionId,
                    supportId: body.supportId,
                    cookie: 'mock-cookie-value' // ÖBB API seems to no longer require the cookie
                });
            } else {
                reject(new Error("No access token in response"));
            }
        });
    });
}

/**
 * Get stations matching the search name
 * @param {Object} auth - Authentication object
 * @param {string} name - Station name to search for
 * @param {number} count - Maximum number of results
 * @returns {Promise<Array>} - Array of station objects
 */
function getStations(auth, name, count) {
    return new Promise((resolve, reject) => {
        request({
            url: "https://tickets.oebb.at/api/hafas/v1/stations",
            json: true,
            qs: { count, name },
            method: "GET",
            headers: {
                cookie: `ts-cookie=${auth.cookie}`,
                Channel: auth.channel,
                AccessToken: auth.accessToken,
                SessionId: auth.sessionId,
                'x-ts-supportid': "WEB_" + auth.supportId
            }
        }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }
            
            if (!body) {
                reject(new Error("No body in stations response"));
                return;
            }
            
            resolve(body);
        });
    });
}

/**
 * Get station board data (departures/arrivals)
 * @param {Object} auth - Authentication object
 * @param {string} stationId - Station ID
 * @param {Date} date - Date for board data
 * @returns {Promise<Array>} - Array of departure objects
 */
function getBoardData(auth, stationId, date = new Date()) {
    return new Promise((resolve, reject) => {
        // Format date for OEBB API
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
        const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        console.log(`Requesting departures for station ${stationId} on ${formattedDate} at ${formattedTime}`);
        
        // Use SCOTTY HAFAS endpoint from fahrplan.oebb.at
        request({
            url: "https://fahrplan.oebb.at/bin/stboard.exe/dn",
            method: "GET",
            qs: {
                L: "vs_scotty.vs_liveticker",
                evaId: stationId,
                boardType: "dep", // dep for departures, arr for arrivals
                time: formattedTime,
                date: formattedDate,
                productsFilter: "1111111111111111", // all products
                additionalTime: "0",
                maxJourneys: "50", // max departures
                outputMode: "tickerDataOnly",
                start: "yes",
                selectDate: "today"
            },
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36"
            }
        }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }
            
            // Handle JSONP response format: journeysObj = {...}
            let data;
            try {
                // Extract the JSON part from JSONP response
                const match = body.match(/journeysObj\s*=\s*(\{.*\})/s);
                if (match && match[1]) {
                    data = JSON.parse(match[1]);
                } else {
                    throw new Error('Could not extract JSON from response');
                }
            } catch (e) {
                console.log('Error parsing response:', e.message);
                console.log('Response sample:', body.substring(0, 200));
                reject(new Error('Invalid response format from station board API'));
                return;
            }
            
            if (!data || !data.journey) {
                console.log('Full response:', JSON.stringify(data, null, 2));
                reject(new Error('No departures data in response'));
                return;
            }
            
            resolve(data.journey);
        });
    });
}

// Example usage
export function searchAndDisplayStations(stationName) {
    return searchStations(stationName)
        .then(stations => {
            console.log(`Found ${stations.length} stations matching "${stationName}":`);
            stations.forEach(station => {
                console.log(`- ${station.meta || station.name} (ID: ${station.number})`);
            });
            return stations;
        })
        .catch(error => {
            console.error('Error searching for stations:', error);
            throw error;
        });
} 