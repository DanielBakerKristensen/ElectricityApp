import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

export const options = {
    stages: [
        { duration: '1m', target: 100 }, // Initial ramp
        { duration: '3m', target: 500 }, // PUSH: Ramp up to 500 users
        { duration: '5m', target: 500 }, // HOLD: Maintain 500 users
        { duration: '2m', target: 0 },   // Cool down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
        http_req_failed: ['rate<0.01'],    // Less than 1% errors
    },
};

export default function () {
    const params = {
        headers: {
            'Authorization': ADMIN_TOKEN ? `Bearer ${ADMIN_TOKEN}` : '',
            'Content-Type': 'application/json',
        },
    };

    group('Weather Feature', function () {
        const dateTo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateFrom = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        group('Load Correlation Data', function () {
            const res = http.get(
                `${BASE_URL}/api/weather/correlation?dateFrom=${dateFrom}&dateTo=${dateTo}`,
                params
            );

            check(res, {
                'weather correlation status is 200': (r) => r.status === 200,
                'has correlation results': (r) => {
                    try { return r.json().success === true; } catch (e) { return false; }
                },
            });
        });

        group('Load Weather & Consumption', function () {
            const res = http.get(
                `${BASE_URL}/api/weather/consumption-temperature?dateFrom=${dateFrom}&dateTo=${dateTo}`,
                params
            );

            check(res, {
                'weather consumption status is 200': (r) => r.status === 200,
                'has weather data': (r) => {
                    try { return r.json().data && r.json().data.length > 0; } catch (e) { return false; }
                },
            });
        });
    });

    group('System Health', function () {
        const res = http.get(`${BASE_URL}/api/health`);
        const isOk = check(res, {
            'health status is 200': (r) => r.status === 200,
        });

        if (isOk) {
            try {
                const body = res.json();
                check(res, {
                    'status is OK': (r) => body.status === 'OK' || body.status === 'DEGRADED',
                });
            } catch (e) { }
        }
    });
}
