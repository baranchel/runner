// Maps Supabase auth errors to the messages shown on screen.
// Codes: https://supabase.com/docs/guides/auth/debugging/error-codes
export type AuthErrorLike = { code?: string; name?: string; message?: string }

export const EMAIL_NOT_CONFIRMED = 'Please confirm your email first'

export function authErrorMessage(e: AuthErrorLike): string {
  if (e.name === 'AuthRetryableFetchError' || /network request failed/i.test(e.message ?? '')) {
    return 'No connection, try again'
  }
  switch (e.code) {
    case 'invalid_credentials':        return 'Email or password is incorrect'
    case 'email_not_confirmed':        return EMAIL_NOT_CONFIRMED
    case 'user_already_exists':
    case 'email_exists':               return 'This email already has an account. Log in?'
    case 'weak_password':              return "Password doesn't meet the requirements"
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':    return 'Too many attempts. Wait a minute and try again'
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':          return 'Link expired. Request a new one'
    case 'same_password':              return 'New password must be different from the old one'
    case 'pkce_code_verifier_not_found': return 'Open the link on the phone you signed up on, or log in'
    case 'needs_dev_build':            return 'Google sign-in needs the dev build (not Expo Go)'
  }
  console.warn('Unhandled auth error', e)
  return 'Something went wrong, try again'
}
