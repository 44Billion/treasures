#!/usr/bin/env node

/**
 * Fetch hero images for the curated treasures carousel.
 *
 * Connects to the relay, resolves each curated naddr, downloads the first
 * image of each event, compresses it to up to 1920px-wide WebP (q80, 600KB
 * cap) via sharp, and writes it to public/hero/curated-<index>.webp.
 *
 * Also writes public/hero/curated.json — an ordered manifest mapping each
 * curated treasure to its local image filename so the frontend can resolve
 * naddr → local path without fetching the image from the remote server.
 *
 * Usage:
 *   node scripts/fetch-hero-images.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import WebSocket from 'ws';
import { nip19 } from 'nostr-tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HERO_DIR = path.join(__dirname, '../public/hero');
const RELAY_URL = 'wss://relay.ditto.pub';
const IMAGE_WIDTH_MAX = 1920;
const IMAGE_WIDTH_MIN = 1280;
const IMAGE_WIDTH_STEP = 160;
const MAX_BYTES = 600 * 1024; // 600 KB hard ceiling
const WEBP_QUALITY = 80;

/**
 * Same list as src/hooks/useCuratedTreasures.ts — keep in sync.
 */
const CURATED_NADDRS = [
  'naddr1qvzqqqyj3spzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqy9ekzen994kkzem9de6xztt8wfshxumgdac8qetj95unxv3kxy6r2dcyc5sxz',
  'naddr1qvzqqqyj3vpzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqr4mxzuned9hxwttzv45kwefdvd6kx6m0duknjvejxccngdfhjtmdv6',
  'naddr1qvzqqqyj3spzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsqfnswfhkwun9wdekjan994shqunfvdhhgttrdpsk6etvv4hkutfexvervvf5x5ms5pltzh',
  'naddr1qvzqqqyj3spzqgynh25xy8zmy40g7n7zcm7lcyxc54vc5f23wejwl2agvpe47ypsqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsqp35xumryve3v8qhcg',
  'naddr1qvzqqqyj3spzqprpljlvcnpnw3pejvkkhrc3y6wvmd7vjuad0fg2ud3dky66gaxaqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsqxmxv9hxx7fddaexzmn8v5kkxmmjv9kz6vp5xcckvcmzv5xp5x46',
  'naddr1qvzqqqyj3spzpn5hxe78t47er7umcw7xladm80d49svfgxluuteksctde0c2mlf0qy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsq8t8wfskgatpdskkx7tpdckkcmmzwd6x2u3dvdjnjdenxcmkxfcpj0e',
  'naddr1qvzqqqyj3vpzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qyt8wumn8ghj7un9d3shjtnwdaehgu3wvfskueqpz4mhxue69uhkg6t5w3hjuur4vghhyetvv9usqxnrv93ksefdxymn2vpsxq6n2dpc8qungttev35h5mmrrr7kdd',
  'naddr1qvzqqqyj3vpzpgfduuysj5zjup023e423f35k7dmzxfc8jfctrde3cqudl8hn0ulqyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqr46kuer9wgkhg6r994kxzun8v5khymmrdvkkzvfjv3jnwvpefwmkxn',
];

/** Decode all naddrs up front. */
function decodeCuratedNaddrs() {
  const results = [];
  for (const naddr of CURATED_NADDRS) {
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type === 'naddr') {
        results.push({ ...decoded.data, naddr });
      }
    } catch {
      console.warn(`  Skipping invalid naddr: ${naddr.slice(0, 20)}...`);
    }
  }
  return results;
}

/**
 * Fetch a single Nostr event from the relay via raw WebSocket.
 * Returns the event object, or null if not found.
 */
function fetchEvent(relay, filter) {
  return new Promise((resolve) => {
    const subId = 'hero-' + Math.random().toString(36).slice(2, 8);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 10000);

    const handler = (msg) => {
      const data = JSON.parse(msg.toString());
      if (data[1] !== subId) return;

      if (data[0] === 'EVENT' && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        relay.off('message', handler);
        // Send CLOSE for this subscription
        relay.send(JSON.stringify(['CLOSE', subId]));
        resolve(data[2]);
      } else if (data[0] === 'EOSE' && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        relay.off('message', handler);
        relay.send(JSON.stringify(['CLOSE', subId]));
        resolve(null);
      }
    };

    relay.on('message', handler);
    relay.send(JSON.stringify(['REQ', subId, filter]));
  });
}

