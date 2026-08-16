import { Router, Request, Response } from 'express';

const router = Router();

// Mock notary data - will be fetched from database in production
const NOTARIES_BY_STATE: Record<string, any[]> = {
  CA: [
    { id: 'n-ca-001', name: 'Maria Rodriguez', state: 'CA', county: 'San Francisco', city: 'San Francisco', certificationLevel: 'Certified Signing Agent', rating: 4.9, reviews: 287, phone: '415-555-0101', email: 'maria@notary.com', verified: true, specialties: ['Loan Signing', 'Mortgage Documents'] },
    { id: 'n-ca-002', name: 'James Wilson', state: 'CA', county: 'Alameda', city: 'Oakland', certificationLevel: 'Mobile Notary', rating: 4.8, reviews: 156, phone: '510-555-0102', email: 'james@notary.com', verified: true, specialties: ['General Notarization', 'Affidavits'] },
    { id: 'n-ca-003', name: 'Sarah Johnson', state: 'CA', county: 'Los Angeles', city: 'Los Angeles', certificationLevel: 'eNotary', rating: 4.7, reviews: 342, phone: '213-555-0103', email: 'sarah@notary.com', verified: true, specialties: ['Remote Video Notarization'] },
    { id: 'n-ca-004', name: 'David Chen', state: 'CA', county: 'San Diego', city: 'San Diego', certificationLevel: 'Certified Signing Agent', rating: 4.9, reviews: 198, phone: '858-555-0104', email: 'david@notary.com', verified: true, specialties: ['Loan Signing', 'Power of Attorney'] },
    { id: 'n-ca-005', name: 'Lisa Thompson', state: 'CA', county: 'Orange', city: 'Anaheim', certificationLevel: 'Mobile Notary', rating: 4.8, reviews: 224, phone: '714-555-0105', email: 'lisa@notary.com', verified: true, specialties: ['General Notarization', 'Document Authentication'] },
  ],
  TX: [
    { id: 'n-tx-001', name: 'David Williams', state: 'TX', county: 'Harris', city: 'Houston', certificationLevel: 'Certified Signing Agent', rating: 4.9, reviews: 301, phone: '713-555-0201', email: 'david.tx@notary.com', verified: true, specialties: ['Loan Signing', 'Mortgage Documents'] },
    { id: 'n-tx-002', name: 'Lisa Anderson', state: 'TX', county: 'Dallas', city: 'Dallas', certificationLevel: 'Mobile Notary', rating: 4.8, reviews: 267, phone: '214-555-0202', email: 'lisa.tx@notary.com', verified: true, specialties: ['General Notarization', 'Affidavits'] },
    { id: 'n-tx-003', name: 'Carlos Martinez', state: 'TX', county: 'Travis', city: 'Austin', certificationLevel: 'eNotary', rating: 4.7, reviews: 189, phone: '512-555-0203', email: 'carlos@notary.com', verified: true, specialties: ['Remote Video Notarization', 'Multi-State RON'] },
  ],
  FL: [
    { id: 'n-fl-001', name: 'Patricia Brown', state: 'FL', county: 'Miami-Dade', city: 'Miami', certificationLevel: 'Certified Signing Agent', rating: 4.9, reviews: 276, phone: '305-555-0301', email: 'patricia@notary.com', verified: true, specialties: ['Loan Signing', 'Mortgage Documents'] },
    { id: 'n-fl-002', name: 'Robert Wilson', state: 'FL', county: 'Orange', city: 'Orlando', certificationLevel: 'Mobile Notary', rating: 4.8, reviews: 213, phone: '407-555-0302', email: 'robert@notary.com', verified: true, specialties: ['General Notarization', 'Document Authentication'] },
  ],
  NY: [
    { id: 'n-ny-001', name: 'Elizabeth Martinez', state: 'NY', county: 'New York', city: 'New York', certificationLevel: 'Certified Signing Agent', rating: 4.9, reviews: 312, phone: '212-555-0401', email: 'elizabeth@notary.com', verified: true, specialties: ['Loan Signing', 'Mortgage Documents'] },
    { id: 'n-ny-002', name: 'Christopher Taylor', state: 'NY', county: 'Kings', city: 'Brooklyn', certificationLevel: 'eNotary', rating: 4.8, reviews: 245, phone: '718-555-0402', email: 'chris@notary.com', verified: true, specialties: ['Remote Video Notarization', 'Multi-State RON'] },
  ],
};

// GET /api/v2/notaries - Search notaries
router.get('/', async (req: Request, res: Response) => {
  try {
    const state = (req.query.state as string) || 'CA';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const data = NOTARIES_BY_STATE[state] || [];
    const paginated = data.slice(offset, offset + limit);

    res.json({
      data: paginated.map(n => ({
        id: n.id,
        name: n.name,
        state: n.state,
        county: n.county,
        city: n.city,
        certificationLevel: n.certificationLevel,
        rating: n.rating,
        reviews: n.reviews,
        availableToday: true,
        nextAvailable: '< 1 hour',
        location: `${n.city}, ${n.state}`,
        responseTime: '< 30 min',
        specialties: n.specialties || [],
        phone: n.phone,
        email: n.email,
        verified: n.verified,
      })),
      pagination: {
        total: data.length,
        limit,
        offset,
        hasMore: offset + limit < data.length,
      },
    });
  } catch (error) {
    console.error('Error fetching notaries:', error);
    res.status(500).json({ error: 'Failed to fetch notaries', details: String(error) });
  }
});

// GET /api/v2/notaries/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    for (const state in NOTARIES_BY_STATE) {
      const notary = NOTARIES_BY_STATE[state].find(n => n.id === id);
      if (notary) {
        return res.json(notary);
      }
    }

    res.status(404).json({ error: 'Notary not found' });
  } catch (error) {
    console.error('Error fetching notary:', error);
    res.status(500).json({ error: 'Failed to fetch notary' });
  }
});

export default router;
