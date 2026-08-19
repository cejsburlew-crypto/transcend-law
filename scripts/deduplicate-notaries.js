#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const notaryFile = path.join(__dirname, '../transcend-frontend/src/data/active-notary.txt');
const outputFile = path.join(__dirname, '../transcend-frontend/src/data/active-notary-dedup.txt');
const logFile = path.join(__dirname, '../deduplicate-notaries.log');

const seen = new Set();
const duplicates = [];
let headerLine = '';
let uniqueCount = 0;
let duplicateCount = 0;

const writeStream = fs.createWriteStream(outputFile);
const logStream = fs.createWriteStream(logFile);

const rl = readline.createInterface({
  input: fs.createReadStream(notaryFile),
  crlfDelay: Infinity
});

let lineNumber = 0;

rl.on('line', (line) => {
  lineNumber++;

  if (lineNumber === 1) {
    headerLine = line;
    writeStream.write(line + '\n');
    return;
  }

  const parts = line.split('\t');
  if (parts.length < 9) return;

  const [name, businessName, address, city, state, zipCode, countyNum, commissionNum] = parts;

  // Create a dedup key using name + state + commission number
  const dedupKey = `${name.trim().toUpperCase()}|${state.trim().toUpperCase()}|${commissionNum.trim()}`;

  if (seen.has(dedupKey)) {
    duplicateCount++;
    duplicates.push({
      line: lineNumber,
      name: name.trim(),
      state: state.trim(),
      commission: commissionNum.trim(),
      dedupKey
    });
  } else {
    seen.add(dedupKey);
    uniqueCount++;
    writeStream.write(line + '\n');
  }

  if (lineNumber % 10000 === 0) {
    console.log(`Processed ${lineNumber} lines... (${uniqueCount} unique, ${duplicateCount} duplicates)`);
  }
});

rl.on('close', () => {
  writeStream.end();

  // Write duplicate log
  logStream.write(`Duplicate Notary Records Removed\n`);
  logStream.write(`================================\n\n`);
  logStream.write(`Total Lines Processed: ${lineNumber - 1}\n`);
  logStream.write(`Unique Records: ${uniqueCount}\n`);
  logStream.write(`Duplicate Records: ${duplicateCount}\n`);
  logStream.write(`Removal Rate: ${((duplicateCount / (lineNumber - 1)) * 100).toFixed(2)}%\n\n`);

  if (duplicates.length > 0) {
    logStream.write(`Duplicates Found:\n`);
    duplicates.forEach((dup, idx) => {
      logStream.write(`${idx + 1}. Line ${dup.line}: ${dup.name} (${dup.state}) - Commission: ${dup.commission}\n`);
    });
  }

  logStream.end();

  console.log(`\n✓ Deduplication complete!`);
  console.log(`  Total input lines: ${lineNumber - 1}`);
  console.log(`  Unique records kept: ${uniqueCount}`);
  console.log(`  Duplicate records removed: ${duplicateCount}`);
  console.log(`  Duplicate rate: ${((duplicateCount / (lineNumber - 1)) * 100).toFixed(2)}%`);
  console.log(`\n  Output: ${outputFile}`);
  console.log(`  Log: ${logFile}`);
});

rl.on('error', (error) => {
  console.error('Error reading file:', error);
  process.exit(1);
});
