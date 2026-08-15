# Authentication Components

Complete authentication system for Transcend Legal Platform with Login and SignUp workflows.

## Components

### Login.tsx

User authentication component for existing accounts.

**Features:**
- Email and password validation
- Show/hide password toggle
- Remember me checkbox with localStorage persistence
- Forgot password link
- Social login buttons (Google, Microsoft)
- Demo credentials display
- Loading state with spinner
- Error message display with shake animation
- API integration: `POST /api/v2/auth/login`
- Token storage: `authToken`, `userId`, `userEmail`
- Callbacks: `onLoginSuccess(userId, token)`, `onNavigateToSignup()`

**Usage:**
```tsx
import { Login } from './Auth';

<Login 
  onLoginSuccess={(userId, token) => {
    // Handle successful login
  }}
  onNavigateToSignup={() => {
    // Navigate to signup page
  }}
/>
```

**Validation:**
- Email: Required, valid format (RFC5322 simplified)
- Password: Required, minimum 6 characters

### SignUp.tsx

Multi-step account creation component.

**Features:**
- 3-step form: Profile → Account → Confirm
- Progress indicator with step numbers
- Back button for navigation
- Step 1: First name, Last name (min 2 chars each)
- Step 2: Email, Password, Confirm Password
- Step 3: User type dropdown, Terms & Privacy checkbox
- Password requirements display
- Show/hide password toggles
- Info box with security notice
- API integration: `POST /api/v2/auth/signup`
- Token storage: `authToken`, `userId`, `userEmail`, `userType`
- Callbacks: `onSignUpSuccess(userId, token)`, `onNavigateToLogin()`

**Usage:**
```tsx
import { SignUp } from './Auth';

<SignUp 
  onSignUpSuccess={(userId, token) => {
    // Handle successful signup
  }}
  onNavigateToLogin={() => {
    // Navigate to login page
  }}
/>
```

**Step 1 - Profile:**
- First name: Min 2 characters
- Last name: Min 2 characters

**Step 2 - Account:**
- Email: Required, valid format
- Password: Min 8 chars, 1 uppercase, 1 number
- Confirm password: Must match password

**Step 3 - Confirm:**
- User type: Client, Lawyer, Paralegal, Notary, Investigator, Mediator
- Terms & Privacy: Must be accepted

### AuthContainer.tsx

Container component managing authentication flow.

**Features:**
- Manages Login/SignUp mode toggling
- Passes success callbacks to parent
- Single entry point for auth UI

**Usage:**
```tsx
import { AuthContainer } from './Auth/AuthContainer';

<AuthContainer 
  onAuthSuccess={(userId, token) => {
    // Handle successful authentication
    // Route to dashboard
  }}
/>
```

## Auth.css

Shared authentication styling with dark mode support.

**Features:**
- CSS variables for theming
- Dark mode support via @media (prefers-color-scheme: dark)
- Responsive design (375px - 1920px)
- Smooth animations (slideUp, shake)
- Form validation patterns
- Button states (hover, disabled, active)
- Password input wrapper with toggle button
- Error message styling with animation
- Info box styling
- Progress indicator styling
- Mobile optimization

**Variables:**
```css
--primary-color: #667eea
--primary-dark: #5568d3
--primary-light: #f0f4ff
--success-color: #48bb78
--error-color: #f56565
--text-primary: #1a202c
--text-secondary: #718096
--bg-surface: #ffffff
--bg-hover: #f7fafc
--border-color: #e2e8f0
```

## API Integration

### POST /api/v2/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**Response (200):**
```json
{
  "token": "jwt-token-here",
  "userId": "user-123",
  "email": "user@example.com"
}
```

**Error Response (401):**
```json
{
  "message": "Invalid credentials"
}
```

### POST /api/v2/auth/signup

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "Password123",
  "userType": "client",
  "termsAccepted": true
}
```

**Response (201):**
```json
{
  "token": "jwt-token-here",
  "userId": "user-123",
  "email": "john@example.com",
  "userType": "client"
}
```

**Error Response (400):**
```json
{
  "message": "Email already in use"
}
```

## localStorage Keys

- `authToken`: JWT authentication token
- `userId`: User ID
- `userEmail`: User's email address
- `userType`: User type/persona
- `rememberMe`: Remember me preference (Login only)

## Testing

### Running Tests

```bash
# Run all auth tests
npm test -- src/__tests__/auth/auth.test.tsx

# Run with coverage
npm test -- src/__tests__/auth/auth.test.tsx --coverage

# Watch mode
npm test -- src/__tests__/auth/auth.test.tsx --watch
```

### Test Coverage

- Login component: 12 tests
  - Form rendering
  - Validation (email, password)
  - Submission success/failure
  - Error handling
  - State management
  - Navigation

- SignUp component: 25+ tests
  - Multi-step form navigation
  - Step 1 validation (name)
  - Step 2 validation (email, password)
  - Step 3 validation (user type, terms)
  - Form submission
  - Back button navigation
  - Password visibility toggles
  - Error handling

## Accessibility

- Semantic HTML (form, input, button, label)
- Proper aria-labels on buttons
- Form label associations
- Keyboard navigation support
- Color contrast compliance (WCAG AA)
- Error announcements
- Loading state indicators

## Responsive Design

- Desktop (1280px+): Full width card (420px max)
- Tablet (768px): Adjusted padding, responsive layout
- Mobile (375px): Full screen, optimized touch targets

## Security Considerations

1. **Password Storage:**
   - Never logged or exposed
   - Only sent over HTTPS
   - Validated client-side for UX, server-side for security

2. **Token Handling:**
   - Stored in localStorage (consider httpOnly cookie for production)
   - Sent in Authorization header for API requests
   - Clear on logout

3. **Input Validation:**
   - Email format validation
   - Password strength requirements
   - Terms acceptance required

4. **Error Handling:**
   - Generic error messages (don't reveal if email exists)
   - Network error handling
   - API error handling

## Performance

- Form validation runs on change (debounced in practice)
- API calls debounced to prevent multiple submissions
- CSS animations use GPU acceleration (transform)
- Component-level memoization for callbacks

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- iOS Safari: Latest 2 versions
- Mobile Chrome: Latest 2 versions

## Future Enhancements

- [ ] Social login integration (Google OAuth, Microsoft)
- [ ] Email verification flow
- [ ] Password reset email
- [ ] Two-factor authentication
- [ ] Account recovery options
- [ ] Rate limiting on failed attempts
- [ ] CAPTCHA for bot prevention
- [ ] Session timeout handling
- [ ] Remember device functionality
- [ ] Biometric authentication (mobile)

## Related Components

- Dashboard.tsx: Main app after authentication
- PersonaSwitcher.tsx: Change user persona
- Navigation: Role-based menu
- Profile: User account settings

## Troubleshooting

**Issue: Login fails with 401**
- Check credentials
- Verify server is running
- Check network tab for API errors

**Issue: SignUp form doesn't submit**
- Check all validation requirements
- Verify terms checkbox is checked
- Check console for API errors

**Issue: localStorage not persisting**
- Check browser privacy settings
- Clear browser cache
- Check if in private/incognito mode

**Issue: Styles not applying**
- Ensure Auth.css is imported
- Check CSS module loading
- Verify dark mode toggle if applicable