/** Connect to relay WebSocket and wait for open. */
function connectRelay(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Relay connection timeout')), 10000);
  });
}

/** Download a URL and return the response body as a Buffer. */
async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log('Fetching hero images for curated treasures...\n');

  const decoded = decodeCuratedNaddrs();
  console.log(`Decoded ${decoded.length} curated naddrs`);

  // Ensure output directory exists
  fs.mkdirSync(HERO_DIR, { recursive: true });

  // Connect to relay
  console.log(`Connecting to ${RELAY_URL}...`);
  const ws = await connectRelay(RELAY_URL);
  console.log('Connected.\n');

  const manifest = [];

  for (let i = 0; i < decoded.length; i++) {
    const item = decoded[i];
    const label = `[${i + 1}/${decoded.length}]`;
    const filename = `curated-${i}.webp`;
    const outPath = path.join(HERO_DIR, filename);

    console.log(`${label} Fetching event for d="${item.identifier}"...`);

    const event = await fetchEvent(ws, {
      kinds: [item.kind],
      authors: [item.pubkey],
      '#d': [item.identifier],
    });

    if (!event) {
      console.log(`${label}   Event not found, skipping.`);
      continue;
    }

    // Extract name
    const nameTag = event.tags.find(t => t[0] === 'name') || event.tags.find(t => t[0] === 'title');
    const name = nameTag ? nameTag[1] : item.identifier;

    // Extract first image URL
    const imageTag = event.tags.find(t => t[0] === 'image');
    if (!imageTag || !imageTag[1]) {
      console.log(`${label}   No image tag found for "${name}", skipping.`);
      continue;
    }

    const imageUrl = imageTag[1];
    console.log(`${label}   "${name}" — downloading ${imageUrl}...`);

    try {
      const raw = await downloadImage(imageUrl);
      const originalKB = (raw.length / 1024).toFixed(0);

      // Resize at fixed quality, reducing width if needed to stay under MAX_BYTES.
      // This preserves visual quality by trading resolution instead of compression.
      // If still over budget at minimum width, reduce quality as a last resort.
      let width = IMAGE_WIDTH_MAX;
      let quality = WEBP_QUALITY;
      let compressed;

      // First pass: reduce width at fixed quality
      while (true) {
        compressed = await sharp(raw)
          .rotate()
          .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
          .sharpen({ sigma: 0.5, m1: 1.0, m2: 0.5 })
          .webp({ quality, effort: 6, smartSubsample: true })
          .toBuffer();

        if (compressed.length <= MAX_BYTES || width <= IMAGE_WIDTH_MIN) break;
        width -= IMAGE_WIDTH_STEP;
      }

      // Second pass: if still over budget at min width, reduce quality
      while (compressed.length > MAX_BYTES && quality > 50) {
        quality -= 5;
        compressed = await sharp(raw)
          .rotate()
          .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
          .sharpen({ sigma: 0.5, m1: 1.0, m2: 0.5 })
          .webp({ quality, effort: 6, smartSubsample: true })
          .toBuffer();
      }

      const compressedKB = (compressed.length / 1024).toFixed(0);
      fs.writeFileSync(outPath, compressed);

      console.log(`${label}   ${originalKB} KB → ${compressedKB} KB (${width}px, q${quality})  ✓ ${filename}`);

      manifest.push({
        naddr: item.naddr,
        identifier: item.identifier,
        pubkey: item.pubkey,
        kind: item.kind,
        name,
        image: `/hero/${filename}`,
      });
    } catch (err) {
      console.log(`${label}   Failed to process image: ${err.message}`);
    }
  }

  ws.close();

  // Write manifest
  const manifestPath = path.join(HERO_DIR, 'curated.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${manifest.length} entries to ${path.relative(process.cwd(), manifestPath)}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
