// K6 Load Test: Hiring Workflow
// Simulates complete hiring flow under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Gauge, Rate } from 'k6/metrics';

// Custom metrics
const serviceLatency = new Trend('service_latency');
const intakeLatency = new Trend('intake_latency');
const offerLatency = new Trend('offer_latency');
const verificationLatency = new Trend('verification_latency');
const videoLatency = new Trend('video_latency');
const messagingLatency = new Trend('messaging_latency');

const serviceErrors = new Counter('service_errors');
const intakeErrors = new Counter('intake_errors');
const offerErrors = new Counter('offer_errors');

const requestRate = new Rate('request_success_rate');
const activeConnections = new Gauge('active_connections');

export const options = {
  vus: 100,
  duration: '5m',
  rampUp: '1m',
  stages: [
    { duration: '1m', target: 30 },   // Ramp-up to 30 users
    { duration: '2m', target: 100 },  // Ramp-up to 100 users
    { duration: '1m', target: 50 },   // Ramp-down to 50 users
    { duration: '1m', target: 0 },    // Ramp-down to 0 users
  ],
  thresholds: {
    'service_latency': ['p(95)<500', 'p(99)<1000'],
    'intake_latency': ['p(95)<800', 'p(99)<1500'],
    'offer_latency': ['p(95)<600', 'p(99)<1200'],
    'verification_latency': ['p(95)<1000', 'p(99)<2000'],
    'video_latency': ['p(95)<2000', 'p(99)<4000'],
    'messaging_latency': ['p(95)<300', 'p(99)<600'],
    'request_success_rate': ['rate>0.99'],
  },
};

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:3000/api/v2';

