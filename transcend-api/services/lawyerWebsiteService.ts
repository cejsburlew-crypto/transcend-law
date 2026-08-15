/**
 * Lawyer Profile Website Service
 * Manages lawyer-hosted websites on Transcend Law domain
 * $25/month subscription model via Clover
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

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

    // Generate subdomain
    const subdomain = await this.generateSubdomain(
      data.companyName,
      data.city,
      [] // In real app, fetch existing websites
    );

    // Calculate included services (all except excluded)
    const includedServices = data.allAvailableServices.filter(
      (service) => !data.excludedServices.includes(service)
    );

    const website: LawyerWebsite = {
      id,
      lawyerId: data.lawyerId,
      companyName: data.companyName,
      lawyerName: data.lawyerName,
      subdomain,
      bio: data.bio,
      email: data.email,
      phone: data.phone,
      specializations: data.specializations,
      excludedServices: data.excludedServices,
      includedServices,
      testimonials: [],
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      website: {
        backgroundColor: '#ffffff',
        accentColor: '#667eea',
      },
      analytics: {
        pageViews: 0,
        visitors: 0,
        lastUpdated: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TODO: Save to database
    // await db.lawyerWebsites.insert(website);

    return website;
  }

  /**
   * Update website content
   */
  async updateWebsite(
    websiteId: string,
    updates: Partial<LawyerWebsite>
  ): Promise<LawyerWebsite> {
    // TODO: Update database
    // const website = await db.lawyerWebsites.findById(websiteId);
    // Object.assign(website, updates);
    // await db.lawyerWebsites.update(website);

    return {} as LawyerWebsite;
  }

  /**
   * Get website by subdomain
   */
  async getWebsiteBySubdomain(subdomain: string): Promise<LawyerWebsite | null> {
    // TODO: Query database
    // return db.lawyerWebsites.findOne({ subdomain });
    return null;
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
    // TODO: Add to database
    // const website = await db.lawyerWebsites.findById(websiteId);
    // website.testimonials.push({
    //   ...testimonial,
    //   date: new Date().toISOString(),
    // });
    // await db.lawyerWebsites.update(website);
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
    // TODO: Log analytics
    // const analytics: WebsiteAnalytics = {
    //   websiteId,
    //   date: new Date(),
    //   pageViews: 1,
    //   uniqueVisitors: 1,
    //   referralSource: data.referralSource,
    //   serviceClicks: {},
    //   contactFormSubmissions: 0,
    // };
    // await db.websiteAnalytics.insert(analytics);
  }

  /**
   * Track service click
   */
  async trackServiceClick(websiteId: string, serviceId: string): Promise<void> {
    // TODO: Log service click
    // await db.websiteAnalytics.increment({
    //   websiteId,
    //   [`serviceClicks.${serviceId}`]: 1,
    // });
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
      // TODO: Get website from database
      // const website = await db.lawyerWebsites.findById(websiteId);

      // Charge via Clover one-time charge
      await axios.post(
        `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/charges`,
        {
          amount: 2500 * months, // $25 per month in cents
          customerId: 'customer_id', // TODO: Get from website.cloverCustomerId
          currency: 'USD',
          description: `Lawyer Website Renewal - ${months} month(s)`,
        },
        {
          headers: {
            Authorization: `Bearer ${CLOVER_API_KEY}`,
          },
        }
      );

      // Update end date
      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + months);
      // TODO: Update database
      // website.subscriptionEndDate = newEndDate;
      // await db.lawyerWebsites.update(website);

      return {} as LawyerWebsite;
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
      // Cancel subscription in Clover
      await axios.delete(
        `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/subscription_plans/${cloverSubscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${CLOVER_API_KEY}`,
          },
        }
      );

      // Update database
      // TODO: Update database
      // await db.lawyerWebsites.updateOne(
      //   { id: websiteId },
      //   { subscriptionStatus: 'cancelled' }
      // );
    } catch (error) {
      console.error('Failed to cancel Clover subscription:', error);
      throw error;
    }
  }
}

export default new LawyerWebsiteService();
