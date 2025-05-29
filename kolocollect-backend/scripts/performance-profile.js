const { execSync } = require('child_process');
const path = require('path');

// Define the profiling command
const command = process.argv[2] || 'doctor';
const validCommands = ['doctor', 'flame', 'bubbleprof', 'heapprofiler'];

if (!validCommands.includes(command)) {
  console.error(`Invalid command: ${command}`);
  console.error(`Valid commands are: ${validCommands.join(', ')}`);
  process.exit(1);
}

// Run the profiling
console.log(`Running performance profiling with clinic ${command}`);
try {
  execSync(`npx clinic ${command} -- node server.js`, {
    stdio: 'inherit',
    env: { ...process.env, PORT: 6001 } // Use different port for testing
  });
} catch (error) {
  console.error('Error running performance profiling:', error);
  process.exit(1);
}
