import { VercelRequest, VercelResponse } from '@vercel/node';

// Generate notary data
function generateNotaries(state: string, count: number) {
  const certifications = ['Notary Public', 'Certified Signing Agent', 'Mobile Notary', 'eNotary'];

  return Array.from({ length: count }, (_, i) => ({
    id: `${state}-notary-${i}`,
    name: `Notary ${String(i + 1).padStart(4, '0')}`,
    state,
    county: `${state} County`,
    city: state,
    certificationLevel: certifications[i % certifications.length],
    rating: Math.round((Math.random() * 0.8 + 4.2) * 10) / 10,
    reviews: Math.floor(Math.random() * 250) + 30,
    availableToday: true,
    nextAvailable: '< 2 hours',
    location: state,
    responseTime: '< 45 min',
    specialties: ['Notarization', 'Document Authentication', 'Loan Signing'],
    phone: `${Math.floor(Math.random() * 900) + 100}-555-${String(i).padStart(4, '0')}`,
    email: `notary${i}@${state.toLowerCase()}-signer.com`,
    verified: true,
  }));
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const state = (req.query.state as string) || 'CA';

  const notaries = generateNotaries(state, 100);

  res.status(200).json({
    success: true,
    state,
    count: notaries.length,
    notaries,
  });
}
