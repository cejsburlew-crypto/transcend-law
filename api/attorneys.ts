export default function handler(req: any, res: any) {
  try {
    const state = req.query?.state || 'CA';

    // Generate attorney data
    const specializations = [
      'Family Law', 'Criminal Defense', 'Corporate Law', 'Real Estate', 'Litigation',
      'Employment Law', 'Immigration Law', 'Bankruptcy', 'Personal Injury', 'Intellectual Property'
    ];

    const attorneys = Array.from({ length: 500 }, (_, i) => ({
      id: `${state}-atty-${i}`,
      name: `Attorney ${String(i + 1).padStart(4, '0')}`,
      state,
      specialization: specializations[i % specializations.length],
      rating: Math.round((Math.random() * 1.8 + 3.2) * 10) / 10,
      reviews: Math.floor(Math.random() * 350) + 20,
      yearsExperience: Math.floor(Math.random() * 35) + 3,
      hourlyRate: Math.floor(Math.random() * 400) + 120,
      firmName: `${state} Law Firm ${Math.floor(i / 5) + 1}`,
      phone: `${Math.floor(Math.random() * 900) + 100}-555-${String(i).padStart(4, '0')}`,
      email: `atty${i}@${state.toLowerCase()}-legal.com`,
      verified: true,
      barNumber: `${state}-${i}`,
    }));

    res.status(200).json({
      success: true,
      state,
      count: attorneys.length,
      attorneys,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
