import { Router, Request, Response } from 'express';
import { pool } from '../database/connection';

const router = Router();

interface AttorneyQuery {
  state?: string;
  practice_area?: string;
  limit?: number;
  offset?: number;
  minRating?: number;
  specialty?: string;
}

// GET /api/v2/attorneys - Search attorneys
router.get('/', async (req: Request, res: Response) => {
  try {
    const { state = 'CA', practice_area, limit = 20, offset = 0, minRating = 0 } = req.query;

    let query = `
      SELECT
        id,
        external_id,
        first_name,
        last_name,
        full_name,
        state,
        practice_areas,
        primary_practice_area,
        bar_number,
        bar_admission_year,
        practicing_years,
        license_status,
        email,
        phone,
        office_phone,
        law_firm_id,
        law_firm_name,
        firm_position,
        years_at_firm,
        avvo_rating,
        google_rating,
        reviews_count,
        hourly_rate
      FROM attorneys
      WHERE state = $1
        AND license_status = 'ACTIVE'
        AND (avvo_rating >= $2 OR avvo_rating IS NULL)
    `;

    let params: any[] = [state, minRating];
    let paramIndex = 3;

    // Filter by practice area if provided
    if (practice_area) {
      query += ` AND (primary_practice_area ILIKE $${paramIndex} OR practice_areas::text ILIKE $${paramIndex})`;
      params.push(`%${practice_area}%`);
      paramIndex++;
    }

    // Get total count for pagination
    const countResult = await pool.query(
      query.replace('SELECT id, external_id, first_name, last_name, full_name, state, practice_areas, primary_practice_area, bar_number, bar_admission_year, practicing_years, license_status, email, phone, office_phone, law_firm_id, law_firm_name, firm_position, years_at_firm, avvo_rating, google_rating, reviews_count, hourly_rate FROM attorneys', 'SELECT COUNT(*) as total FROM attorneys'),
      params
    );

    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination and sorting
    query += ` ORDER BY avvo_rating DESC NULLS LAST, practicing_years DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows.map((row: any) => ({
        id: row.id,
        name: row.full_name,
        state: row.state,
        specialization: row.primary_practice_area,
        rating: row.avvo_rating || 4.5,
        reviews: row.reviews_count || 0,
        yearsExperience: row.practicing_years || 0,
        hourlyRate: row.hourly_rate,
        firmName: row.law_firm_name,
        firmPosition: row.firm_position,
        phone: row.phone,
        email: row.email,
        verified: row.bar_number ? true : false,
        barNumber: row.bar_number,
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
      },
    });
  } catch (error) {
    console.error('Error fetching attorneys:', error);
    res.status(500).json({ error: 'Failed to fetch attorneys' });
  }
});

// GET /api/v2/attorneys/:id - Get single attorney
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM attorneys WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attorney not found' });
    }

    const attorney = result.rows[0];
    res.json({
      id: attorney.id,
      name: attorney.full_name,
      state: attorney.state,
      specialization: attorney.primary_practice_area,
      rating: attorney.avvo_rating || 4.5,
      reviews: attorney.reviews_count || 0,
      yearsExperience: attorney.practicing_years || 0,
      hourlyRate: attorney.hourly_rate,
      firmName: attorney.law_firm_name,
      phone: attorney.phone,
      email: attorney.email,
      verified: attorney.bar_number ? true : false,
      barNumber: attorney.bar_number,
      barAdmissionYear: attorney.bar_admission_year,
      practiceAreas: attorney.practice_areas,
      licenseStatus: attorney.license_status,
    });
  } catch (error) {
    console.error('Error fetching attorney:', error);
    res.status(500).json({ error: 'Failed to fetch attorney' });
  }
});

export default router;
