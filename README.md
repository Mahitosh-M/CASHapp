# Cash App

Lightweight mobile-first cash management for authorized ASHOKA and SMPA staff.

The production site is an installable progressive web app. Staff can open `https://cashapp-a213f.web.app/` on a phone and add Cash App to the home screen from the in-app installation prompt.

## Project responsibilities

- `cashapp-a213f`: Firebase Hosting target for this separate application.
- `cisapp-236ab`: runtime Firebase Authentication and Firestore data project shared with the CRM.
- GitHub: `https://github.com/Mahitosh-M/CASHapp.git`.

Keeping runtime data in the CRM project is required because Firebase Auth tokens and Firestore security rules are project-specific. The Cash App does not copy CRM payments, invoices, customers, PC, credit, or intelligence data.

## Current status

The application and matching CRM rules/index changes are implemented, tested, and deployed. A controlled end-to-end user test is still recommended before relying on live financial writes. See [docs/CRM_FIRESTORE_INTEGRATION.md](docs/CRM_FIRESTORE_INTEGRATION.md).

This repository deliberately configures Firebase Hosting only. It does not contain a deployable Firestore rules file, preventing a Cash App deployment from replacing the CRM's existing ruleset.

## Local development

```powershell
npm install
npm run dev
```

The checked-in defaults point runtime Auth and Firestore to `cisapp-236ab`. Copy `.env.example` to `.env.local` only when environment-specific overrides are needed.

For isolated integration testing, start Auth and Firestore emulators from the CISapp repository and set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local`. This prevents CashApp tests from writing production data.

## Verification

```powershell
npm test
npm run build
```

## Firestore behavior

- Startup: Firebase Auth restore, one `users/{uid}` profile read, one assigned `shopCash/{shopId}` read.
- Foreground refresh after the app has been away for at least 30 seconds: one assigned summary read.
- Initialization: one immutable audit write plus one summary write; Admin-only and one-time.
- Expense, purchase, or EMI payment: one categorized `cashExpenses` create plus one own-shop summary update in one batch. Purchases are classified as COGS; EMI payments are classified as financing cash outflows.
- Admin expense correction: one immutable `cashExpenseCorrections` audit write, the matching `cashExpenses` update or deletion, and the exact own-shop summary adjustment in one transaction. Deletion restores the original amount to available cash.
- Transfer: one `shopTransfers` create plus two summary updates in one batch.
- Admin adjustment: one immutable `cashAdjustments` create plus one selected-shop summary update in one batch; audited deductions may produce or deepen a negative balance.
- History: four bounded monthly queries, only when History is opened; results remain cached during that app session.
- Admin reports: bounded selected-period history queries, with monthly/yearly P&L and Cash Flow Analysis, COGS, gross profit, complete outflow allocation graphs, and current cash position.
- No listeners, polling, Cloud Functions, payment scans, or customer-data reads.

Admin and Staff use separate login commands on the same form, but both authenticate against the existing CIS Firebase Auth project. The CIS `users/{uid}.role` remains authoritative; selecting Admin login never grants or changes a role.

## Hosting

Every push to `main` runs the test suite and production build, then deploys Cash App to Firebase Hosting only if both succeed. The GitHub repository must contain the encrypted Actions secret `FIREBASE_SERVICE_ACCOUNT_CASHAPP_A213F`. Never commit the service-account JSON.

For an emergency manual Hosting-only deployment:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting --project cashapp-a213f
```

Do not deploy Firestore rules from this repository.

## Environment configuration

Copy `.env.example` to `.env.local` and set each configuration variable to a single-line JSON object copied from Firebase's web app settings. Only apiKey, authDomain, projectId, storageBucket, messagingSenderId and appId are allowed. Local configuration is ignored by Git.

Required GitHub Actions secrets (same JSON values as local configuration):
- `VITE_FIREBASE_CONFIG`

Set these repository secrets before merging or deploying. Existing deployment service-account secrets remain separate. Firebase web configuration is public and will be included in browser bundles; environment variables keep its values out of source control, not hidden from browser users. Never place passwords, private keys, service-account JSON, access tokens or server API keys in any VITE_* variable. Keep those in server-only environment variables or a secret store. Existing Git history is unchanged; rotate real leaked credentials before any coordinated history cleanup.

## Shared background component

Reusable shadcn-style components live in `src/components/ui`, exposed as `@/components/ui` by Vite and TypeScript. This folder and the aliases in `components.json` give the shadcn CLI a consistent installation target without moving existing components. Existing app styles remain in their original files; `src/background.css` contains the Tailwind utilities and background integration.

TypeScript is already installed. Tailwind v4 is configured through `@tailwindcss/vite`; Preflight is omitted to preserve existing forms and tables. The equivalent dependency command is `npm install clsx tailwind-merge && npm install -D tailwindcss @tailwindcss/vite`. The shadcn configuration is already present; use `npx shadcn@latest add <component>` to add components later. For a fresh project, use `npx shadcn@latest init`.

`Hero` and `HeroDemo` require no data, state, providers, images or icons. `AppBackground` mounts the decorative gradient behind all routes, fills desktop/mobile viewports, and never intercepts pointer input.


## Dispatch diesel (development)

Home > Fuel opens the existing fuel expense history. The CISapp Dispatch backend posts shop-funded diesel at approval and personal diesel when reimbursement is confirmed. Entries are labelled Diesel under Fuel; the same shopCash balance is reduced atomically once. Do not manually add the same Dispatch bill again. Paise are preserved in displayed amounts and movement snapshots, while manual whole-rupee inputs remain unchanged. Cash advances and handovers are custody events, not additional diesel expenses. The expense ledger and corrections remain available for reports; Dispatch image retention does not delete CashApp expenses.
