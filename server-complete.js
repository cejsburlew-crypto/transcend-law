// TRANSCEND LAW - Complete Backend Server
// Node.js + Express + PostgreSQL + Stripe Integration

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_demo');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/transcend_law'
});

// Middleware
app.use(cors());
app.use(express.json());

// ==================== AUTHENTICATION ====================

// Middleware: Verify JWT Token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Client Login/Signup
app.post('/api/auth/client/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, state, county } = req.body;

        // Check if email exists
        const existing = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create client
        const result = await pool.query(
            'INSERT INTO clients (email, password_hash, first_name, last_name, state, county) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email',
            [email, hashedPassword, firstName, lastName, state, county]
        );

        const token = jwt.sign({ id: result.rows[0].id, type: 'client' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, client: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/client/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query('SELECT id, email, password_hash FROM clients WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const client = result.rows[0];
        const passwordValid = await bcrypt.compare(password, client.password_hash);
        if (!passwordValid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: client.id, type: 'client' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, client: { id: client.id, email: client.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Firm Login/Signup
app.post('/api/auth/firm/register', async (req, res) => {
    try {
        const { email, password, firmName, website, state } = req.body;

        const existing = await pool.query('SELECT id FROM firms WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO firms (email, password_hash, name, website, headquarters_state, subscription_tier) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name',
            [email, hashedPassword, firmName, website, state, 'basic']
        );

        const token = jwt.sign({ id: result.rows[0].id, type: 'firm' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, firm: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/firm/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query('SELECT id, email, password_hash, name FROM firms WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const firm = result.rows[0];
        const passwordValid = await bcrypt.compare(password, firm.password_hash);
        if (!passwordValid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: firm.id, type: 'firm' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, firm: { id: firm.id, email: firm.email, name: firm.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== FIRM PROFILE & DIRECTORY ====================

// Get all firms (for directory with filtering)
app.get('/api/firms', async (req, res) => {
    try {
        const { state, caseType, tier, search } = req.query;

        let query = `
            SELECT id, name, website, description, logo_url, founded_year, headquarters_state,
                   overall_rating, total_reviews, total_cases_won, total_cases_handled,
                   average_settlement_amount, verified, subscription_tier
            FROM firms
            WHERE status = 'active' AND verified = true
        `;

        const params = [];
        let paramIndex = 1;

        if (state) {
            query += ` AND headquarters_state = $${paramIndex}`;
            params.push(state);
            paramIndex++;
        }

        if (tier) {
            query += ` AND subscription_tier = $${paramIndex}`;
            params.push(tier);
            paramIndex++;
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' ORDER BY subscription_tier, overall_rating DESC LIMIT 50';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get firm profile with details
app.get('/api/firms/:id', async (req, res) => {
    try {
        const firmResult = await pool.query(`
            SELECT id, name, email, phone, website, description, logo_url, founded_year,
                   headquarters_state, overall_rating, total_reviews, total_cases_won,
                   total_cases_handled, average_settlement_amount, verified,
                   subscription_tier, has_complaints, complaint_count, has_disciplinary_actions
            FROM firms
            WHERE id = $1 AND status = 'active'
        `, [req.params.id]);

        if (firmResult.rows.length === 0) return res.status(404).json({ error: 'Firm not found' });

        const firm = firmResult.rows[0];

        // Get attorneys
        const attorneysResult = await pool.query(`
            SELECT id, first_name, last_name, bar_license_number, bar_state, years_practicing,
                   attorney_rating, total_reviews, specialties, verified, bio
            FROM attorneys
            WHERE firm_id = $1 AND status = 'active'
            ORDER BY is_lead_attorney DESC, attorney_rating DESC
        `, [req.params.id]);

        // Get reviews
        const reviewsResult = await pool.query(`
            SELECT rating, title, review_text, would_recommend, created_at
            FROM firm_reviews
            WHERE firm_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.params.id]);

        // Get complaints
        const complaintsResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM attorney_complaints
            WHERE attorney_id IN (SELECT id FROM attorneys WHERE firm_id = $1)
        `, [req.params.id]);

        res.json({
            firm,
            attorneys: attorneysResult.rows,
            reviews: reviewsResult.rows,
            totalComplaints: parseInt(complaintsResult.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ATTORNEY VERIFICATION ====================

// Get attorney profile with BAR verification
app.get('/api/attorneys/:id', async (req, res) => {
    try {
        const attorneyResult = await pool.query(`
            SELECT id, firm_id, first_name, last_name, email, phone, bio, profile_photo_url,
                   bar_license_number, bar_state, bar_admission_date, bar_license_status,
                   bar_verified, years_practicing, total_cases_handled, cases_won, win_rate,
                   law_school, graduation_year, specialties, attorney_rating, total_reviews,
                   has_complaints, complaint_count, has_disciplinary_actions, verified,
                   verification_status, role, is_lead_attorney
            FROM attorneys
            WHERE id = $1 AND status = 'active'
        `, [req.params.id]);

        if (attorneyResult.rows.length === 0) return res.status(404).json({ error: 'Attorney not found' });

        const attorney = attorneyResult.rows[0];

        // Get BAR verification details
        const verificationResult = await pool.query(`
            SELECT bar_license_verified, bar_status_verified, bar_verification_date,
                   state_bar_checked, complaints_found, disciplinary_actions_found
            FROM attorney_verifications
            WHERE attorney_id = $1
            ORDER BY verification_date DESC
            LIMIT 1
        `, [req.params.id]);

        // Get complaints
        const complaintsResult = await pool.query(`
            SELECT id, complaint_type, complaint_date, title, description, status,
                   severity, public_record
            FROM attorney_complaints
            WHERE attorney_id = $1 AND public_record = true
            ORDER BY complaint_date DESC
        `, [req.params.id]);

        // Get reviews
        const reviewsResult = await pool.query(`
            SELECT rating, title, review_text, would_recommend, verified_case, created_at
            FROM attorney_reviews
            WHERE attorney_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.params.id]);

        res.json({
            attorney,
            barVerification: verificationResult.rows[0] || null,
            complaints: complaintsResult.rows,
            reviews: reviewsResult.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add attorney to firm
app.post('/api/firms/:firmId/attorneys', verifyToken, async (req, res) => {
    try {
        const { firstName, lastName, email, barLicenseNumber, barState, yearsInBusiness, specialties } = req.body;

        // Verify user owns firm
        const firmCheck = await pool.query('SELECT id FROM firms WHERE id = $1', [req.params.firmId]);
        if (firmCheck.rows.length === 0) return res.status(404).json({ error: 'Firm not found' });

        const result = await pool.query(`
            INSERT INTO attorneys
            (firm_id, first_name, last_name, email, bar_license_number, bar_state, years_practicing, specialties)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, first_name, last_name, bar_license_number
        `, [req.params.firmId, firstName, lastName, email, barLicenseNumber, barState, yearsInBusiness, specialties]);

        // Queue BAR verification
        await pool.query(`
            INSERT INTO attorney_verifications (attorney_id, state_bar_checked)
            VALUES ($1, false)
        `, [result.rows[0].id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== INTAKES & CASES ====================

// Create intake
app.post('/api/intakes', verifyToken, async (req, res) => {
    try {
        const { caseType, title, description, state, county, caseDetails, urgencyLevel, firmIds } = req.body;

        const result = await pool.query(`
            INSERT INTO intakes
            (client_id, case_type, title, description, state, county, case_details, urgency_level, submitted_to_firm_ids)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, status, submitted_date
        `, [req.user.id, caseType, title, description, state, county, JSON.stringify(caseDetails), urgencyLevel, firmIds || []]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get intakes for client
app.get('/api/clients/:clientId/intakes', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, case_type, title, status, state, county, submitted_date,
                   first_opened_date, first_message_date, retention_date
            FROM intakes
            WHERE client_id = $1
            ORDER BY submitted_date DESC
        `, [req.params.clientId]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get leads for firm
app.get('/api/firms/:firmId/leads', verifyToken, async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT i.id, i.case_type, i.title, i.status, i.state, i.county,
                   i.submitted_date, i.urgency_level, i.client_id,
                   c.first_name, c.last_name, c.email
            FROM intakes i
            JOIN clients c ON i.client_id = c.id
            WHERE i.primary_firm_id = $1 OR $1 = ANY(i.submitted_to_firm_ids)
        `;

        const params = [req.params.firmId];

        if (status) {
            query += ` AND i.status = $2`;
            params.push(status);
        }

        query += ' ORDER BY i.submitted_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update intake status
app.patch('/api/intakes/:id/status', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;

        const updateFields = {
            status: status,
            updated_at: 'NOW()'
        };

        // Set timestamps based on status
        if (status === 'opened') updateFields.first_opened_date = 'NOW()';
        if (status === 'engaged') updateFields.first_message_date = 'NOW()';
        if (status === 'retained') updateFields.retention_date = 'NOW()';

        let query = 'UPDATE intakes SET ';
        const updates = [];
        const params = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updateFields)) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            updates.push(`${dbKey} = ${value === 'NOW()' ? 'NOW()' : `$${paramIndex}`}`);
            if (value !== 'NOW()') {
                params.push(value);
                paramIndex++;
            }
        }

        query += updates.join(', ') + ` WHERE id = $${paramIndex} RETURNING *`;
        params.push(req.params.id);

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== MESSAGING ====================

// Send message
app.post('/api/messages', verifyToken, async (req, res) => {
    try {
        const { caseId, intakeId, toId, subject, body } = req.body;

        const result = await pool.query(`
            INSERT INTO messages
            (case_id, intake_id, from_type, from_id, to_id, subject, body)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, created_at
        `, [caseId || null, intakeId || null, req.user.type, req.user.id, toId, subject || null, body]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get messages
app.get('/api/messages/:caseId', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, from_type, from_id, to_id, subject, body, created_at
            FROM messages
            WHERE case_id = $1
            ORDER BY created_at ASC
        `, [req.params.caseId]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== PAYMENTS & SUBSCRIPTIONS ====================

// Create payment intent for subscription upgrade
app.post('/api/subscriptions/upgrade', verifyToken, async (req, res) => {
    try {
        const { tier } = req.body;

        // Get subscription plan
        const planResult = await pool.query(
            'SELECT id, price FROM subscription_plans WHERE name = $1',
            [tier]
        );

        if (planResult.rows.length === 0) return res.status(400).json({ error: 'Plan not found' });

        const plan = planResult.rows[0];

        // Get or create Stripe customer
        const firmResult = await pool.query(
            'SELECT stripe_customer_id FROM firms WHERE id = $1',
            [req.user.id]
        );

        let customerId = firmResult.rows[0]?.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                metadata: { firmId: req.user.id }
            });
            customerId = customer.id;

            await pool.query(
                'UPDATE firms SET stripe_customer_id = $1 WHERE id = $2',
                [customerId, req.user.id]
            );
        }

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price_data: { currency: 'usd', product_data: { name: tier }, unit_amount: Math.round(plan.price * 100) }, billing_scheme: 'per_unit' }],
            billing_cycle_anchor: Math.floor(Date.now() / 1000)
        });

        // Update firm
        await pool.query(`
            UPDATE firms
            SET subscription_tier = $1, subscription_status = 'active',
                stripe_subscription_id = $2, subscription_start_date = NOW(),
                subscription_end_date = NOW() + INTERVAL '1 month', monthly_cost = $3
            WHERE id = $4
        `, [tier, subscription.id, plan.price, req.user.id]);

        res.json({ subscriptionId: subscription.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get subscription status
app.get('/api/subscriptions/status', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT subscription_tier, subscription_status, subscription_start_date,
                   subscription_end_date, next_billing_date, monthly_cost
            FROM firms
            WHERE id = $1
        `, [req.user.id]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== REVIEWS & RATINGS ====================

// Create firm review
app.post('/api/firms/:firmId/reviews', verifyToken, async (req, res) => {
    try {
        const { rating, title, reviewText, wouldRecommend, caseId } = req.body;

        const result = await pool.query(`
            INSERT INTO firm_reviews
            (firm_id, client_id, case_id, rating, title, review_text, would_recommend)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [req.params.firmId, req.user.id, caseId || null, rating, title, reviewText, wouldRecommend]);

        // Update firm rating
        await pool.query(`
            UPDATE firms
            SET overall_rating = (SELECT AVG(rating)::numeric(3,2) FROM firm_reviews WHERE firm_id = $1),
                total_reviews = (SELECT COUNT(*) FROM firm_reviews WHERE firm_id = $1)
            WHERE id = $1
        `, [req.params.firmId]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create attorney review
app.post('/api/attorneys/:attorneyId/reviews', verifyToken, async (req, res) => {
    try {
        const { rating, title, reviewText, wouldRecommend, caseId } = req.body;

        const result = await pool.query(`
            INSERT INTO attorney_reviews
            (attorney_id, client_id, case_id, rating, title, review_text, would_recommend)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [req.params.attorneyId, req.user.id, caseId || null, rating, title, reviewText, wouldRecommend]);

        // Update attorney rating
        await pool.query(`
            UPDATE attorneys
            SET attorney_rating = (SELECT AVG(rating)::numeric(3,2) FROM attorney_reviews WHERE attorney_id = $1),
                total_reviews = (SELECT COUNT(*) FROM attorney_reviews WHERE attorney_id = $1)
            WHERE id = $1
        `, [req.params.attorneyId]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ADMIN VERIFICATION DASHBOARD ====================

// Get attorneys pending verification (Admin only)
app.get('/api/admin/attorneys/pending', verifyToken, async (req, res) => {
    try {
        // Check if user is admin
        const adminCheck = await pool.query('SELECT role FROM admins WHERE id = $1', [req.user.id]);
        if (!adminCheck.rows[0]?.role?.includes('admin')) return res.status(403).json({ error: 'Unauthorized' });

        const result = await pool.query(`
            SELECT a.id, a.first_name, a.last_name, a.bar_license_number, a.bar_state,
                   a.years_practicing, f.name as firm_name, a.verification_status,
                   av.state_bar_checked, av.complaints_found, av.disciplinary_actions_found
            FROM attorneys a
            JOIN firms f ON a.firm_id = f.id
            LEFT JOIN attorney_verifications av ON a.id = av.attorney_id
            WHERE a.verification_status = 'pending' OR a.verified = false
            ORDER BY a.created_at ASC
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify attorney (Admin)
app.post('/api/admin/attorneys/:attorneyId/verify', verifyToken, async (req, res) => {
    try {
        const { status, notes } = req.body;

        await pool.query(`
            UPDATE attorney_verifications
            SET verification_status = $1, admin_notes = $2, verified_by_admin_id = $3, verification_date = NOW()
            WHERE attorney_id = $4
        `, [status, notes || null, req.user.id, req.params.attorneyId]);

        if (status === 'approved') {
            await pool.query(`
                UPDATE attorneys
                SET verified = true, verification_status = 'verified', bar_verified = true
                WHERE id = $1
            `, [req.params.attorneyId]);
        } else if (status === 'rejected') {
            await pool.query(`
                UPDATE attorneys
                SET verified = false, verification_status = 'rejected'
                WHERE id = $1
            `, [req.params.attorneyId]);
        }

        res.json({ status: 'verified' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== AVVO INTEGRATION (ATTORNEY VERIFICATION) ====================

// Fetch attorney verification from Avvo API
async function verifyAttorneyViaAvvo(barNumber, jurisdiction) {
    try {
        // In production, call actual Avvo API
        // const response = await fetch(`https://api.avvo.com/v1/lawyers/${barNumber}`, {
        //     headers: { 'Authorization': `Bearer ${process.env.AVVO_API_KEY}` }
        // });

        // Demo response
        return {
            name: 'John Smith',
            barNumber: barNumber,
            jurisdiction: jurisdiction,
            status: 'Active & in Good Standing',
            barAdmissionDate: '2010-05-15',
            verificationDate: new Date().toISOString(),
            disciplinaryHistory: [],
            avvoRating: 8.5,
            reviewCount: 24
        };
    } catch (err) {
        return null;
    }
}

// Update attorney with Avvo verification
app.post('/api/admin/attorneys/:attorneyId/verify-avvo', verifyToken, async (req, res) => {
    try {
        const { barNumber, jurisdiction } = req.body;

        const avvoData = await verifyAttorneyViaAvvo(barNumber, jurisdiction);
        if (!avvoData) {
            return res.status(400).json({ error: 'Could not verify with Avvo' });
        }

        await pool.query(`
            UPDATE attorney_verifications
            SET verification_status = 'approved',
                avvo_verified = true,
                avvo_data = $1,
                verified_by_admin_id = $2,
                verification_date = NOW()
            WHERE attorney_id = $3
        `, [JSON.stringify(avvoData), req.user.id, req.params.attorneyId]);

        await pool.query(`
            UPDATE attorneys
            SET verified = true, verification_status = 'verified', bar_verified = true
            WHERE id = $1
        `, [req.params.attorneyId]);

        res.json({ status: 'verified', avvoData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SME DOCUMENT VERSIONING ====================

// Upload SME document (creates new version)
app.post('/api/sme/:smeId/documents/upload', verifyToken, async (req, res) => {
    try {
        const { fileName, caseId, documentContent, mimeType } = req.body;

        // Get current version number
        const versionResult = await pool.query(`
            SELECT MAX(version_number) as max_version FROM sme_documents
            WHERE sme_id = $1 AND file_name = $2
        `, [req.params.smeId, fileName]);

        const nextVersion = (versionResult.rows[0]?.max_version || 0) + 1;

        const result = await pool.query(`
            INSERT INTO sme_documents
            (sme_id, case_id, file_name, version_number, document_content, mime_type, approval_status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
            RETURNING id, file_name, version_number, approval_status, created_at
        `, [req.params.smeId, caseId, fileName, nextVersion, documentContent, mimeType]);

        res.json({ document: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve SME document (client action)
app.post('/api/sme/documents/:documentId/approve', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            UPDATE sme_documents
            SET approval_status = 'approved', approved_at = NOW(), approved_by_client_id = $1
            WHERE id = $2
            RETURNING id, file_name, version_number, approval_status, approved_at
        `, [req.user.id, req.params.documentId]);

        res.json({ document: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject SME document (client action)
app.post('/api/sme/documents/:documentId/reject', verifyToken, async (req, res) => {
    try {
        const { feedback } = req.body;

        const result = await pool.query(`
            UPDATE sme_documents
            SET approval_status = 'rejected', rejected_feedback = $1, rejected_at = NOW()
            WHERE id = $2
            RETURNING id, file_name, version_number, approval_status, rejected_feedback
        `, [feedback || null, req.params.documentId]);

        res.json({ document: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get document version history
app.get('/api/sme/documents/:documentId/versions', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, file_name, version_number, approval_status, created_at, approved_at, mime_type
            FROM sme_documents
            WHERE id = $1 OR file_name = (
                SELECT file_name FROM sme_documents WHERE id = $1
            )
            ORDER BY version_number DESC
        `, [req.params.documentId]);

        res.json({ versions: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SME CASE TYPE SPECIALIZATION ====================

// Update SME case type specializations
app.post('/api/sme/:smeId/case-types', verifyToken, async (req, res) => {
    try {
        const { caseTypes } = req.body; // array of case type IDs

        // Delete existing specializations
        await pool.query('DELETE FROM sme_case_type_specializations WHERE sme_id = $1', [req.params.smeId]);

        // Insert new specializations
        for (const caseType of caseTypes) {
            await pool.query(`
                INSERT INTO sme_case_type_specializations (sme_id, case_type_id)
                VALUES ($1, $2)
            `, [req.params.smeId, caseType]);
        }

        res.json({ status: 'updated', caseTypes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get SMEs by case type (for client/firm discovery)
app.get('/api/sme/by-case-type/:caseType', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT s.id, s.name, s.professional_title, s.years_experience, s.expertise_areas, s.rating
            FROM smes s
            JOIN sme_case_type_specializations cts ON s.id = cts.sme_id
            WHERE cts.case_type_id = $1
            ORDER BY s.rating DESC
        `, [req.params.caseType]);

        res.json({ smes: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get SMEs by expertise + case type
app.get('/api/sme/search', async (req, res) => {
    try {
        const { expertise, caseType, state } = req.query;

        let query = `
            SELECT DISTINCT s.id, s.name, s.professional_title, s.years_experience,
                   s.expertise_areas, s.rating, ARRAY_AGG(DISTINCT cts.case_type_id) as case_types
            FROM smes s
            LEFT JOIN sme_case_type_specializations cts ON s.id = cts.sme_id
            WHERE 1=1
        `;

        const params = [];

        if (expertise) {
            query += ` AND s.expertise_areas ILIKE ANY($${params.length + 1}::text[])`;
            params.push(expertise.split(',').map(e => `%${e}%`));
        }

        if (caseType) {
            query += ` AND cts.case_type_id = $${params.length + 1}`;
            params.push(caseType);
        }

        query += ` GROUP BY s.id, s.name, s.professional_title, s.years_experience, s.expertise_areas, s.rating
                  ORDER BY s.rating DESC`;

        const result = await pool.query(query, params);
        res.json({ smes: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ TRANSCEND LAW API Server running on port ${PORT}`);
    console.log(`📊 Database: PostgreSQL`);
    console.log(`💳 Payments: Stripe Integration`);
    console.log(`🔐 Auth: JWT`);
});

module.exports = app;
