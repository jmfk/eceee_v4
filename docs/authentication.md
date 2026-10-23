# CMS sign-in and two-factor authentication

ECEEE uses django-allauth 65.20.1 for browser sessions, explicit Apple/Google connections and optional MFA. See [PRD-0038](../specs/prds/0038-social-login-and-mfa.md) and [ADR-0053](../specs/adrs/active/0053-browser-sessions-social-login-and-mfa.md).

## User journey

1. Existing users sign in with their username or email and password. Unverified accounts verify their existing email using the emailed code before CMS access. No addresses are marked verified by migration.
2. Profile → Account security lets users explicitly connect Apple or Google after verifying their current password (or an existing second factor). A matching provider email alone never links an account. Apple relay addresses do not change the CMS email.
3. Users may enroll an authenticator app by QR/manual key and code, or register a passkey/security key. A passkey is a second factor, not a passwordless login method. Enrollment requires a verified account email.
4. Save the ten recovery codes when first displayed. Each works once. Replacing the set invalidates the old codes. Codes are not available for later redisplay.
5. Once enabled, MFA is required after password, Apple and Google sign-in. Remove all main factors to turn it off; fresh verification is required. Password reset does not remove MFA. There is no operator recovery endpoint in this version.

Profile, login, OAuth return and the expired-session overlay use the same browser flow. Logout terminates the server session. Security changes revoke older sessions, personal tokens and signed Kanban browser tickets. Already connected WebSockets recheck server sessions and security state before delivering further messages.

## Environment configuration

Use ECEEE-owned applications and credentials, separately configured for development/test and production. Do not reuse Bad Herring or Staravenir provider identities. Provider registration, secret provisioning and production deployment require their own environment access; none is performed by the code change.

| Variable | Purpose |
| --- | --- |
| `CMS_GOOGLE_CLIENT_ID` | Google OAuth web application client ID |
| `CMS_GOOGLE_CLIENT_SECRET` | Matching Google OAuth client secret |
| `CMS_APPLE_CLIENT_ID` | Apple **Services ID** for web sign-in |
| `CMS_APPLE_TEAM_ID` | Apple team/App ID prefix |
| `CMS_APPLE_KEY_ID` | Sign in with Apple key ID |
| `CMS_APPLE_PRIVATE_KEY` | Matching PEM private key; literal `\n` is accepted for line breaks |
| `CMS_MFA_ENCRYPTION_KEYS` | Comma-separated Fernet keys; first encrypts, all decrypt |
| `CMS_WEBAUTHN_RP_ID` | Exact CMS hostname, without scheme/port; `localhost` for local tests |
| `DEV_AUTO_LOGIN` | Set `False` to exercise real authentication locally; production also requires `DEBUG=False` |

Supply credentials through the established protected environment mechanism. Production backend already consumes its environment file. Never print, paste into source, or put secret values on the command line. Check presence/format only through the `inspect-secrets-safely` helpers. For non-production unattended secret injection, follow the project's accepted SOPS/age decision before provisioning automation.

MFA encryption keys must be generated in a protected secret workflow and backed up with the environment's recovery material. They are independent of Django's signing secret. Pending TOTP enrollment keys are also encrypted in stored browser sessions; completed provider callbacks retain only allowlisted identity fields, not bearer credentials. To rotate, prepend a new key and retain old keys until existing factors have been re-enrolled under the new key. Do not remove an old decryption key while records encrypted with it remain. Losing all keys makes existing TOTP and recovery factors unusable. Missing keys never fall back to plaintext storage.

Google is offered only when both Google variables are present. Apple requires all four Apple variables. Missing providers are hidden on login and explained in Profile. Missing MFA configuration disables enrollment. Keep Google/Apple scopes limited to identity and email; provider access/refresh tokens are not retained as application integrations.

## Provider registration and HTTPS

Register these exact redirect URIs on each environment's CMS origin:

- Google: `https://<cms-host>/accounts/google/login/callback/`
- Apple: `https://<cms-host>/accounts/apple/login/callback/`

