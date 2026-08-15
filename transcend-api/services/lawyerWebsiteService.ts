/**
 * Lawyer Profile Website Service
 * Manages lawyer-hosted websites on Transcend Law domain
 * $25/month subscription model via Clover
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { query } from '../../../transcend-law/backend/src/db/connection.js';

const CLOVER_API_BASE = 'https://api.clover.com';
const CLOVER_API_KEY = process.env.CLOVER_API_KEY;
const CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;
const LAWYER_WEBSITE_ITEM_ID = process.env.CLOVER_WEBSITE_ITEM_ID || 'lawyer_website_25mo';

export interface LawyerWebsite {
  id: string;
  lawyerId: string;
  companyName: string;
  lawyerName: string;
  subdomain: string; // Unique URL slug
  bio: string;
  profilePicture?: string;
  officeAddress?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  yearsExperience?: number;
  specializations: string[];
  excludedServices: string[]; // Compete with these
  includedServices: string[]; // Show all except competitors
  testimonials: Array<{
    clientName: string;
    rating: number;
    review: string;
    date: string;
  }>;
  subscriptionStatus: 'active' | 'paused' | 'cancelled';
  subscriptionStartDate: Date;
  subscriptionEndDate?: Date;
  website: {
    backgroundColor: string;
    accentColor: string;
    logoUrl?: string;
    headerImage?: string;
  };
  analytics: {
    pageViews: number;
    visitors: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WebsiteAnalytics {
  websiteId: string;
  date: Date;
  pageViews: number;
  uniqueVisitors: number;
  referralSource: string;
  serviceClicks: {
    [serviceId: string]: number;
  };
  contactFormSubmissions: number;
}

class LawyerWebsiteService {
  /**
   * Generate unique subdomain from company name
   * Checks for duplicates in same city and appends number if needed
   */
  async generateSubdomain(
    companyName: string,
    city: string,
    existingWebsites: LawyerWebsite[]
  ): Promise<string> {
    const baseSlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);

    // Check for duplicates in same city
    const duplicatesInCity = existingWebsites.filter(
      (w) =>
        w.subdomain.startsWith(baseSlug) &&
        w.companyName.toLowerCase().includes(city.toLowerCase())
    );

    if (duplicatesInCity.length === 0) {
      return baseSlug;
    }

    // Append number for duplicates
    return `${baseSlug}-${duplicatesInCity.length + 1}`;
  }

  /**
   * Create new lawyer website
   */
  async createWebsite(data: {
    lawyerId: string;
    lawyerName: string;
    companyName: string;
    city: string;
    bio: string;
    email: string;
    phone: string;
    specializations: string[];
    excludedServices: string[];
    allAvailableServices: string[];
  }): Promise<LawyerWebsite> {
    const id = uuidv4();

    // Fetch existing websites to check for duplicates
    const existingResult = await query(
      'SELECT * FROM lawyer_websites ORDER BY created_at DESC LIMIT 100'
    );
    const existingWebsites = existingResult.rows.map((row: any) => ({
      ...row,
      id: row.id,
      subdomain: row.subdomain,
      companyName: row.company_name,
    }));

    // Generate subdomain
    const subdomain = await this.generateSubdomain(
      data.companyName,
      data.city,
      existingWebsites
    );

    // Calculate included services (all except excluded)
    const includedServices = data.allAvailableServices.filter(
      (service) => !data.excludedServices.includes(service)
    );

    // Save to database
    const insertResult = await query(
      `INSERT INTO lawyer_websites (
        id, lawyer_id, company_name, lawyer_name, subdomain, bio,
        email, phone, specializations, excluded_services, included_services,
        subscription_status, subscription_start_date, website_bg_color,
        website_accent_color, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        id,
        data.lawyerId,
        data.companyName,
        data.lawyerName,
        subdomain,
        data.bio,
        data.email,
        data.phone,
        JSON.stringify(data.specializations),
        JSON.stringify(data.excludedServices),
        JSON.stringify(includedServices),
        'active',
        new Date(),
        '#ffffff',
        '#667eea',
        new Date(),
        new Date(),
      ]
    );

    const row = insertResult.rows[0];
    const website: LawyerWebsite = {
      id: row.id,
      lawyerId: row.lawyer_id,
      companyName: row.company_name,
      lawyerName: row.lawyer_name,
      subdomain: row.subdomain,
      bio: row.bio,
      email: row.email,
      phone: row.phone,
      specializations: JSON.parse(row.specializations || '[]'),
      excludedServices: JSON.parse(row.excluded_services || '[]'),
      includedServices: JSON.parse(row.included_services || '[]'),
      testimonials: [],
      subscriptionStatus: 'active',
      subscriptionStartDate: row.subscription_start_date,
      website: {
        backgroundColor: row.website_bg_color,
        accentColor: row.website_accent_color,
      },
      analytics: {
        pageViews: row.total_page_views || 0,
        visitors: row.total_unique_visitors || 0,
        lastUpdated: row.last_analytics_update || new Date(),
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return website;
  }

  /**
   * Update website content
   */
  async updateWebsite(
    websiteId: string,
    updates: Partial<LawyerWebsite>
  ): Promise<LawyerWebsite> {
    // Build dynamic SQL based on updates
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (updates.companyName) {
      updateFields.push(`company_name = $${paramCount++}`);
      updateValues.push(updates.companyName);
    }
    if (updates.bio) {
      updateFields.push(`bio = $${paramCount++}`);
      updateValues.push(updates.bio);
    }
    if (updates.email) {
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(updates.email);
    }
    if (updates.phone) {
      updateFields.push(`phone = $${paramCount++}`);
      updateValues.push(updates.phone);
    }
    if (updates.specializations) {
      updateFields.push(`specializations = $${paramCount++}`);
      updateValues.push(JSON.stringify(updates.specializations));
    }
    if (updates.website) {
      if (updates.website.backgroundColor) {
        updateFields.push(`website_bg_color = $${paramCount++}`);
        updateValues.push(updates.website.backgroundColor);
      }
      if (updates.website.accentColor) {
        updateFields.push(`website_accent_color = $${paramCount++}`);
        updateValues.push(updates.website.accentColor);
      }
    }

    updateFields.push(`updated_at = $${paramCount++}`);
    updateValues.push(new Date());
    updateValues.push(websiteId);

    if (updateFields.length === 1) return {} as LawyerWebsite; // No updates

    const updateResult = await query(
      `UPDATE lawyer_websites SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      updateValues
    );

    const row = updateResult.rows[0];
    if (!row) throw new Error('Website not found');

    const website: LawyerWebsite = {
      id: row.id,
      lawyerId: row.lawyer_id,
      companyName: row.company_name,
      lawyerName: row.lawyer_name,
      subdomain: row.subdomain,
      bio: row.bio,
      email: row.email,
      phone: row.phone,
      specializations: JSON.parse(row.specializations || '[]'),
      excludedServices: JSON.parse(row.excluded_services || '[]'),
      includedServices: JSON.parse(row.included_services || '[]'),
      testimonials: [],
      subscriptionStatus: row.subscription_status,
      subscriptionStartDate: row.subscription_start_date,
      subscriptionEndDate: row.subscription_end_date,
      website: {
        backgroundColor: row.website_bg_color,
        accentColor: row.website_accent_color,
      },
      analytics: {
        pageViews: row.total_page_views || 0,
        visitors: row.total_unique_visitors || 0,
        lastUpdated: row.last_analytics_update || new Date(),
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return website;
  }

  /**
   * Get website by subdomain
   */
  async getWebsiteBySubdomain(subdomain: string): Promise<LawyerWebsite | null> {
    const result = await query(
      'SELECT * FROM lawyer_websites WHERE subdomain = $1',
      [subdomain]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Fetch testimonials
    const testimonialsResult = await query(
      'SELECT * FROM lawyer_website_testimonials WHERE website_id = $1 ORDER BY created_at DESC',
      [row.id]
    );

    const testimonials = testimonialsResult.rows.map((t: any) => ({
      clientName: t.client_name,
      rating: t.rating,
      review: t.review,
      date: t.created_at,
    }));

    const website: LawyerWebsite = {
      id: row.id,
      lawyerId: row.lawyer_id,
      companyName: row.company_name,
      lawyerName: row.lawyer_name,
      subdomain: row.subdomain,
      bio: row.bio,
      profilePicture: row.profile_picture_url,
      officeAddress: row.office_address,
      email: row.email,
      phone: row.phone,
      licenseNumber: row.license_number,
      yearsExperience: row.years_experience,
      specializations: JSON.parse(row.specializations || '[]'),
      excludedServices: JSON.parse(row.excluded_services || '[]'),
      includedServices: JSON.parse(row.included_services || '[]'),
      testimonials,
      subscriptionStatus: row.subscription_status,
      subscriptionStartDate: row.subscription_start_date,
      subscriptionEndDate: row.subscription_end_date,
      website: {
        backgroundColor: row.website_bg_color,
        accentColor: row.website_accent_color,
        logoUrl: row.website_logo_url,
        headerImage: row.website_header_image_url,
      },
      analytics: {
        pageViews: row.total_page_views || 0,
        visitors: row.total_unique_visitors || 0,
        lastUpdated: row.last_analytics_update || new Date(),
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return website;
  }

  /**
   * Add testimonial to website
   */
  async addTestimonial(
    websiteId: string,
    testimonial: {
      clientName: string;
      rating: number;
      review: string;
    }
  ): Promise<void> {
    const id = uuidv4();

    await query(
      `INSERT INTO lawyer_website_testimonials (
        id, website_id, client_name, rating, review, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, websiteId, testimonial.clientName, testimonial.rating, testimonial.review, new Date()]
    );

    // Update audit log
    await query(
      `INSERT INTO lawyer_website_audit_log (
        id, website_id, lawyer_id, action, created_at
      ) SELECT $1, $2, lawyer_id, 'testimonial_added', $3 FROM lawyer_websites WHERE id = $2`,
      [uuidv4(), websiteId, new Date()]
    );
  }

  /**
   * Track page view analytics
   */
  async trackPageView(
    websiteId: string,
    data: {
      referralSource: string;
      visitorIp: string;
    }
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Upsert analytics record (insert if not exists, increment if exists)
      await query(
        `INSERT INTO lawyer_website_analytics (
          id, website_id, visit_date, page_views, unique_visitors, referral_source
        ) VALUES ($1, $2, $3, 1, 1, $4)
        ON CONFLICT (website_id, visit_date) DO UPDATE SET
          page_views = lawyer_website_analytics.page_views + 1`,
        [uuidv4(), websiteId, today, data.referralSource]
      );

      // Trigger stats update function
      await query('SELECT update_lawyer_website_stats($1)', [websiteId]);
    } catch (error) {
      console.error('Failed to track page view:', error);
      // Don't throw - analytics tracking should not block page loads
    }
  }

  /**
   * Track service click
   */
  async trackServiceClick(websiteId: string, serviceId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Upsert service click tracking
      await query(
        `INSERT INTO lawyer_website_service_clicks (
          id, website_id, service_name, click_date, click_count
        ) VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (website_id, service_name, click_date) DO UPDATE SET
          click_count = lawyer_website_service_clicks.click_count + 1`,
        [uuidv4(), websiteId, serviceId, today]
      );
    } catch (error) {
      console.error('Failed to track service click:', error);
      // Don't throw - analytics tracking should not block page loads
    }
  }

  /**
   * Generate website preview
   */
  generatePreview(website: LawyerWebsite): string {
    return `
      <div class="lawyer-website-preview">
        <h1>${website.companyName}</h1>
        <p>Attorney: ${website.lawyerName}</p>
        <p>${website.bio}</p>
        <h2>Contact</h2>
        <p>Email: ${website.email}</p>
        <p>Phone: ${website.phone}</p>
      </div>
    `;
  }

  /**
   * Calculate subscription cost
   */
  calculateSubscriptionCost(
    startDate: Date,
    endDate: Date,
    monthlyRate: number = 25
  ): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.ceil(diffDays / 30);
    return diffMonths * monthlyRate;
  }

  /**
   * Check if subscription is active
   */
  isSubscriptionActive(website: LawyerWebsite): boolean {
    if (website.subscriptionStatus !== 'active') return false;
    if (website.subscriptionEndDate && website.subscriptionEndDate < new Date()) {
      return false;
    }
    return true;
  }

  /**
   * Create Clover subscription for lawyer website
   */
  async createCloverSubscription(data: {
    lawyerId: string;
    lawyerEmail: string;
    lawyerName: string;
    cloverCustomerId: string;
  }): Promise<string> {
    try {
      // Create subscription in Clover
      const response = await axios.post(
        `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/subscription_plans`,
        {
          name: `Lawyer Website - ${data.lawyerName}`,
          items: [
            {
              id: LAWYER_WEBSITE_ITEM_ID,
              name: 'Lawyer Website Hosting',
              price: 2500, // $25.00 in cents
              quantity: 1,
            },
          ],
          recurring: {
            interval: 'MONTH',
            intervalCount: 1,
          },
          customer: data.cloverCustomerId,
          initialCharge: 2500,
        },
        {
          headers: {
            Authorization: `Bearer ${CLOVER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.id;
    } catch (error) {
      console.error('Failed to create Clover subscription:', error);
      throw error;
    }
  }

  /**
   * Renew subscription
   */
  async renewSubscription(websiteId: string, months: number = 1): Promise<LawyerWebsite> {
    try {
      // Get website from database
      const result = await query('SELECT * FROM lawyer_websites WHERE id = $1', [websiteId]);
      if (result.rows.length === 0) throw new Error('Website not found');

      const website = result.rows[0];

      // Charge via Clover one-time charge
      if (website.stripe_subscription_id) {
        await axios.post(
          `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/charges`,
          {
            amount: 2500 * months, // $25 per month in cents
            customerId: website.stripe_subscription_id,
            currency: 'USD',
            description: `Lawyer Website Renewal - ${months} month(s)`,
          },
          {
            headers: {
              Authorization: `Bearer ${CLOVER_API_KEY}`,
            },
          }
        );
      }

      // Update end date
      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + months);

      const updateResult = await query(
        `UPDATE lawyer_websites SET
          subscription_end_date = $1,
          subscription_status = 'active',
          updated_at = $2
        WHERE id = $3
        RETURNING *`,
        [newEndDate, new Date(), websiteId]
      );

      const row = updateResult.rows[0];

      // Log billing
      await query(
        `INSERT INTO lawyer_website_billing (
          id, website_id, lawyer_id, amount, billing_period_start,
          billing_period_end, status, payment_method, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'paid', 'clover', $7)`,
        [uuidv4(), websiteId, website.lawyer_id, 25.00 * months, new Date(), newEndDate, new Date()]
      );

      // Update audit log
      await query(
        `INSERT INTO lawyer_website_audit_log (
          id, website_id, lawyer_id, action, new_value, created_at
        ) VALUES ($1, $2, $3, 'subscription_renewed', $4, $5)`,
        [uuidv4(), websiteId, website.lawyer_id, `Renewed for ${months} month(s)`, new Date()]
      );

      const renewedWebsite: LawyerWebsite = {
        id: row.id,
        lawyerId: row.lawyer_id,
        companyName: row.company_name,
        lawyerName: row.lawyer_name,
        subdomain: row.subdomain,
        bio: row.bio,
        email: row.email,
        phone: row.phone,
        specializations: JSON.parse(row.specializations || '[]'),
        excludedServices: JSON.parse(row.excluded_services || '[]'),
        includedServices: JSON.parse(row.included_services || '[]'),
        testimonials: [],
        subscriptionStatus: 'active',
        subscriptionStartDate: row.subscription_start_date,
        subscriptionEndDate: newEndDate,
        website: {
          backgroundColor: row.website_bg_color,
          accentColor: row.website_accent_color,
        },
        analytics: {
          pageViews: row.total_page_views || 0,
          visitors: row.total_unique_visitors || 0,
          lastUpdated: row.last_analytics_update || new Date(),
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return renewedWebsite;
    } catch (error) {
      console.error('Failed to renew subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(websiteId: string, cloverSubscriptionId: string): Promise<void> {
    try {
      // Get website from database
      const result = await query('SELECT * FROM lawyer_websites WHERE id = $1', [websiteId]);
      if (result.rows.length === 0) throw new Error('Website not found');

      const website = result.rows[0];

      // Cancel subscription in Clover if subscription ID exists
      if (cloverSubscriptionId) {
        try {
          await axios.delete(
            `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/subscription_plans/${cloverSubscriptionId}`,
            {
              headers: {
                Authorization: `Bearer ${CLOVER_API_KEY}`,
              },
            }
          );
        } catch (cloverError) {
          console.error('Clover cancellation failed:', cloverError);
          // Continue with local cancellation even if Clover fails
        }
      }

      // Update database - set status to cancelled
      await query(
        `UPDATE lawyer_websites SET
          subscription_status = 'cancelled',
          updated_at = $1
        WHERE id = $2`,
        [new Date(), websiteId]
      );

      // Update audit log
      await query(
        `INSERT INTO lawyer_website_audit_log (
          id, website_id, lawyer_id, action, created_at
        ) VALUES ($1, $2, $3, 'cancelled', $4)`,
        [uuidv4(), websiteId, website.lawyer_id, new Date()]
      );
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }
}

export default new LawyerWebsiteService();
