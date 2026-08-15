// k6 Load Testing Script
// Performance validation for Transcend Law platform

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const messageLatency = new Trend('message_latency');

// Configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 users
    { duration: '5m', target: 500 },   // Ramp to 500 users
    { duration: '5m', target: 1000 },  // Ramp to 1000 users
    { duration: '5m', target: 500 },   // Ramp down to 500
    { duration: '3m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'errors': ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api/v2`;

// Test users pool
const users = [
  { email: 'user1@test.com', password: 'pass123' },
  { email: 'user2@test.com', password: 'pass123' },
  { email: 'user3@test.com', password: 'pass123' },
];

// Helper: Random selection
function randomUser() {
  return users[Math.floor(Math.random() * users.length)];
}

// Helper: Login and get token
function login(user) {
  const loginRes = http.post(`${API_URL}/auth/login`, {
    email: user.email,
    password: user.password,
  });

  check(loginRes, {
    'login succeeds': (r) => r.status === 200,
    'auth token present': (r) => r.json().token !== undefined,
  }) || errorRate.add(1);

  return loginRes.json().token;
}

// Load Test: Authentication
export function testAuth() {
  group('Authentication', () => {
    const user = randomUser();
    
    const signupRes = http.post(`${API_URL}/auth/signup`, {
      email: `test-${Date.now()}@test.com`,
      password: 'TestPass123!',
      userType: 'client',
    });

    check(signupRes, {
      'signup status is 201': (r) => r.status === 201,
    }) || errorRate.add(1);

    apiLatency.add(signupRes.timings.duration);
  });
  
  sleep(1);
}

// Load Test: Case Submission
export function testCaseSubmission() {
  group('Case Submission', () => {
    const user = randomUser();
    const token = login(user);

    const caseRes = http.post(`${API_URL}/cases`, {
      title: `Test Case ${Date.now()}`,
      description: 'Test case description',
      serviceType: 'trademark',
      budget: 5000,
      urgency: 'high',
      location: 'California',
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    check(caseRes, {
      'case created': (r) => r.status === 201,
    }) || errorRate.add(1);

    apiLatency.add(caseRes.timings.duration);
  });

  sleep(2);
}

// Load Test: Payments
export function testPayments() {
  group('Payment Processing', () => {
    const user = randomUser();
    const token = login(user);

    const paymentRes = http.post(`${API_URL}/payments/subscribe`, {
      planId: 'professional',
      cardNumber: '4242424242424242',
      expirationDate: '12/25',
      cvc: '123',
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    check(paymentRes, {
      'payment processed': (r) => r.status === 200,
      'no payment errors': (r) => r.json().error === undefined,
    }) || errorRate.add(1);

    apiLatency.add(paymentRes.timings.duration);
  });

  sleep(2);
}

// Load Test: Messaging
export function testMessaging() {
  group('Real-Time Messaging', () => {
    const user = randomUser();
    const token = login(user);

    const messageRes = http.post(`${API_URL}/messages`, {
      conversationId: 'conv-123',
      content: `Test message at ${Date.now()}`,
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    check(messageRes, {
      'message sent': (r) => r.status === 200,
      'message delivered': (r) => r.json().id !== undefined,
    }) || errorRate.add(1);

    messageLatency.add(messageRes.timings.duration);
  });

  sleep(1);
}

// Load Test: Document Upload
export function testDocumentUpload() {
  group('Document Upload', () => {
    const user = randomUser();
    const token = login(user);

    // Create form data
    const params = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    };

    const docRes = http.post(`${API_URL}/documents/case-123/upload`, {
      file: http.file('test-document.pdf', 'PDF content here'),
    }, params);

    check(docRes, {
      'upload succeeds': (r) => r.status === 200,
    }) || errorRate.add(1);

    apiLatency.add(docRes.timings.duration);
  });

  sleep(2);
}

// Load Test: Dashboard
export function testDashboard() {
  group('Dashboard Load', () => {
    const user = randomUser();
    const token = login(user);

    const dashRes = http.get(`${API_URL}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    check(dashRes, {
      'dashboard loads': (r) => r.status === 200,
      'has metrics': (r) => r.json().metrics !== undefined,
    }) || errorRate.add(1);

    apiLatency.add(dashRes.timings.duration);
  });

  sleep(1);
}

// Main execution flow
export default function () {
  // Distribute load across different endpoints
  const scenario = Math.random();

  if (scenario < 0.15) {
    testAuth();
  } else if (scenario < 0.3) {
    testCaseSubmission();
  } else if (scenario < 0.45) {
    testPayments();
  } else if (scenario < 0.6) {
    testMessaging();
  } else if (scenario < 0.75) {
    testDocumentUpload();
  } else {
    testDashboard();
  }
}

// Summary function
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}
