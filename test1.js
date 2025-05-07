import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'request';

// Debug version of searchStationsNew
function searchStationsNewDebug(name) {
    console.log('Searching for stations with name:', name);
    
    return new Promise((resolve, reject) => {
        // Setup authentication debugging
        const authRequest = () => {
            console.log('Making authentication request...');
            
            return new Promise((authResolve, authReject) => {
                const userId = Math.random().toString(36).substring(2, 15);
                console.log('Using generated userId:', userId);
                
                const authUrl = "https://tickets.oebb.at/api/domain/v3/init";
                console.log('Auth URL:', authUrl);
                
                request({
                    url: authUrl,
                    method: "GET",
                    json: true,
                    headers: { Channel: "inet" },
                    qs: { userId: userId },
                    timeout: 10000
                }, (error, response, body) => {
                    if (error) {
                        console.error('Auth request error:', error);
                        authReject(error);
                        return;
                    }
                    
                    console.log('Auth response status:', response.statusCode);
                    console.log('Auth response headers:', JSON.stringify(response.headers, null, 2));
                    
                    if (!body) {
                        console.error('No body in auth response');
                        authReject(new Error("No body in auth response"));
                        return;
                    }
                    
                    console.log('Auth response body:', JSON.stringify(body, null, 2));
                    
                    if (body.accessToken && body.accessToken !== "") {
                        if (!response.headers['set-cookie'] || !response.headers['set-cookie'][0]) {
                            console.warn('No set-cookie header in response, creating mock cookie');
                            // Create a mock authentication object
                            const mockAuth = {
                                ...body,
                                cookie: 'mock-cookie-value'
                            };
                            authResolve(mockAuth);
                        } else {
                            console.log('Found set-cookie header:', response.headers['set-cookie'][0]);
                            // Normal flow - parse the cookie
                            const cookie = require('cookie');
                            const parsedCookie = cookie.parse(response.headers['set-cookie'][0]);
                            console.log('Parsed cookie:', parsedCookie);
                            
                            authResolve({
                                ...body,
                                cookie: parsedCookie['ts-cookie'] || 'fallback-cookie-value'
                            });
                        }
                    } else {
                        console.error('No access token in response');
                        authReject(new Error("No access token in response"));
                    }
                });
            });
        };
        
        // Execute auth request and then get stations
        authRequest()
            .then(auth => {
                console.log('Authentication successful, fetching stations...');
                
                const stationsUrl = "https://tickets.oebb.at/api/hafas/v1/stations";
                console.log('Stations URL:', stationsUrl);
                console.log('Request params:', { count: 15, name: name });
                
                request({
                    url: stationsUrl,
                    json: true,
                    qs: { count: 15, name: name },
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
                        console.error('Stations request error:', error);
                        reject(error);
                        return;
                    }
                    
                    console.log('Stations response status:', response.statusCode);
                    console.log('Stations response headers:', JSON.stringify(response.headers, null, 2));
                    
                    if (!body) {
                        console.error('No body in stations response');
                        reject(new Error("No body in stations response"));
                        return;
                    }
                    
                    console.log('Stations response body (first 200 chars):', 
                        JSON.stringify(body).substring(0, 200) + '...');
                    
                    // Save the full response to a file for inspection
                    const responseFile = 'station_response.json';
                    fs.writeFileSync(responseFile, JSON.stringify(body, null, 2));
                    console.log(`Full response saved to ${responseFile}`);
                    
                    resolve(body);
                });
            })
            .catch(error => {
                console.error('Authentication failed:', error);
                reject(error);
            });
    });
}

// Run the debug search
searchStationsNewDebug("Wien")
  .then(results => {
    console.log('\nSearch results (summary):');
    if (Array.isArray(results)) {
      console.log(`Found ${results.length} stations`);
      console.log(JSON.stringify(results.slice(0, 3), null, 2)); // Show first 3 only
    } else {
      console.log('Unexpected results format:', typeof results);
    }
  })
  .catch(error => {
    console.error('\nError occurred:', error);
  });
