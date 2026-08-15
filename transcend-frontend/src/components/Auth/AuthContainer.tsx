// Auth Container
// Manages authentication flow between Login and SignUp

import React, { useState } from 'react';
import Login from './Login';
import SignUp from './SignUp';

interface AuthContainerProps {
  onAuthSuccess?: (userId: string, token: string) => void;
  className?: string;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  onAuthSuccess,
  className = '',
}) => {
  const [isLoginMode, setIsLoginMode] = useState(true);

  const handleLoginSuccess = (userId: string, token: string) => {
    onAuthSuccess?.(userId, token);
  };

  const handleSignUpSuccess = (userId: string, token: string) => {
    onAuthSuccess?.(userId, token);
  };

  return (
    <div className={className}>
      {isLoginMode ? (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onNavigateToSignup={() => setIsLoginMode(false)}
        />
      ) : (
        <SignUp
          onSignUpSuccess={handleSignUpSuccess}
          onNavigateToLogin={() => setIsLoginMode(true)}
        />
      )}
    </div>
  );
};

export default AuthContainer;
