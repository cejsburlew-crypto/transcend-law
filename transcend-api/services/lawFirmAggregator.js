const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

// Mapping of practice areas to law specialties
const PRACTICE_AREA_MAPPING = {
  'corporate': ['Corporate', 'Business', 'M&A', 'Mergers & Acquisitions'],
  'employment': ['Employment', 'Labor', 'Workplace', 'HR'],
  'intellectual': ['Intellectual Property', 'IP', 'Patent', 'Trademark', 'Copyright'],
  'contracts': ['Contract', 'Commercial'],
  'divorce': ['Divorce', 'Separation', 'Family Law'],
  'family': ['Family', 'Custody', 'Adoption'],
  'adoption': ['Adoption'],
  'realEstate': ['Real Estate', 'Property', 'Real Property'],
  'landlord': ['Landlord', 'Tenant', 'Lease'],
  'propertyDispute': ['Property Dispute', 'Boundary'],
  'taxLaw': ['Tax', 'Taxation'],
  'estateTax': ['Estate', 'Probate', 'Trust'],
  'criminalDefense': ['Criminal', 'Defense'],
  'whiteCollar': ['White Collar', 'Fraud', 'Securities'],
  'dui': ['DUI', 'Driving'],
  'civilLitigation': ['Litigation', 'Civil', 'Dispute'],
  'personalInjury': ['Personal Injury', 'Injury', 'Accident'],
  'medicalMalpractice': ['Medical Malpractice', 'Medical', 'Malpractice'],
  'construction': ['Construction', 'Construction Defect'],
  'bankruptcy': ['Bankruptcy'],
  'debtCollection': ['Debt', 'Collection'],
  'immigration': ['Immigration', 'Immigration Law'],
  'deportation': ['Deportation', 'Removal'],
  'administrative': ['Administrative', 'Regulatory'],
  'appeals': ['Appeals'],
  'publicDefender': ['Public Interest', 'Civil Rights'],
  'environmental': ['Environmental'],
  'securities': ['Securities'],
  'insurance': ['Insurance'],
  'healthcare': ['Healthcare', 'Health Law'],
  'entertainment': ['Entertainment'],
  'sports': ['Sports'],
  'animal': ['Animal'],
  'education': ['Education'],
  'nonprofitLaw': ['Nonprofit', 'Non-profit'],
  'elderLaw': ['Elder'],
};

class LawFirmAggregator {
  constructor() {
    this.data = null;
    this.cachedStats = null;
    this.lastUpdate = null;
  }

  loadAllCSVFiles() {
    const csvDir = path.join(__dirname, '../../');
    const csvFiles = fs.readdirSync(csvDir)
      .filter(f => f.endsWith('-law-firms.csv') || f.endsWith('_firms.csv'))
      .map(f => path.join(csvDir, f));

    const allFirms = [];
    const stateSet = new Set();

    csvFiles.forEach(filePath => {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const records = csv.parse(fileContent, { columns: true });
        allFirms.push(...records);
        records.forEach(r => stateSet.add(r.state));
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err.message);
      }
    });

    this.data = allFirms;
    return allFirms;
  }

  matchPracticeArea(practiceAreaText, specialtyId) {
    if (!practiceAreaText) return false;
    const keywords = PRACTICE_AREA_MAPPING[specialtyId] || [];
    const text = practiceAreaText.toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }

  aggregateStats() {
    if (!this.data) {
      this.loadAllCSVFiles();
    }

    const stats = {};
    const stateSet = new Set();

    // Initialize stats for all specialties
    Object.keys(PRACTICE_AREA_MAPPING).forEach(id => {
      stats[id] = {
        firmsCount: 0,
        attorneysCount: 0,
        statesSet: new Set(),
        firms: [],
      };
    });

    // Process each firm
    this.data.forEach(firm => {
      stateSet.add(firm.state);

      if (!firm.practice_areas) return;

      const practiceAreas = firm.practice_areas.split(';').map(p => p.trim());

      // For each specialty, check if this firm matches
      Object.keys(PRACTICE_AREA_MAPPING).forEach(specialtyId => {
        const matches = practiceAreas.some(area =>
          this.matchPracticeArea(area, specialtyId)
        );

        if (matches) {
          stats[specialtyId].firmsCount++;
          stats[specialtyId].statesSet.add(firm.state);

          const attyCount = parseInt(firm.estimated_attorney_count) || 0;
          if (attyCount > 0) {
            stats[specialtyId].attorneysCount += attyCount;
          }

          stats[specialtyId].firms.push({
            name: firm.firm_name,
            state: firm.state,
            attorneys: attyCount,
          });
        }
      });
    });

    // Convert sets to counts
    const finalStats = {};
    Object.keys(stats).forEach(id => {
      finalStats[id] = {
        firmsCount: stats[id].firmsCount,
        attorneysCount: stats[id].attorneysCount,
        statesAvailable: stats[id].statesSet.size,
      };
    });

    this.cachedStats = finalStats;
    this.lastUpdate = new Date();
    return finalStats;
  }

  getStats(force = false) {
    if (!this.cachedStats || force) {
      this.aggregateStats();
    }
    return this.cachedStats;
  }
}

module.exports = new LawFirmAggregator();
