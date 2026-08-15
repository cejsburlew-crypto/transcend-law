// Find Attorney Component Tests
// Step 1: State Selection
// Step 2: Firm Selection with Send to All and Select Individual options

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FindAttorneyStep1 from '../../components/Directory/FindAttorneyStep1';
import FindAttorneyStep2 from '../../components/Directory/FindAttorneyStep2';

const mockFirms = [
  {
    id: 'firm-1',
    name: 'California Legal Partners',
    location: 'San Francisco, CA',
    attorneyCount: 2,
  },
  {
    id: 'firm-2',
    name: 'West Coast Law Group',
    location: 'Los Angeles, CA',
    attorneyCount: 1,
  },
  {
    id: 'firm-3',
    name: 'Bay Area Legal Services',
    location: 'Oakland, CA',
    attorneyCount: 3,
  },
];

describe('FindAttorneyStep1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Layout & Rendering', () => {
    it('renders step header with title', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByText('Select Your State')).toBeInTheDocument();
      expect(screen.getByText(/Choose your state to find/)).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByTestId('state-search-input')).toBeInTheDocument();
    });

    it('renders state buttons for all 50 states', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByTestId('state-button-CA')).toBeInTheDocument();
      expect(screen.getByTestId('state-button-NY')).toBeInTheDocument();
      expect(screen.getByTestId('state-button-TX')).toBeInTheDocument();
    });

    it('renders cancel and continue buttons', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByTestId('btn-cancel')).toBeInTheDocument();
      expect(screen.getByTestId('btn-continue')).toBeInTheDocument();
    });

    it('renders info box with tip', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByText(/We have attorneys and law firms/)).toBeInTheDocument();
    });
  });

  describe('State Selection', () => {
    it('selects state when clicked', () => {
      render(<FindAttorneyStep1 />);
      const caButton = screen.getByTestId('state-button-CA');
      fireEvent.click(caButton);
      expect(caButton).toHaveClass('active');
    });

    it('shows only one state selected at a time', () => {
      render(<FindAttorneyStep1 />);
      fireEvent.click(screen.getByTestId('state-button-CA'));
      fireEvent.click(screen.getByTestId('state-button-NY'));

      expect(screen.getByTestId('state-button-CA')).not.toHaveClass('active');
      expect(screen.getByTestId('state-button-NY')).toHaveClass('active');
    });

    it('calls onStateSelected when continue clicked with selected state', () => {
      const mockOnStateSelected = jest.fn();
      render(
        <FindAttorneyStep1 onStateSelected={mockOnStateSelected} />
      );

      fireEvent.click(screen.getByTestId('state-button-CA'));
      fireEvent.click(screen.getByTestId('btn-continue'));

      expect(mockOnStateSelected).toHaveBeenCalledWith('CA');
    });

    it('disables continue button until state is selected', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByTestId('btn-continue')).toBeDisabled();

      fireEvent.click(screen.getByTestId('state-button-CA'));
      expect(screen.getByTestId('btn-continue')).not.toBeDisabled();
    });

    it('shows selected state summary after selection', () => {
      render(<FindAttorneyStep1 />);
      fireEvent.click(screen.getByTestId('state-button-CA'));
      expect(screen.getByText('California (CA)')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters states by state code', () => {
      render(<FindAttorneyStep1 />);
      const searchInput = screen.getByTestId('state-search-input');

      fireEvent.change(searchInput, { target: { value: 'CA' } });

      expect(screen.getByTestId('state-button-CA')).toBeInTheDocument();
      expect(screen.queryByTestId('state-button-NY')).not.toBeInTheDocument();
    });

    it('filters states by state name', () => {
      render(<FindAttorneyStep1 />);
      const searchInput = screen.getByTestId('state-search-input');

      fireEvent.change(searchInput, { target: { value: 'California' } });

      expect(screen.getByTestId('state-button-CA')).toBeInTheDocument();
      expect(screen.queryByTestId('state-button-NY')).not.toBeInTheDocument();
    });

    it('shows no results message when search has no matches', () => {
      render(<FindAttorneyStep1 />);
      const searchInput = screen.getByTestId('state-search-input');

      fireEvent.change(searchInput, { target: { value: 'XYZ' } });

      expect(screen.getByText(/No states found/)).toBeInTheDocument();
    });

    it('shows clear button when search has text', () => {
      render(<FindAttorneyStep1 />);
      const searchInput = screen.getByTestId('state-search-input');

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'CA' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      render(<FindAttorneyStep1 />);
      const searchInput = screen.getByTestId('state-search-input');

      fireEvent.change(searchInput, { target: { value: 'CA' } });
      fireEvent.click(screen.getByLabelText('Clear search'));

      expect(searchInput).toHaveValue('');
    });

    it('is case insensitive search', () => {
      render(<FindAttorneyStep1 />);
      const searchInput = screen.getByTestId('state-search-input');

      fireEvent.change(searchInput, { target: { value: 'california' } });

      expect(screen.getByTestId('state-button-CA')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('calls onCancel when cancel button clicked', () => {
      const mockOnCancel = jest.fn();
      render(<FindAttorneyStep1 onCancel={mockOnCancel} />);

      fireEvent.click(screen.getByTestId('btn-cancel'));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('disables cancel button during loading', () => {
      render(<FindAttorneyStep1 loading={true} />);
      expect(screen.getByTestId('btn-cancel')).toBeDisabled();
    });

    it('disables state buttons during loading', () => {
      render(<FindAttorneyStep1 loading={true} />);
      expect(screen.getByTestId('state-button-CA')).toBeDisabled();
    });

    it('shows loading state in continue button', () => {
      render(<FindAttorneyStep1 loading={true} />);
      expect(screen.getByTestId('btn-continue')).toHaveTextContent('🔄 Loading...');
    });
  });

  describe('Pre-selected State', () => {
    it('shows selected state on initial render', () => {
      render(<FindAttorneyStep1 selectedState="CA" />);
      expect(screen.getByTestId('state-button-CA')).toHaveClass('active');
    });

    it('updates continue button text with pre-selected state', () => {
      render(<FindAttorneyStep1 selectedState="CA" />);
      expect(screen.getByTestId('btn-continue')).toHaveTextContent('Continue with CA');
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-pressed on state buttons', () => {
      render(<FindAttorneyStep1 />);
      fireEvent.click(screen.getByTestId('state-button-CA'));
      expect(screen.getByTestId('state-button-CA')).toHaveAttribute('aria-pressed', 'true');
    });

    it('has title attribute on state buttons', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByTestId('state-button-CA')).toHaveAttribute('title', 'California');
    });

    it('search input has placeholder text', () => {
      render(<FindAttorneyStep1 />);
      expect(screen.getByTestId('state-search-input')).toHaveAttribute('placeholder');
    });
  });
});

