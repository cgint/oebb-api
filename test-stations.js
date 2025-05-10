#!/usr/bin/env node

import request from 'request';

// Test file specifically for station search
console.log('Testing OEBB station search APIs...');

// Test with hafas/bin endpoint (timetable.oebb.at)
function searchStationsHafas(name) {
    return new Promise((resolve, reject) => {
        console.log(`Searching for stations matching "${name}" using HAFAS endpoint...`);
        
        request({
            url: 'https://fahrplan.oebb.at/bin/query.exe/dn',
            method: 'GET',
            qs: {
                start: 1,
                S: 'Wien', 
                REQ0JourneyStopsS0A: 1,
                REQ0JourneyStopsS0G: name,
                tpl: 'stop2json'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        }, (error, response, body) => {
            if (error) {
                console.error('Error in HAFAS search:', error);
                reject(error);
                return;
            }
            
            console.log('HAFAS search response status:', response.statusCode);
            console.log('HAFAS response preview:', body.substring(0, 200) + '...');
            
            try {
                const data = JSON.parse(body);
                console.log(`HAFAS found ${data.stops ? data.stops.length : 0} stations`);
                if (data.stops) {
                    data.stops.forEach(s => {
                        console.log(`- ${s.name} (${s.extId})`);
                    });
                }
                resolve(data.stops || []);
            } catch (e) {
                console.error('Error parsing HAFAS response:', e.message);
                reject(e);
            }
        });
    });
}

// Test with getstop.exe endpoint
function searchStationsGetstop(name) {
    return new Promise((resolve, reject) => {
        console.log(`\nSearching for stations matching "${name}" using getstop endpoint...`);
        
        request({
            url: 'https://fahrplan.oebb.at/bin/ajax-getstop.exe/dn',
            method: 'GET',
            qs: {
                start: 1,
                REQ0JourneyStopsS0A: 1,
                REQ0JourneyStopsS0G: name,
                getstop: 1,
                noEvaluation: 'yes'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        }, (error, response, body) => {
            if (error) {
                console.error('Error in getstop search:', error);
                reject(error);
                return;
            }
            
            console.log('Getstop search response status:', response.statusCode);
            console.log('Getstop response preview:', body.substring(0, 200) + '...');
            
            try {
                // Try to extract JSON from JSONP response
                const match = body.match(/SLs\.sls\s*=\s*(\{.*\})/s);
                if (match && match[1]) {
                    const data = JSON.parse(match[1]);
                    console.log(`Getstop found ${data.suggestions ? data.suggestions.length : 0} stations`);
                    if (data.suggestions) {
                        data.suggestions.forEach(s => {
                            console.log(`- ${s.value} (${s.extId})`);
                        });
                    }
                    resolve(data.suggestions || []);
                } else {
                    console.error('Could not extract JSON from getstop response');
                    reject(new Error('Could not extract JSON from response'));
                }
            } catch (e) {
                console.error('Error parsing getstop response:', e.message);
                reject(e);
            }
        });
    });
}

// Try a third method - SCOTTY directly
function searchStationsScotty(name) {
    return new Promise((resolve, reject) => {
        console.log(`\nSearching for stations matching "${name}" using SCOTTY endpoint...`);
        
        request({
            url: 'https://fahrplan.oebb.at/api/hafas/v1/stations',
            method: 'GET',
            qs: {
                count: 15,
                name: name
            },
            json: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        }, (error, response, body) => {
            if (error) {
                console.error('Error in SCOTTY search:', error);
                reject(error);
                return;
            }
            
            console.log('SCOTTY search response status:', response.statusCode);
            
            if (response.statusCode >= 400) {
                console.error('SCOTTY search error:', body);
                reject(new Error(`SCOTTY API error: ${response.statusCode}`));
                return;
            }
            
            try {
                console.log(`SCOTTY found ${body.length || 0} stations`);
                if (body && body.length) {
                    body.forEach(s => {
                        console.log(`- ${s.name} (${s.number})`);
                    });
                }
                resolve(body || []);
            } catch (e) {
                console.error('Error processing SCOTTY response:', e.message);
                reject(e);
            }
        });
    });
}

// Run all tests
const searchTerm = process.argv[2] || 'Wien';

searchStationsHafas(searchTerm)
    .catch(error => {
        console.error('HAFAS search failed:', error.message);
        return []; // Continue even if this fails
    })
    .then(() => searchStationsGetstop(searchTerm))
    .catch(error => {
        console.error('Getstop search failed:', error.message);
        return []; // Continue even if this fails
    })
    .then(() => searchStationsScotty(searchTerm))
    .catch(error => {
        console.error('SCOTTY search failed:', error.message);
    }); 