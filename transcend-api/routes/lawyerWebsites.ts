/**
 * Lawyer Profile Website Routes
 * Handle website creation, updates, and public access
 */

import { Router, Request, Response } from 'express';
import lawyerWebsiteService, { LawyerWebsite } from '../services/lawyerWebsiteService';

const router = Router();

/**
 * POST /api/lawyer-websites
 * Create new lawyer profile website
 * Requires: lawyerId, companyName, bio, email, phone, specializations, excludedServices
 * $25/month subscription starts immediately
 */
router.post('/api/lawyer-websites', async (req: Request, res: Response) => {
  try {
    const {
      lawyerId,
      lawyerName,
      companyName,
      city,
      bio,
      email,
      phone,
      licenseNumber,
      yearsExperience,
      specializations,
      excludedServices,
      allAvailableServices,
      profilePicture,
    } = req.body;

    // Validate required fields
    if (!lawyerId || !companyName || !bio || !email || !phone) {
      return res.status(400).json({
        error: 'Missing required fields: lawyerId, companyName, bio, email, phone',
      });
    }

    // Create website
    const website = await lawyerWebsiteService.createWebsite({
      lawyerId,
      lawyerName,
      companyName,
      city,
      bio,
      email,
      phone,
      specializations,
      excludedServices,
      allAvailableServices,
    });

    // TODO: Create Stripe subscription ($25/month)
    // const stripeSubscription = await stripe.subscriptions.create({
    //   customer: lawyer.stripeCustomerId,
    //   items: [{ price: 'price_lawyer_website_monthly' }],
    //   metadata: { websiteId: website.id },
    // });

    res.status(201).json({
      success: true,
      website,
      message: `Website created at transcend-law.com/${website.subdomain}`,
      subscriptionCost: '$25/month',
    });
  } catch (error) {
    console.error('Failed to create lawyer website:', error);
    res.status(500).json({ error: 'Failed to create website' });
  }
});

/**
 * GET /api/lawyer-websites/:websiteId
 * Get lawyer website details (admin only)
 */
router.get('/api/lawyer-websites/:websiteId', async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;

    // TODO: Get from database
    // const website = await db.lawyerWebsites.findById(websiteId);

    res.json({
      // website,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch website' });
  }
});

/**
 * PUT /api/lawyer-websites/:websiteId
 * Update lawyer website
 */
router.put('/api/lawyer-websites/:websiteId', async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const updates = req.body;

    // Validate user owns website
    // TODO: Check authorization

    const website = await lawyerWebsiteService.updateWebsite(websiteId, updates);

    res.json({
      success: true,
      website,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update website' });
  }
});

/**
 * POST /api/lawyer-websites/:websiteId/testimonials
 * Add testimonial to website
 */
router.post('/api/lawyer-websites/:websiteId/testimonials', async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { clientName, rating, review } = req.body;

    if (!clientName || !rating || !review) {
      return res.status(400).json({
        error: 'Missing required fields: clientName, rating, review',
      });
    }

    // TODO: Validate rating is 1-5
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    await lawyerWebsiteService.addTestimonial(websiteId, {
      clientName,
      rating,
      review,
    });

    res.json({
      success: true,
      message: 'Testimonial added',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add testimonial' });
  }
});

/**
 * POST /api/lawyer-websites/:websiteId/renew
 * Renew subscription
 */
router.post('/api/lawyer-websites/:websiteId/renew', async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { months = 1 } = req.body;

    // TODO: Process payment via Stripe
    const website = await lawyerWebsiteService.renewSubscription(websiteId, months);

    res.json({
      success: true,
      website,
      message: `Subscription renewed for ${months} month(s)`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

/**
 * POST /api/lawyer-websites/:websiteId/cancel
 * Cancel subscription
 */
router.post('/api/lawyer-websites/:websiteId/cancel', async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;

    // TODO: Cancel Stripe subscription
    await lawyerWebsiteService.cancelSubscription(websiteId);

    res.json({
      success: true,
      message: 'Subscription cancelled. Website will remain live for 30 days.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * PUBLIC ROUTES (No authentication required)
 */

/**
 * GET /:subdomain
 * Public lawyer website page
 * Route: transcend-law.com/{subdomain}
 */
router.get('/:subdomain', async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;

    const website = await lawyerWebsiteService.getWebsiteBySubdomain(subdomain);

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    if (!lawyerWebsiteService.isSubscriptionActive(website)) {
      return res.status(404).json({
        error: 'This website is no longer active',
      });
    }

    // Track page view
    await lawyerWebsiteService.trackPageView(subdomain, {
      referralSource: req.get('referer') || 'direct',
      visitorIp: req.ip || '',
    });

    // Return website data
    res.json({
      website: {
        companyName: website.companyName,
        lawyerName: website.lawyerName,
        bio: website.bio,
        email: website.email,
        phone: website.phone,
        licenseNumber: website.licenseNumber,
        yearsExperience: website.yearsExperience,
        specializations: website.specializations,
        officeAddress: website.officeAddress,
        profilePicture: website.profilePicture,
        services: website.includedServices,
        testimonials: website.testimonials,
        website: website.website,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load website' });
  }
});

/**
 * POST /:subdomain/contact
 * Submit contact form on public website
 */
router.post('/:subdomain/contact', async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;
    const { name, email, phone, message, serviceInterest } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Missing required fields: name, email, message',
      });
    }

    const website = await lawyerWebsiteService.getWebsiteBySubdomain(subdomain);

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // TODO: Send email to lawyer
    // TODO: Create contact lead in system
    // TODO: Create task for lawyer to follow up

    res.json({
      success: true,
      message: 'Your message has been sent. The attorney will contact you soon.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

/**
 * POST /:subdomain/track/service-click
 * Track when visitor clicks on a service
 */
router.post('/:subdomain/track/service-click', async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;
    const { serviceId } = req.body;

    const website = await lawyerWebsiteService.getWebsiteBySubdomain(subdomain);

    if (website) {
      await lawyerWebsiteService.trackServiceClick(website.id, serviceId);
    }

    res.json({ success: true });
  } catch (error) {
    // Silently fail for tracking - don't impact user experience
    res.status(200).json({ success: true });
  }
});

export default router;
