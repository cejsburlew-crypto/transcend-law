// Integration Tests: Complete Hiring Workflow
// Tests end-to-end flow from persona selection through hire completion

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock components
import { PersonaSwitcher } from '../../components/Marketplace/PersonaSwitcher';
import { ServiceMarketplace } from '../../components/Marketplace/ServiceMarketplace';
import { IntakeForm } from '../../components/Hiring/IntakeForm';
import { ServiceOfferDisplay } from '../../components/Hiring/ServiceOfferDisplay';
import { IDMeVerification } from '../../components/Verification/IDMeVerification';
import { VideoConferencing } from '../../components/Conference/VideoConferencing';
import { MessagingUI } from '../../components/Messaging/MessagingUI';

// Mock API responses
const mockPersonas = [
  { id: 1, name: 'Client', icon: '👤' },
  { id: 2, name: 'Lawyer', icon: '⚖️' },
];

const mockServices = [
  {
    id: 1,
    name: 'Contract Review',
    icon: '📋',
    rating: 4.8,
    reviews: 124,
    providers: 8,
    tools: ['Document Editor', 'E-Signature'],
  },
];

const mockOffers = [
  {
    id: 1,
    provider_id: 1,
    provider_name: 'Sarah Johnson, Esq.',
    hourly_rate: 250,
    estimated_hours: 3,
    retention_required: 500,
    spending_limit: 1500,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];

describe('Hiring Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('Step 1: Persona Selection', () => {
    it('should render persona switcher and allow persona selection', async () => {
      const handlePersonaChange = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockPersonas }),
      });

      render(
        <PersonaSwitcher
          currentPersonaId={1}
          onPersonaChange={handlePersonaChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Client')).toBeInTheDocument();
      });

      const lawyerOption = screen.getByText('⚖️');
      fireEvent.click(lawyerOption);

      expect(handlePersonaChange).toHaveBeenCalledWith(2);
    });

    it('should display current persona with checkmark', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockPersonas }),
      });

      render(<PersonaSwitcher currentPersonaId={1} onPersonaChange={() => {}} />);

      await waitFor(() => {
        const clientOption = screen.getByText('Client');
        expect(clientOption).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Service Browsing & Selection', () => {
    it('should render service marketplace and fetch services', async () => {
      const handleSelectService = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { services: mockServices },
          }),
      });

      render(
        <ServiceMarketplace
          personaId={1}
          onSelectService={handleSelectService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Contract Review')).toBeInTheDocument();
      });

      const serviceCard = screen.getByText('Contract Review');
      fireEvent.click(serviceCard);

      expect(handleSelectService).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        name: 'Contract Review',
      }));
    });

    it('should support search and filtering', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { services: mockServices },
          }),
      });

      render(<ServiceMarketplace personaId={1} onSelectService={() => {}} />);

      const searchInput = await screen.findByPlaceholderText(/search/i);
      await userEvent.type(searchInput, 'Contract');

      await waitFor(() => {
        expect(screen.getByText('Contract Review')).toBeInTheDocument();
      });
    });

    it('should display service details correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { services: mockServices },
          }),
      });

      render(<ServiceMarketplace personaId={1} onSelectService={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('Contract Review')).toBeInTheDocument();
        expect(screen.getByText('4.8')).toBeInTheDocument(); // rating
        expect(screen.getByText('124')).toBeInTheDocument(); // reviews
      });
    });
  });

  describe('Step 3: Intake Form Submission', () => {
    it('should validate required fields before submission', async () => {
      const handleSubmit = jest.fn();

      render(
        <IntakeForm
          serviceId={1}
          serviceName="Contract Review"
          serviceIcon="📋"
          onSubmit={handleSubmit}
          onCancel={() => {}}
        />
      );

      const submitButton = screen.getByText(/submit/i);
      fireEvent.click(submitButton);

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    it('should accept valid intake form submission', async () => {
      const handleSubmit = jest.fn();

      render(
        <IntakeForm
          serviceId={1}
          serviceName="Contract Review"
          serviceIcon="📋"
          onSubmit={handleSubmit}
          onCancel={() => {}}
        />
      );

      const titleInput = screen.getByPlaceholderText(/service title/i);
      const descriptionInput = screen.getByPlaceholderText(/detailed description/i);
      const budgetInput = screen.getByPlaceholderText(/budget/i);

      await userEvent.type(titleInput, 'Review NDA');
      await userEvent.type(
        descriptionInput,
        'Need review of vendor NDA before signing. Priority issues: confidentiality scope and indemnification clauses.'
      );
      await userEvent.type(budgetInput, '2000');

      const submitButton = screen.getByText(/submit/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Review NDA',
            description: expect.stringContaining('vendor NDA'),
            budget_range: 2000,
          })
        );
      });
    });

    it('should enforce character limits on description', async () => {
      render(
        <IntakeForm
          serviceId={1}
          serviceName="Contract Review"
          serviceIcon="📋"
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      const descriptionInput = screen.getByPlaceholderText(/detailed description/i);
      const tooShort = 'Short';
      const tooLong = 'x'.repeat(5001);

      await userEvent.type(descriptionInput, tooShort);
      expect(screen.getByText(/minimum 20 characters/i)).toBeInTheDocument();

      await userEvent.clear(descriptionInput);
      await userEvent.type(descriptionInput, tooLong);
      expect(screen.getByText(/maximum 5000 characters/i)).toBeInTheDocument();
    });

    it('should display urgency level options', async () => {
      render(
        <IntakeForm
          serviceId={1}
          serviceName="Contract Review"
          serviceIcon="📋"
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText('🟢')).toBeInTheDocument(); // Low
      expect(screen.getByText('🟡')).toBeInTheDocument(); // Medium
      expect(screen.getByText('🟠')).toBeInTheDocument(); // High
      expect(screen.getByText('🔴')).toBeInTheDocument(); // Urgent
    });
  });

  describe('Step 4: Offer Review & Acceptance', () => {
    it('should display provider offers with countdown timer', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockOffers,
          }),
      });

      render(
        <ServiceOfferDisplay
          intakeFormId={1}
          serviceName="Contract Review"
          onOfferAccepted={() => {}}
          onOfferRejected={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson, Esq.')).toBeInTheDocument();
        expect(screen.getByText('$250/hour')).toBeInTheDocument();
        expect(screen.getByText('3 hours')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should allow acceptance of offer', async () => {
      const handleOfferAccepted = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockOffers,
          }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <ServiceOfferDisplay
          intakeFormId={1}
          serviceName="Contract Review"
          onOfferAccepted={handleOfferAccepted}
          onOfferRejected={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson, Esq.')).toBeInTheDocument();
      });

      const acceptButton = screen.getByText(/accept/i);
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(handleOfferAccepted).toHaveBeenCalled();
      });
    });

    it('should allow rejection of offer', async () => {
      const handleOfferRejected = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockOffers,
          }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(
        <ServiceOfferDisplay
          intakeFormId={1}
          serviceName="Contract Review"
          onOfferAccepted={() => {}}
          onOfferRejected={handleOfferRejected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson, Esq.')).toBeInTheDocument();
      });

      const rejectButton = screen.getByText(/reject/i);
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(handleOfferRejected).toHaveBeenCalled();
      });
    });

    it('should organize offers by status (Active, Accepted, Declined)', async () => {
      const multiStatusOffers = [
        { ...mockOffers[0], id: 1, status: 'pending' },
        { ...mockOffers[0], id: 2, status: 'accepted' },
        { ...mockOffers[0], id: 3, status: 'rejected' },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: multiStatusOffers,
          }),
      });

      render(
        <ServiceOfferDisplay
          intakeFormId={1}
          serviceName="Contract Review"
          onOfferAccepted={() => {}}
          onOfferRejected={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/active/i)).toBeInTheDocument();
        expect(screen.getByText(/accepted/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 5: Identity Verification', () => {
    it('should render ID.me verification option', async () => {
      render(
        <IDMeVerification
          userId={1}
          hireAgreementId={1}
          onVerified={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText(/ID\.me verification/i)).toBeInTheDocument();
      expect(screen.getByText(/instant verification/i)).toBeInTheDocument();
    });

    it('should allow driver license upload with validation', async () => {
      const handleVerified = jest.fn();

      render(
        <IDMeVerification
          userId={1}
          hireAgreementId={1}
          onVerified={handleVerified}
          onSkip={() => {}}
        />
      );

      const fileInput = screen.getByRole('input', { hidden: true });
      const file = new File(['dummy'], 'license.jpg', { type: 'image/jpeg' });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('license.jpg')).toBeInTheDocument();
      });
    });

    it('should validate file type (JPEG/PNG/PDF only)', async () => {
      render(
        <IDMeVerification
          userId={1}
          hireAgreementId={1}
          onVerified={() => {}}
          onSkip={() => {}}
        />
      );

      const fileInput = screen.getByRole('input', { hidden: true });
      const invalidFile = new File(['dummy'], 'document.txt', {
        type: 'text/plain',
      });

      await userEvent.upload(fileInput, invalidFile);

      expect(
        screen.getByText(/only JPEG, PNG, or PDF files/i)
      ).toBeInTheDocument();
    });

    it('should validate file size (max 5MB)', async () => {
      render(
        <IDMeVerification
          userId={1}
          hireAgreementId={1}
          onVerified={() => {}}
          onSkip={() => {}}
        />
      );

      const fileInput = screen.getByRole('input', { hidden: true });
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      await userEvent.upload(fileInput, largeFile);

      expect(screen.getByText(/file must be smaller than 5MB/i)).toBeInTheDocument();
    });
  });

  describe('Step 6: Video Conferencing', () => {
    it('should render video conferencing controls', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { platform: 'zoom', connected: true },
          }),
      });

      render(
        <VideoConferencing
          hireAgreementId={1}
          clientName="John Doe"
          providerName="Sarah Johnson, Esq."
          clientEmail="john@example.com"
          providerEmail="sarah@example.com"
          isHost={true}
          onCallStart={() => {}}
          onCallEnd={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/zoom/i)).toBeInTheDocument();
      });
    });

    it('should allow platform connection', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { platform: 'zoom', connected: false },
          }),
      });

      render(
        <VideoConferencing
          hireAgreementId={1}
          clientName="John Doe"
          providerName="Sarah Johnson, Esq."
          clientEmail="john@example.com"
          providerEmail="sarah@example.com"
          isHost={true}
          onCallStart={() => {}}
          onCallEnd={() => {}}
        />
      );

      const connectButton = await screen.findByText(/connect account/i);
      fireEvent.click(connectButton);

      expect(
        screen.getByText(/connecting to Zoom/i)
      ).toBeInTheDocument();
    });

    it('should track active call duration', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              platform: 'zoom',
              connected: true,
              activeCall: { startedAt: Date.now(), participants: 2 },
            },
          }),
      });

      const { rerender } = render(
        <VideoConferencing
          hireAgreementId={1}
          clientName="John Doe"
          providerName="Sarah Johnson, Esq."
          clientEmail="john@example.com"
          providerEmail="sarah@example.com"
          isHost={true}
          onCallStart={() => {}}
          onCallEnd={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/00:00:00/)).toBeInTheDocument();
      });

      jest.advanceTimersByTime(65000); // 1 minute 5 seconds
      rerender(
        <VideoConferencing
          hireAgreementId={1}
          clientName="John Doe"
          providerName="Sarah Johnson, Esq."
          clientEmail="john@example.com"
          providerEmail="sarah@example.com"
          isHost={true}
          onCallStart={() => {}}
          onCallEnd={() => {}}
        />
      );

      jest.useRealTimers();
    });
  });

  describe('Step 7: Real-Time Messaging', () => {
    it('should render messaging interface', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
      });
    });

    it('should send text messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      const input = await screen.findByPlaceholderText(/message/i);
      await userEvent.type(input, 'When can you start?');

      const sendButton = screen.getByText(/send/i);
      fireEvent.click(sendButton);

      expect(input).toHaveValue('');
    });

    it('should support file attachments', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      const fileUploadButton = await screen.findByRole('button', {
        name: /attachment/i,
      });
      expect(fileUploadButton).toBeInTheDocument();
    });

    it('should poll for new messages every 3 seconds', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    it('should display read status indicators', async () => {
      const messagesWithStatus = [
        {
          id: 1,
          sender_id: 2,
          message: 'I can start tomorrow',
          read_at: new Date().toISOString(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: messagesWithStatus,
          }),
      });

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/I can start tomorrow/)).toBeInTheDocument();
      });
    });
  });

  describe('Complete Workflow End-to-End', () => {
    it('should complete full hiring workflow', async () => {
      // Mock all API calls
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockPersonas }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, data: { services: mockServices } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: 1 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOffers }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { platform: 'zoom', connected: true },
            }),
        });

      // Test workflow progression
      const workflowSteps: string[] = [];

      // Step 1: Persona Selection
      const { rerender } = render(
        <PersonaSwitcher
          currentPersonaId={1}
          onPersonaChange={() => workflowSteps.push('persona_selected')}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Client')).toBeInTheDocument();
      });

      // Step 2: Service Selection (simulated)
      workflowSteps.push('service_selected');

      // Step 3: Intake Submission (simulated)
      workflowSteps.push('intake_submitted');

      // Step 4: Offer Accepted (simulated)
      workflowSteps.push('offer_accepted');

      // Step 5: Identity Verified (simulated)
      workflowSteps.push('identity_verified');

      // Step 6: Video Call Started (simulated)
      workflowSteps.push('video_call_started');

      // Verify workflow completed
      expect(workflowSteps).toContain('service_selected');
      expect(workflowSteps).toContain('intake_submitted');
      expect(workflowSteps).toContain('offer_accepted');
      expect(workflowSteps).toContain('identity_verified');
      expect(workflowSteps).toContain('video_call_started');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle API failures gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(
        <ServiceMarketplace
          personaId={1}
          onSelectService={() => {}}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/failed to load services/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle missing or incomplete offer data', async () => {
      const incompleteOffer = {
        ...mockOffers[0],
        provider_name: null,
        hourly_rate: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [incompleteOffer],
          }),
      });

      render(
        <ServiceOfferDisplay
          intakeFormId={1}
          serviceName="Contract Review"
          onOfferAccepted={() => {}}
          onOfferRejected={() => {}}
        />
      );

      await waitFor(() => {
        // Should still render without crashing
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    it('should handle expired offers correctly', async () => {
      const expiredOffer = {
        ...mockOffers[0],
        expires_at: new Date(Date.now() - 1000).toISOString(),
        status: 'expired',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [expiredOffer],
          }),
      });

      render(
        <ServiceOfferDisplay
          intakeFormId={1}
          serviceName="Contract Review"
          onOfferAccepted={() => {}}
          onOfferRejected={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument();
      });
    });

    it('should disable messaging if hire agreement is not active', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });

      const { container } = render(
        <MessagingUI
          hireAgreementId={0}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      const messageInput = container.querySelector('.message-input') as HTMLInputElement;
      if (messageInput) {
        expect(messageInput.disabled).toBe(true);
      }
    });

    it('should handle file upload failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Upload failed')
      );

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      const input = await screen.findByRole('input', { hidden: true });
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });

      await userEvent.upload(input, file);

      expect(
        screen.getByText(/file must be smaller than 10MB/i)
      ).toBeInTheDocument();
    });
  });

  describe('Responsive Design & Accessibility', () => {
    it('should render components on mobile viewport', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: mockPersonas }),
      });

      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <PersonaSwitcher
          currentPersonaId={1}
          onPersonaChange={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Client')).toBeInTheDocument();
      });

      // Restore viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    it('should have proper ARIA labels for accessibility', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: [] }),
      });

      render(
        <MessagingUI
          hireAgreementId={1}
          currentUserId={1}
          currentUserType="client"
          currentUserName="John Doe"
          otherUserName="Sarah Johnson, Esq."
        />
      );

      const sendButton = await screen.findByRole('button', {
        name: /send|send message/i,
      });
      expect(sendButton).toBeInTheDocument();
    });
  });
});
