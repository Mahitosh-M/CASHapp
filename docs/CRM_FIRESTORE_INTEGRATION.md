# CRM Firestore Integration Required

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
```

The CRM remains the only writer of customer payment records and collection effects.

## Firebase project boundary

The supplied `cashapp-a213f` project currently has the Firestore API disabled. It is configured as this app's Hosting project only.

Runtime Authentication and Firestore point to `cisapp-236ab`. A separate Cash App Firestore project cannot directly share CRM Auth identities or `shopCash` documents. Doing so would require duplicate accounts/data or paid backend synchronization, all of which violate the approved architecture.

## Existing compatibility gaps

The CRM branch currently validates `shopCash` with exactly these fields:

```text
shopId
availableBalance
totalCollections
updatedAt (ISO string)
```

Its update rule also requires the `availableBalance` delta to equal the `totalCollections` delta. That is correct for a CRM receipt but intentionally rejects Cash App expenses and transfers.

Before live Cash App use, the CRM's complete ruleset must be extended to accept optional numeric fields:

```text
totalExpenses
totalTransferredIn
totalTransferredOut
```

The Cash App keeps `shopCash.updatedAt` as an ISO string for CRM compatibility. Expense and transfer audit records use Firestore server timestamps.

## Required rule behavior

The CRM rules should be extended in the CRM repository, reviewed, emulator-tested, and deployed as one complete ruleset. They must enforce all of the following:

1. Only active `Staff` and `Admin` profiles can access cash records.
2. Staff can get only their assigned `shopCash` document. Collection listing remains denied.
3. Staff can create an expense only for their assigned shop, with a positive bounded amount, trimmed bounded description, their own UID, and an authoritative timestamp.
4. Staff cannot update or delete expense audit records. Any Admin correction policy must be explicit and audited.
5. Staff can create a transfer only from their assigned shop to the other valid shop.
6. Staff cannot update or delete transfer audit records.
7. An expense batch may change only `availableBalance`, `totalExpenses`, and `updatedAt` on the sender summary, with matching opposite/positive amount deltas.
8. A transfer batch may change only sender balance/out total and receiver balance/in total. It must never change `totalCollections`.
9. Staff cannot directly create a Shop A expense from Shop S or vice versa.
10. CRM payment batches must retain their current collection behavior and legacy-record compatibility.
11. Resulting balances should not be negative where the rule design can enforce this safely.
12. Reusing an existing expense or transfer document ID must be denied to reduce manual retry duplication risk.

Cross-document validation should use the new audit record in the same atomic batch where practical. A broad rule allowing Staff to freely increment/decrement `shopCash` would not provide adequate financial integrity.

## Required indexes

Merge the entries in `docs/firestore.indexes.required.json` into the CRM's existing `firestore.indexes.json`. Do not replace the CRM index file.

History then performs these bounded queries only after the History page opens:

```text
cashExpenses: shopId == assigned shop, createdAt desc, limit 10
shopTransfers: fromShopId == assigned shop, createdAt desc, limit 10
shopTransfers: toShopId == assigned shop, createdAt desc, limit 10
```

## Safe rollout order

1. Add and emulator-test the complete CRM rule/index changes on CRM branch `big`.
2. Test Cash App against Firebase emulators using fake Admin, Shop A Staff, Shop S Staff, and invalid users.
3. Verify legacy CRM invoice/payment workflows against the updated rules.
4. Deploy CRM rules and indexes without deploying Cash App Hosting.
5. Run a controlled Cash App test using initialized branch summaries and test audit entries.
6. Deploy Cash App Hosting only after the controlled test passes.

No production Firebase write, rules deployment, index deployment, or Hosting deployment has been performed from this repository.
