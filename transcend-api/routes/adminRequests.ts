/**
 * Admin Request Management API
 * Handle feature requests, bug reports, and enhancements with full database integration
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';

const router = Router();

// Validation helper
function validateRequest(title: string, description: string) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return 'Title is required and must be a non-empty string';
  }
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return 'Description is required and must be a non-empty string';
  }
  if (title.length > 255) {
    return 'Title must be 255 characters or less';
  }
  if (description.length > 5000) {
    return 'Description must be 5000 characters or less';
  }
  return null;
}

// GET /api/admin/requests - List requests with optional filtering
router.get('/api/admin/requests', async (req: Request, res: Response) => {
  try {
    const { status, type, priority, limit = 50, offset = 0 } = req.query;

    let queryStr = 'SELECT * FROM admin_requests WHERE archived = FALSE';
    const params: any[] = [];
    let paramCount = 1;

    // Add filters
    if (status) {
      const statuses = (status as string).split(',').map(s => s.trim());
      queryStr += ` AND status = ANY($${paramCount})`;
      params.push(statuses);
      paramCount++;
    }

    if (type) {
      const types = (type as string).split(',').map(t => t.trim());
      queryStr += ` AND type = ANY($${paramCount})`;
      params.push(types);
      paramCount++;
    }

    if (priority) {
      const priorities = (priority as string).split(',').map(p => p.trim());
      queryStr += ` AND priority = ANY($${paramCount})`;
      params.push(priorities);
      paramCount++;
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit as string) || 50, parseInt(offset as string) || 0);

    const result = await query(queryStr, params);

    // Get total count
    let countStr = 'SELECT COUNT(*) as total FROM admin_requests WHERE archived = FALSE';
    const countParams: any[] = [];
    let countParamCount = 1;

    if (status) {
      const statuses = (status as string).split(',').map(s => s.trim());
      countStr += ` AND status = ANY($${countParamCount})`;
      countParams.push(statuses);
      countParamCount++;
    }

    if (type) {
      const types = (type as string).split(',').map(t => t.trim());
      countStr += ` AND type = ANY($${countParamCount})`;
      countParams.push(types);
      countParamCount++;
    }

    if (priority) {
      const priorities = (priority as string).split(',').map(p => p.trim());
      countStr += ` AND priority = ANY($${countParamCount})`;
      countParams.push(priorities);
      countParamCount++;
    }

    const countResult = await query(countStr, countParams);
    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      requests: result.rows,
      total: parseInt(total),
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0,
    });
  } catch (error: any) {
    console.error('Failed to fetch requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/admin/requests - Create new request
router.post('/api/admin/requests', async (req: Request, res: Response) => {
  try {
    const { title, description, type = 'feature', priority = 'medium', requestedBy = 'Unknown', tags } = req.body;

    // Validate input
    const validationError = validateRequest(title, description);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    // Validate type and priority
    const validTypes = ['feature', 'bug', 'enhancement', 'infrastructure'];
    const validPriorities = ['low', 'medium', 'high', 'critical'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Type must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Priority must be one of: ${validPriorities.join(', ')}`,
      });
    }

    const id = uuidv4();
    const now = new Date();
    const estimatedCompletion = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Insert into database
    const result = await query(
      `INSERT INTO admin_requests
       (id, title, description, type, priority, status, requested_by,
        requested_at, estimated_completion, completion_percentage, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        title.trim(),
        description.trim(),
        type,
        priority,
        'pending',
        requestedBy,
        now,
        estimatedCompletion,
        0,
        tags ? JSON.stringify(tags) : null,
        now,
        now,
      ]
    );

    // Log audit
    await query(
      `INSERT INTO admin_request_audit_log (request_id, action_type, new_values, created_at)
       VALUES ($1, $2, $3, $4)`,
      [id, 'CREATED', JSON.stringify(result.rows[0]), now]
    );

    res.status(201).json({
      success: true,
      request: result.rows[0],
      message: 'Request created successfully',
    });
  } catch (error: any) {
    console.error('Failed to create request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/admin/requests/:id - Get request details
router.get('/api/admin/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ success: false, error: 'Invalid request ID format' });
    }

    const result = await query(
      'SELECT * FROM admin_requests WHERE id = $1 AND archived = FALSE',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({
      success: true,
      request: result.rows[0],
    });
  } catch (error: any) {
    console.error('Failed to fetch request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// PATCH /api/admin/requests/:id - Update request status/progress
router.patch('/api/admin/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, completionPercentage, estimatedCompletion } = req.body;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ success: false, error: 'Invalid request ID format' });
    }

    // Check request exists
    const existingRequest = await query(
      'SELECT * FROM admin_requests WHERE id = $1',
      [id]
    );

    if (existingRequest.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const oldValues = existingRequest.rows[0];

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Status must be one of: ${validStatuses.join(', ')}`,
        });
      }
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (completionPercentage !== undefined) {
      if (typeof completionPercentage !== 'number' || completionPercentage < 0 || completionPercentage > 100) {
        return res.status(400).json({
          success: false,
          error: 'Completion percentage must be a number between 0 and 100',
        });
      }
      updates.push(`completion_percentage = $${paramCount}`);
      params.push(completionPercentage);
      paramCount++;
    }

    if (estimatedCompletion) {
      const date = new Date(estimatedCompletion);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid estimated completion date',
        });
      }
      updates.push(`estimated_completion = $${paramCount}`);
      params.push(date);
      paramCount++;
    }

    updates.push(`updated_at = $${paramCount}`);
    params.push(new Date());
    paramCount++;

    // Set completed_at if status is completed
    let completedAt = null;
    if (status === 'completed') {
      completedAt = new Date();
      updates.push(`completed_at = $${paramCount}`);
      params.push(completedAt);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided',
      });
    }

    params.push(id);

    const result = await query(
      `UPDATE admin_requests SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    const newValues = result.rows[0];

    // Log audit
    await query(
      `INSERT INTO admin_request_audit_log (request_id, action_type, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, 'STATUS_CHANGED', JSON.stringify(oldValues), JSON.stringify(newValues), new Date()]
    );

    res.json({
      success: true,
      request: newValues,
      message: 'Request updated successfully',
    });
  } catch (error: any) {
    console.error('Failed to update request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// DELETE /api/admin/requests/:id - Archive request (soft delete)
router.delete('/api/admin/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ success: false, error: 'Invalid request ID format' });
    }

    const result = await query(
      'UPDATE admin_requests SET archived = TRUE, updated_at = $1 WHERE id = $2 RETURNING *',
      [new Date(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Log audit
    await query(
      `INSERT INTO admin_request_audit_log (request_id, action_type, old_values, created_at)
       VALUES ($1, $2, $3, $4)`,
      [id, 'ARCHIVED', JSON.stringify({ archived: false }), new Date()]
    );

    res.json({
      success: true,
      message: 'Request archived successfully',
    });
  } catch (error: any) {
    console.error('Failed to archive request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/admin/requests/:id/history - Get request audit history
router.get('/api/admin/requests/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ success: false, error: 'Invalid request ID format' });
    }

    const result = await query(
      `SELECT * FROM admin_request_audit_log
       WHERE request_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      history: result.rows,
    });
  } catch (error: any) {
    console.error('Failed to fetch history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch request history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
