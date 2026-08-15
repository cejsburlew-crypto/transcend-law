// Intake API Endpoints
// Handle case submission and management

import { Router, Request, Response } from 'express';

const router = Router();

// POST /api/v2/intake/submit - Submit case
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { caseData, selectedAttorneys } = req.body;
    const userId = req.user?.id;

    if (!userId || !caseData || !selectedAttorneys.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate case ID
    const caseId = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Mock database insert
    const caseRecord = {
      id: caseId,
      userId,
      ...caseData,
      selectedAttorneys,
      status: 'submitted',
      createdAt: new Date(),
      updatedAt: new Date(),
      offers: [],
    };

    console.log('Case submitted:', caseRecord);

    // TODO: Save to database
    // TODO: Send notifications to selected attorneys
    // TODO: Add to law firm opportunity board

    res.json({
      success: true,
      caseId,
      message: 'Case submitted successfully',
      data: caseRecord,
    });
  } catch (error) {
    console.error('Intake submission error:', error);
    res.status(500).json({ error: 'Failed to submit case' });
  }
});

// GET /api/v2/cases/{caseId}/offers - Get all offers for a case
router.get('/cases/:caseId/offers', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = req.user?.id;

    // Mock data
    const offers = [
      {
        id: 'offer_1',
        caseId,
        attorneyId: 'atty_1',
        attorney: {
          name: 'Sarah Johnson, Esq.',
          firm: 'Johnson & Associates',
          rating: 4.9,
          specialty: 'Employment Law',
          yearsExperience: 12,
          location: 'San Francisco, CA',
        },
        status: 'quoted',
        quoteAmount: 2500,
        message: 'I have extensive experience with wrongful termination cases.',
        responseTime: '2 hours',
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        id: 'offer_2',
        caseId,
        attorneyId: 'atty_2',
        attorney: {
          name: 'Maria Garcia, Esq.',
          firm: 'Garcia Legal Partners',
          rating: 4.8,
          specialty: 'Employment Law',
          yearsExperience: 10,
          location: 'San Jose, CA',
        },
        status: 'quoted',
        quoteAmount: 2000,
        message: 'I can help with this case.',
        responseTime: '4 hours',
        createdAt: new Date(Date.now() - 14400000),
      },
      {
        id: 'offer_3',
        caseId,
        attorneyId: 'atty_3',
        attorney: {
          name: 'James Miller, Esq.',
          firm: 'Miller Law Group',
          rating: 4.7,
          specialty: 'Personal Injury',
          yearsExperience: 15,
          location: 'Los Angeles, CA',
        },
        status: 'rejected',
        message: 'This case falls outside my current focus areas.',
        responseTime: '1 hour',
        createdAt: new Date(Date.now() - 1800000),
      },
    ];

    // TODO: Fetch from database
    // TODO: Verify user owns this case

    res.json({
      success: true,
      caseId,
      offers,
      stats: {
        total: offers.length,
        quoted: offers.filter(o => o.status === 'quoted').length,
        rejected: offers.filter(o => o.status === 'rejected').length,
        pending: offers.filter(o => o.status === 'pending').length,
      },
    });
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// POST /api/v2/offers/{offerId}/accept - Accept an attorney offer
router.post('/offers/:offerId/accept', async (req: Request, res: Response) => {
  try {
    const { offerId } = req.params;
    const userId = req.user?.id;

    if (!userId || !offerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Update offer status to 'accepted'
    // TODO: Update case status to 'retained'
    // TODO: Notify attorney of acceptance
    // TODO: Send contract/agreement
    // TODO: Set up case channel for communication

    res.json({
      success: true,
      message: 'Offer accepted successfully',
      offerId,
      status: 'accepted',
    });
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// POST /api/v2/intake/request/firms/all - Send case to all firms
router.post('/request/firms/all', async (req: Request, res: Response) => {
  try {
    const { caseData } = req.body;
    const userId = req.user?.id;

    if (!userId || !caseData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Get all active firms
    // TODO: Create opportunity board entries for each firm
    // TODO: Send notifications to all firms

    res.json({
      success: true,
      message: 'Case sent to all firms',
      firmsNotified: 5000,
    });
  } catch (error) {
    console.error('Send to all firms error:', error);
    res.status(500).json({ error: 'Failed to send case' });
  }
});

export default router;