Register the HTTPS CMS domain and return URL on Apple's Services ID, associated with the owning App ID. Apple's callback is a cross-site POST followed by allauth's finish GET. Keep the normal session cookie `SameSite=Lax`; do not globally disable CSRF or change all cookies to `SameSite=None` to accommodate Apple. The intermediate POST must not manufacture a new Django session.

Caddy and frontend Nginx route `/_allauth/`, `/accounts/` and `/csrf-token/` to Django. Vite proxies the two authentication namespaces as well. Configure allowed hosts/CSRF trusted origins for the actual CMS origin, secure HttpOnly sessions over HTTPS, and preserve the external HTTPS scheme at the trusted reverse proxy. Rate limiting uses allauth's default untrusted-forwarded-header behavior; only configure trusted proxy settings after verifying the environment's actual proxy chain.

WebAuthn requires a secure browser context and an RP ID matching the CMS hostname. Credentials remain bound to that RP ID. An intentional hostname/RP-ID change requires a migration/re-enrollment plan. Apple needs a registered HTTPS test hostname for live acceptance; a localhost-only test does not prove Apple integration.

## Interfaces and legacy automation

- `/_allauth/browser/v1/`: allauth's browser API. Its published snake_case contract is preserved by `frontend/src/api/auth.js`.
- `/accounts/`: provider callbacks. Local headed login/signup pages are disabled.
- `GET /_allauth/browser/v1/account/reauthenticated`: ECEEE freshness check before leaving Profile to connect a provider.
- `GET /api/v1/auth/security/`: personal browser-only status (`mfaEnabled`, `mfaConfigured`, `emailVerified`).
- Existing `/api/v1/auth/token/`, `/refresh/`, `/verify/` endpoints remain for non-MFA personal integrations. Tokens carry the account security version. Old version-zero credentials are accepted only while the account remains at version zero.

While MFA exists, personal JWT and DRF bearer credentials are rejected, including token issuance, refresh, preview and theme-sync paths. After any security change, old credentials remain revoked even if MFA is later disabled. Previously issued DRF tokens are rejected based on their creation time. Replace such automation with a separately provisioned, appropriately scoped machine key. Machine identities cannot use browser account-security APIs.

## Migration, verification and recovery

The new `cms_auth` migration adds only the user-bound revocation state table. Rows are created lazily; it does not rewrite users, roles, tenant memberships or email verification. allauth's normal account/social/MFA migrations run in the reviewed deployment flow. Review the actual target's migration history before the production gate; library upgrades from older allauth versions must not be faked.

Focused local checks:

```sh
cd backend
python manage.py test cms_auth --settings=cms_auth.test_settings --noinput
python manage.py makemigrations cms_auth --check --dry-run --settings=cms_auth.test_settings
```

The isolated settings use in-memory SQLite, synthetic cryptographic material and a local-memory mail backend; they never load application environment files or contact providers. They cover password/email verification, actual software WebAuthn registration/assertion, mocked OAuth boundaries, recovery, CSRF, revocation and real ASGI WebSockets. They do not establish live provider acceptance or PostgreSQL concurrency behavior.

Run the focused frontend auth, Profile, AuthContext and API-client Vitest tests plus `npm run build`. Inspect wide/narrow login, MFA and Profile screens with keyboard navigation. Before enabling a provider, complete a real HTTPS acceptance with an ECEEE test account: connect, disconnect, login, cancel, MFA challenge, hidden Apple email and return destination. Log only outcomes; never capture provider callback payloads or enrollment/recovery material in shared traces.

Production remains subject to the repository's exact-tag deployment gate, preflight and backups. Prefer roll-forward after an authentication failure. Once MFA is enrolled, reverting to old code that ignores MFA is an authentication bypass, not a safe rollback. Preserve data and keys, stop mutation and obtain a fresh recovery gate.

## Current batch evidence

Implementation and local verification are recorded in PRD-0038. Live provider acceptance remains pending environment-specific credential provisioning and a registered HTTPS test origin. No production action is included.
