import { PrismaClient } from '@prisma/client';
import { Google, generateCodeVerifier } from 'arctic';
import crypto from 'crypto';
import { generateTokenPair } from './auth';

const prisma = new PrismaClient();

// Google OAuth configuration
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Redirect URI: where Google sends the user after consent. Must EXACTLY match
// one of the "Authorized redirect URIs" in Google Cloud Console (scheme, case,
// and trailing slash must all match). See:
// https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch
const rawCallbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';
const callbackUrl = rawCallbackUrl.trim().replace(/\/+$/, ''); // trim + no trailing slash

if (!googleClientId || !googleClientSecret) {
  console.warn('Google OAuth credentials not configured. Google login will be disabled.');
}

let google: Google | null = null;

if (googleClientId && googleClientSecret) {
  google = new Google(googleClientId, googleClientSecret, callbackUrl);
  console.log(`Google OAuth: Add this EXACT redirect URI in Cloud Console → Credentials → Your OAuth client → Authorized redirect URIs:\n  ${callbackUrl}`);
}

/** Redirect URI sent to Google (for debugging redirect_uri_mismatch). */
export function getGoogleRedirectUri(): string | null {
  return google ? callbackUrl : null;
}

// In-memory store for PKCE code verifiers (state -> codeVerifier)
// For production, use Redis or database for multi-server support
const codeVerifierStore = new Map<string, string>();

export interface OAuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Generate a random state string for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verify state string matches
 */
export function verifyState(receivedState: string, expectedState: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(receivedState, 'hex'),
    Buffer.from(expectedState, 'hex')
  );
}

/**
 * Get Google OAuth authorization URL
 * Returns URL and state (needs to be stored for callback validation)
 */
export function getGoogleAuthorizationUrl(): { url: string; state: string } | null {
  if (!google) {
    return null;
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store code verifier associated with state
  codeVerifierStore.set(state, codeVerifier);

  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

  // Add additional query parameters for offline access
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return { url: url.toString(), state };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(code: string, state: string): Promise<OAuthUser> {
  if (!google) {
    throw new Error('Google OAuth not configured');
  }

  // Get the code verifier from storage
  const codeVerifier = codeVerifierStore.get(state);

  if (!codeVerifier) {
    throw new Error('Invalid or expired OAuth state');
  }

  // Clean up the stored code verifier
  codeVerifierStore.delete(state);

  const tokens = await google.validateAuthorizationCode(code, codeVerifier);

  // Fetch user info from Google
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const googleUser = await response.json() as {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };

  return {
    id: googleUser.id,
    email: googleUser.email,
    displayName: googleUser.name,
    avatar: googleUser.picture,
  };
}

/**
 * Find or create user from Google OAuth user
 */
export async function findOrCreateGoogleUser(
  googleUser: OAuthUser,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: Date
) {
  // Try to find user by email first
  let user = await prisma.user.findUnique({
    where: { email: googleUser.email },
  });

  // Try to find user by google ID
  if (!user && googleUser.id) {
    user = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });
  }

  // If user exists but doesn't have googleId, link it
  if (user && !user.googleId && googleUser.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: googleUser.id },
    });
  }

  // Create new user if not found
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        googleId: googleUser.id,
        displayName: googleUser.displayName,
      },
    });
  }

  // Create or update OAuth account
  if (googleUser.id) {
    const existingAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: 'google',
          providerId: googleUser.id,
        },
      },
    });

    if (existingAccount) {
      await prisma.oAuthAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresAt: expiresAt,
        },
      });
    } else {
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerId: googleUser.id,
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresAt: expiresAt,
        },
      });
    }
  }

  return user;
}

/**
 * Complete Google OAuth login and return tokens
 */
export async function completeGoogleLogin(
  googleUser: OAuthUser,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: Date
) {
  const user = await findOrCreateGoogleUser(
    googleUser,
    accessToken,
    refreshToken,
    expiresAt
  );

  const tokens = generateTokenPair(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}
