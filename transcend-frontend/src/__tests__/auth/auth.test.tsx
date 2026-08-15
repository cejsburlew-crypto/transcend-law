// Authentication Components Tests
// Login and SignUp component testing

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../components/Auth/Login';
import SignUp from '../../components/Auth/SignUp';

describe('Login Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders login form with email and password fields', () => {
    render(<Login />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('renders sign in button', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders remember me checkbox', () => {
    render(<Login />);
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    render(<Login />);
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('renders create account link', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: /create one/i })).toBeInTheDocument();
  });

  it('shows password when eye icon is clicked', async () => {
    render(<Login />);
    const passwordInput = screen.getByTestId('input-password') as HTMLInputElement;
    const toggleButton = screen.getByLabelText(/show password/i);

    expect(passwordInput.type).toBe('password');
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');
  });

  it('validates email is required', async () => {
    render(<Login />);
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.click(submitButton);
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(<Login />);
    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it('validates password is required', async () => {
    render(<Login />);
    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('validates password minimum length', async () => {
    render(<Login />);
    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '12345' } });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
  });

  it('submits login form successfully', async () => {
    const mockOnLoginSuccess = jest.fn();
    const mockResponse = {
      ok: true,
      json: async () => ({ token: 'mock-token', userId: 'user-123' }),
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
          rememberMe: false,
        }),
      });
    });

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalledWith('user-123', 'mock-token');
    });

    expect(localStorage.getItem('authToken')).toBe('mock-token');
    expect(localStorage.getItem('userId')).toBe('user-123');
  });

  it('saves remember me preference', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ token: 'mock-token', userId: 'user-123' }),
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    render(<Login />);

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const rememberCheckbox = screen.getByLabelText(/remember me/i);
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(rememberCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorage.getItem('rememberMe')).toBe('true');
    });
  });

  it('handles login error', async () => {
    const mockResponse = {
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    render(<Login />);

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('handles network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<Login />);

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it('calls onNavigateToSignup when signup link is clicked', () => {
    const mockOnNavigateToSignup = jest.fn();
    render(<Login onNavigateToSignup={mockOnNavigateToSignup} />);

    const signupLink = screen.getByTestId('btn-signup-link');
    fireEvent.click(signupLink);

    expect(mockOnNavigateToSignup).toHaveBeenCalled();
  });

  it('clears error message when input changes', () => {
    render(<Login />);
    const emailInput = screen.getByTestId('input-email');
    const submitButton = screen.getByTestId('btn-login');

    fireEvent.click(submitButton);
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
  });

  it('disables form during submission', async () => {
    const mockResponse = {
      ok: true,
      json: async () => new Promise(resolve => setTimeout(() => resolve({ token: 'mock-token', userId: 'user-123' }), 100)),
    };
    (global.fetch as jest.Mock).mockReturnValueOnce(mockResponse);

    render(<Login />);

    const emailInput = screen.getByTestId('input-email') as HTMLInputElement;
    const passwordInput = screen.getByTestId('input-password') as HTMLInputElement;
    const submitButton = screen.getByTestId('btn-login') as HTMLButtonElement;

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(emailInput.disabled).toBe(true);
    expect(passwordInput.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);
  });

  it('shows social login buttons', () => {
    render(<Login />);
    expect(screen.getByTitle(/sign in with google/i)).toBeInTheDocument();
    expect(screen.getByTitle(/sign in with microsoft/i)).toBeInTheDocument();
  });
});

describe('SignUp Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders multi-step signup form', () => {
    render(<SignUp />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
  });

  it('renders progress indicator', () => {
    render(<SignUp />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('step 1: validates first name', async () => {
    render(<SignUp />);
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.click(continueButton);
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
  });

  it('step 1: validates first name length', async () => {
    render(<SignUp />);
    const firstNameInput = screen.getByTestId('input-firstName');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(firstNameInput, { target: { value: 'J' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
  });

  it('step 1: validates last name', async () => {
    render(<SignUp />);
    const firstNameInput = screen.getByTestId('input-firstName');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/last name is required/i)).toBeInTheDocument();
  });

  it('step 1: advances to step 2 with valid data', async () => {
    render(<SignUp />);
    const firstNameInput = screen.getByTestId('input-firstName');
    const lastNameInput = screen.getByTestId('input-lastName');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });
  });

  it('step 2: validates email', async () => {
    render(<SignUp />);
    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const continueButton = screen.getByTestId('btn-continue');
    fireEvent.click(continueButton);

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('step 2: validates email format', async () => {
    render(<SignUp />);
    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it('step 2: validates password requirements', async () => {
    render(<SignUp />);
    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('step 2: validates uppercase letter requirement', async () => {
    render(<SignUp />);
    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/uppercase letter/i)).toBeInTheDocument();
  });

  it('step 2: validates number requirement', async () => {
    render(<SignUp />);
    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/at least one number/i)).toBeInTheDocument();
  });

  it('step 2: validates password confirmation match', async () => {
    render(<SignUp />);
    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    const emailInput = screen.getByTestId('input-email');
    const passwordInput = screen.getByTestId('input-password');
    const confirmPasswordInput = screen.getByTestId('input-confirmPassword');
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password124' } });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('step 3: validates user type selection', async () => {
    render(<SignUp />);
    // Move through steps
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByTestId('input-confirmPassword'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('select-userType')).toBeInTheDocument();
    });

    const continueButton = screen.getByTestId('btn-continue');
    fireEvent.click(continueButton);

    expect(await screen.findByText(/select your user type/i)).toBeInTheDocument();
  });

  it('step 3: validates terms acceptance', async () => {
    render(<SignUp />);
    // Move through steps
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByTestId('input-confirmPassword'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('select-userType')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('select-userType'), { target: { value: 'client' } });
    const continueButton = screen.getByTestId('btn-continue');
    fireEvent.click(continueButton);

    expect(await screen.findByText(/must accept the terms/i)).toBeInTheDocument();
  });

  it('completes full signup successfully', async () => {
    const mockOnSignUpSuccess = jest.fn();
    const mockResponse = {
      ok: true,
      json: async () => ({ token: 'mock-token', userId: 'user-123' }),
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    render(<SignUp onSignUpSuccess={mockOnSignUpSuccess} />);

    // Step 1
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    // Step 2
    fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByTestId('input-confirmPassword'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('select-userType')).toBeInTheDocument();
    });

    // Step 3
    fireEvent.change(screen.getByTestId('select-userType'), { target: { value: 'client' } });
    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.click(termsCheckbox);
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v2/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Password123',
          userType: 'client',
          termsAccepted: true,
        }),
      });
    });

    await waitFor(() => {
      expect(mockOnSignUpSuccess).toHaveBeenCalledWith('user-123', 'mock-token');
    });
  });

  it('back button returns to previous step', async () => {
    render(<SignUp />);

    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-email')).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByRole('button', { name: /← Back/i });
    fireEvent.click(backButton);

    // Should return to step 1
    await waitFor(() => {
      expect(screen.getByTestId('input-firstName')).toBeInTheDocument();
    });
  });

  it('calls onNavigateToLogin when login link is clicked', () => {
    const mockOnNavigateToLogin = jest.fn();
    render(<SignUp onNavigateToLogin={mockOnNavigateToLogin} />);

    const loginLink = screen.getByTestId('btn-login-link');
    fireEvent.click(loginLink);

    expect(mockOnNavigateToLogin).toHaveBeenCalled();
  });

  it('shows password visibility toggles', async () => {
    render(<SignUp />);

    // Move to step 2
    fireEvent.change(screen.getByTestId('input-firstName'), { target: { value: 'John' } });
    fireEvent.change(screen.getByTestId('input-lastName'), { target: { value: 'Doe' } });
    fireEvent.click(screen.getByTestId('btn-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-password')).toBeInTheDocument();
    });

    const passwordToggles = screen.getAllByLabelText(/show password|hide password/i);
    expect(passwordToggles.length).toBe(2);
  });

  it('clears error messages when input changes', async () => {
    render(<SignUp />);
    const continueButton = screen.getByTestId('btn-continue');

    fireEvent.click(continueButton);
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();

    const firstNameInput = screen.getByTestId('input-firstName');
    fireEvent.change(firstNameInput, { target: { value: 'John' } });

    expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
  });
});
