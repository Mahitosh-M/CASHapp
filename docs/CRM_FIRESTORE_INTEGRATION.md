# CRM Firestore Integration

## Discovered architecture

The CRM currently defines the two shops as code constants (`SHOP_A`, `SHOP_S`); there is no `shops` collection and therefore no reason for the Cash App to add a branch-configuration read.

The planned CRM branch implementation uses:

```text
users/{uid}
shopCash/SHOP_A
shopCash/SHOP_S
```

No compatible cash expense or inter-shop transfer collection exists, so the Cash App uses:

```text
cashExpenses/{expenseId}
shopTransfers/{transferId}
cashAdjustments/{adjustmentId}
```

The CRM remains the only writer of customer payment records and collection effects.

## Firebase project boundary

The supplied `cashapp-a213f` project currently has the Firestore API disabled. It is configured as this app's Hosting project only.

Runtime Authentication and Firestore point to `cisapp-236ab`. A separate Cash App Firestore project cannot directly share CRM Auth identities or `shopCash` documents. Doing so would require duplicate accounts/data or paid backend synchronization, all of which violate the approved architecture.

## Implemented compatibility contract

The CRM `big` branch now keeps the original required fields:

```text
shopId
availableBalance
totalCollections
updatedAt (ISO string)
```

and accepts Cash App-managed fields:

```text
totalExpenses
totalTransferredIn
totalTransferredOut
openingBalance
initializedAt
initializedBy
lastCashOperationId
lastCashOperationType
```

CRM receipt effects carry the payment ID and are accepted only when the rules derive the same exact before/after `cashSyncedAmount` delta from the matching payment mutation. Invoice deletion uses an Admin-only aggregate reversal marker because one invoice can remove several linked payment documents atomically. Expense, transfer, and Admin adjustment deltas require a newly created immutable audit document in the same batch. The Cash App keeps `shopCash.updatedAt` as an ISO string for CRM compatibility; authoritative audit and initialization times use Firestore server timestamps.

## Required rule behavior

The CRM rules should be extended in the CRM repository, reviewed, emulator-tested, and deployed as one complete ruleset. They must enforce all of the following:

1. Only active `Staff` and `Admin` profiles can access cash records.
2. Staff can get only their assigned `shopCash` document. Collection listing remains denied.
3. Staff can create an expense, purchase, or EMI payment only for their assigned shop, with a positive bounded amount, a recognized optional accounting category for legacy-client compatibility, trimmed bounded description, their own UID, and an authoritative timestamp. The `purchases` category represents COGS and `emi` represents a financing cash outflow.
4. Staff cannot update or delete expense records. Admin can update or delete them only when the same transaction creates an immutable `cashExpenseCorrections` record containing the exact before/after amount, category, and description.
5. Staff can create a transfer only from their assigned shop to the other valid shop.
6. Staff cannot update or delete transfer audit records.
7. An expense batch may change only `availableBalance`, `totalExpenses`, and `updatedAt` on the sender summary, with matching opposite/positive amount deltas.
8. A transfer batch may change only sender balance/out total and receiver balance/in total. It must never change `totalCollections`.
9. ASHOKA staff cannot directly create an SMPA expense, or vice versa.
10. CRM payment batches must retain their current collection behavior and legacy-record compatibility, and each normal summary delta must be linked to the exact matching payment mutation.
11. Audited expenses and Admin deductions may produce negative cash balances; transfer-specific sufficiency checks remain enforced.
12. Reusing an existing expense or transfer document ID must be denied to reduce manual retry duplication risk.
13. Admin initialization must create `cashInitializations/{shopId}` once and preserve any CRM collections already tracked.
14. Only Admin can create a manual adjustment, and its add/deduct amount must exactly match the selected shop summary delta.
15. Adjustment records are immutable, require a nonblank reason, and must exactly match the resulting balance even when it is negative.
16. An Admin expense correction must change `availableBalance` and `totalExpenses` by the exact difference between the old and new amount. Deletion must restore the full original amount, and correction audit records cannot be updated or deleted.

Cross-document validation uses `getAfter()` to prove the immutable record and exact summary effects are in the same atomic batch. Staff do not receive broad summary write access.

## Required indexes

Merge the entries in `docs/firestore.indexes.required.json` into the CRM's existing `firestore.indexes.json`. Do not replace the CRM index file.

History and Admin reports perform month-bounded queries only after the relevant view opens:

```text
cashExpenses: shopId == assigned shop, selected createdAt month, createdAt desc
shopTransfers: fromShopId == assigned shop, selected createdAt month, createdAt desc
shopTransfers: toShopId == assigned shop, selected createdAt month, createdAt desc
cashAdjustments: shopId == assigned shop, selected createdAt month, createdAt desc
payments: shopId == assigned shop, affectsShopCash == true, selected createdAt month, createdAt desc
```

## Safe rollout order

1. Emulator-test the complete CRM rule/index changes on CRM branch `big`.
2. Test Cash App against Firebase emulators using fake Admin, ASHOKA Staff, SMPA Staff, and invalid users.
3. Verify legacy CRM invoice/payment workflows against the updated rules.
4. Deploy CRM rules and indexes without deploying Cash App Hosting.
5. Run a controlled Cash App test using initialized branch summaries and test audit entries.
6. Deploy Cash App Hosting only after the controlled test passes.

No production Firebase write, rules deployment, index deployment, or Hosting deployment is performed by these local code changes.
