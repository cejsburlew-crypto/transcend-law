/**
 * Lawyer Profile Website Service
 * Manages lawyer-hosted websites on Transcend Law domain
 * $25/month subscription model via Clover
 */
export interface LawyerWebsite {
    id: string;
    lawyerId: string;
    companyName: string;
    lawyerName: string;
    subdomain: string;
    bio: string;
    profilePicture?: string;
    officeAddress?: string;
    phone?: string;
    email?: string;
    licenseNumber?: string;
    yearsExperience?: number;
    specializations: string[];
    excludedServices: string[];
    includedServices: string[];
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
declare class LawyerWebsiteService {
    /**
     * Generate unique subdomain from company name
     * Checks for duplicates in same city and appends number if needed
     */
    generateSubdomain(companyName: string, city: string, existingWebsites: LawyerWebsite[]): Promise<string>;
    /**
     * Create new lawyer website
     */
    createWebsite(data: {
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
    }): Promise<LawyerWebsite>;
    /**
     * Update website content
     */
    updateWebsite(websiteId: string, updates: Partial<LawyerWebsite>): Promise<LawyerWebsite>;
    /**
     * Get website by subdomain
     */
    getWebsiteBySubdomain(subdomain: string): Promise<LawyerWebsite | null>;
    /**
     * Add testimonial to website
     */
    addTestimonial(websiteId: string, testimonial: {
        clientName: string;
        rating: number;
        review: string;
    }): Promise<void>;
    /**
     * Track page view analytics
     */
    trackPageView(websiteId: string, data: {
        referralSource: string;
        visitorIp: string;
    }): Promise<void>;
    /**
     * Track service click
     */
    trackServiceClick(websiteId: string, serviceId: string): Promise<void>;
    /**
     * Generate website preview
     */
    generatePreview(website: LawyerWebsite): string;
    /**
     * Calculate subscription cost
     */
    calculateSubscriptionCost(startDate: Date, endDate: Date, monthlyRate?: number): number;
    /**
     * Check if subscription is active
     */
    isSubscriptionActive(website: LawyerWebsite): boolean;
    /**
     * Create Clover subscription for lawyer website
     */
    createCloverSubscription(data: {
        lawyerId: string;
        lawyerEmail: string;
        lawyerName: string;
        cloverCustomerId: string;
    }): Promise<string>;
    /**
     * Renew subscription
     */
    renewSubscription(websiteId: string, months?: number): Promise<LawyerWebsite>;
    /**
     * Cancel subscription
     */
    cancelSubscription(websiteId: string, cloverSubscriptionId: string): Promise<void>;
}
declare const _default: LawyerWebsiteService;
export default _default;
//# sourceMappingURL=lawyerWebsiteService.d.ts.map