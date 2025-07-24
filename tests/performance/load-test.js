import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTrend = new Trend('response_time_trend');

// Test configuration
export const options = {
    stages: [
        // Ramp up to 10 users over 30 seconds
        { duration: '30s', target: 10 },
        // Stay at 10 users for 1 minute
        { duration: '1m', target: 10 },
        // Ramp up to 20 users over 30 seconds
        { duration: '30s', target: 20 },
        // Stay at 20 users for 2 minutes
        { duration: '2m', target: 20 },
        // Ramp down to 0 users over 30 seconds
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        // HTTP request duration should be less than 500ms for 95% of requests
        http_req_duration: ['p(95)<500'],
        // HTTP request failure rate should be less than 1%
        http_req_failed: ['rate<0.01'],
        // Custom error rate should be less than 1%
        errors: ['rate<0.01'],
    },
};

// Base URLs
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = __ENV.API_URL || 'http://localhost:8000';

// Test data
const testUsers = [
    { username: 'load-test-user-1', password: 'testpass123' },
    { username: 'load-test-user-2', password: 'testpass123' },
    { username: 'load-test-user-3', password: 'testpass123' },
];

// Helper function to get CSRF token
function getCSRFToken() {
    const response = http.get(`${API_URL}/api/csrf/`);
    check(response, {
        'CSRF token request successful': (r) => r.status === 200,
    });

    if (response.status === 200) {
        const token = response.json('csrfToken') || response.cookies.csrftoken[0].value;
        return token;
    }
    return null;
}

// Helper function to login
function login(username, password) {
    const csrfToken = getCSRFToken();
    if (!csrfToken) return null;

    const loginData = {
        username: username,
        password: password,
    };

    const headers = {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
    };

    const response = http.post(`${API_URL}/api/auth/login/`, JSON.stringify(loginData), { headers });

    check(response, {
        'Login successful': (r) => r.status === 200,
    });

    if (response.status === 200) {
        return response.cookies;
    }
    return null;
}

export default function () {
    // Test scenario: Anonymous user browsing
    testAnonymousBrowsing();

    // Test scenario: Authenticated user operations
    testAuthenticatedOperations();

    // Test scenario: API performance
    testAPIPerformance();

    sleep(1);
}

function testAnonymousBrowsing() {
    console.log('Testing anonymous browsing...');

    // Homepage
    let response = http.get(`${BASE_URL}/`);
    check(response, {
        'Homepage loads successfully': (r) => r.status === 200,
        'Homepage loads within 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(response.status !== 200);
    responseTrend.add(response.timings.duration);

    // Static assets
    response = http.get(`${BASE_URL}/static/css/main.css`);
    check(response, {
        'CSS loads successfully': (r) => r.status === 200 || r.status === 404, // 404 is ok if using bundled CSS
    });

    // About page
    response = http.get(`${BASE_URL}/about`);
    check(response, {
        'About page accessible': (r) => r.status === 200 || r.status === 404, // 404 is ok if route doesn't exist
    });
}

function testAuthenticatedOperations() {
    console.log('Testing authenticated operations...');

    // Use random test user
    const user = testUsers[Math.floor(Math.random() * testUsers.length)];
    const cookies = login(user.username, user.password);

    if (!cookies) {
        console.log('Login failed, skipping authenticated tests');
        return;
    }

    const headers = {
        cookies: cookies,
    };

    // Page management interface
    let response = http.get(`${BASE_URL}/page-management`, { headers });
    check(response, {
        'Page management loads for authenticated user': (r) => r.status === 200,
        'Page management loads within 3s': (r) => r.timings.duration < 3000,
    });
    errorRate.add(response.status !== 200);
    responseTrend.add(response.timings.duration);

    // Settings page
    response = http.get(`${BASE_URL}/settings`, { headers });
    check(response, {
        'Settings page loads for authenticated user': (r) => r.status === 200,
        'Settings page loads within 3s': (r) => r.timings.duration < 3000,
    });
    errorRate.add(response.status !== 200);
    responseTrend.add(response.timings.duration);
}

function testAPIPerformance() {
    console.log('Testing API performance...');

    // Test public API endpoints
    let response = http.get(`${API_URL}/api/v1/webpages/layouts/`);
    check(response, {
        'Layouts API responds': (r) => r.status === 200,
        'Layouts API responds within 1s': (r) => r.timings.duration < 1000,
    });
    errorRate.add(response.status !== 200);
    responseTrend.add(response.timings.duration);

    // Test widget types API
    response = http.get(`${API_URL}/api/v1/webpages/widget-types/`);
    check(response, {
        'Widget types API responds': (r) => r.status === 200,
        'Widget types API responds within 1s': (r) => r.timings.duration < 1000,
    });
    errorRate.add(response.status !== 200);
    responseTrend.add(response.timings.duration);

    // Test pages API with authentication
    const user = testUsers[0];
    const cookies = login(user.username, user.password);

    if (cookies) {
        const headers = {
            cookies: cookies,
        };

        response = http.get(`${API_URL}/api/v1/webpages/pages/`, { headers });
        check(response, {
            'Pages API responds for authenticated user': (r) => r.status === 200,
            'Pages API responds within 2s': (r) => r.timings.duration < 2000,
        });
        errorRate.add(response.status !== 200);
        responseTrend.add(response.timings.duration);
    }
}

// Setup function - runs once at the start
export function setup() {
    console.log('Setting up load test...');

    // Create test users if they don't exist
    testUsers.forEach(user => {
        const userData = {
            username: user.username,
            email: `${user.username}@test.com`,
            password: user.password,
            first_name: 'Load',
            last_name: 'Test'
        };

        const response = http.post(`${API_URL}/api/auth/register/`, JSON.stringify(userData), {
            headers: { 'Content-Type': 'application/json' },
        });

        // Ignore 400 errors (user already exists)
        if (response.status === 201) {
            console.log(`Created test user: ${user.username}`);
        } else if (response.status === 400) {
            console.log(`Test user already exists: ${user.username}`);
        } else {
            console.log(`Failed to create user ${user.username}: ${response.status}`);
        }
    });

    return { testUsers };
}

// Teardown function - runs once at the end
export function teardown(data) {
    console.log('Load test completed');
    console.log(`Test users used: ${data.testUsers.length}`);
} 