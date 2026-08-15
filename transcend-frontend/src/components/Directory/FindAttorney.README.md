# Find Attorney Components

Attorney and law firm discovery and selection system for Transcend Legal Platform.

## Components

### FindAttorneyStep1.tsx
State selection step - allows users to select a state to browse attorneys/firms.

**Features:**
- State selection buttons (CA, NY, TX, FL, IL, PA, OH, GA, NC, AZ + more)
- Visual feedback for selected state
- Navigation to next step
- Callback prop for state selection

### FindAttorneyStep2.tsx
Firm selection step with dual options: Send to All or Select Individual Firms.

**Features:**
- Send to All Firms button (one-click to contact all)
- Individual firm cards with checkboxes
- Select All checkbox for quick selection
- Multi-select capability
- Selected firm count display
- Keyboard navigation support
- Accessibility features (WCAG AA)

## API Integration

### GetFirms Endpoint
```
GET /api/v2/directory/firms?state=CA
Response: {
  state: "CA",
  firms: [
    {
      id: "firm-1",
      name: "California Legal Partners",
      location: "San Francisco, CA",
      attorneyCount: 2
    }
  ]
}
```

### SendIntakeRequest Endpoint
```
POST /api/v2/intake/request/firms
Request: {
  firmIds: ["firm-1", "firm-2"],
  intakeFormData: { ... },
  clientId: "user-123"
}

OR for Send to All:

POST /api/v2/intake/request/firms/all
Request: {
  state: "CA",
  intakeFormData: { ... },
  clientId: "user-123"
}

Response: {
  requestId: "req-123",
  firmsNotified: 3,
  timestamp: "2026-08-15T..."
}
```

## Component Usage

### FindAttorneyStep2

```tsx
import FindAttorneyStep2 from '@/components/Directory/FindAttorneyStep2';

const firms = [
  {
    id: 'firm-1',
    name: 'California Legal Partners',
    location: 'San Francisco, CA',
    attorneyCount: 2,
  },
  // ... more firms
];

<FindAttorneyStep2
  state="CA"
  firms={firms}
  onSendToAll={() => {
    // Send intake request to all firms in CA
  }}
  onSendToSelected={(firmIds) => {
    // Send intake request to selected firms
    // firmIds: ['firm-1', 'firm-2']
  }}
  onBack={() => {
    // Return to step 1
  }}
  loading={false}
/>
```

## State Management

### Component State
- `selectedFirms`: Set<string> - IDs of selected firms
- `sendingMode`: 'all' | 'selected' | null - Current sending mode

### UI Updates
- Selected count badge updates automatically
- Button text updates with selected count
- Select All checkbox reflects state of all individual selections

## User Interactions

### Send to All Flow
1. User clicks "Send to All Firms" button
2. Component calls `onSendToAll()` callback
3. Backend sends intake request to all firms in state
4. Loading state disables all controls
5. Success callback triggers navigation

### Select Individual Firms Flow
1. User clicks checkboxes to select firms
2. Selected count updates in real-time
3. Send button enables when firms are selected
4. User clicks "Send to [N] Firms"
5. Component calls `onSendToSelected(firmIds)`
6. Backend sends intake request to selected firms only
7. Loading state disables controls
8. Success callback triggers navigation

### Select All Flow
1. User clicks "Select All" checkbox
2. All firm checkboxes become checked
3. All firm cards highlight
4. Send button updates with total count
5. User clicks send button
6. Same as Select Individual flow

## Form Data Integration

The component receives intake form data from the parent (ClientServiceIntake form):
- Service type (Contract Review, Legal Advice, etc.)
- Description of legal need
- Budget range
- Urgency level
- Supporting documents

This data is included in the API request to firms.

## Validation Rules

**Before Sending:**
- At least 1 firm must be selected (for individual selection mode)
- Intake form data must be complete and validated
- User must be authenticated

## Error Handling

```tsx
try {
  // Send request to firms
  const response = await fetch('/api/v2/intake/request/firms', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      firmIds: ['firm-1', 'firm-2'],
      intakeFormData: formData,
      clientId: userId,
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send request to firms');
  }

  // Show success message
  // Navigate to next step
} catch (error) {
  // Show error message
  // Keep loading state disabled
}
```

## Styling Features

- **Responsive Grid:** Auto-fills 280px+ columns on desktop, single column on mobile
- **Selection Feedback:** Highlight on hover and selection
- **Visual Hierarchy:** Large "Send to All" button, individual cards below
- **Color Coding:** Success green for "Send to All", primary blue for selections
- **Animations:** Smooth transitions, hover effects
- **Dark Mode:** Full support with color scheme inversion
- **Mobile Optimization:** Touch-friendly button sizes (44px+ minimum)

