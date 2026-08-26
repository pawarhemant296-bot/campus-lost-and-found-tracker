# Demo script for judges (3 minutes)

## Before you start

```bash
npm run setup && npm run seed && npm start
```

Open two browser windows side by side at <http://localhost:4000>:

- **Left** — sign in as `ananya@campus.edu` / `demo1234` (she lost the wallet)
- **Right** — sign in as `rahul@campus.edu` / `demo1234` (he found it)

Keep a third tab signed in as `admin@campus.edu` / `admin123`.

The seed leaves the wallet case at the *possible match* stage on purpose, so the claim →
verification → handover part is performed live.

---

## 0:00 — Frame the problem (20 s)

> "A student loses a wallet in the canteen. Someone else finds it an hour later. Today those two
> people never meet. Our platform connects them, proves who the real owner is, and tracks the item
> until it is back."

Show the landing page: live counters, and the four-step *Report → Match → Verify → Return* strip.

## 0:20 — Report a lost item (30 s)

On the **left** window: **Report lost** →

| Field | Value |
| --- | --- |
| Title | `Blue Wildcraft backpack` |
| Category | `Bag / Backpack` |
| Description | `Blue Wildcraft backpack with a laptop sleeve and a broken zip on the front pocket` |
| Location | `Library second floor` |
| Date & time | today, a couple of hours ago |

Submit. Point out the result screen: *"no match above the threshold yet — every new report on the
other side is scored against yours automatically."*

## 0:50 — Report the matching found item (40 s)

On the **right** window: **Report found** →

| Field | Value |
| --- | --- |
| Title | `Blue backpack left in library` |
| Category | `Bag / Backpack` |
| Description | `Blue Wildcraft backpack found near the library reading desks, front pocket zip is broken` |
| Location | `Library, second floor` |
| Date & time | today, an hour after the loss |
| Verification question | `What is inside the front pocket and what is broken?` |
| Expected answer | `a laptop sleeve and a broken front zip` |

Submit — **this is the money moment**: the score appears immediately with the full breakdown.

> "The engine scored this at 80-something percent. It never compared item names alone: category and
> title 25%, description 25%, location 20%, date and time 15%, image 15%. There are no photos here,
> so the image factor is *skipped* and its weight is redistributed — a missing photo can't cap a
> perfect match."

Emphasise the private answer: *"the expected answer is stored but the API never returns it to
anyone — not even to Rahul."*

## 1:30 — Notification and claim (30 s)

Back on the **left** window: the bell already shows a new *Strong match found* notification (pushed
over WebSocket, no refresh). Click it → **Claim this item**.

The verification question appears. Answer it:

> `A laptop sleeve, and the front zip is broken`

Add proof text and submit. Note the **automatic proof score** on the claim page.

> "The system grades the answer against the finder's private detail, but a human always decides —
> that is what stops anybody from just clicking 'this is mine'."

## 2:00 — Verify, approve, hand over (40 s)

On the **right** window: bell → *New ownership claim* → **Start verification** → **Approve claim**.

- Contact details unlock for **both** sides only now.
- Show the chat: *"Meet at the library at 5pm."* — messages arrive live, scoped to this one item.
- Press **Confirm handover**.

Switch to the **left** window: the item is `RETURNED`, the timeline is fully ticked, and both the
lost and the found report closed together.

## 2:40 — Admin dashboard (20 s)

Third tab → **Admin**:

- resolution rate, category breakdown, **location hotspots** (heatmap data)
- claims/dispute queue — an admin can decide any claim if the finder disappears
- hide a report → show it instantly appearing in the **audit log**

---

## If a judge asks…

**"What if the descriptions use completely different words?"**
Open any match → *Why these two match*. Beyond weighted keyword overlap we use containment and
salient-word coverage, because the owner describes contents while the finder describes appearance.
Turning on the Python service (`AI_SERVICE_ENABLED=true`) swaps in sentence-embedding similarity
plus real image comparison — and if that service dies, the engine silently falls back.

**"Can someone brute-force a claim?"**
No. You cannot claim your own report, you get one open claim per item, the private detail is never
exposed by the API, approving one claim auto-rejects the others, and every admin action is audited.

**"Is this really working, or is it a mock-up?"**

```bash
npm run demo      # 38 assertions across the whole REST journey
npm run test:ui   # drives this exact UI in a real browser, 30 assertions, 0 console errors
```

**"Would it run on PostgreSQL?"**

```bash
docker compose up --build     # Postgres + API + AI service, same code path
```

## Fallback if something goes wrong live

Run `npm run demo` — it prints the entire journey with the real score breakdown in about two
seconds, and it does not depend on the browser.
