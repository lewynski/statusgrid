STATUSGRID — VERCEL + SUPABASE SETUP
=====================================

PROJECT
-------
StatusGrid/
├── index.html
├── api/
│   ├── _supabase.js
│   ├── sites.js
│   └── check.js
├── supabase/
│   └── schema.sql
└── vercel.json


STEP 1 — CREATE SUPABASE PROJECT
--------------------------------
Create a project at Supabase.

STEP 2 — CREATE TABLES
----------------------
Supabase Dashboard
-> SQL Editor
-> New query

Copy everything from:
supabase/schema.sql

Run it.

The SQL creates:
- sites
- checks

STEP 3 — GET SUPABASE KEYS
--------------------------
Supabase Dashboard
-> Project Settings
-> API

You need:
- Project URL
- service_role key

Never put the service_role key in index.html.

STEP 4 — VERCEL ENVIRONMENT VARIABLES
-------------------------------------
Vercel
-> Project
-> Settings
-> Environment Variables

Create:

SUPABASE_URL
= your Supabase Project URL

SUPABASE_SERVICE_ROLE_KEY
= your Supabase service_role key

Then redeploy the project.

STEP 5 — TEST
-------------
Open StatusGrid and add:

Name:
Google

URL:
https://google.com

StatusGrid will:
1. save the website in Supabase
2. call your Vercel /api/check function
3. validate the destination
4. measure response time and HTTP status
5. store the check in Supabase
6. update the dashboard

SECURITY
--------
The checker blocks:
- localhost
- private IPv4 ranges
- private/reserved IPv6 ranges
- .local and .internal names
- redirect attempts into private networks

It also uses an 8-second timeout.

This is important because a public server-side URL checker should not be
allowed to request private/internal services.

MVP FEATURES
------------
Included:
- add/remove monitored websites
- Check Now
- Check All
- HTTP status code
- response time
- operational/unavailable state
- observed uptime from stored checks
- recent activity
- Supabase persistence
- responsive editorial interface

GOOD PHASE 2 FEATURES
---------------------
- Supabase Auth
- automatic scheduled checks
- outage email alerts
- SSL expiry checks
- public status page
- 24h/7d response charts
- configurable monitoring interval
