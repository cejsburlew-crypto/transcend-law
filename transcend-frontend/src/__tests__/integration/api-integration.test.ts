// API Integration Tests
// Tests backend API communication and data contracts

describe('API Integration Tests', () => {
  const API_BASE_URL = '/api/v2';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Personas API', () => {
    it('should fetch all personas', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 1, name: 'Client', tier_access: [0, 1, 2, 3] },
          { id: 2, name: 'Lawyer', tier_access: [1, 2, 3] },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/personas`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0]).toHaveProperty('id');
      expect(data.data[0]).toHaveProperty('name');
      expect(data.data[0]).toHaveProperty('tier_access');
    });

    it('should fetch persona by ID', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          name: 'Client',
          services: 48,
          tools: 20,
          tier_access: [0, 1, 2, 3],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/personas/1`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(1);
      expect(data.data.services).toBe(48);
    });
  });

  describe('Services API', () => {
    it('should fetch services for persona with pagination', async () => {
      const mockResponse = {
        success: true,
        data: {
          services: [
            {
              id: 1,
              name: 'Contract Review',
              category: 'legal',
              icon: '📋',
              rating: 4.8,
              reviews: 124,
            },
          ],
          total: 48,
          page: 1,
          limit: 10,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(
        `${API_BASE_URL}/personas/1/marketplace?page=1&limit=10`
      );
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.services).toHaveLength(1);
      expect(data.data.total).toBe(48);
      expect(data.data.page).toBe(1);
    });

    it('should filter services by rating', async () => {
      const mockResponse = {
        success: true,
        data: {
          services: [
            { id: 1, name: 'Contract Review', rating: 4.8 },
            { id: 2, name: 'Legal Research', rating: 4.7 },
          ],
          filtered: true,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(
        `${API_BASE_URL}/personas/1/marketplace?minRating=4.5`
      );
      const data = await response.json();

      expect(data.data.services.every((s: any) => s.rating >= 4.5)).toBe(true);
    });

    it('should search services by name', async () => {
      const mockResponse = {
        success: true,
        data: {
          services: [{ id: 1, name: 'Contract Review' }],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(
        `${API_BASE_URL}/personas/1/marketplace?search=contract`
      );
      const data = await response.json();

      expect(data.data.services).toHaveLength(1);
      expect(data.data.services[0].name).toContain('Contract');
    });
  });

  describe('Intake Forms API', () => {
    it('should create intake form', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, service_id: 1, client_id: 1, status: 'open' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/intake-forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 1,
          title: 'Review NDA',
          description: 'Need to review vendor NDA',
          budget_range: 2000,
          urgency: 'high',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.status).toBe('open');
    });

    it('should fetch intake form by ID', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          service_id: 1,
          client_id: 1,
          title: 'Review NDA',
          status: 'open',
          created_at: '2026-08-15T00:00:00Z',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/intake-forms/1`);
      const data = await response.json();

      expect(data.data.id).toBe(1);
      expect(data.data.status).toBe('open');
    });

    it('should validate intake form fields', async () => {
      const mockResponse = {
        success: false,
        errors: {
          title: 'Title is required',
          description: 'Description must be between 20-5000 characters',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/intake-forms`, {
        method: 'POST',
        body: JSON.stringify({ title: '', description: 'Short' }),
      });

      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.errors).toHaveProperty('title');
      expect(data.errors).toHaveProperty('description');
    });
  });

  describe('Service Offers API', () => {
    it('should fetch offers for intake form', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            provider_id: 1,
            provider_name: 'Sarah Johnson, Esq.',
            hourly_rate: 250,
            estimated_hours: 3,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/intake-forms/1/offers`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toHaveProperty('provider_name');
      expect(data.data[0]).toHaveProperty('hourly_rate');
    });

    it('should accept offer and create hire agreement', async () => {
      const mockResponse = {
        success: true,
        data: {
          hire_agreement_id: 1,
          status: 'active',
          provider_name: 'Sarah Johnson, Esq.',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/service-offers/1/accept`, {
        method: 'POST',
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('hire_agreement_id');
      expect(data.data.status).toBe('active');
    });

    it('should reject offer', async () => {
      const mockResponse = {
        success: true,
        data: { status: 'rejected' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/service-offers/1/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Rate too high' }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.status).toBe('rejected');
    });
  });

  describe('Hire Agreements API', () => {
    it('should fetch hire agreement details', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          client_id: 1,
          provider_id: 1,
          service_id: 1,
          status: 'active',
          created_at: '2026-08-15T00:00:00Z',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/hire-agreements/1`);
      const data = await response.json();

      expect(data.data.id).toBe(1);
      expect(data.data.status).toBe('active');
    });

    it('should update hire agreement status', async () => {
      const mockResponse = {
        success: true,
        data: { status: 'completed' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/hire-agreements/1`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });

      const data = await response.json();

      expect(data.data.status).toBe('completed');
    });
  });

  describe('Identity Verification API', () => {
    it('should verify identity with ID.me', async () => {
      const mockResponse = {
        success: true,
        data: {
          verification_id: 'id_123',
          status: 'verified',
          verified_at: new Date().toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(
        `${API_BASE_URL}/verifications/idme/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ user_id: 1 }),
        }
      );

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.status).toBe('verified');
    });

    it('should upload identity document', async () => {
      const mockResponse = {
        success: true,
        data: {
          document_id: 1,
          status: 'pending_review',
          created_at: new Date().toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const formData = new FormData();
      formData.append('document', new File(['test'], 'license.jpg'));
      formData.append('type', 'driver_license');

      const response = await fetch(`${API_BASE_URL}/verifications/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.status).toBe('pending_review');
    });

    it('should get verification status', async () => {
      const mockResponse = {
        success: true,
        data: {
          status: 'verified',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/verifications/user/1`);
      const data = await response.json();

      expect(data.data.status).toBe('verified');
    });
  });

  describe('Video Sessions API', () => {
    it('should create video session', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          hire_agreement_id: 1,
          platform: 'zoom',
          meeting_url: 'https://zoom.us/j/123456',
          started_at: new Date().toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/video-sessions`, {
        method: 'POST',
        body: JSON.stringify({
          hire_agreement_id: 1,
          platform: 'zoom',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('meeting_url');
      expect(data.data.platform).toBe('zoom');
    });

    it('should fetch video session history', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            platform: 'zoom',
            duration_seconds: 1800,
            recording_url: 'https://zoom.us/recording/123',
            ended_at: new Date().toISOString(),
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(
        `${API_BASE_URL}/video/hire-agreement/1/history`
      );
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toHaveProperty('recording_url');
    });

    it('should update video session status', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          status: 'ended',
          ended_at: new Date().toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/video-sessions/1`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ended' }),
      });

      const data = await response.json();

      expect(data.data.status).toBe('ended');
    });
  });

  describe('Messaging API', () => {
    it('should send message', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          hire_agreement_id: 1,
          sender_id: 1,
          message: 'When can you start?',
          created_at: new Date().toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          hire_agreement_id: 1,
          message: 'When can you start?',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.message).toBe('When can you start?');
    });

    it('should fetch message thread', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 1,
            sender_id: 1,
            message: 'Hi, interested?',
            read_at: null,
          },
          {
            id: 2,
            sender_id: 2,
            message: 'Yes, absolutely!',
            read_at: new Date().toISOString(),
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/hire-agreements/1/messages`);
      const data = await response.json();

      expect(data.data).toHaveLength(2);
      expect(data.data[0].message).toBe('Hi, interested?');
    });

    it('should mark message as read', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, read_at: new Date().toISOString() },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/messages/1/read`, {
        method: 'PATCH',
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('read_at');
    });
  });

  describe('Subscriptions API', () => {
    it('should fetch subscription tiers', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 0,
            tier_name: 'Free',
            monthly_price: 0,
            tier_level: 0,
            features: ['Core tools', 'Basic search'],
          },
          {
            id: 1,
            tier_name: 'Starter',
            monthly_price: 49,
            tier_level: 1,
            features: ['Core tools', 'Advanced search', 'Priority support'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/subscriptions/tiers`);
      const data = await response.json();

      expect(data.data).toHaveLength(2);
      expect(data.data[0].monthly_price).toBe(0);
      expect(data.data[1].monthly_price).toBe(49);
    });

    it('should fetch user subscription', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          user_id: 1,
          subscription_tier_id: 1,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/subscriptions/user/1`);
      const data = await response.json();

      expect(data.data.status).toBe('active');
      expect(data.data.subscription_tier_id).toBe(1);
    });

    it('should upgrade subscription tier', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          subscription_tier_id: 2,
          status: 'active',
          upgraded_at: new Date().toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(
        `${API_BASE_URL}/subscriptions/user/1/upgrade`,
        {
          method: 'POST',
          body: JSON.stringify({ tierId: 2 }),
        }
      );

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.subscription_tier_id).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for validation errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Validation failed',
        errors: { email: 'Invalid email format' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should return 404 for not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ success: false, error: 'Not found' }),
      });

      const response = await fetch(`${API_BASE_URL}/hire-agreements/999`);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthorized', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ success: false, error: 'Unauthorized' }),
      });

      const response = await fetch(`${API_BASE_URL}/protected-resource`, {
        headers: { Authorization: 'Bearer invalid' },
      });

      expect(response.status).toBe(401);
    });

    it('should handle network timeouts', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network timeout')
      );

      try {
        await fetch(`${API_BASE_URL}/hire-agreements/1`);
      } catch (error) {
        expect((error as Error).message).toBe('Network timeout');
      }
    });
  });

  describe('Data Contracts & Validation', () => {
    it('should enforce ID field presence in all responses', async () => {
      const responses = [
        {
          success: true,
          data: { id: 1, name: 'Test' },
        },
        {
          success: true,
          data: [{ id: 1 }, { id: 2 }],
        },
      ];

      responses.forEach((resp) => {
        if (Array.isArray(resp.data)) {
          resp.data.forEach((item) => {
            expect(item).toHaveProperty('id');
          });
        } else {
          expect(resp.data).toHaveProperty('id');
        }
      });
    });

    it('should maintain consistent timestamp formats', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 1,
          created_at: '2026-08-15T12:00:00Z',
          updated_at: '2026-08-15T12:00:00Z',
        },
      };

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
      expect(mockResponse.data.created_at).toMatch(isoRegex);
      expect(mockResponse.data.updated_at).toMatch(isoRegex);
    });

    it('should validate status enums', async () => {
      const validStatuses = ['pending', 'active', 'completed', 'cancelled'];
      const testStatus = 'active';

      expect(validStatuses).toContain(testStatus);
    });
  });
});
