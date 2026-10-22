'use strict';

const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const host = '0.0.0.0';
const apiPort = 3002;
const clientPort = 5151;
const viteEntry = path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
const children = [];
let stopping = false;

function assertPortAvailable(port, service) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use; stop the existing ${service} process and try again.`));
        return;
      }
      reject(error);
    });
    server.once('listening', () => server.close((error) => error ? reject(error) : resolve()));
    server.listen(port, host);
  });
}

function getLanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    const address = addresses?.find((entry) => entry.family === 'IPv4' && !entry.internal);
    if (address) return address.address;
  }
  return null;
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

async function main() {
  await assertPortAvailable(apiPort, 'backend');
  await assertPortAvailable(clientPort, 'frontend');

  const api = spawn(process.execPath, ['--watch', 'server.js'], {
    cwd: root,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(apiPort),
      ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'hashfood123',
    },
    stdio: 'inherit',
  });
  children.push(api);

  const client = spawn(process.execPath, [
    viteEntry,
    ...process.argv.slice(2),
    '--host', host,
    '--port', String(clientPort),
    '--strictPort',
  ], {
    cwd: path.join(root, 'client'),
    env: {
      ...process.env,
      HASH_FOOD_API_TARGET: `http://${host}:${apiPort}`,
    },
    stdio: 'inherit',
  });
  children.push(client);

  const lanAddress = getLanAddress();
  console.log(`\nHash Food frontend: http://127.0.0.1:${clientPort}`);
  if (lanAddress) console.log(`Open on this Wi-Fi: http://${lanAddress}:${clientPort}`);
  console.log(`Hash Food backend:  http://127.0.0.1:${apiPort} (LAN-enabled)`);
  console.log('Press Ctrl+C to stop both servers.\n');

  for (const child of children) {
    child.once('error', (error) => {
      console.error('Could not start a development server:', error.message);
      stop();
      process.exitCode = 1;
    });
    child.once('exit', (code) => {
      if (!stopping && code !== 0) {
        console.error(`A development server exited with code ${code ?? 'unknown'}.`);
        process.exitCode = 1;
        stop();
      }
    });
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