// Mock user personas
const personas = [1, 2, 3, 4, 5]; // Client, Lawyer, Paralegal, Notary, PI
const services = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function () {
  const personaId = personas[Math.floor(Math.random() * personas.length)];
  const serviceId = services[Math.floor(Math.random() * services.length)];
  const userId = `user_${__VU}_${__ITER}`;

  // Track active connections
  activeConnections.add(1);

  // 1. Get Personas
  const personasRes = http.get(`${API_BASE}/personas`);
  check(personasRes, {
    'personas status is 200': (r) => r.status === 200,
    'personas response time < 500ms': (r) => r.timings.duration < 500,
  });
  serviceLatency.add(personasRes.timings.duration);
  requestRate.add(personasRes.status === 200);
  if (personasRes.status !== 200) serviceErrors.add(1);
  sleep(0.5);

  // 2. Get Services for Persona
  const servicesRes = http.get(`${API_BASE}/personas/${personaId}/marketplace?page=1&limit=20`);
  check(servicesRes, {
    'services status is 200': (r) => r.status === 200,
    'services has data': (r) => r.body.includes('services'),
    'services response time < 500ms': (r) => r.timings.duration < 500,
  });
  serviceLatency.add(servicesRes.timings.duration);
  requestRate.add(servicesRes.status === 200);
  if (servicesRes.status !== 200) serviceErrors.add(1);
  sleep(1);

  // 3. Get Service Details
  const serviceDetailRes = http.get(`${API_BASE}/services/${serviceId}`);
  check(serviceDetailRes, {
    'service detail status is 200': (r) => r.status === 200,
  });
  serviceLatency.add(serviceDetailRes.timings.duration);
  requestRate.add(serviceDetailRes.status === 200);
  sleep(1);

  // 4. Create Intake Form
  const intakePayload = JSON.stringify({
    service_id: serviceId,
    title: `Service Request ${__ITER}`,
    description: `This is a test service request from load test iteration ${__ITER}. Need comprehensive review of documents and legal analysis.`,
    budget_range: Math.floor(Math.random() * 5000) + 1000,
    urgency: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)],
  });

  const intakeRes = http.post(`${API_BASE}/intake-forms`, intakePayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(intakeRes, {
    'intake status is 201': (r) => r.status === 201,
    'intake response time < 800ms': (r) => r.timings.duration < 800,
  });
  intakeLatency.add(intakeRes.timings.duration);
  requestRate.add(intakeRes.status === 201);
  if (intakeRes.status !== 201) intakeErrors.add(1);

  let intakeId = null;
  if (intakeRes.status === 201) {
    const intakeData = JSON.parse(intakeRes.body);
    intakeId = intakeData.data?.id;
  }
  sleep(1);

  if (intakeId) {
    // 5. Get Offers for Intake
    const offersRes = http.get(`${API_BASE}/intake-forms/${intakeId}/offers`);
    check(offersRes, {
      'offers status is 200': (r) => r.status === 200,
      'offers response time < 600ms': (r) => r.timings.duration < 600,
    });
    offerLatency.add(offersRes.timings.duration);
    requestRate.add(offersRes.status === 200);
    if (offersRes.status !== 200) offerErrors.add(1);

    let offerId = null;
    if (offersRes.status === 200) {
      const offersData = JSON.parse(offersRes.body);
      const offers = offersData.data || [];
      if (offers.length > 0) {
        offerId = offers[0].id;
      }
    }
    sleep(1);

    if (offerId) {
      // 6. Accept Offer (50% chance)
      if (Math.random() > 0.5) {
        const acceptRes = http.post(`${API_BASE}/service-offers/${offerId}/accept`, {});
        check(acceptRes, {
          'accept offer status is 200': (r) => r.status === 200,
        });
        offerLatency.add(acceptRes.timings.duration);
        requestRate.add(acceptRes.status === 200);
        sleep(1);

        // 7. Get Hire Agreement (after acceptance)
        const hireRes = http.get(`${API_BASE}/intake-forms/${intakeId}/hire-agreement`);
        check(hireRes, {
          'hire agreement status is 200': (r) => r.status === 200,
        });
        requestRate.add(hireRes.status === 200);

        let hireAgreementId = null;
        if (hireRes.status === 200) {
          const hireData = JSON.parse(hireRes.body);
          hireAgreementId = hireData.data?.id;
        }
        sleep(1);

        if (hireAgreementId) {
          // 8. Upload Identity Verification (50% chance)
          if (Math.random() > 0.5) {
            const verifyRes = http.post(
              `${API_BASE}/verifications/upload`,
              {
                document: 'data:image/jpeg;base64,fake_document_data',
                type: 'driver_license',
              },
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );
            check(verifyRes, {
              'verification status is 200 or 201': (r) => r.status === 200 || r.status === 201,
              'verification response time < 1000ms': (r) => r.timings.duration < 1000,
            });
            verificationLatency.add(verifyRes.timings.duration);
            requestRate.add(verifyRes.status === 200 || verifyRes.status === 201);
            sleep(1);
          }

          // 9. Create Video Session (30% chance)
          if (Math.random() > 0.7) {
            const videoRes = http.post(
              `${API_BASE}/video-sessions`,
              JSON.stringify({
                hire_agreement_id: hireAgreementId,
                platform: ['zoom', 'teams', 'gmeet'][Math.floor(Math.random() * 3)],
              }),
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );
            check(videoRes, {
              'video session status is 201': (r) => r.status === 201,
              'video response time < 2000ms': (r) => r.timings.duration < 2000,
            });
            videoLatency.add(videoRes.timings.duration);
            requestRate.add(videoRes.status === 201);
            sleep(1);
          }

          // 10. Send Message
          const messageRes = http.post(
            `${API_BASE}/messages`,
            JSON.stringify({
              hire_agreement_id: hireAgreementId,
              message: `Test message ${__ITER} from load test`,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            }
          );
          check(messageRes, {
            'message status is 201': (r) => r.status === 201,
            'message response time < 300ms': (r) => r.timings.duration < 300,
          });
          messagingLatency.add(messageRes.timings.duration);
          requestRate.add(messageRes.status === 201);
          sleep(1);

          // 11. Fetch Message Thread
          const threadsRes = http.get(`${API_BASE}/hire-agreements/${hireAgreementId}/messages`);
          check(threadsRes, {
            'thread fetch status is 200': (r) => r.status === 200,
            'thread response time < 300ms': (r) => r.timings.duration < 300,
          });
          messagingLatency.add(threadsRes.timings.duration);
          requestRate.add(threadsRes.status === 200);
          sleep(1);
        }
      } else {
        // 6b. Reject Offer (50% chance)
        const rejectRes = http.post(
          `${API_BASE}/service-offers/${offerId}/reject`,
          JSON.stringify({ reason: 'Rate too high' }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
        check(rejectRes, {
          'reject offer status is 200': (r) => r.status === 200,
        });
        offerLatency.add(rejectRes.timings.duration);
        requestRate.add(rejectRes.status === 200);
        sleep(1);
      }
    }
  }

  // 12. Subscription Tier Fetch
  const tiersRes = http.get(`${API_BASE}/subscriptions/tiers`);
  check(tiersRes, {
    'tiers status is 200': (r) => r.status === 200,
  });
  requestRate.add(tiersRes.status === 200);
  sleep(1);

  // Track active connections
  activeConnections.add(-1);

  // Think time between iterations
  sleep(Math.random() * 5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  // Simple text summary
  let summary = '\n=== Load Test Results ===\n';
  summary += `Total Requests: ${data.metrics.request_success_rate?.values?.count || 0}\n`;
  summary += `Success Rate: ${(data.metrics.request_success_rate?.values?.rate * 100).toFixed(2)}%\n`;
  summary += `Service P95: ${(data.metrics.service_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Intake P95: ${(data.metrics.intake_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Offer P95: ${(data.metrics.offer_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Verification P95: ${(data.metrics.verification_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Video P95: ${(data.metrics.video_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Messaging P95: ${(data.metrics.messaging_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += '=========================\n';
  return summary;
}
