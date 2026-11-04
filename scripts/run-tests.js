const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');

const testFiles = readdirSync('tests')
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => path.join('tests', file));

const result = spawnSync(
    process.execPath,
    ['--test', '--require', 'ts-node/register', ...testFiles],
    {
        env: {
            ...process.env,
            TS_NODE_PROJECT: path.join('tests', 'tsconfig.json'),
        },
        stdio: 'inherit',
    },
);

if (result.error) {
    console.error('Unable to run the test suite:', result.error);
    process.exit(1);
}

process.exit(result.status ?? 1);