## Accessibility (WCAG 2.1 AA)

- Semantic HTML with proper input types
- Aria-labels on all interactive elements
- Keyboard navigation support (Tab, Enter, Space)
- Focus indicators on all focusable elements
- Color contrast compliance
- Screen reader announcements for state changes
- Logical tab order

## Performance

- Efficient checkbox state management (Set instead of array)
- Debounced API calls to prevent duplicates
- Lazy rendering of firm cards (virtualization for large lists)
- CSS transitions use GPU acceleration
- Minimal re-renders with proper memoization

## Testing

### Running Tests
```bash
npm test -- src/__tests__/directory/find-attorney.test.tsx
```

### Test Coverage
- Layout and rendering (6+ tests)
- Send to All functionality (3+ tests)
- Individual firm selection (8+ tests)
- Select All functionality (4+ tests)
- Navigation (2+ tests)
- Keyboard navigation (2+ tests)
- Empty state (2+ tests)
- Accessibility (3+ tests)
- Display logic (3+ tests)

**Total: 33+ tests**

## Browser Support

- Desktop: Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile: Safari iOS, Chrome Android (latest 2 versions)
- Tablets: Full support
- Accessibility: Screen readers, keyboard navigation

## Future Enhancements

- [ ] Firm filtering by practice area, size, ratings
- [ ] Sort firms by rating, location, experience
- [ ] View firm profiles/credentials before selection
- [ ] Add favorite firms list
- [ ] Firm availability indicator
- [ ] Response time estimates
- [ ] Estimated cost calculator
- [ ] Reviews and ratings display
- [ ] Save firm preferences
- [ ] Advanced search filters

## Related Components

- **ClientServiceIntake.tsx** - Collects intake form data
- **ServiceMarketplace.tsx** - Browse services
- **PersonaSwitcher.tsx** - Change user persona
- **Dashboard.tsx** - Main application page

## Troubleshooting

### Issue: Firms not loading
- Check network tab for API errors
- Verify state parameter is valid
- Ensure backend is running
- Check user authentication token

### Issue: Send button disabled
- Ensure at least 1 firm is selected
- Check form data is valid
- Verify user is authenticated
- Check for API response errors

### Issue: Selection not updating
- Check browser console for errors
- Verify component re-rendering
- Check setState calls in parent component
- Clear browser cache

### Issue: Styling not applying
- Ensure FindAttorney.css is imported
- Check CSS module loading
- Verify dark mode toggle if applicable
- Clear browser cache and rebuild

## API Response Examples

### Successful Firms List
```json
{
  "state": "CA",
  "count": 3,
  "firms": [
    {
      "id": "firm-1",
      "name": "California Legal Partners",
      "location": "San Francisco, CA",
      "attorneyCount": 2,
      "rating": 4.8,
      "specialties": ["Contract Law", "Corporate Law"],
      "avgResponseTime": "2 hours"
    },
    {
      "id": "firm-2",
      "name": "West Coast Law Group",
      "location": "Los Angeles, CA",
      "attorneyCount": 1,
      "rating": 4.5,
      "specialties": ["Real Estate", "Family Law"],
      "avgResponseTime": "4 hours"
    }
  ]
}
```

### Successful Intake Request
```json
{
  "requestId": "req-abc123",
  "status": "sent",
  "firmsNotified": 3,
  "state": "CA",
  "createdAt": "2026-08-15T10:30:00Z",
  "nextStep": "wait-for-offers",
  "estimatedWaitTime": "24-48 hours"
}
```

### Error Response
```json
{
  "error": "NO_FIRMS_SELECTED",
  "message": "Please select at least one firm",
  "status": 400
}
```

## File Structure

```
src/components/Directory/
├── FindAttorneyStep1.tsx
├── FindAttorneyStep2.tsx
├── FindAttorney.css
└── FindAttorney.README.md

src/__tests__/directory/
└── find-attorney.test.tsx
```

## Summary

Complete attorney discovery and firm selection system with:
- **2 step interface:** State selection → Firm selection
- **Dual submission modes:** Send to all vs. select individual
- **Responsive design:** Mobile to desktop
- **Full accessibility:** WCAG AA compliant
- **Comprehensive tests:** 33+ test cases
- **Dark mode support:** Full theme support
- **Keyboard navigation:** Full keyboard support
- **Error handling:** Graceful error messages
- **Performance optimized:** Efficient state management

Ready for integration with Intake Form and API backend.
