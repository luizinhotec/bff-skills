'use strict';

const fs = require('fs');
const path = require('path');
const { run } = require('./index.cjs');

const filePath = process.argv[2];

if (!filePath) {
  console.error(JSON.stringify({ ok: false, error: 'MISSING_INPUT_FILE' }));
  process.exit(1);
}

const payload = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
);

process.stdout.write(JSON.stringify(run(payload), null, 2) + '\n');
