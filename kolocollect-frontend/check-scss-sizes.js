#!/usr/bin/env node

/**
 * Script to identify large SCSS files that need optimization
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Threshold for large SCSS files in KB
const WARNING_THRESHOLD_KB = 6;
const ERROR_THRESHOLD_KB = 10;

// Get all SCSS files in the project
function getAllScssFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const fileStat = fs.statSync(filePath);
    
    if (fileStat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('dist')) {
      getAllScssFiles(filePath, fileList);
    } else if (path.extname(file) === '.scss') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Check file sizes
function analyzeScssFiles(files) {
  const results = [];
  
  files.forEach(file => {
    const fileSize = fs.statSync(file).size;
    const fileSizeKB = fileSize / 1024;
    
    if (fileSizeKB > WARNING_THRESHOLD_KB) {
      results.push({
        path: file,
        size: fileSizeKB.toFixed(2),
        status: fileSizeKB > ERROR_THRESHOLD_KB ? 'ERROR' : 'WARNING'
      });
    }
  });
  
  return results.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
}

// Format output
function printResults(results) {
  console.log('\n=== SCSS File Size Analysis ===');
  console.log('Files exceeding size thresholds:');
  console.log(`Warning: ${WARNING_THRESHOLD_KB}KB | Error: ${ERROR_THRESHOLD_KB}KB\n`);
  
  if (results.length === 0) {
    console.log('✅ All SCSS files are within size limits! Great job!');
    return;
  }
  
  console.log('| Status  | Size (KB) | File Path');
  console.log('|---------|-----------|--------------------------------------------------');
  
  results.forEach(result => {
    const statusSymbol = result.status === 'ERROR' ? '❌' : '⚠️';
    console.log(`| ${statusSymbol} ${result.status.padEnd(6)} | ${result.size.padEnd(9)} | ${result.path}`);
  });
  
  console.log('\nTotal files exceeding thresholds: ' + results.length);
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  console.log(`Error-level files: ${errorCount}`);
  console.log(`Warning-level files: ${results.length - errorCount}`);
}

// Main execution
try {
  console.log('Scanning for SCSS files...');
  const rootDir = path.resolve(__dirname, 'src');
  const scssFiles = getAllScssFiles(rootDir);
  console.log(`Found ${scssFiles.length} SCSS files.`);
  
  const largeFiles = analyzeScssFiles(scssFiles);
  printResults(largeFiles);
  
} catch (error) {
  console.error('Error analyzing SCSS files:', error);
}
