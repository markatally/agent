import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { setTokens } from '../lib/api';
import { useToast } from '../hooks/use-toast';

/**
 * OAuth Success Page
 * Handles the redirect from backend after successful OAuth authentication
 * Tokens are passed in URL hash fragment
 */
export function OAuthSuccessPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSuccess = () => {
      try {
        // Get the hash fragment (everything after #)
        const hashFragment = window.location.hash.slice(1); // Remove the leading '#'

        if (!hashFragment) {
          setError('No authentication data found');
          return;
        }

        // Decode the JSON data from the hash
        const tokenData = JSON.parse(decodeURIComponent(hashFragment));

        // Validate the data structure
        if (!tokenData.user || !tokenData.accessToken) {
          setError('Invalid authentication data');
          return;
        }

        // Store tokens in localStorage
        setTokens(tokenData.accessToken, tokenData.refreshToken);

        // Update auth state
        setUser(tokenData.user);

        toast({
          title: 'Success',
          description: 'Logged in successfully!',
        });

        // Redirect to chat page
        navigate('/chat');
      } catch (err: any) {
        console.error('OAuth success error:', err);
        setError('Failed to process authentication');
        toast({
          title: 'Authentication Error',
          description: 'Could not complete login',
          variant: 'destructive',
        });
      }
    };

    handleSuccess();
  }, [navigate, setUser, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold">Authentication Error</h1>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline"
            >
              Return to login
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <h1 className="text-2xl font-bold">Completing login...</h1>
            <p className="text-muted-foreground">Please wait while we sign you in</p>
          </>
        )}
      </div>
    </div>
  );
}
