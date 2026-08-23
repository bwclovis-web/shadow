# Decants on perfumer's hollow — User Guide

This guide explains how decants work on the platform: inventory, listings, one-to-one buys, and **group splits**. Copy sections into Help, How It Works, or FAQ as needed.

---

## 1. What is a decant here?

A **decant** is a portion of authentic fragrance poured from a bottle you own into a smaller container (atomizer, vial, etc.). perfumer's hollow helps collectors **find each other** and **track** offers and group pours. We do **not** sell fragrance, process payments, or ship bottles.

---

## 2. Inventory vs listings

| | **My Inventory** | **My Listings** (exchange) |
|--|------------------|---------------------------|
| Purpose | What you own privately | What others can discover |
| Visibility | Only you | Traders on the exchange |
| Typical row | Full bottle (`amount` > 0) | Decant row (`available` ml for sale) |

CSV import and bulk add go to **inventory first**. You choose when to list ml on the exchange.

---

## 3. Multiple decant listings per perfume

You can have **several listing rows** for the same perfume — for example 10 ml at one price and 5 ml at another, or different decant formats.

- **Update existing decant** — changes one listing row.
- **Create as new decant entry** — adds another row (separate price, format, photos).

**Rule:** Total ml listed plus ml reserved in **active group splits** cannot exceed total ml you own for that perfume.

---

## 4. Buying a decant (one-to-one)

1. Browse **The Exchange** or wishlist matches.
2. Open a trader’s listing and **message** them (or propose a swap if trade-only).
3. Agree on **price and shipping off-platform** (PayPal, Venmo, etc.). When you list ml on the exchange, you must accept the off-platform payment disclaimer (same acknowledgment as group splits).
4. Optionally use a **trade** to track a swap if bottles are exchanged.

perfumer's hollow does not hold money or guarantee delivery.

---

## 5. Group splits (host + multiple claimants)

Use a **group split** when you want to pour **one bottle once** and fill **several fixed slots** (e.g. 6 × 10 ml) with different buyers.

| | Individual decant listing | Group split |
|--|---------------------------|-------------|
| Buyers | One deal at a time | Many slots, one pour |
| Discovery | Exchange listing card | “Group split” chip on exchange → split page |
| Fulfillment | You arrange per buyer | Host marks **shipped once**; each claimant **confirms received** |
| Storage | `UserPerfume` listing row | `DecantSplit` + slots (no new listing per buyer) |

### Host flow

1. **My Scents** → perfume → **Start group split**.
2. Enter total ml, slot layout, price hint, notes; accept the payment disclaimer.
3. Share the split page link (or let traders find it via the exchange chip).
4. When claimants pay off-platform, mark slots **paid**.
5. When all slots are claimed, mark the split **shipped**.
6. After claimants confirm receipt, the split **completes** and ml reservation is released.

### Claimant flow

1. Open the split page from the exchange or a shared link.
2. **Claim** an open slot (one slot per user per split).
3. Pay the host off-platform.
4. When the host ships, confirm **received** on your slot.

### Decant Host badge

After you complete **one group split as host**, you may earn the **Decant Host** contributor badge on your profile.

---

## 6. Millilitre limits

For each perfume you own:

```
pourable ml = owned ml − listed ml − reserved ml (active splits)
```

While a split is open, filling, or shipped, its `totalMl` counts as **reserved**. You cannot list or start another split beyond what you own.

---

## 7. Alerts

| Alert | When |
|-------|------|
| Wishlist available | A wishlist perfume is listed |
| Decant interest | Someone wishlists a perfume you decant |
| Split claim | Someone claims a slot on your split |
| Split shipped | Host marked the split shipped (claimants) |
| Split completed | All slots received |

Manage these under **Alert preferences** (in-app, email, push where enabled).

---

## 8. Trust and safety

- Use **Report** on profiles or trades if something goes wrong.
- **Trade disputes** apply to bilateral trades; group splits rely on slot status and messaging.
- Price fields are **hints only**, not binding checkout amounts.

---

## FAQ snippets (for site copy)

**Can I list the same perfume more than once?**  
Yes. Each decant listing is its own row with its own ml, price hint, and photos.

**What is the difference between a listing and a group split?**  
A listing is a standing offer on the exchange. A group split is one coordinated pour with numbered slots and shared shipping status.

**Does the site take a cut of decant sales?**  
No. Payment is always between traders off-platform.

**Why can’t I create a split for 50 ml?**  
You may already have that ml listed or reserved in another active split. Check your pourable ml budget in the split wizard.

**Do claimants get a listing on the exchange?**  
No. Claimants only appear on the split as slot holders.

---

## Related docs

- [Contributor badges — decantHost](./contributor-badges-spec.md)
- [Smoke test — decant splits](./smoke-test-decant-splits.md)
- Hub: [README.md](./README.md)
