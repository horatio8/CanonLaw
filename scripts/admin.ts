#!/usr/bin/env node
/**
 * Super-admin entry point.
 *
 *   AIRTABLE_CLIENT_ID=...  \
 *   AIRTABLE_REDIRECT_URI=http://localhost:3000/auth/callback  \
 *   CANONLAW_MASTER_KEY=...  \
 *   npm run admin
 *
 * Then open http://localhost:3000 and click "Connect Airtable".
 */

import { startAdminServer } from "../src/airtable/server.ts";

startAdminServer();
