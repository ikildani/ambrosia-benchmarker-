# QA/QC/Security/Performance Review - Implementation Plan

## Critical Bug Fixes

### 1. Fix Race Condition: Pro Users Seeing "Upgrade to Pro" Messages
**Root Cause**: In `AuthContext.tsx`, `setIsLoading(false)` fires at line 211 BEFORE the async tier database query resolves (lines 195-205). Components render with `tier='free'` (the default state from line 109), so API calls are made with the wrong tier. By the time the tier query resolves, the damage is done.

**Files**: `contexts/AuthContext.tsx`

**Fix**: Await the tier query BEFORE setting `isLoading` to false. Move `setIsLoading(false)` inside the `.then()` callback (after tier is resolved) and add it to the `.catch()` as well. This ensures components don't render until the tier is known. Apply this fix to both the initial `getSession()` flow (lines 195-211) and the `onAuthStateChange` SIGNED_IN flow (lines 247-259).

### 2. Add Timeouts to All AI Generation Fetches
**Root Cause**: Several AI endpoints lack timeouts, causing requests to hang indefinitely.

**Missing timeouts**:
- `components/benchmarker/OutreachEmailModal.tsx` - email generation fetch (line 58): NO TIMEOUT
- `components/ReportGenerationModal.tsx` - deal memo fetch (line 190): NO TIMEOUT
- `components/ReportGenerationModal.tsx` - playbook fetch (line 215): NO TIMEOUT
- `components/PartnerMatchesContainer.tsx` - partner match fetch (line 74): NO TIMEOUT

**Fix**: Add AbortController with appropriate timeouts:
- OutreachEmailModal: 60s timeout (same as playbook, these are AI-generated)
- ReportGenerationModal memo fetch: 90s timeout (memo generation can be slow)
- ReportGenerationModal playbook fetch: 90s timeout
- PartnerMatchesContainer: 30s timeout (not AI-generated, just database query)

### 3. Fix Silent Error Swallowing in ReportGenerationModal
**Root Cause**: When deal memo or playbook fetch fails in `ReportGenerationModal.tsx`, errors are silently caught (lines 209-212, 244-247) and return null. The user only sees "Compilation skipped" with no explanation of why their deal memo failed.

**Fix**: When memo/playbook fetch fails, set a visible warning state so the user knows what happened. Use the existing `canSkipMemo` pattern to show "Memo generation failed — the report will be generated without the AI deal memo" with a retry option.

## Performance Improvements

### 4. Use `fetchWithTimeout` Utility Consistently
**Root Cause**: A well-built `fetchWithTimeout` utility exists at `lib/fetch-with-timeout.ts` with timeout + exponential backoff retry, but it's only used in `NegotiationPlaybookModal`. All other fetch calls roll their own or have none.

**Fix**: Replace raw `fetch()` calls with `fetchWithTimeout()` in:
- `OutreachEmailModal.tsx` (line 58)
- `PartnerMatchesContainer.tsx` (line 74)

Note: ReportGenerationModal memo/playbook fetches are in a parallel pipeline with custom abort logic, so they should use plain AbortController rather than the utility (which has its own retry logic that could conflict with the pipeline).

## Security Fixes

### 5. Sanitize innerHTML Assignment in ReportGenerationModal
**Root Cause**: Line 328 in `ReportGenerationModal.tsx` uses `hiddenContainerRef.current.innerHTML = html` which is a potential XSS vector. While the HTML comes from `generateReportHTML()` (an internal function), the data fed into it includes user-supplied inputs (company names, indication names, etc.) that could contain script injection.

**Fix**: Sanitize the HTML before setting innerHTML. Use DOMPurify or a lightweight sanitizer function. Since this is a hidden container used only for PDF rendering, we can strip all script tags and event handlers.

### 6. Prevent Error Message Information Leakage
**Root Cause**: API error responses expose internal details:
- `deal-memo/route.ts` line 122: `Generation failed: ${errorMessage.slice(0, 100)}` leaks internal error messages
- `playbook/route.ts` line 134: Same pattern
- `partners/outreach/route.ts` line 192: Same pattern

**Fix**: Return generic error messages to the client while logging detailed errors server-side. Replace `Generation failed: ${errorMessage}` with a static "Generation failed. Please try again." for all three endpoints. The detailed error is already logged via `captureApiError()`.

### 7. Add Timeout to Email Report Send
**Root Cause**: `ReportGenerationModal.tsx` `handleEmailReport` (line 459) sends a fetch to `/api/report/email` with no timeout. Large PDF base64 payloads could hang.

**Fix**: Add a 30s timeout via AbortController.

## Error Handling Improvements

### 8. Show User-Facing Error Feedback for Email Send Failure
**Root Cause**: `ReportGenerationModal.tsx` lines 472-474 log email send failures to console but show no user feedback.

**Fix**: Add an `emailError` state and show a toast/inline error when email sending fails.

### 9. Improve Outreach Endpoint Error Response for Pro Users Getting Wrongly Gated
**Root Cause**: When the race condition (fix #1) causes a pro user to be treated as free, the error message says "Upgrade to Pro" which is confusing. Even after fix #1, edge cases could remain.

**Fix**: In `ScoreBreakdown.tsx` and `OutreachEmailModal.tsx`, when `upgrade_required` is true, check the local tier state. If the user's context tier is 'pro' or 'report', show a different message: "Verification error — please refresh the page and try again" instead of "Upgrade to Pro".

## Summary of Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `contexts/AuthContext.tsx` | Fix tier loading race condition |
| 2 | `components/benchmarker/OutreachEmailModal.tsx` | Add timeout, improve error for pro users |
| 3 | `components/ReportGenerationModal.tsx` | Add timeouts to memo/playbook fetches, sanitize innerHTML, add email error state, add timeout to email send |
| 4 | `components/PartnerMatchesContainer.tsx` | Add timeout to partner match fetch |
| 5 | `components/benchmarker/ScoreBreakdown.tsx` | Improve error message for pro users |
| 6 | `app/api/deal-memo/route.ts` | Sanitize error response |
| 7 | `app/api/playbook/route.ts` | Sanitize error response |
| 8 | `app/api/partners/outreach/route.ts` | Sanitize error response |
