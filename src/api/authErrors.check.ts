// Run: node src/api/authErrors.check.ts
import { authErrorMessage } from './authErrors.ts'

const cases: [Parameters<typeof authErrorMessage>[0], string][] = [
  [{ code: 'invalid_credentials' },                         'Email or password is incorrect'],
  [{ code: 'email_not_confirmed' },                         'Please confirm your email first'],
  [{ code: 'user_already_exists' },                         'This email already has an account. Log in?'],
  [{ code: 'over_email_send_rate_limit' },                  'Too many attempts. Wait a minute and try again'],
  [{ code: 'otp_expired' },                                 'Link expired. Request a new one'],
  [{ code: 'flow_state_not_found' },                        'Link expired. Request a new one'],
  [{ code: 'same_password' },                               'New password must be different from the old one'],
  [{ code: 'pkce_code_verifier_not_found' },                'Open the link on the phone you signed up on, or log in'],
  [{ code: 'needs_dev_build' },                             'Google sign-in needs the dev build (not Expo Go)'],
  [{ name: 'AuthRetryableFetchError', message: 'x' },       'No connection, try again'],
  [{ name: 'TypeError', message: 'Network request failed' }, 'No connection, try again'],
  [{ code: 'something_new' },                               'Something went wrong, try again'],
]

for (const [input, expected] of cases) {
  const got = authErrorMessage(input)
  if (got !== expected) throw new Error(`${JSON.stringify(input)} → "${got}", expected "${expected}"`)
}
console.log(`authErrorMessage: ${cases.length} cases OK`)
