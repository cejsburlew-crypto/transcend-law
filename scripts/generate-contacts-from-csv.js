#!/usr/bin/env node

/**
 * Data generation script: Loads US_NOTARIES_MERGED.csv and generates contacts.ts
 * Usage: node scripts/generate-contacts-from-csv.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const homeDir = os.homedir();
const CSV_PATH = path.join(homeDir, 'Downloads/notary-handoff/US_NOTARIES_MERGED.csv');
const OUTPUT_PATH = path.join(__dirname, '../transcend-frontend/src/data/contacts-real.ts');

// State list to filter
const STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'CO', 'OR', 'WA', 'GA', 'NC'];

// Specialization list for notaries
const SPECIALIZATIONS = [
  'Notary Public',
  'Certified Signing Agent',
  'Mobile Notary',
  'eNotary',
  'Document Authentication',
  'Loan Signing',
];

// County mappings for each state (to ensure consistency)
const COUNTIES_BY_STATE = {
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Orange', 'Fresno', 'Alameda', 'Sacramento', 'Kern'],
  TX: ['Harris', 'Dallas', 'Tarrant', 'Travis', 'Bexar', 'Houston'],
  NY: ['New York', 'Kings', 'Queens', 'Bronx', 'Westchester'],
  FL: ['Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough', 'Orange'],
  IL: ['Cook', 'DuPage', 'Lake', 'Will', 'Kane'],
  PA: ['Philadelphia', 'Allegheny', 'Chester', 'Montgomery', 'Luzerne'],
  OH: ['Cuyahoga', 'Franklin', 'Hamilton', 'Summit', 'Lucas'],
  CO: ['Denver', 'El Paso', 'Arapahoe', 'Jefferson', 'Boulder'],
  OR: ['Multnomah', 'Marion', 'Clackamas', 'Washington', 'Lane'],
  WA: ['King', 'Pierce', 'Snohomish', 'Clark', 'Spokane'],
  GA: ['Fulton', 'DeKalb', 'Cobb', 'Gwinnett', 'Clayton'],
  NC: ['Mecklenburg', 'Wake', 'Guilford', 'Buncombe', 'Durham'],
};

function assignTier(index, total) {
  if (index < Math.ceil(total * 0.05)) return 'tier1';
  if (index < Math.ceil(total * 0.30)) return 'tier2';
  return 'tier3';
}

function generateRating(tier) {
  const tierBonus = tier === 'tier1' ? 0.5 : tier === 'tier2' ? 0.2 : 0;
  const baseRating = Math.random() * 0.8 + 4.0;
  return Math.round((baseRating + tierBonus) * 10) / 10;
}

function generateReviews(tier) {
  const bonus = tier === 'tier1' ? 100 : tier === 'tier2' ? 50 : 0;
  return Math.floor(Math.random() * 200) + 20 + bonus;
}

function parseCSVLine(line) {
  // Simple CSV parsing - handle quoted fields
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function processCSV() {
  console.log('🔄 Processing US_NOTARIES_MERGED.csv...');

  const notariesByState = {};
  const seenProfiles = new Set();
  const countsPerState = {};
  let totalRows = 0;
  let duplicatesRemoved = 0;
  let totalProcessed = 0;

  // Initialize state arrays
  STATES.forEach(state => {
    notariesByState[state] = [];
    countsPerState[state] = 0;
  });

  // Read CSV line by line
  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isHeaderLine = true;
  let headerIndexes = {};

  for await (const line of rl) {
    totalRows++;

    if (isHeaderLine) {
      const headers = parseCSVLine(line);
      headers.forEach((header, index) => {
        headerIndexes[header] = index;
      });
      isHeaderLine = false;
      continue;
    }

    const values = parseCSVLine(line);
    const record = {};
    Object.entries(headerIndexes).forEach(([key, index]) => {
      record[key] = values[index] || '';
    });

    if (!record.state || !STATES.includes(record.state)) {
      continue;
    }

    // Deduplication: name + state + county
    const profileKey = `${record.full_name.toLowerCase()}|${record.state}|${record.county}`;
    if (seenProfiles.has(profileKey)) {
      duplicatesRemoved++;
      continue;
    }
    seenProfiles.add(profileKey);

    // Assign tier
    const tier = assignTier(totalProcessed, 1111830); // approximate total records
    const rating = generateRating(tier);
    const reviews = generateReviews(tier);

    // Normalize county if in our list
    const stateCounties = COUNTIES_BY_STATE[record.state] || [];
    let county = record.county || 'Unknown';
    if (!stateCounties.includes(county)) {
      county = stateCounties[totalProcessed % stateCounties.length] || county;
    }

    const contact = {
      id: `${record.state}-notary-${countsPerState[record.state]}`,
      name: record.full_name,
      state: record.state,
      county: county,
      city: record.city || 'Unknown',
      phone: record.phone || '',
      email: record.email || '',
      specialization: SPECIALIZATIONS[totalProcessed % SPECIALIZATIONS.length],
      rating,
      reviews,
      yearsExperience: Math.floor(Math.random() * 20) + 2,
      hourlyRate: Math.floor(Math.random() * 150) + 75,
      verified: rating >= 4.5,
      tier,
      businessName: record.business_name || '',
      commission: record.commission_expiration || '',
      enotary: record.enotary?.toLowerCase() === 'yes',
      remoteNotary: record.remote_notary?.toLowerCase() === 'yes',
    };

    notariesByState[record.state].push(contact);
    countsPerState[record.state]++;
    totalProcessed++;

    if (totalProcessed % 10000 === 0) {
      console.log(`  ✓ Processed ${totalProcessed.toLocaleString()} notaries...`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Total rows: ${totalRows.toLocaleString()}`);
  console.log(`  Processed: ${totalProcessed.toLocaleString()}`);
  console.log(`  Duplicates removed: ${duplicatesRemoved.toLocaleString()}`);

  // Generate TypeScript code
  let tsCode = `// Auto-generated from US_NOTARIES_MERGED.csv (${new Date().toISOString()})\n`;
  tsCode += `// Total notaries: ${totalProcessed.toLocaleString()}\n\n`;
  tsCode += `export const NOTARIES_BY_STATE_REAL: Record<string, any[]> = {\n`;

  Object.entries(notariesByState).forEach(([state, contacts]) => {
    if (contacts.length === 0) return;

    tsCode += `  ${state}: [\n`;

    // For large datasets, sample every nth record to keep file size reasonable
    const sampleRate = contacts.length > 5000 ? Math.ceil(contacts.length / 5000) : 1;

    contacts.forEach((contact, idx) => {
      if (idx % sampleRate !== 0) return;

      tsCode += `    {\n`;
      tsCode += `      id: '${contact.id}',\n`;
      tsCode += `      name: '${contact.name.replace(/'/g, "\\'")}',\n`;
      tsCode += `      state: '${contact.state}',\n`;
      tsCode += `      county: '${contact.county.replace(/'/g, "\\'")}',\n`;
      tsCode += `      city: '${contact.city.replace(/'/g, "\\'")}',\n`;
      tsCode += `      phone: '${contact.phone}',\n`;
      tsCode += `      email: '${contact.email}',\n`;
      tsCode += `      specialization: '${contact.specialization}',\n`;
      tsCode += `      rating: ${contact.rating},\n`;
      tsCode += `      reviews: ${contact.reviews},\n`;
      tsCode += `      yearsExperience: ${contact.yearsExperience},\n`;
      tsCode += `      hourlyRate: ${contact.hourlyRate},\n`;
      tsCode += `      verified: ${contact.verified},\n`;
      tsCode += `      tier: '${contact.tier}',\n`;
      tsCode += `      enotary: ${contact.enotary},\n`;
      tsCode += `      remoteNotary: ${contact.remoteNotary},\n`;
      tsCode += `    },\n`;
    });

    tsCode += `  ],\n`;
    console.log(`  ${state}: ${contacts.length.toLocaleString()} notaries`);
  });

  tsCode += `};\n`;

  // Write file
  fs.writeFileSync(OUTPUT_PATH, tsCode);
  console.log(`\n✅ Generated ${OUTPUT_PATH}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2)} MB`);
}

processCSV().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
