import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OAuth Error Page
 * Handles the redirect from backend after failed OAuth authentication
 * Error message is passed as query parameter
 */
export function OAuthErrorPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login page after 2 seconds
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const errorMessage = new URLSearchParams(window.location.search).get('message') || 'Authentication failed';

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold">Authentication Error</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        <button
          onClick={() => navigate('/login')}
          className="text-primary hover:underline"
        >
          Go to login now
        </button>
      </div>
    </div>
  );
}
