const lines = [
  'Scanning access log (48,211 entries, 2024-05-01 to 2024-05-07)...',
  'Found 1,204 requests that returned HTTP 500 from /api/checkout.',
  'The error rate spiked on May 4 between 14:00 and 16:00 UTC, reaching 9.8%.',
  'Most failures share the stack trace "TypeError: Cannot read properties of undefined (reading \'currency\')".',
  'The failing requests all came from the mobile app version 3.2.0.',
  'Requests from web clients and app version 3.1.x were not affected.',
  'Average latency for successful checkouts rose from 220 ms to 610 ms during the spike.',
  'A deploy of payments-service v2.14 happened at 13:52 UTC on May 4.',
  'Recommendation: inspect how payments-service v2.14 handles a missing currency field sent by app 3.2.0.',
];
console.log(lines.join('\n'));
