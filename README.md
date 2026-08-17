# Cash App

Lightweight mobile-first cash management for authorized ASHOKA and SMPA staff.

## Project responsibilities

- `cashapp-a213f`: Firebase Hosting target for this separate application.
- `cisapp-236ab`: runtime Firebase Authentication and Firestore data project shared with the CRM.
- GitHub: `https://github.com/Mahitosh-M/CASHapp.git`.

Keeping runtime data in the CRM project is required because Firebase Auth tokens and Firestore security rules are project-specific. The Cash App does not copy CRM payments, invoices, customers, PC, credit, or intelligence data.

## Current status

The application and matching CRM rules/index changes are implemented and rule-emulator tested locally. They still require a controlled end-to-end user test and an explicit production deployment before live financial writes are enabled. See [docs/CRM_FIRESTORE_INTEGRATION.md](docs/CRM_FIRESTORE_INTEGRATION.md).

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
- Expense: one `cashExpenses` create plus one own-shop summary update in one batch.
- Transfer: one `shopTransfers` create plus two summary updates in one batch.
- Admin adjustment: one immutable `cashAdjustments` create plus one selected-shop summary update in one batch.
- History: four bounded queries, only when History is opened; results remain cached during that app session.
- No listeners, polling, Cloud Functions, payment scans, or customer-data reads.

Admin and Staff use separate login commands on the same form, but both authenticate against the existing CIS Firebase Auth project. The CIS `users/{uid}.role` remains authoritative; selecting Admin login never grants or changes a role.

## Hosting

After the CISapp rules/indexes are approved, tested, and deployed:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting --project cashapp-a213f
```

Do not deploy Firestore rules from this repository.
