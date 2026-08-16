import { VercelRequest, VercelResponse } from '@vercel/node';

const NOTARIES_BY_STATE: Record<string, any[]> = {
  CA: Array.from({ length: 50 }, (_, i) => ({
    id: `ca-notary-${i}`,
    name: `Notary ${i + 1}`,
    state: 'CA',
    county: 'Various',
    city: 'California',
    certificationLevel: i % 3 === 0 ? 'Certified Signing Agent' : i % 3 === 1 ? 'Mobile Notary' : 'eNotary',
    rating: (Math.random() * 0.5 + 4.5).toFixed(1),
    reviews: Math.floor(Math.random() * 300) + 50,
    availableToday: true,
    nextAvailable: '< 1 hour',
    location: `Various, CA`,
    responseTime: '< 30 min',
    specialties: ['Notarization', 'Document Authentication'],
    phone: `415-555-${String(i).padStart(4, '0')}`,
    email: `notary${i}@CA.com`,
    verified: true,
  })),
  TX: Array.from({ length: 40 }, (_, i) => ({
    id: `tx-notary-${i}`,
    name: `Notary ${i + 1}`,
    state: 'TX',
    county: 'Various',
    city: 'Texas',
    certificationLevel: i % 3 === 0 ? 'Certified Signing Agent' : 'Mobile Notary',
    rating: (Math.random() * 0.5 + 4.5).toFixed(1),
    reviews: Math.floor(Math.random() * 250) + 40,
    availableToday: true,
    nextAvailable: '< 1 hour',
    location: `Various, TX`,
    responseTime: '< 30 min',
    specialties: ['Notarization', 'Loan Signing'],
    phone: `713-555-${String(i).padStart(4, '0')}`,
    email: `notary${i}@TX.com`,
    verified: true,
  })),
  FL: Array.from({ length: 35 }, (_, i) => ({
    id: `fl-notary-${i}`,
    name: `Notary ${i + 1}`,
    state: 'FL',
    county: 'Various',
    city: 'Florida',
    certificationLevel: 'Notary Public',
    rating: (Math.random() * 0.5 + 4.4).toFixed(1),
    reviews: Math.floor(Math.random() * 200) + 30,
    availableToday: true,
    nextAvailable: '< 1 hour',
    location: `Various, FL`,
    responseTime: '< 45 min',
    specialties: ['Notarization', 'Document Authentication'],
    phone: `305-555-${String(i).padStart(4, '0')}`,
    email: `notary${i}@FL.com`,
    verified: true,
  })),
  NY: Array.from({ length: 30 }, (_, i) => ({
    id: `ny-notary-${i}`,
    name: `Notary ${i + 1}`,
    state: 'NY',
    county: 'Various',
    city: 'New York',
    certificationLevel: i % 2 === 0 ? 'Notary Public' : 'eNotary',
    rating: (Math.random() * 0.5 + 4.5).toFixed(1),
    reviews: Math.floor(Math.random() * 220) + 35,
    availableToday: true,
    nextAvailable: '< 1 hour',
    location: `Various, NY`,
    responseTime: '< 30 min',
    specialties: ['Notarization', 'Remote Notarization'],
    phone: `212-555-${String(i).padStart(4, '0')}`,
    email: `notary${i}@NY.com`,
    verified: true,
  })),
  IL: Array.from({ length: 25 }, (_, i) => ({
    id: `il-notary-${i}`,
    name: `Notary ${i + 1}`,
    state: 'IL',
    county: 'Various',
    city: 'Illinois',
    certificationLevel: 'Notary Public',
    rating: (Math.random() * 0.5 + 4.4).toFixed(1),
    reviews: Math.floor(Math.random() * 180) + 25,
    availableToday: true,
    nextAvailable: '< 2 hours',
    location: `Various, IL`,
    responseTime: '< 45 min',
    specialties: ['Notarization', 'Document Authentication'],
    phone: `312-555-${String(i).padStart(4, '0')}`,
    email: `notary${i}@IL.com`,
    verified: true,
  })),
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const state = (req.query.state as string) || 'CA';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const data = NOTARIES_BY_STATE[state] || NOTARIES_BY_STATE['CA'];
    const paginated = data.slice(offset, offset + limit);

    return res.status(200).json({
      data: paginated,
      pagination: {
        total: data.length,
        limit,
        offset,
        hasMore: offset + limit < data.length,
      },
    });
  } catch (error) {
    console.error('Error fetching notaries:', error);
    return res.status(500).json({ error: 'Failed to fetch notaries', details: String(error) });
  }
}
