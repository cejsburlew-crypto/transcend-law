// K6 Load Test: Real-Time Messaging
// Simulates concurrent messaging under load

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';

// Custom metrics
const messageLatency = new Trend('message_send_latency');
const pollLatency = new Trend('poll_latency');
const messageErrors = new Counter('message_errors');
const pollErrors = new Counter('poll_errors');
const requestRate = new Rate('messaging_success_rate');
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const activeUsers = new Gauge('active_users');
const wsErrors = new Counter('websocket_errors');

export const options = {
  vus: 50,
  duration: '5m',
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 users
    { duration: '2m', target: 50 },   // Ramp-up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    'message_send_latency': ['p(95)<300', 'p(99)<600'],
    'poll_latency': ['p(95)<200', 'p(99)<400'],
    'messaging_success_rate': ['rate>0.99'],
  },
};

const API_BASE = 'http://localhost:3000/api/v2';
const WS_URL = 'ws://localhost:3000';

export default function () {
  activeUsers.add(1);

  // Simulate user IDs
  const userId = `user_${__VU}`;
  const hireAgreementId = `hire_${Math.floor(Math.random() * 100) + 1}`;

  // 1. Send messages (poll-based, 3-second interval simulation)
  const sendMessageAndPoll = () => {
    // Send message
    const messagePayload = JSON.stringify({
      hire_agreement_id: parseInt(hireAgreementId.split('_')[1]),
      message: `Message from user ${__VU} at ${new Date().toISOString()}`,
      type: 'text',
    });

    const sendRes = http.post(`${API_BASE}/messages`, messagePayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(sendRes, {
      'send message status is 201': (r) => r.status === 201,
      'send message latency < 300ms': (r) => r.timings.duration < 300,
    });

    messageLatency.add(sendRes.timings.duration);
    requestRate.add(sendRes.status === 201);

    if (sendRes.status !== 201) {
      messageErrors.add(1);
    } else {
      messagesSent.add(1);
    }

    // Poll for new messages (simulate 3-second polling)
    sleep(0.5);

    const pollRes = http.get(
      `${API_BASE}/hire-agreements/${parseInt(hireAgreementId.split('_')[1])}/messages`
    );

    check(pollRes, {
      'poll messages status is 200': (r) => r.status === 200,
      'poll latency < 200ms': (r) => r.timings.duration < 200,
    });

    pollLatency.add(pollRes.timings.duration);
    requestRate.add(pollRes.status === 200);

    if (pollRes.status !== 200) {
      pollErrors.add(1);
    } else {
      messagesReceived.add(1);
    }

    sleep(0.5);
  };

  // Execute message send/poll sequence
  for (let i = 0; i < 3; i++) {
    sendMessageAndPoll();
  }

  // 2. File upload (10% chance per iteration)
  if (Math.random() > 0.9) {
    const filePayload = JSON.stringify({
      hire_agreement_id: parseInt(hireAgreementId.split('_')[1]),
      message: 'Document attachment',
      type: 'file',
      file_name: `document_${__ITER}.pdf`,
      file_size: 5 * 1024 * 1024, // 5MB
    });

    const uploadRes = http.post(`${API_BASE}/messages`, filePayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(uploadRes, {
      'upload message status is 201': (r) => r.status === 201,
    });

    messageLatency.add(uploadRes.timings.duration);
    requestRate.add(uploadRes.status === 201);

    if (uploadRes.status === 201) {
      messagesSent.add(1);
    }

    sleep(0.5);
  }

  // 3. Mark messages as read (5% chance)
  if (Math.random() > 0.95) {
    const readRes = http.patch(
      `${API_BASE}/messages/${Math.floor(Math.random() * 1000)}/read`,
      {}
    );

    requestRate.add(readRes.status === 200 || readRes.status === 404);
    sleep(0.5);
  }

  // 4. Search messages (2% chance)
  if (Math.random() > 0.98) {
    const searchRes = http.get(
      `${API_BASE}/hire-agreements/${parseInt(hireAgreementId.split('_')[1])}/messages?search=contract`
    );

    check(searchRes, {
      'search status is 200': (r) => r.status === 200,
    });

    pollLatency.add(searchRes.timings.duration);
    requestRate.add(searchRes.status === 200);
  }

  activeUsers.add(-1);

  // Random think time (1-5 seconds between message batches)
  sleep(Math.random() * 4 + 1);
}

// WebSocket test for real-time messaging (optional, concurrent)
export function testWebSocketMessaging() {
  activeUsers.add(1);

  const url = `${WS_URL}/ws/messages/${Math.floor(Math.random() * 100) + 1}`;
  const res = ws.connect(url, null, function (socket) {
    socket.on('open', function open() {
      // Send initial connection message
      socket.send(
        JSON.stringify({
          type: 'connect',
          userId: `user_${__VU}`,
          timestamp: new Date().toISOString(),
        })
      );
    });

    socket.on('message', function (message) {
      // Receive incoming messages
      const data = JSON.parse(message);

      if (data.type === 'message') {
        messagesReceived.add(1);
      }

      // Echo message back
      socket.send(
        JSON.stringify({
          type: 'ack',
          messageId: data.id,
          timestamp: new Date().toISOString(),
        })
      );
    });

    socket.on('close', function () {
      // Connection closed
    });

    socket.on('error', function (e) {
      // Connection error
      wsErrors.add(1);
    });

    // Keep connection open for 2 minutes
    socket.setInterval(function () {
      socket.send(
        JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString(),
        })
      );
    }, 30000); // Ping every 30 seconds

    // Close after test duration
    socket.setTimeout(function () {
      socket.close();
    }, 120000); // 2 minutes
  });

  check(res, {
    'WebSocket connection successful': (r) => r.status === 101,
  });

  activeUsers.add(-1);
}

