# INVOX

INVOX is a browser-based invoice and purchase-order studio. Vercel serves the static frontend; Firebase Authentication and Cloud Firestore provide accounts and data storage. No server or Cloud Functions are required.

## Local development

1. Copy `.env.example` to `.env` and fill in the Firebase web app configuration.
2. Run:

   ```sh
   npm ci
   npm run build
   npm run dev
   ```

3. Open `http://localhost:3000`.

The Firebase web configuration is public client configuration, not a server secret. The build writes it to an ignored generated file in `public/js`; do not commit that file.

## Firebase setup

1. The repository is configured to use Firebase project `invox-ab91c`. In that project's console, register a Web App and copy its six config values into the Vercel environment variables listed below. Confirm the storage bucket value in the Web App config rather than assuming it matches the example.
2. In Firebase Authentication, enable **Email/Password** and **Google** sign-in.
3. Add your Vercel deployment domain (and any custom domain) to Authentication's authorized domains.
4. Create a Cloud Firestore database.
5. Install and authenticate the Firebase CLI, then deploy the Firestore security rules:

   ```sh
   npm install --global firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```

Firestore rules limit reads and writes to the authenticated user's own records. Email verification is not required. Review and deploy `firestore.rules` whenever its data model changes.
The project does not deploy Cloud Functions, so no Blaze upgrade is needed for this setup. AI invoice generation and account deletion are not provided; users can sign out and manage their data from the workspace.

## Vercel deployment

1. Import this repository into Vercel. Use the repository root and the **Other** framework preset.
2. Set **Build Command** to `npm run build`, **Output Directory** to `public`, and the Node.js version to **22**.
3. Add these environment variables for Production (and Preview/Development if needed):

   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

4. Deploy. The existing `vercel.json` keeps the clean page routes. Authentication and data access go directly from the browser to Firebase; no Vercel API proxy, MySQL server, or Cloud Functions are needed.

## Existing data

This Firebase version does not automatically migrate accounts or records from the previous MySQL backend. Export any existing data before switching, and migrate it separately before deleting or shutting down the old database. The app can import previously cached browser data after the user signs into a matching Firebase account.
