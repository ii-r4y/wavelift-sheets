# Wave Lift Project Rules

You are working on Wave Lift, a real sports club management app.

This project is not a landing page.

It is a Single Page Application with multiple screens, Firebase, Google Sheets, Apps Script, player flows, coach flows, admin flows, QR attendance, daily training, weekly schedule, and player cards.

## Main Rule

Do not rebuild the project from scratch.

Most tasks should be treated as Reskin or focused improvement, not full redesign.

## Critical Priorities

1. Stability
2. Do not break data
3. Keep navigation working
4. Ease of use
5. Mobile-first experience
6. Professional UI
7. Visual polish

## Never Change Without Explicit Permission

* Do not rename IDs.
* Do not rename important classes.
* Do not rename functions.
* Do not rewrite app.js fully.
* Do not change Firebase logic.
* Do not change Google Sheets logic.
* Do not change Apps Script logic.
* Do not change page().
* Do not change renderSports().
* Do not delete sections.
* Do not add new screens unless requested.
* Do not convert the app into a long landing page.
* Do not use random stock images.
* Do not change button locations unless specifically requested.

## Preferred Work Style

Before editing:

* Briefly state what files you will touch.
* Explain the risk level: low / medium / high.
* If the task may break navigation or data, ask before editing.

During editing:

* Prefer CSS changes first.
* Edit HTML only when necessary.
* Edit JavaScript only when required for a real bug.
* Make the smallest safe change possible.

After editing:

* List changed files.
* State whether app.js was changed.
* State whether any ID was changed.
* State whether navigation was tested.
* State what screens should be manually tested.

## UI Direction

Use:

* Dark Glass UI
* Blue Neon Accent
* RTL Arabic
* Mobile-first layout
* Glassmorphism cards
* Clean sports app feel
* Premium club management system style

But keep:

* Same layout
* Same button positions
* Same content order
* Same user flows
* Same screens

## Wave Lift Screens

Known screens:

* home
* sport
* coachDash
* daily
* weekly
* attendance
* playerDash
* gymAttendance
* gymTraining
* adminDash
* adminClub
* adminSettings

## Default Behavior

If the user asks for design improvement:
Treat it as Global Reskin unless they clearly ask for a new layout.

If the user asks for a new feature:
First check if it affects Firebase, Google Sheets, attendance, login, QR, or player data.

If unsure:
Ask before editing.
