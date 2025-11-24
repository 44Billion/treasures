#!/usr/bin/env node

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Recursively flattens a nested object into dot-notation keys
 * @param {object} obj - The object to flatten
 * @param {string} prefix - The prefix for nested keys
 * @returns {Set<string>} Set of all unique keys
 */
function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedKeys = flattenKeys(value, fullKey);
      nestedKeys.forEach(k => keys.add(k));
    }
  }
  
  return keys;
}

/**
 * Counts all unique keys in a translation file
 * @param {string} filePath - Path to the translation JSON file
 * @returns {Set<string>} Set of all unique keys
 */
function countKeys(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const translations = JSON.parse(content);
    return flattenKeys(translations);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Main execution
const localesDir = join(__dirname, '..', 'src', 'locales');
const files = readdirSync(localesDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.error('No translation files found in src/locales/');
  process.exit(1);
}

console.log('Checking translation parity...\n');

const results = {};
let allKeys = new Set();

// Count keys in each file
for (const file of files) {
  const filePath = join(localesDir, file);
  const keys = countKeys(filePath);
  results[file] = keys;
  keys.forEach(k => allKeys.add(k));
  console.log(`${file}: ${keys.size} keys`);
}

// Check for missing keys in each file
let hasErrors = false;
const expectedKeyCount = allKeys.size;

console.log(`\nExpected key count: ${expectedKeyCount}\n`);

for (const [file, keys] of Object.entries(results)) {
  const missingKeys = [...allKeys].filter(k => !keys.has(k));
  
  if (keys.size < expectedKeyCount) {
    hasErrors = true;
    console.error(`❌ ${file} is missing ${missingKeys.length} key(s):`);
    missingKeys.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.error('');
  } else {
    console.log(`✅ ${file}: All keys present`);
  }
}

if (hasErrors) {
  console.error('\n❌ Translation parity check failed!');
  console.error('All translation files must have the same number of keys.');
  process.exit(1);
} else {
  console.log('\n✅ All translation files have parity!');
  process.exit(0);
}

