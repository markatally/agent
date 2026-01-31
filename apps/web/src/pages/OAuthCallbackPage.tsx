import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../lib/api';
import { useToast } from '../hooks/use-toast';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        setError('Missing OAuth parameters');
        toast({
          title: 'OAuth Error',
          description: 'Invalid OAuth callback',
          variant: 'destructive',
        });
        return;
      }

      try {
        const response = await authApi.handleGoogleCallback(code, state);
        setUser(response.user);

        toast({
          title: 'Success',
          description: 'Logged in with Google successfully!',
        });

        navigate('/chat');
      } catch (err: any) {
        setError(err.message || 'OAuth failed');
        toast({
          title: 'Authentication failed',
          description: err.message || 'Could not complete login',
          variant: 'destructive',
        });
        // Redirect to login after 2 seconds
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    handleCallback();
  }, [navigate, setUser, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold">Authentication Error</h1>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <h1 className="text-2xl font-bold">Signing you in...</h1>
            <p className="text-muted-foreground">Please wait while we complete your login</p>
          </>
        )}
      </div>
    </div>
  );
}
