# LIAN Mobile Web

Static mobile web frontend for LIAN.

This repository contains only the frontend static app and local frontend rehearsal scripts. Backend APIs, runtime data, authentication, uploads, image proxy, and NodeBB integration live in the backend server repository.

## Run frontend static rehearsal

Start the backend server separately, then run:

```bash
npm run start:frontend-static
Default ports:

frontend static rehearsal: 4300
backend API: 4200
image proxy: 4201
Validate
npm run check
node scripts/smoke-frontend.js http://127.0.0.1:4300

