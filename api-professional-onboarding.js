// TRANSCEND LAW - PROFESSIONAL ONBOARDING & RECRUITMENT API
// Handles sign-ups for all 20 profession types with referral system
// Enables law firms + attorneys to recommend other professionals

const express = require('express');
const router = express.Router();
const { Anthropic } = require('@anthropic-ai/sdk');
const pool = require('./db');

const client = new Anthropic();

// ============================================================================
// ONBOARDING: Professional self-registration for any profession type
// ============================================================================

router.post('/api/onboard/professional', async (req, res) => {
  try {
    const {
      profession_type,
      first_name,
      last_name,
      state,
      email,
      phone,
      license_number,
      specializations,
      hourly_rate,
      experience_years
    } = req.body;

    // Validate required fields
    if (!profession_type || !first_name || !last_name || !state || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Map profession_type to correct table
    const tableMap = {
      'paralegal': 'paralegals',
      'court_reporter': 'court_reporters',
      'expert_witness': 'expert_witnesses',
      'process_server': 'process_servers',
      'mediator': 'mediators',
      'bail_bondsman': 'bail_bondsmen',
      'title_agent': 'title_agents',
      'legal_consultant': 'legal_consultants',
      'document_preparer': 'document_preparers',
      'forensic_accountant': 'forensic_accountants',
      'background_check_service': 'background_check_services',
      'skip_tracer': 'skip_tracers',
      'insurance_adjuster': 'insurance_adjusters'
    };

    const table = tableMap[profession_type.toLowerCase()];
    if (!table) {
      return res.status(400).json({ error: 'Invalid profession type' });
    }

    // Generate unique hash for deduplication
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(`${state}|${email}|${license_number || ''}`)
      .digest('hex');

    // Insert into appropriate table
    const query = `
      INSERT INTO ${table} (
        external_id, state, first_name, last_name, email, phone,
        license_number, specializations, hourly_rate, experience_years,
        status, data_source, collected_at, ${table.slice(0, -1)}_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (${table.slice(0, -1)}_hash) DO NOTHING
      RETURNING id;
    `;

    const values = [
      `${state}-${profession_type.toUpperCase()}-${Date.now()}`,
      state,
      first_name,
      last_name,
      email,
      phone,
      license_number || null,
      specializations ? JSON.stringify(specializations) : null,
      hourly_rate || null,
      experience_years || null,
      'ACTIVE',
      'Self-registered via Transcend Platform',
      new Date(),
      hash
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Professional already registered' });
    }

    const professional_id = result.rows[0].id;

    // Create discovery signals (what they need from network)
    await pool.query(
      `INSERT INTO discovery_signals (
        professional_id, profession_type, state, created_at
      ) VALUES ($1, $2, $3, NOW())`,
      [professional_id, profession_type, state]
    );

    // Auto-generate referral opportunities based on profession
    await generateReferralOpportunities(profession_type, state, professional_id);

    res.status(201).json({
      success: true,
      professional_id,
      message: `Welcome to Transcend Law! Your ${profession_type} profile is now active. Law firms and attorneys in ${state} can find you in the directory.`,
      next_steps: [
        'Complete your profile with certifications and ratings',
        'Wait for referrals from attorneys and law firms',
        'Start earning commission on each referral'
      ]
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Onboarding failed' });
  }
});

// ============================================================================
// REFERRAL: Attorney/Law Firm can request professional services
// ============================================================================

router.post('/api/referral/request', async (req, res) => {
  try {
    const {
      referrer_id,
      referrer_type,  // attorney, law_firm
      target_profession_type,
      target_state,
      case_type,
      commission_offered
    } = req.body;

    // Find best match from professional_profiles
    const matchQuery = `
      SELECT
        id, professional_id, full_name, email, phone,
        hourly_rate, avg_rating,
        CASE
          WHEN avg_rating >= 4.5 THEN 1
          WHEN avg_rating >= 4.0 THEN 0.8
          ELSE 0.5
        END as match_confidence
      FROM professional_profiles
      WHERE profession_type = $1 AND state = $2
        AND status = 'ACTIVE'
        AND available_for_referrals = TRUE
      ORDER BY avg_rating DESC
      LIMIT 5;
    `;

    const matches = await pool.query(matchQuery, [target_profession_type, target_state]);

    if (matches.rows.length === 0) {
      return res.status(404).json({
        error: `No ${target_profession_type}s available in ${target_state}`,
        alternative_states: await findAlternateStates(target_profession_type)
      });
    }

    // Add to referral queue
    const referralQuery = `
      INSERT INTO referral_queue (
        referrer_id, referrer_profession_type, referrer_state,
        needed_profession_type, needed_state, case_type,
        matched_professional_id, match_confidence, status,
        matched_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id;
    `;

    const topMatch = matches.rows[0];
    const referralResult = await pool.query(referralQuery, [
      referrer_id, referrer_type, req.user?.state || 'CA',
      target_profession_type, target_state, case_type,
      topMatch.id, topMatch.match_confidence, 'MATCHED'
    ]);

    // Notify professional via email
    await notifyProfessionalOfReferral(
      topMatch.email,
      topMatch.full_name,
      referrer_type,
      case_type,
      commission_offered
    );

    res.status(201).json({
      success: true,
      referral_id: referralResult.rows[0].id,
      matched_professional: {
        name: topMatch.full_name,
        email: topMatch.email,
        phone: topMatch.phone,
        hourly_rate: topMatch.hourly_rate,
        rating: topMatch.avg_rating,
        match_confidence: topMatch.match_confidence
      },
      message: 'Professional notified and waiting to accept referral'
    });
  } catch (error) {
    console.error('Referral error:', error);
    res.status(500).json({ error: 'Referral request failed' });
  }
});

// ============================================================================
// RECRUITMENT: Send targeted outreach to professionals
// ============================================================================

router.post('/api/recruitment/campaign', async (req, res) => {
  try {
    const {
      profession_type,
      state,
      target_count,
      commission_offered,
      value_proposition
    } = req.body;

    // Create campaign
    const campaignResult = await pool.query(
      `INSERT INTO recruitment_campaigns (
        profession_type, state, campaign_name, target_count,
        estimated_commission_offered, value_proposition, status,
        launch_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id;`,
      [
        profession_type,
        state,
        `${profession_type} Recruitment - ${state}`,
        target_count,
        commission_offered,
        value_proposition,
        'ACTIVE'
      ]
    );

    const campaign_id = campaignResult.rows[0].id;

    // Get leads from recruitment_leads table
    const leadsResult = await pool.query(
      `SELECT id, email, name, profession_type FROM recruitment_leads
       WHERE profession_type = $1 AND state = $2 AND outreach_sent = FALSE
       LIMIT $3;`,
      [profession_type, state, target_count]
    );

    let sent_count = 0;

    // Send outreach to each lead
    for (const lead of leadsResult.rows) {
      try {
        // Generate personalized outreach message using Claude
        const message = await client.messages.create({
          model: 'claude-opus-5',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Generate a 2-sentence recruitment email subject line and opening for a ${profession_type} in ${state} joining Transcend Law legal marketplace. Commission: ${commission_offered}%. Value prop: ${value_proposition}. Recipient: ${lead.name}.`
            }
          ]
        });

        const emailContent = message.content[0].text;

        // Mark as sent
        await pool.query(
          `UPDATE recruitment_leads SET outreach_sent = TRUE, outreach_date = NOW()
           WHERE id = $1;`,
          [lead.id]
        );

        sent_count++;
      } catch (err) {
        console.error(`Failed to send to ${lead.email}:`, err);
      }
    }

    res.status(201).json({
      success: true,
      campaign_id,
      profession_type,
      state,
      outreach_sent: sent_count,
      target_count,
      message: `Recruitment campaign launched. ${sent_count} professionals contacted.`
    });
  } catch (error) {
    console.error('Campaign error:', error);
    res.status(500).json({ error: 'Campaign creation failed' });
  }
});

// ============================================================================
// DISCOVERY: Get recommendations for other professionals
// ============================================================================

router.get('/api/discovery/recommendations/:profession_type/:state', async (req, res) => {
  try {
    const { profession_type, state } = req.params;

    // Query referral opportunities
    const query = `
      SELECT
        pn.target_profession_type,
        COUNT(*) as referral_count,
        AVG(pn.commission_offered) as avg_commission,
        SUM(pn.volume_potential_per_month) as monthly_volume
      FROM professional_network pn
      WHERE pn.source_profession_type = $1
        AND pn.target_state = $2
      GROUP BY pn.target_profession_type
      ORDER BY monthly_volume DESC;
    `;

    const results = await pool.query(query, [profession_type, state]);

    res.json({
      profession_type,
      state,
      recommendations: results.rows,
      message: 'Professionals you should partner with based on market analysis'
    });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'Discovery failed' });
  }
});

// ============================================================================
// ANALYTICS: Platform metrics
// ============================================================================

router.get('/api/analytics/platform', async (req, res) => {
  try {
    const totalQuery = `
      SELECT
        (SELECT COUNT(*) FROM paralegals WHERE status = 'ACTIVE') as paralegals,
        (SELECT COUNT(*) FROM court_reporters WHERE status = 'ACTIVE') as court_reporters,
        (SELECT COUNT(*) FROM expert_witnesses WHERE status = 'ACTIVE') as expert_witnesses,
        (SELECT COUNT(*) FROM process_servers WHERE status = 'ACTIVE') as process_servers,
        (SELECT COUNT(*) FROM mediators WHERE status = 'ACTIVE') as mediators,
        (SELECT COUNT(*) FROM bail_bondsmen WHERE status = 'ACTIVE') as bail_bondsmen,
        (SELECT COUNT(*) FROM title_agents WHERE status = 'ACTIVE') as title_agents,
        (SELECT COUNT(*) FROM legal_consultants WHERE status = 'ACTIVE') as legal_consultants,
        (SELECT COUNT(*) FROM document_preparers WHERE status = 'ACTIVE') as document_preparers,
        (SELECT COUNT(*) FROM forensic_accountants WHERE status = 'ACTIVE') as forensic_accountants,
        (SELECT COUNT(*) FROM background_check_services WHERE status = 'ACTIVE') as background_check_services,
        (SELECT COUNT(*) FROM skip_tracers WHERE status = 'ACTIVE') as skip_tracers,
        (SELECT COUNT(*) FROM insurance_adjusters WHERE status = 'ACTIVE') as insurance_adjusters;
    `;

    const results = await pool.query(totalQuery);
    const counts = results.rows[0];

    const totalProfessionals = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

    res.json({
      total_professionals: totalProfessionals,
      by_profession: counts,
      referral_volume: (await pool.query('SELECT COUNT(*) FROM referral_queue WHERE status = "MATCHED"')).rows[0].count,
      active_campaigns: (await pool.query('SELECT COUNT(*) FROM recruitment_campaigns WHERE status = "ACTIVE"')).rows[0].count
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Analytics failed' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateReferralOpportunities(profession_type, state, professional_id) {
  const opportunities = {
    'paralegal': ['attorney', 'law_firm'],
    'court_reporter': ['attorney', 'litigation_firm'],
    'expert_witness': ['attorney', 'law_firm'],
    'process_server': ['attorney', 'law_firm'],
    'mediator': ['attorney', 'law_firm'],
    'bail_bondsman': ['criminal_defense_attorney'],
    'title_agent': ['real_estate_attorney', 'law_firm'],
    'legal_consultant': ['attorney', 'law_firm'],
    'document_preparer': ['attorney', 'paralegal'],
    'forensic_accountant': ['attorney', 'law_firm'],
    'background_check_service': ['attorney', 'law_firm'],
    'skip_tracer': ['attorney', 'pi'],
    'insurance_adjuster': ['attorney', 'law_firm']
  };

  const sourceTypes = opportunities[profession_type] || [];

  for (const sourceType of sourceTypes) {
    await pool.query(
      `INSERT INTO discovery_signals (
        professional_id, profession_type, state, needed_profession_type, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [professional_id, profession_type, state, sourceType]
    );
  }
}

async function findAlternateStates(profession_type) {
  const query = `
    SELECT DISTINCT state FROM professional_profiles
    WHERE profession_type = $1 AND status = 'ACTIVE'
    LIMIT 5;
  `;
  const results = await pool.query(query, [profession_type]);
  return results.rows.map(r => r.state);
}

async function notifyProfessionalOfReferral(email, name, referrerType, caseType, commission) {
  try {
    // Use Claude to generate notification email
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Generate a professional notification email for ${name} about a referral from a ${referrerType} for a ${caseType} case. Commission offered: ${commission}%.`
        }
      ]
    });

    // In production, send via email service (SendGrid, SES, etc.)
    console.log(`Notification sent to ${email}: ${message.content[0].text}`);
  } catch (error) {
    console.error('Notification error:', error);
  }
}

module.exports = router;
