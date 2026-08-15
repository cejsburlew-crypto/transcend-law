/**
 * Calendar Integration API Routes Example
 * Shows how to use the calendarService in your backend
 */

import express, { Router, Request, Response } from 'express';
import calendarService from './calendarService';
import { authMiddleware } from '../middleware/auth';

const router: Router = express.Router();

/**
 * Get providers status
 */
router.get('/providers/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const statuses = {
      providers: {
        google: {
          isConnected: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
          lastSync: Date.now() - 300000, // 5 minutes ago
        },
        outlook: {
          isConnected: !!process.env.OUTLOOK_OAUTH_CLIENT_ID,
          lastSync: Date.now() - 300000,
        },
        calendly: {
          isConnected: !!process.env.CALENDLY_API_KEY,
          lastSync: Date.now() - 300000,
        },
      },
    };

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching provider status:', error);
    res.status(500).json({
      error: 'Failed to fetch provider status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get availability patterns
 */
router.get('/patterns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    // In a real implementation, this would fetch from database
    const patterns = [
      {
        id: '1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        timezone: 'America/Los_Angeles',
      },
      {
        id: '2',
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        timezone: 'America/Los_Angeles',
      },
      {
        id: '3',
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        timezone: 'America/Los_Angeles',
      },
      {
        id: '4',
        dayOfWeek: 4,
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        timezone: 'America/Los_Angeles',
      },
      {
        id: '5',
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        timezone: 'America/Los_Angeles',
      },
    ];

    res.json({ patterns });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({
      error: 'Failed to fetch patterns',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create/update availability patterns
 */
router.post('/patterns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, patterns } = req.body;

    if (!userId || !patterns) {
      return res.status(400).json({ error: 'userId and patterns are required' });
    }

    // In a real implementation, this would save to database
    // For now, just return success
    res.json({
      success: true,
      patterns,
    });
  } catch (error) {
    console.error('Error updating patterns:', error);
    res.status(500).json({
      error: 'Failed to update patterns',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get blackout dates
 */
router.get('/blackout-dates', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    // In a real implementation, this would fetch from database
    const blackoutDates = [];

    res.json({ blackoutDates });
  } catch (error) {
    console.error('Error fetching blackout dates:', error);
    res.status(500).json({
      error: 'Failed to fetch blackout dates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Add blackout date
 */
router.post('/blackout-dates', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, blackoutDate } = req.body;

    if (!userId || !blackoutDate) {
      return res.status(400).json({ error: 'userId and blackoutDate are required' });
    }

    const result = await calendarService.addBlackoutDate(userId, blackoutDate);

    res.json({
      success: true,
      blackoutDate: {
        id: result.blackoutId,
        ...blackoutDate,
      },
    });
  } catch (error) {
    console.error('Error adding blackout date:', error);
    res.status(500).json({
      error: 'Failed to add blackout date',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get available time slots
 */
router.get('/slots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      date,
      provider = 'google',
      durationMinutes = 60,
      bufferMinutes = 15,
      timezone = 'America/Los_Angeles',
      minNoticeMinutes = 60,
    } = req.query;

    if (!userId || typeof userId !== 'string' || !date || typeof date !== 'string') {
      return res.status(400).json({
        error: 'userId and date are required',
      });
    }

    const selectedDate = new Date(date);
    const config = {
      durationMinutes: parseInt(durationMinutes as string, 10),
      bufferMinutes: parseInt(bufferMinutes as string, 10),
      timezone: timezone as string,
      minNoticeMinutes: parseInt(minNoticeMinutes as string, 10),
      maxAdvanceDaysForBooking: 90,
    };

    // Fetch patterns and blackout dates (in a real implementation, from database)
    const patterns = [
      {
        id: '1',
        dayOfWeek: selectedDate.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        timezone,
      },
    ];

    const slots = await calendarService.getAvailableSlots(
      userId,
      selectedDate,
      config,
      patterns,
      []
    );

    res.json({ slots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({
      error: 'Failed to fetch available slots',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Book appointment
 */
router.post('/book', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, slotId, appointment } = req.body;

    if (!userId || !slotId || !appointment) {
      return res.status(400).json({
        error: 'userId, slotId, and appointment are required',
      });
    }

    const provider = appointment.provider || 'google';

    const result = await calendarService.bookAppointment(
      userId,
      slotId,
      appointment,
      provider
    );

    res.json({
      success: true,
      appointmentId: result.appointmentId,
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({
      error: 'Failed to book appointment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Cancel appointment
 */
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, appointmentId, provider = 'google' } = req.body;

    if (!userId || !appointmentId) {
      return res.status(400).json({
        error: 'userId and appointmentId are required',
      });
    }

    const result = await calendarService.cancelAppointment(userId, appointmentId, provider);

    res.json({
      success: result.success,
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      error: 'Failed to cancel appointment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Sync calendars
 */
router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, providers } = req.body;

    if (!userId || !providers) {
      return res.status(400).json({
        error: 'userId and providers are required',
      });
    }

    // Sync would happen asynchronously in production
    const syncStatus = calendarService.getSyncStatus();

    res.json({
      success: true,
      syncStatus,
    });
  } catch (error) {
    console.error('Error syncing calendars:', error);
    res.status(500).json({
      error: 'Failed to sync calendars',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * OAuth callback for Google Calendar
 */
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, scope } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Exchange authorization code for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL}/api/calendar/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await response.json();

    if (!response.ok) {
      throw new Error(tokenData.error_description || 'Failed to obtain access token');
    }

    // Store token in session/database
    // In a real implementation, you would store this securely
    res.json({
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    console.error('Error in Google Calendar auth callback:', error);
    res.status(500).json({
      error: 'Failed to authenticate with Google Calendar',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * OAuth callback for Outlook Calendar
 */
router.get('/auth/outlook/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Exchange authorization code for access token
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.OUTLOOK_OAUTH_CLIENT_ID || '',
        client_secret: process.env.OUTLOOK_OAUTH_CLIENT_SECRET || '',
        redirect_uri: `${process.env.APP_URL}/api/calendar/auth/outlook/callback`,
        grant_type: 'authorization_code',
        scope: 'Calendars.ReadWrite offline_access',
      }).toString(),
    });

    const tokenData = await response.json();

    if (!response.ok) {
      throw new Error(tokenData.error_description || 'Failed to obtain access token');
    }

    // Store token in session/database
    res.json({
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    console.error('Error in Outlook Calendar auth callback:', error);
    res.status(500).json({
      error: 'Failed to authenticate with Outlook Calendar',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Register calendar provider
 */
router.post('/providers/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, provider, accessToken, refreshToken, expiresAt } = req.body;

    if (!userId || !provider || !accessToken) {
      return res.status(400).json({
        error: 'userId, provider, and accessToken are required',
      });
    }

    const result = await calendarService.registerProvider(userId, {
      type: provider,
      accessToken,
      refreshToken,
      expiresAt,
    });

    res.json({
      success: result.success,
      providerId: result.providerId,
    });
  } catch (error) {
    console.error('Error registering provider:', error);
    res.status(500).json({
      error: 'Failed to register provider',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Fetch appointments from all providers
 */
router.get('/appointments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate, provider = 'google' } = req.query;

    if (!userId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'userId, startDate, and endDate are required',
      });
    }

    const appointments = await calendarService.fetchAppointments(
      userId as string,
      provider as 'google' | 'outlook' | 'calendly',
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({ appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      error: 'Failed to fetch appointments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get sync status
 */
router.get('/sync/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const syncStatus = calendarService.getSyncStatus();

    res.json({
      syncStatus,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({
      error: 'Failed to fetch sync status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
