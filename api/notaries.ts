export default function handler(req: any, res: any) {
  try {
    const state = req.query?.state || 'CA';

    const certifications = ['Notary Public', 'Certified Signing Agent', 'Mobile Notary', 'eNotary'];

    const notaries = Array.from({ length: 100 }, (_, i) => ({
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

    res.status(200).json({
      success: true,
      state,
      count: notaries.length,
      notaries,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
