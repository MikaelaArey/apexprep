# Connecting ApexPrep to Supabase

ApexPrep keeps everything on the phone first. Supabase is the backup and the way
progress moves between devices. Students start as anonymous guests (their progress
backs up from day one) and can upgrade with Sign in with Apple. Email-code sign-in
is built but switched off until there's an email sender (see below).

The free plan is enough to launch.

## 1. Create the project

1. At supabase.com, create a project named `apexprep` (free plan, nearest region).
   Save the database password in a password manager.
2. Copy two values:
   - **Project URL:** open **Project Settings** (the gear at the bottom left), then
     **Data API**. Or build it from the browser's address bar: the ID after
     `/project/` gives `https://<that ID>.supabase.co`.
   - **Publishable key:** open **Project Settings → API Keys** and copy the key
     that starts with `sb_publishable_`. Older projects call it the anon key.

   Never put the secret or service_role key in the app.

## 2. Create the tables

**SQL Editor → New query**, paste all of [`supabase/schema.sql`](../supabase/schema.sql),
and click **Run**. It's safe to run again later.

It creates five tables (attempts, reviews, xp_events, cards, profiles), each
private to its owner through row-level security; a function that reports how
everyone answered a question (counts only, shown once 30+ students have
answered); and `delete_my_account`, which Apple requires for in-app account
deletion.

## 3. Auth settings

**Authentication → Sign In / Providers**:

- **Allow anonymous sign-ins**: on. Guests can study without an account.
- **Allow manual linking**: on. Lets a guest add Sign in with Apple and keep their
  progress.
- **Apple**: enable it. Under *Client IDs* add `com.mikaelaarey.apexprep` (and
  `host.exp.Exponent` to test in Expo Go). The native flow uses Apple's ID token,
  so no secret key is needed.
- **Email**: keep it on.

### Email codes need your own email sender

Students who sign in by email get a 6-digit code. Supabase's built-in sender can't
handle that for real students:

- It only emails members of your Supabase team, two messages an hour.
- On free projects created after 3 June 2026, its email templates can't be edited.

Email sign-in therefore needs a custom SMTP sender. Resend's free tier works, with a
domain you own.

1. Set up the sender and verify your domain. Enter its details under
   **Authentication → Emails → SMTP Settings**.
2. In **Authentication → Emails → Templates**, open **Magic Link**, replace the
   message body with the code template below, and save. Do the same for **Confirm
   signup**, which is the email a student gets the first time they sign in this way.
3. Add `EXPO_PUBLIC_EMAIL_SIGN_IN=1` to `.env.local` and restart. The Account
   screen then offers "Or use an email code" under the Apple button.

```html
<h2>Your ApexPrep code</h2>
<p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
```

Until then, the app offers Sign in with Apple only, along with guest accounts and
backup. None of those need email.

## 4. Point the app at it

Create `.env.local` in the project folder (it's ignored by git):

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Restart the dev server. Settings → Account should now show the guest account, and
Settings → Last backup gets a time after the first session.

## 5. Sign in with Apple in the Apple Developer account

The bundle ID `com.mikaelaarey.apexprep` needs the **Sign in with Apple**
capability (Certificates, Identifiers & Profiles → Identifiers). Xcode can add it
automatically with team D28MYG4A35 the first time the app is built for a device.

## Testing sync without the real project

`npm run test:sync` starts a throwaway Postgres + PostgREST + minimal auth server
on this Mac (`supabase/test/`), applies `schema.sql`, and runs the sync engine
against it: backup, restore on a second phone, privacy between accounts,
newer-card-wins, switching accounts, answer counts and account deletion.

## Housekeeping

Guest accounts that never come back stay in the database. Now and then, run the
commented line at the bottom of `schema.sql` to remove guests unused for 90 days.
