const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('homepage loads the public site script instead of the admin portal script', () => {
  assert.match(indexHtml, /<script src="js\/main\.js\?v=\d+" defer><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="main\.js\?v=/);
});
