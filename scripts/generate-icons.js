#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if sharp is available, install temporarily if needed
let sharpInstalled = false;
try {
  await import('sharp');
} catch (error) {
  console.log('Installing sharp temporarily...');
  execSync('npm install --save-dev sharp', { stdio: 'inherit' });
  sharpInstalled = true;
}

const sharp = (await import('sharp')).default;

const inputFile = path.join(__dirname, '../public/icon.png');
const outputDir = path.join(__dirname, '../public');

// Icon sizes needed
const iconSizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' }
];

async function generateIcons() {
  console.log('Generating icons from icon.png...');
  
  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error('Error: icon.png not found in public directory');
    process.exit(1);
  }

  try {
    // Generate all icon sizes
    for (const { size, name } of iconSizes) {
      await sharp(inputFile)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 90 })
        .toFile(path.join(outputDir, name));
      
      console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    // Copy 32x32 PNG as favicon.ico
    fs.copyFileSync(
      path.join(outputDir, 'favicon-32x32.png'),
      path.join(outputDir, 'favicon.ico')
    );
    console.log('✓ Generated favicon.ico');

    console.log('✓ Generated all icon sizes successfully!');
    
    // Clean up sharp if we installed it
    if (sharpInstalled) {
      console.log('Removing temporary sharp installation...');
      execSync('npm uninstall sharp', { stdio: 'inherit' });
    }
    
  } catch (error) {
    console.error('Error generating icons:', error);
    
    // Clean up sharp if we installed it and there was an error
    if (sharpInstalled) {
      try {
        execSync('npm uninstall sharp', { stdio: 'inherit' });
      } catch (cleanupError) {
        console.error('Error cleaning up sharp:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

generateIcons();