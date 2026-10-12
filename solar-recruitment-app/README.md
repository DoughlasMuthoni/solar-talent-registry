# Solar Talent Registry prototype — Waterlift Solar

## What it includes

- Five-step, mobile-friendly technician application
- EPRA licence fields and manual verification control
- Rule-based preliminary scoring and transparent routing
- Installation, equipment, logger, voltage, safety and referee fields
- Regional assignment across Kenya
- Recruiter dashboard, filters and candidate details
- CSV export plus JSON backup/import (validated, with merge or replace)
- Optional saving in the browser (off by default)
- Light and dark modes
- Fictional demo records, clearly labelled and loaded only on request

## Running the prototype

Open `solar-talent-registry.html` in a modern browser. Data is stored in memory and disappears when the tab closes unless you export it, or turn on **Save records in this browser** under Privacy & controls. That option is for demo or test data only; the browser copy is unencrypted.

## Testing

`node --test tests` runs the scoring-rule tests (Node 20+, nothing to install).

## Production build recommendation

- Front end: Next.js/React or equivalent responsive framework
- API: Node/NestJS or Django
- Database: managed PostgreSQL
- Files: encrypted object storage with signed URLs and malware scanning
- Authentication: managed identity with recruiter, assessor and administrator roles
- Integrations: transactional email, WhatsApp Business API and calendar scheduling
- EPRA checks: assisted verification queue unless EPRA provides an authorised API
- Controls: audit trail, data retention, access logs, backups, encryption, privacy notice, correction/appeal workflow and human review of adverse decisions

This prototype is not a production applicant-tracking system and should not be used to store live personal data without the production security and privacy controls above.
