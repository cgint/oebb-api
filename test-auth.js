#!/usr/bin/env node

import request from 'request';

// Test the authentication mechanism to see what's going wrong
console.log('Testing OEBB API authentication...');

function authenticate() {
    return new Promise((resolve, reject) => {
        const userId = Math.random().toString(36).substring(2, 15);
        
        console.log(`Making auth request with userId: ${userId}`);
        
        request({
            url: "https://tickets.oebb.at/api/domain/v3/init",
            method: "GET",
            json: true,
            headers: { 
                Channel: "inet",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36"
            },
            qs: { userId: userId },
            timeout: 10000
        }, (error, response, body) => {
            if (error) {
                console.error('Auth request error:', error.message);
                reject(error);
                return;
            }
            
            console.log('Auth response status:', response.statusCode);
            console.log('Auth response headers:', JSON.stringify(response.headers, null, 2));
            
            if (!body) {
                console.error('No body in auth response');
                reject(new Error("No body in auth response"));
                return;
            }
            
            console.log('Auth response body:', JSON.stringify(body, null, 2));
            
            if (body.accessToken && body.accessToken !== "") {
                console.log('Successfully authenticated!');
                resolve({
                    accessToken: body.accessToken,
                    channel: body.channel,
                    sessionId: body.sessionId,
                    supportId: body.supportId,
                    cookie: 'mock-cookie-value'
                });
            } else {
                console.error('No access token in response');
                reject(new Error("No access token in response"));
            }
        });
    });
}

// Alternative newer authentication method to try
function authenticateAlternative() {
    return new Promise((resolve, reject) => {
        const userId = Math.random().toString(36).substring(2, 15);
        
        console.log(`\nTrying alternative auth with userId: ${userId}`);
        
        request({
            url: "https://tickets.oebb.at/api/domain/v4/init",
            method: "GET",
            json: true,
            headers: { 
                Channel: "inet",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36",
                "Accept": "application/json, text/plain, */*"
            },
            qs: { userId: userId },
            timeout: 10000
        }, (error, response, body) => {
            if (error) {
                console.error('Alternative auth request error:', error.message);
                reject(error);
                return;
            }
            
            console.log('Alternative auth response status:', response.statusCode);
            
            if (!body) {
                console.error('No body in alternative auth response');
                reject(new Error("No body in alternative auth response"));
                return;
            }
            
            console.log('Alternative auth response body:', JSON.stringify(body, null, 2));
            
            if (body.accessToken && body.accessToken !== "") {
                console.log('Successfully authenticated with alternative method!');
                resolve({
                    accessToken: body.accessToken,
                    channel: body.channel,
                    sessionId: body.sessionId,
                    supportId: body.supportId
                });
            } else {
                console.error('No access token in alternative auth response');
                reject(new Error("No access token in alternative auth response"));
            }
        });
    });
}

// Execute the tests
authenticate()
    .then(() => {
        return authenticateAlternative();
    })
    .catch(error => {
        console.error('Authentication test failed:', error.message);
        // Try the alternative even if the first one fails
        return authenticateAlternative();
    })
    .catch(error => {
        console.error('All authentication tests failed:', error.message);
        process.exit(1);
    }); 