describe('FindAttorneyStep2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Layout & Rendering', () => {
    it('renders step header with state and firm count', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByText('Select Firm(s) in CA')).toBeInTheDocument();
      expect(screen.getByText(/3 firms/)).toBeInTheDocument();
    });

    it('renders send to all button', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByTestId('btn-send-to-all')).toBeInTheDocument();
      expect(screen.getByText(/Send to All Firms/)).toBeInTheDocument();
      expect(screen.getByText(/Send your request to all 3 firms/)).toBeInTheDocument();
    });

    it('renders firm cards for each firm', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByText('California Legal Partners')).toBeInTheDocument();
      expect(screen.getByText('West Coast Law Group')).toBeInTheDocument();
      expect(screen.getByText('Bay Area Legal Services')).toBeInTheDocument();
    });

    it('renders firm details (location and attorney count)', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByText('📍 San Francisco, CA')).toBeInTheDocument();
      expect(screen.getByText('👥 2 attorneys')).toBeInTheDocument();
      expect(screen.getByText('👥 1 attorney')).toBeInTheDocument();
    });

    it('renders select all checkbox', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const selectAllCheckbox = screen.getByLabelText('Select all firms');
      expect(selectAllCheckbox).toBeInTheDocument();
    });

    it('renders back and send buttons', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByTestId('btn-back')).toBeInTheDocument();
      expect(screen.getByTestId('btn-send-selected')).toBeInTheDocument();
    });

    it('renders info box with tip', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByText(/All selected firms will receive/)).toBeInTheDocument();
    });
  });

  describe('Send to All Functionality', () => {
    it('calls onSendToAll when send to all button clicked', () => {
      const mockOnSendToAll = jest.fn();
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          onSendToAll={mockOnSendToAll}
        />
      );

      const sendToAllButton = screen.getByTestId('btn-send-to-all');
      fireEvent.click(sendToAllButton);

      expect(mockOnSendToAll).toHaveBeenCalled();
    });

    it('disables send to selected button while sending to all', () => {
      const mockOnSendToAll = jest.fn();
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          onSendToAll={mockOnSendToAll}
        />
      );

      fireEvent.click(screen.getByTestId('btn-send-to-all'));

      expect(screen.getByTestId('btn-send-selected')).toBeDisabled();
    });

    it('shows loading indicator when sending to all', () => {
      const mockOnSendToAll = jest.fn();
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          onSendToAll={mockOnSendToAll}
          loading={true}
        />
      );

      expect(screen.getByTestId('btn-send-to-all')).toBeDisabled();
    });
  });

  describe('Individual Firm Selection', () => {
    it('selects firm when checkbox is clicked', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const firstFirmCheckbox = screen.getByLabelText('Select California Legal Partners');
      fireEvent.click(firstFirmCheckbox);

      expect(firstFirmCheckbox).toBeChecked();
    });

    it('highlights firm card when selected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const firstFirmCard = screen.getByTestId('firm-card-firm-1');
      fireEvent.click(firstFirmCard);

      expect(firstFirmCard).toHaveClass('selected');
    });

    it('deselects firm when checkbox is clicked again', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const firstFirmCheckbox = screen.getByLabelText('Select California Legal Partners');
      fireEvent.click(firstFirmCheckbox);
      expect(firstFirmCheckbox).toBeChecked();

      fireEvent.click(firstFirmCheckbox);
      expect(firstFirmCheckbox).not.toBeChecked();
    });

    it('allows selecting multiple firms', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));
      fireEvent.click(screen.getByLabelText('Select West Coast Law Group'));

      expect(screen.getByLabelText('Select California Legal Partners')).toBeChecked();
      expect(screen.getByLabelText('Select West Coast Law Group')).toBeChecked();
    });

    it('shows selected count when firms are selected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));
      fireEvent.click(screen.getByLabelText('Select West Coast Law Group'));

      expect(screen.getByText('2 firms selected')).toBeInTheDocument();
    });

    it('shows singular form when one firm selected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));

      expect(screen.getByText('1 firm selected')).toBeInTheDocument();
    });

    it('calls onSendToSelected with selected firm IDs', () => {
      const mockOnSendToSelected = jest.fn();
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          onSendToSelected={mockOnSendToSelected}
        />
      );

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));
      fireEvent.click(screen.getByLabelText('Select West Coast Law Group'));
      fireEvent.click(screen.getByTestId('btn-send-selected'));

      expect(mockOnSendToSelected).toHaveBeenCalledWith(['firm-1', 'firm-2']);
    });

    it('disables send to selected button when no firms selected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByTestId('btn-send-selected')).toBeDisabled();
    });

    it('enables send to selected button when firms are selected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));

      expect(screen.getByTestId('btn-send-selected')).not.toBeDisabled();
    });

    it('updates button text with selected count', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));
      expect(screen.getByTestId('btn-send-selected')).toHaveTextContent('Send to 1 Firm');

      fireEvent.click(screen.getByLabelText('Select West Coast Law Group'));
      expect(screen.getByTestId('btn-send-selected')).toHaveTextContent('Send to 2 Firms');
    });
  });

  describe('Select All Functionality', () => {
    it('selects all firms when select all is clicked', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select all firms'));

      expect(screen.getByLabelText('Select California Legal Partners')).toBeChecked();
      expect(screen.getByLabelText('Select West Coast Law Group')).toBeChecked();
      expect(screen.getByLabelText('Select Bay Area Legal Services')).toBeChecked();
    });

    it('deselects all firms when select all is clicked again', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const selectAllCheckbox = screen.getByLabelText('Select all firms');
      fireEvent.click(selectAllCheckbox);
      expect(selectAllCheckbox).toBeChecked();

      fireEvent.click(selectAllCheckbox);
      expect(selectAllCheckbox).not.toBeChecked();
      expect(screen.queryByText(/firms selected/)).not.toBeInTheDocument();
    });

    it('highlights select all when all firms are selected individually', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      mockFirms.forEach(firm => {
        fireEvent.click(screen.getByLabelText(`Select ${firm.name}`));
      });

      expect(screen.getByLabelText('Select all firms')).toBeChecked();
    });

    it('unchecks select all when one firm is deselected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      fireEvent.click(screen.getByLabelText('Select all firms'));
      expect(screen.getByLabelText('Select all firms')).toBeChecked();

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));
      expect(screen.getByLabelText('Select all firms')).not.toBeChecked();
    });
  });

  describe('Navigation', () => {
    it('calls onBack when back button clicked', () => {
      const mockOnBack = jest.fn();
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          onBack={mockOnBack}
        />
      );

      fireEvent.click(screen.getByTestId('btn-back'));

      expect(mockOnBack).toHaveBeenCalled();
    });

    it('disables back button during loading', () => {
      const mockOnBack = jest.fn();
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          onBack={mockOnBack}
          loading={true}
        />
      );

      expect(screen.getByTestId('btn-back')).toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('selects firm when Enter key pressed on firm card', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const firstFirmCard = screen.getByTestId('firm-card-firm-1');
      fireEvent.keyDown(firstFirmCard, { key: 'Enter', code: 'Enter' });

      expect(screen.getByLabelText('Select California Legal Partners')).toBeChecked();
    });

    it('selects firm when Space key pressed on firm card', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const firstFirmCard = screen.getByTestId('firm-card-firm-1');
      fireEvent.keyDown(firstFirmCard, { key: ' ', code: 'Space' });

      expect(screen.getByLabelText('Select California Legal Partners')).toBeChecked();
    });
  });

  describe('Empty State', () => {
    it('handles empty firms list gracefully', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={[]} />
      );

      expect(screen.getByText('Select Firm(s) in CA')).toBeInTheDocument();
      expect(screen.getByText(/0 firms/)).toBeInTheDocument();
    });

    it('disables send to all when no firms available', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={[]} />
      );

      expect(screen.getByTestId('btn-send-to-all')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria labels on buttons', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.getByLabelText('Select all firms')).toBeInTheDocument();
      expect(screen.getByLabelText('Select California Legal Partners')).toBeInTheDocument();
    });

    it('firm cards are keyboard accessible', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      const firstFirmCard = screen.getByTestId('firm-card-firm-1');
      expect(firstFirmCard).toHaveAttribute('role', 'button');
      expect(firstFirmCard).toHaveAttribute('tabIndex', '0');
    });

    it('has proper semantic HTML structure', () => {
      const { container } = render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(container.querySelector('input[type="checkbox"]')).toBeInTheDocument();
      expect(container.querySelector('button')).toBeInTheDocument();
    });
  });

  describe('Display Logic', () => {
    it('shows selected count only when firms are selected', () => {
      render(
        <FindAttorneyStep2 state="CA" firms={mockFirms} />
      );

      expect(screen.queryByText(/firms selected/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Select California Legal Partners'));

      expect(screen.getByText('1 firm selected')).toBeInTheDocument();
    });

    it('disables select all when loading', () => {
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          loading={true}
        />
      );

      expect(screen.getByLabelText('Select all firms')).toBeDisabled();
    });

    it('disables individual firm checkboxes when loading', () => {
      render(
        <FindAttorneyStep2
          state="CA"
          firms={mockFirms}
          loading={true}
        />
      );

      expect(screen.getByLabelText('Select California Legal Partners')).toBeDisabled();
    });
  });
});
