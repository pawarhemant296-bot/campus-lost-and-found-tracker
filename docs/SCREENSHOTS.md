# TraceBack — UI walkthrough

Every image below is a real screenshot of the running app against the seeded demo data,
captured automatically by [`verify-ui.sh`](../verify-ui.sh) at 1440×900 (desktop),
900×1000 (tablet) and 390×844 (mobile). Regenerate the whole set any time with:

```bash
./verify-ui.sh
```

---

## Landing page

Two-tone hero over a nebula gradient and a drifting starfield, with a radar sweep visual and a
live stats bar pulled from `/api/meta/stats`.

![Landing page hero](screenshots/01-landing.png)

The matching engine explained in the user's language, with the real weights and a worked example
scored by the live engine.

![Matching engine section](screenshots/02-landing-matching-engine.png)

## How it works

The full 13-stage workflow as a timeline, the claim wizard, and the safeguards that stop a stranger
claiming your things.

![How it works](screenshots/03-how-it-works.png)

---

## Search & browse

Glassmorphism filter bar — category, location, date range, status and sort as dark pill dropdowns
with a purple active state. Reporter identities are masked on every public listing.

![Browse and filter](screenshots/04-browse-and-filter.png)

## Item details

Photo in a glowing frame, masked reporter, the item's position in the lifecycle, and the claim CTA.

![Item details](screenshots/05-item-details.png)

"This might be your item?" — the AI match score as a large glowing ring, with a per-factor
breakdown and plain-English reasons for the score.

![Match breakdown on an item](screenshots/06-item-match-breakdown.png)

---

## Sign in

Centred glass card on the starfield. The three chips log you straight into the demo accounts, so
nothing needs typing during a presentation.

![Login](screenshots/07-login.png)

## Dashboard

Four stat cards, recent activity with status badges, top matches as glowing progress rings, and
claims in flight. The amber banner appears when a case is waiting on you.

![User dashboard](screenshots/08-user-dashboard.png)

## Possible matches

Lost report ⟷ found report, joined by an animated glowing connector, with the combined confidence
in the middle. Expanded here to show the five factor bars and why the pair matched.

![Possible matches](screenshots/09-possible-matches.png)

---

## Reporting an item

Three-step wizard (Details → Photo → Review) with a **live preview** of the card you're about to
publish and a match-strength checklist that shows what each field is worth to the score.

![Report item form](screenshots/10-report-item-form.png)

Reporting a *found* item adds private ownership questions. The answers are stored privately and are
never returned by the API — claimants only ever see the questions.

![Verification questions on a found report](screenshots/11-report-found-verification-questions.png)

## My reports

Table view with inline status control, re-scan and delete; there's a card/grid toggle too.

![My reports](screenshots/12-my-reports.png)

---

## Claim & verification

Step-by-step wizard — Claim Submitted → Verification → Review → Handover → Returned — with a
vertical case timeline, the item's lifecycle, and both parties (masked until approval).

![Claim wizard](screenshots/13-claim-wizard.png)

The finder's review screen: the auto-score as a glowing ring, each answer with its own similarity
bar, and Approve / Reject. The score is advisory — a human always decides.

![Claim verification review](screenshots/14-claim-verification-review.png)

---

## Messages

Split view: conversations on the left with unread glow dots, chat on the right with the item
context pinned at the top. Sender bubbles are purple gradient, receiver bubbles dark grey.

![Messages](screenshots/15-messages.png)

## Notifications

Slide-in panel from the bell, unread items marked with a purple left-border glow.

![Notifications panel](screenshots/16-notifications-panel.png)

Full page with type filters and timestamps.

![Notifications page](screenshots/17-notifications-page.png)

## Profile

Editable details, a live avatar hue slider, the privacy guarantees in plain language, and the
current matching-engine tuning.

![Profile](screenshots/18-profile.png)

---

## Admin console

KPI cards, a 14-day lost-vs-found trend, the moderation queue and the latest reports.

![Admin overview](screenshots/19-admin-overview.png)

Analytics — reports over time, category donut, score distribution, location hotspots, lifecycle
funnel and resolution-time trend. All hand-rolled SVG with purple gradient fills.

![Admin analytics](screenshots/20-admin-analytics.png)

Manage items: search and status filters, inline status override, hide-from-public and delete.

![Admin manage items](screenshots/21-admin-manage-items.png)

Claim review modal — the auto-score, every answer with its similarity bar, any disputes, and a
moderation note that gets shared with the claimant.

![Admin claim review](screenshots/22-admin-claim-review.png)

Disputes queue, for when a rejected claimant escalates.

![Admin disputes](screenshots/23-admin-disputes.png)

Settings — the matching engine is genuinely configuration-driven. Move a slider, save, re-scan a
report, and the scores change.

![Admin engine settings](screenshots/24-admin-engine-settings.png)

---

## Responsive

Cards stack, forms go single-column, and the sidebar becomes a labelled bottom nav. Match rings and
status steppers resize but keep their glow.

| Mobile landing | Mobile browse |
| --- | --- |
| ![Mobile landing](screenshots/25-mobile-landing.png) | ![Mobile browse](screenshots/26-mobile-browse.png) |

| Mobile bottom nav | Mobile matches |
| --- | --- |
| ![Mobile bottom nav](screenshots/27-mobile-bottom-nav.png) | ![Mobile matches](screenshots/28-mobile-matches.png) |

At tablet widths the sidebar collapses to an icon rail:

![Tablet collapsed sidebar](screenshots/29-tablet-collapsed-sidebar.png)