// Load test for concurrent typing indicators
export function testTypingIndicators() {
  const hireAgreementId = Math.floor(Math.random() * 100) + 1;

  for (let i = 0; i < 5; i++) {
    const typingRes = http.post(
      `${API_BASE}/hire-agreements/${hireAgreementId}/typing-start`,
      JSON.stringify({
        userId: `user_${__VU}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(typingRes, {
      'typing indicator status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    sleep(1);

    const stopTypingRes = http.post(
      `${API_BASE}/hire-agreements/${hireAgreementId}/typing-stop`,
      JSON.stringify({
        userId: `user_${__VU}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(stopTypingRes, {
      'stop typing status is 200': (r) => r.status === 200,
    });

    sleep(0.5);
  }
}

// Load test for read receipts
export function testReadReceipts() {
  const hireAgreementId = Math.floor(Math.random() * 100) + 1;

  // Fetch messages
  const messagesRes = http.get(`${API_BASE}/hire-agreements/${hireAgreementId}/messages`);

  if (messagesRes.status === 200) {
    const messages = JSON.parse(messagesRes.body).data || [];

    // Mark random messages as read
    messages.forEach((msg) => {
      if (Math.random() > 0.7) {
        const readRes = http.patch(`${API_BASE}/messages/${msg.id}/read`, {});
        requestRate.add(readRes.status === 200);
      }
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'messaging-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  let summary = '\n=== Messaging Load Test Results ===\n';
  summary += `Messages Sent: ${data.metrics.messages_sent?.values?.count || 0}\n`;
  summary += `Messages Received: ${data.metrics.messages_received?.values?.count || 0}\n`;
  summary += `Send Latency P95: ${(data.metrics.message_send_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Poll Latency P95: ${(data.metrics.poll_latency?.values?.['p(95)'] || 0).toFixed(0)}ms\n`;
  summary += `Success Rate: ${(data.metrics.messaging_success_rate?.values?.rate * 100).toFixed(2)}%\n`;
  summary += `Message Errors: ${data.metrics.message_errors?.values?.count || 0}\n`;
  summary += `Poll Errors: ${data.metrics.poll_errors?.values?.count || 0}\n`;
  summary += `WebSocket Errors: ${data.metrics.websocket_errors?.values?.count || 0}\n`;
  summary += '====================================\n';
  return summary;
}
