# Cash App

Lightweight mobile-first cash management for authorized Shop A and Shop S staff.

## Project responsibilities

- `cashapp-a213f`: Firebase Hosting target for this separate application.
- `cisapp-236ab`: runtime Firebase Authentication and Firestore data project shared with the CRM.
- GitHub: `https://github.com/Mahitosh-M/CASHapp.git`.

Keeping runtime data in the CRM project is required because Firebase Auth tokens and Firestore security rules are project-specific. The Cash App does not copy CRM payments, invoices, customers, PC, credit, or intelligence data.

## Current status

The application is implemented and can be built locally. It is not ready for production financial writes until the CRM's complete Firestore rules and `shopCash` schema are extended as described in [docs/CRM_FIRESTORE_INTEGRATION.md](docs/CRM_FIRESTORE_INTEGRATION.md).

This repository deliberately configures Firebase Hosting only. It does not contain a deployable Firestore rules file, preventing a Cash App deployment from replacing the CRM's existing ruleset.

## Local development

```powershell
npm install
npm run dev
```

The checked-in defaults point runtime Auth and Firestore to `cisapp-236ab`. Copy `.env.example` to `.env.local` only when environment-specific overrides are needed.

## Verification

```powershell
npm test
npm run build
```

## Firestore behavior

- Startup: Firebase Auth restore, one `users/{uid}` profile read, one assigned `shopCash/{shopId}` read.
- Home refresh: one assigned summary read.
- Expense: one `cashExpenses` create plus one own-shop summary update in one batch.
- Transfer: one `shopTransfers` create plus two summary updates in one batch.
- History: three bounded queries, only when History is opened; results remain cached during that app session.
- No listeners, polling, Cloud Functions, payment scans, or customer-data reads.

## Hosting

After production integration is approved and tested:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting --project cashapp-a213f
```

Do not deploy Firestore rules from this repository.
