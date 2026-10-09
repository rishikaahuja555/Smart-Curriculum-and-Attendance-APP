import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

process.env.NODE_ENV = 'development';
process.env.AIRS_SEED_DEMO ||= '1';
process.env.AIRS_DEMO_PASSWORD ||= 'Demo-only-AIRS-2026';
process.env.AIRS_DEMO_LOGIN ||= '1';
const node = process.execPath;
const requestedPort = Number(process.env.API_PORT) || 3001;

function canListen(port) {
  const probe = createServer();
  return new Promise((resolve, reject) => {
    probe.once('error', (error) => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
    probe.listen(port, '127.0.0.1', () => probe.close((error) => error ? reject(error) : resolve(true)));
  });
}

async function findAvailablePort() {
  if (await canListen(requestedPort)) return requestedPort;
  const probe = createServer();
  return new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const apiPort = await findAvailablePort();
process.env.API_PORT = String(apiPort);
if (apiPort !== requestedPort) console.warn(`API port ${requestedPort} is busy; using ${apiPort}.`);

const children = [
  spawn(node, ['server/index.js'], { stdio: 'inherit', env: process.env }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit', env: process.env })
];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
