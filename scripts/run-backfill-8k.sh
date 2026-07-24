#!/bin/bash
# Continuous 8-K Item 1.01 deal backfill script
# Run this in a terminal to continuously process SEC EDGAR deal filings.
# Usage: ./scripts/run-backfill-8k.sh
#
# This processes 20 filings per call across 5 deal types (license, collaboration,
# option, acquisition, codevelopment) with pagination. Each call extracts ~2-5
# deals from real SEC 8-K filings using Claude.
#
# Total addressable: ~3,500 deal filings → estimated 200-500 new deals
# Runtime: ~30 minutes per full pass (all deal types, first 5 pages each)

ADMIN_KEY="${ADMIN_API_KEY:-bdf61d1734c6aa78539533b6ae83f9e359f50e5056dac99601369aa13dbfa166}"
BASE_URL="${BASE_URL:-https://solidus.ambrosiaventures.co}"
MAX_PAGES="${MAX_PAGES:-10}"  # Pages per deal type (20 filings per page)

DEAL_TYPES=("license" "collaboration" "option" "acquisition" "codevelopment" "royalty")

echo "=========================================="
echo "8-K Item 1.01 Deal Backfill"
echo "Base URL: ${BASE_URL}"
echo "Max pages per deal type: ${MAX_PAGES}"
echo "=========================================="

TOTAL_INSERTED=0

for deal_type in "${DEAL_TYPES[@]}"; do
  echo ""
  echo "--- Processing: ${deal_type} deals ---"

  for page in $(seq 0 $((MAX_PAGES - 1))); do
    result=$(curl -s -X POST "${BASE_URL}/api/deals/backfill-8k?dealType=${deal_type}&page=${page}" \
      -H "Authorization: Bearer ${ADMIN_KEY}" 2>&1)

    # Parse results
    inserted=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('inserted',0))" 2>/dev/null || echo "err")
    total=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalAvailable',0))" 2>/dev/null || echo "?")
    fetched=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('fetched',0))" 2>/dev/null || echo "?")
    extracted=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('extracted',0))" 2>/dev/null || echo "?")
    ta_info=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin).get('byTA',{}); print(', '.join(f'{k}:{v}' for k,v in d.items()) if d else '-')" 2>/dev/null || echo "?")

    if [ "$inserted" = "err" ]; then
      echo "  Page ${page}: ERROR (timeout or deploy issue)"
      sleep 5
      continue
    fi

    TOTAL_INSERTED=$((TOTAL_INSERTED + inserted))
    echo "  Page ${page}/${total}: fetched=${fetched}, extracted=${extracted}, inserted=${inserted} [${ta_info}] (total so far: ${TOTAL_INSERTED})"

    # If no more filings to process, move to next deal type
    if [ "$fetched" = "0" ]; then
      echo "  No more filings to process for ${deal_type}"
      break
    fi

    # Brief pause between API calls
    sleep 3
  done
done

echo ""
echo "=========================================="
echo "BACKFILL COMPLETE"
echo "Total new deals inserted: ${TOTAL_INSERTED}"
echo "=========================================="

# Show updated TA distribution
echo ""
echo "Run this to check updated distribution:"
echo "  curl -s '${BASE_URL}/api/deals/debug' -H 'Authorization: Bearer ${ADMIN_KEY}' | python3 -m json.tool"
