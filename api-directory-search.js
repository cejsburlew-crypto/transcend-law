// TRANSCEND LAW - PROFESSIONAL DIRECTORY SEARCH API (OPTION 2)
// Advanced search across 2.6M+ professionals with filtering and discovery

const express = require('express');
const router = express.Router();
const pool = require('./db');

// ============================================================================
// 1. ADVANCED SEARCH WITH FILTERS
// ============================================================================

router.get('/api/directory/search', async (req, res) => {
  try {
    const { profession, state, min_rating, max_rate, min_rate, sort, search_term } = req.query;

    let query = `SELECT * FROM professional_profiles WHERE status = 'ACTIVE'`;
    const params = [];
    let paramCount = 1;

    if (profession) {
      query += ` AND profession_type = $${paramCount++}`;
      params.push(profession);
    }
    if (state) {
      query += ` AND state = $${paramCount++}`;
      params.push(state);
    }
    if (min_rating) {
      query += ` AND rating >= $${paramCount++}`;
      params.push(parseFloat(min_rating));
    }
    if (min_rate) {
      query += ` AND hourly_rate >= $${paramCount++}`;
      params.push(parseFloat(min_rate));
    }
    if (max_rate) {
      query += ` AND hourly_rate <= $${paramCount++}`;
      params.push(parseFloat(max_rate));
    }
    if (search_term) {
      query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search_term}%`);
      paramCount++;
    }

    // Sort options
    if (sort === 'rating') query += ` ORDER BY rating DESC`;
    else if (sort === 'rate') query += ` ORDER BY hourly_rate ASC`;
    else if (sort === 'recent') query += ` ORDER BY created_at DESC`;
    else query += ` ORDER BY rating DESC, total_reviews DESC`;

    query += ` LIMIT 50`;

    const result = await pool.query(query, params);

    res.json({
      count: result.rows.length,
      professionals: result.rows
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================================================
// 2. PROFESSIONAL PROFILE
// ============================================================================

router.get('/api/directory/professional/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM professional_profiles WHERE id = $1 AND status = 'ACTIVE';`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================================================
// 3. ALL PROFESSIONALS OF SPECIFIC TYPE
// ============================================================================

router.get('/api/directory/profession/:profession_type', async (req, res) => {
  try {
    const { profession_type } = req.params;

    const result = await pool.query(
      `SELECT id, first_name, last_name, state, hourly_rate, rating, total_reviews
       FROM professional_profiles
       WHERE profession_type = $1 AND status = 'ACTIVE'
       ORDER BY rating DESC, total_reviews DESC
       LIMIT 100;`,
      [profession_type]
    );

    res.json({
      profession: profession_type,
      count: result.rows.length,
      professionals: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================================================
// 4. PROFESSIONALS IN STATE
// ============================================================================

router.get('/api/directory/state/:state', async (req, res) => {
  try {
    const { state } = req.params;

    const result = await pool.query(
      `SELECT profession_type, COUNT(*) as count, ROUND(AVG(rating), 2) as avg_rating
       FROM professional_profiles
       WHERE state = $1 AND status = 'ACTIVE'
       GROUP BY profession_type
       ORDER BY count DESC;`,
      [state]
    );

    res.json({
      state,
      professions: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch state data' });
  }
});

// ============================================================================
// 5. TOP-RATED PROFESSIONALS
// ============================================================================

router.get('/api/directory/top-rated', async (req, res) => {
  try {
    const { min_rating = 4.5, profession } = req.query;

    let query = `SELECT * FROM professional_profiles
                 WHERE status = 'ACTIVE' AND rating >= $1 AND total_reviews >= 5`;
    const params = [parseFloat(min_rating)];

    if (profession) {
      query += ` AND profession_type = $2`;
      params.push(profession);
    }

    query += ` ORDER BY rating DESC, total_reviews DESC LIMIT 50`;

    const result = await pool.query(query, params);

    res.json({
      min_rating: parseFloat(min_rating),
      count: result.rows.length,
      top_professionals: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top-rated' });
  }
});

// ============================================================================
// 6. MOST AFFORDABLE PROFESSIONALS
// ============================================================================

router.get('/api/directory/affordable', async (req, res) => {
  try {
    const { min_rating = 3.5, max_rate = 200 } = req.query;

    const result = await pool.query(
      `SELECT * FROM professional_profiles
       WHERE status = 'ACTIVE' AND hourly_rate <= $1 AND rating >= $2
       ORDER BY hourly_rate ASC, rating DESC
       LIMIT 50;`,
      [parseFloat(max_rate), parseFloat(min_rating)]
    );

    res.json({
      max_rate: parseFloat(max_rate),
      count: result.rows.length,
      affordable_professionals: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch affordable options' });
  }
});

// ============================================================================
// 7. NEARBY PROFESSIONALS
// ============================================================================

router.get('/api/directory/nearby/:state', async (req, res) => {
  try {
    const { state } = req.params;
    const { profession } = req.query;

    let query = `SELECT id, first_name, last_name, profession_type, hourly_rate, rating, state
                 FROM professional_profiles WHERE state = $1 AND status = 'ACTIVE'`;
    const params = [state];

    if (profession) {
      query += ` AND profession_type = $2`;
      params.push(profession);
    }

    query += ` ORDER BY rating DESC, total_reviews DESC LIMIT 30`;

    const result = await pool.query(query, params);

    res.json({
      state,
      count: result.rows.length,
      nearby: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch nearby professionals' });
  }
});

// ============================================================================
// 8. AUTOCOMPLETE SEARCH
// ============================================================================

router.get('/api/directory/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const result = await pool.query(
      `SELECT DISTINCT CONCAT(first_name, ' ', last_name) as name, profession_type
       FROM professional_profiles
       WHERE (first_name ILIKE $1 OR last_name ILIKE $1) AND status = 'ACTIVE'
       LIMIT 10;`,
      [`${q}%`]
    );

    res.json({
      suggestions: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

// ============================================================================
// BONUS: GET AVAILABLE FILTERS
// ============================================================================

router.get('/api/directory/filters', async (req, res) => {
  try {
    const professionsResult = await pool.query(
      `SELECT DISTINCT profession_type FROM professional_profiles WHERE status = 'ACTIVE' ORDER BY profession_type;`
    );

    const statesResult = await pool.query(
      `SELECT DISTINCT state FROM professional_profiles WHERE status = 'ACTIVE' ORDER BY state;`
    );

    const ratesResult = await pool.query(
      `SELECT MIN(hourly_rate)::NUMERIC as min_rate, MAX(hourly_rate)::NUMERIC as max_rate
       FROM professional_profiles WHERE status = 'ACTIVE';`
    );

    res.json({
      professions: professionsResult.rows.map(r => r.profession_type),
      states: statesResult.rows.map(r => r.state),
      rates: ratesResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

module.exports = router;
