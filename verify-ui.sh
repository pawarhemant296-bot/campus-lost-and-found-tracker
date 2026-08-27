#!/usr/bin/env bash
# Visual smoke test: boots the API (serving the built client) and captures a
# screenshot of every major screen with agent-browser.
#
# Note: in this sandbox agent-browser's native `click` only lands on the first
# page of a session, so interactions are driven through `eval` (a real DOM
# click, which React's synthetic event system handles identically).
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
SHOTS="/projects/sandbox/.kiro/artifacts/screenshots"
S=tb
BASE=http://localhost:4000
mkdir -p "$SHOTS"

echo "── building client"
(cd "$ROOT/client" && npm run build >/dev/null 2>&1) || { echo "build failed"; exit 1; }

echo "── seeding + starting API"
(cd "$ROOT/server" && npm run seed >/dev/null 2>&1)
(cd "$ROOT/server" && node src/index.js >/tmp/api.log 2>&1 &)
for _ in $(seq 1 40); do curl -sf $BASE/api/health >/dev/null && break; sleep 0.5; done
curl -sf $BASE/api/health >/dev/null || { echo "API failed to start"; cat /tmp/api.log; exit 1; }

ab()   { agent-browser --session $S "$@" >/dev/null 2>&1; }
url()  { agent-browser --session $S get url 2>/dev/null | tail -1; }
shot() { agent-browser --session $S screenshot "$SHOTS/$1.png" >/dev/null 2>&1 && echo "   ✓ $1"; }
go()   { ab open "$BASE$1"; sleep "${2:-2}"; }
tap()  { ab eval "document.querySelector(\"$1\")?.click()"; sleep "${2:-2}"; }
taptext() {
  ab eval "[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim().startsWith(\"$1\"))?.click()"
  sleep "${2:-2}"
}

login() {
  ab open "$BASE/login"; sleep 1
  ab eval "localStorage.clear()"
  ab open "$BASE/login"; sleep 2
  ab fill "#email" "$1"
  ab fill "#password" "$2"
  ab eval "document.querySelector('form').requestSubmit()"
  sleep 3
  echo "   · $1 → $(url)"
}

echo "── desktop pass (1440x900)"
ab set viewport 1440 900
go / 3;                       shot 01-landing-hero
ab eval "window.scrollTo(0,1150)"; sleep 1; shot 02-landing-engine
ab eval "window.scrollTo(0,2500)"; sleep 1; shot 03-landing-lifecycle
go /how-it-works 2;           shot 04-how-it-works
go /browse 3;                 shot 05-browse
go /items/2 3;                shot 06-item-details
ab eval "window.scrollTo(0,760)"; sleep 1; shot 06b-item-match-breakdown
go /login 2;                  shot 07-login
go /register 2;               shot 07b-register

echo "── owner journey (aarav)"
login aarav@college.edu demo1234
shot 08-dashboard
go /app/matches 3
taptext "View details" 2;     shot 09-matches-expanded
go /app/report/lost 2;        shot 10-report-form
ab eval "document.querySelectorAll('.toggle-option')[1].click()"; sleep 2; shot 10b-report-found-questions
go /app/reports 2;            shot 11-my-reports
go /app/claims 2;             shot 12-claims-list
go /app/claims/1 3;           shot 13-claim-wizard
go /app/messages 4;           shot 14-messages
go /app/notifications 2;      shot 15-notifications
go /app/profile 2;            shot 16-profile
go /app 3
tap ".bell" 1;                shot 17-notification-panel

echo "── finder journey (priya) — the review step"
login priya@college.edu demo1234
go /app/claims/1 3;           shot 18-claim-review

echo "── admin console"
login admin@traceback.io admin1234
go /admin 3;                  shot 19-admin-overview
go /admin/analytics 3;        shot 20-admin-analytics
ab eval "window.scrollTo(0,700)"; sleep 1; shot 20b-admin-analytics-charts
go /admin/items 3;            shot 21-admin-items
go /admin/claims 3;           shot 22-admin-claims
taptext "Review" 2;           shot 22b-admin-claim-review-modal
go /admin/disputes 3;         shot 23-admin-disputes
go /admin/users 3;            shot 24-admin-users
go /admin/settings 3;         shot 25-admin-settings

echo "── mobile pass (390x844)"
ab set viewport 390 844
go / 3;                       shot 26-mobile-landing
go /browse 3;                 shot 27-mobile-browse
go /admin 3;                  shot 28-mobile-admin-bottomnav
go /items/2 3;                shot 29-mobile-item-details
go /app/matches 3;            shot 30-mobile-matches

echo "── tablet pass (900x1000)"
ab set viewport 900 1000
go /app 3;                    shot 31-tablet-dashboard-collapsed-sidebar

echo "── page errors"
agent-browser --session $S errors 2>&1 | head -20

ab close
pkill -f "node src/index.js"
echo "── done · $(ls "$SHOTS" | wc -l) screenshots in $SHOTS"
