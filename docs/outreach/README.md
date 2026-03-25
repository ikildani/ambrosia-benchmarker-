# Outreach Playbook — Ambrosia Ventures Backlink & Growth Engine

## How to Use This Folder

| File | What It Contains |
|------|-----------------|
| `journalists.md` | 40+ pharma/biotech journalists with beats, outlets, emails, and tailored pitches |
| `vc-newsletters.md` | 25+ VC partners and newsletters with portfolio focus and outreach strategy |
| `bd-consultants.md` | 30+ BD professionals, consulting firms, and industry bodies to target |
| `email-templates.md` | Exact email templates by audience type, with data hooks and follow-up sequences |
| `weekly-schedule.md` | Week-by-week execution plan split between Issa and intern |
| `data-hooks.md` | 20 rotation-ready data hooks from your insight pages, one per outreach cycle |

## Split: Issa vs Intern

**Issa handles:** VCs (relationship-driven), senior journalists (byline recognition matters), consulting partners (McKinsey/LEK/Deloitte), webinar promotion
**Intern handles:** Junior journalists (volume play), blog/newsletter editors, industry body submissions, LinkedIn comment engagement, follow-up sequences

## Tracking

Log every outreach in the `backlink_outreach` Supabase table:
- `org_type`: journalist, vc, consultant, newsletter, blog
- `data_hook`: which stat you pitched
- `page_linked`: which URL you sent them to
- `status`: sent → replied → linked (or ignored)
- `follow_up_date`: 5 business days after initial send
