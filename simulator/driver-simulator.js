import { parseArgs } from 'node:util';
import { Client } from '@stomp/stompjs';
import WebSocket from 'ws';

const { values: args } = parseArgs({
    options: {
        email: { type: 'string' },
        password: { type: 'string' },
        orderId: { type: 'string' },
        fromLat: { type: 'string' },
        fromLng: { type: 'string' },
        toLat: { type: 'string' },
        toLng: { type: 'string' },
        serverUrl: { type: 'string', default: 'http://localhost:8080' },
        duration: { type: 'string', default: '60' },
        interval: { type: 'string', default: '4' },
    },
});

function requireArg(name) {
    if (!args[name]) {
        console.error(`Missing required --${name}`);
        process.exit(1);
    }
    return args[name];
}

const email = requireArg('email');
const password = requireArg('password');
const orderId = requireArg('orderId');
const fromLat = Number(requireArg('fromLat'));
const fromLng = Number(requireArg('fromLng'));
const toLat = Number(requireArg('toLat'));
const toLng = Number(requireArg('toLng'));
const serverUrl = args.serverUrl.replace(/\/$/, '');
const durationSeconds = Number(args.duration);
const intervalSeconds = Number(args.interval);
const totalSteps = Math.max(1, Math.round(durationSeconds / intervalSeconds));

const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws/websocket';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ease(t) {
    return t * t * (3 - 2 * t);
}

function interpolate(from, to, t) {
    return from + (to - from) * ease(t);
}

async function login() {
    const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    }

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const tokenCookie = setCookies.find((c) => c && c.startsWith('token='));

    if (!tokenCookie) {
        throw new Error('Login succeeded but no "token" cookie was set - check server response.');
    }

    return tokenCookie.split(';')[0];
}

async function main() {
    console.log(`Logging in as ${email}...`);
    const cookie = await login();
    console.log('Login OK, cookie captured.');

    const client = new Client({
        webSocketFactory: () => new WebSocket(wsUrl, [], { headers: { Cookie: cookie } }),
        reconnectDelay: 0,
        onStompError: (frame) => {
            console.error('STOMP error:', frame.headers['message'], frame.body);
            process.exit(1);
        },
        onWebSocketClose: () => {
            console.log('WebSocket closed.');
        },
    });

    await new Promise((resolve, reject) => {
        client.onConnect = () => resolve();
        client.onWebSocketError = (err) => reject(err);
        client.activate();
    });

    console.log(`Connected. Simulating order ${orderId}: (${fromLat}, ${fromLng}) -> (${toLat}, ${toLng})`);
    console.log(`${totalSteps} steps over ${durationSeconds}s (every ${intervalSeconds}s).`);

    for (let step = 0; step <= totalSteps; step++) {
        const t = step / totalSteps;
        const lat = interpolate(fromLat, toLat, t);
        const lng = interpolate(fromLng, toLng, t);

        client.publish({
            destination: `/app/location/${orderId}`,
            body: JSON.stringify({ lat, lng }),
        });

        console.log(`[${step}/${totalSteps}] lat=${lat.toFixed(6)} lng=${lng.toFixed(6)}`);

        if (step < totalSteps) {
            await sleep(intervalSeconds * 1000);
        }
    }

    console.log('Destination reached. Disconnecting.');
    await client.deactivate();
    process.exit(0);
}

process.on('SIGINT', () => {
    console.log('\nInterrupted, exiting.');
    process.exit(0);
});

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
