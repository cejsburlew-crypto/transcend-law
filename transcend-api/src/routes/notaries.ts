import { Router, Request, Response } from 'express';
import { pool } from '../database/connection';

const router = Router();

// GET /api/v2/notaries - Search notaries
router.get('/', async (req: Request, res: Response) => {
  try {
    const { state = 'CA', limit = 20, offset = 0, minRating = 0 } = req.query;

    let query = `
      SELECT
        id,
        first_name,
        last_name,
        full_name,
        state,
        county,
        city,
        email,
        phone,
        license_number,
        commission_expiration,
        status,
        rating,
        reviews_count,
        certifications
      FROM state_notaries
      WHERE state = $1
        AND status = 'ACTIVE'
    `;

    let params: any[] = [state];
    let paramIndex = 2;

    // Get total count for pagination
    const countResult = await pool.query(
      query.replace('SELECT id, first_name, last_name, full_name, state, county, city, email, phone, license_number, commission_expiration, status, rating, reviews_count, certifications FROM state_notaries', 'SELECT COUNT(*) as total FROM state_notaries'),
      params
    );

    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination and sorting
    query += ` ORDER BY rating DESC NULLS LAST, commission_expiration DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows.map((row: any) => ({
        id: row.id,
        name: row.full_name,
        state: row.state,
        county: row.county,
        city: row.city,
        certificationLevel: row.certifications || 'Notary Public',
        rating: row.rating || 4.8,
        reviews: row.reviews_count || 0,
        availableToday: true,
        nextAvailable: '< 1 hour',
        location: `${row.city}, ${row.state}`,
        responseTime: '< 30 min',
        specialties: row.certifications ? (row.certifications as string).split(';').slice(0, 3) : [],
        phone: row.phone,
        email: row.email,
        verified: row.license_number ? true : false,
        licenseNumber: row.license_number,
        commissionExpiration: row.commission_expiration,
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
      },
    });
  } catch (error) {
    console.error('Error fetching notaries:', error);
    res.status(500).json({ error: 'Failed to fetch notaries' });
  }
});

// GET /api/v2/notaries/:id - Get single notary
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM state_notaries WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notary not found' });
    }

    const notary = result.rows[0];
    res.json({
      id: notary.id,
      name: notary.full_name,
      state: notary.state,
      county: notary.county,
      city: notary.city,
      certificationLevel: notary.certifications || 'Notary Public',
      rating: notary.rating || 4.8,
      reviews: notary.reviews_count || 0,
      phone: notary.phone,
      email: notary.email,
      verified: notary.license_number ? true : false,
      licenseNumber: notary.license_number,
      commissionExpiration: notary.commission_expiration,
      status: notary.status,
    });
  } catch (error) {
    console.error('Error fetching notary:', error);
    res.status(500).json({ error: 'Failed to fetch notary' });
  }
});

export default router;
