#!/usr/bin/env node

/**
 * Performance Testing Script for Media System
 * 
 * Tests the performance requirements from issue #104:
 * - Upload speeds: 10MB file in < 30 seconds
 * - Search response: < 500ms for typical queries  
 * - Thumbnail generation: < 5 seconds for images
 * - UI responsiveness: < 100ms for interactions
 * - Database queries: < 200ms for complex searches
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

// Performance test results
const results = {
    apiResponse: [],
    searchResponse: [],
    uiResponse: [],
    errors: []
};

// Helper function to make HTTP requests with timing
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                resolve({
                    statusCode: res.statusCode,
                    data: data,
                    duration: duration,
                    headers: res.headers
                });
            });
        });

        req.on('error', (err) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            reject({ error: err, duration });
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Test API response times
async function testApiResponseTimes() {
    console.log('🔍 Testing API Response Times...');

    const endpoints = [
        '/api/v1/media/files/',
        '/api/v1/media/collections/',
        '/api/v1/media/tags/',
        '/api/v1/webpages/pages/',
        '/api/v1/namespaces/'
    ];

    for (const endpoint of endpoints) {
        try {
            const result = await makeRequest(`${BASE_URL}${endpoint}`);
            results.apiResponse.push({
                endpoint,
                duration: result.duration,
                status: result.statusCode
            });

            const status = result.duration < 200 ? '✅' : result.duration < 500 ? '⚠️' : '❌';
            console.log(`  ${status} ${endpoint}: ${result.duration}ms (${result.statusCode})`);
        } catch (error) {
            results.errors.push({
                test: 'API Response',
                endpoint,
                error: error.error?.message || error.message
            });
            console.log(`  ❌ ${endpoint}: ERROR - ${error.error?.message || error.message}`);
        }
    }
}

// Test search response times (simulated)
async function testSearchResponseTimes() {
    console.log('🔍 Testing Search Response Times...');

    const searchQueries = [
        '?search=image',
        '?search=test',
        '?file_type=image',
        '?tags=photo',
        '?ordering=-created_at'
    ];

    for (const query of searchQueries) {
        try {
            const result = await makeRequest(`${BASE_URL}/api/v1/media/files/${query}`);
            results.searchResponse.push({
                query,
                duration: result.duration,
                status: result.statusCode
            });

            const status = result.duration < 500 ? '✅' : result.duration < 1000 ? '⚠️' : '❌';
            console.log(`  ${status} Search "${query}": ${result.duration}ms (${result.statusCode})`);
        } catch (error) {
            results.errors.push({
                test: 'Search Response',
                query,
                error: error.error?.message || error.message
            });
            console.log(`  ❌ Search "${query}": ERROR - ${error.error?.message || error.message}`);
        }
    }
}

// Test frontend response times
async function testFrontendResponseTimes() {
    console.log('🔍 Testing Frontend Response Times...');

    const frontendPaths = [
        '/',
        '/media',
        '/pages',
        '/settings'
    ];

    for (const path of frontendPaths) {
        try {
            const result = await makeRequest(`${FRONTEND_URL}${path}`);
            results.uiResponse.push({
                path,
                duration: result.duration,
                status: result.statusCode
            });

            const status = result.duration < 100 ? '✅' : result.duration < 500 ? '⚠️' : '❌';
            console.log(`  ${status} ${path}: ${result.duration}ms (${result.statusCode})`);
        } catch (error) {
            results.errors.push({
                test: 'Frontend Response',
                path,
                error: error.error?.message || error.message
            });
            console.log(`  ❌ ${path}: ERROR - ${error.error?.message || error.message}`);
        }
    }
}

// Generate performance report
function generateReport() {
    console.log('\n📊 Performance Test Results Summary');
    console.log('=====================================');

    // API Response Times
    if (results.apiResponse.length > 0) {
        const apiTimes = results.apiResponse.map(r => r.duration);
        const avgApiTime = apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length;
        const maxApiTime = Math.max(...apiTimes);

        console.log(`\n🔧 API Response Times:`);
        console.log(`  Average: ${avgApiTime.toFixed(2)}ms`);
        console.log(`  Maximum: ${maxApiTime}ms`);
        console.log(`  Target: < 200ms for complex queries`);
        console.log(`  Status: ${maxApiTime < 200 ? '✅ PASS' : maxApiTime < 500 ? '⚠️ ACCEPTABLE' : '❌ NEEDS OPTIMIZATION'}`);
    }

    // Search Response Times
    if (results.searchResponse.length > 0) {
        const searchTimes = results.searchResponse.map(r => r.duration);
        const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
        const maxSearchTime = Math.max(...searchTimes);

        console.log(`\n🔍 Search Response Times:`);
        console.log(`  Average: ${avgSearchTime.toFixed(2)}ms`);
        console.log(`  Maximum: ${maxSearchTime}ms`);
        console.log(`  Target: < 500ms for typical queries`);
        console.log(`  Status: ${maxSearchTime < 500 ? '✅ PASS' : maxSearchTime < 1000 ? '⚠️ ACCEPTABLE' : '❌ NEEDS OPTIMIZATION'}`);
    }

    // UI Response Times
    if (results.uiResponse.length > 0) {
        const uiTimes = results.uiResponse.map(r => r.duration);
        const avgUiTime = uiTimes.reduce((a, b) => a + b, 0) / uiTimes.length;
        const maxUiTime = Math.max(...uiTimes);

        console.log(`\n🖥️ Frontend Response Times:`);
        console.log(`  Average: ${avgUiTime.toFixed(2)}ms`);
        console.log(`  Maximum: ${maxUiTime}ms`);
        console.log(`  Target: < 100ms for interactions`);
        console.log(`  Status: ${maxUiTime < 100 ? '✅ PASS' : maxUiTime < 500 ? '⚠️ ACCEPTABLE' : '❌ NEEDS OPTIMIZATION'}`);
    }

    // Errors
    if (results.errors.length > 0) {
        console.log(`\n❌ Errors (${results.errors.length}):`);
        results.errors.forEach(error => {
            console.log(`  - ${error.test}: ${error.error}`);
        });
    }

    // Overall Assessment
    const allPassing = results.apiResponse.every(r => r.duration < 200) &&
        results.searchResponse.every(r => r.duration < 500) &&
        results.uiResponse.every(r => r.duration < 100) &&
        results.errors.length === 0;

    console.log(`\n🎯 Overall Performance Assessment:`);
    console.log(`  Status: ${allPassing ? '✅ ALL TARGETS MET' : '⚠️ SOME OPTIMIZATIONS NEEDED'}`);
    console.log(`  Errors: ${results.errors.length === 0 ? '✅ NO ERRORS' : `❌ ${results.errors.length} ERRORS`}`);

    return allPassing && results.errors.length === 0;
}

// Main test execution
async function runPerformanceTests() {
    console.log('🚀 Starting Performance Tests for Media System');
    console.log('==============================================');

    try {
        await testApiResponseTimes();
        await testSearchResponseTimes();
        await testFrontendResponseTimes();

        const success = generateReport();

        console.log('\n📝 Additional Notes:');
        console.log('  - Upload speed testing requires actual file uploads (manual test recommended)');
        console.log('  - Thumbnail generation testing requires image processing (manual test recommended)');
        console.log('  - Database query performance is reflected in API response times');
        console.log('  - UI responsiveness testing requires browser-based testing');

        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('❌ Performance test failed:', error);
        process.exit(1);
    }
}

// Run the tests
runPerformanceTests();
