/**
 * Onboarding Test Script
 * Run this in your browser console on http://localhost:3000/calculator
 *
 * Testing Checklist:
 *
 * 1. FIRST-TIME USER TEST
 *    - Run: localStorage.removeItem('deal_calculator_onboarding')
 *    - Refresh page
 *    - Expected: Modal appears after ~500ms
 *
 * 2. STEP NAVIGATION TEST
 *    - Click "Show me how it works" → Step 2 (Big Three)
 *    - Asset Details section should have teal spotlight glow
 *    - Click "Next" → Step 3 (Value Modifiers)
 *    - Competitive Landscape section should have teal spotlight glow
 *    - Click "Next" → Step 4 (Ready)
 *    - Click "Start calculating" → Modal closes
 *
 * 3. PERSISTENCE TEST
 *    - After completing, refresh page
 *    - Expected: Modal should NOT appear
 *    - Check: localStorage.getItem('deal_calculator_onboarding')
 *    - Should show: {"completed":true,"skipped":false,"completedAt":"...","version":1}
 *
 * 4. SKIP TEST
 *    - Run: localStorage.removeItem('deal_calculator_onboarding')
 *    - Refresh, click "Skip tutorial"
 *    - Refresh again
 *    - Expected: Modal should NOT appear
 *
 * 5. KEYBOARD TEST
 *    - Open modal
 *    - Press Escape → Modal should close
 *    - Press Tab → Focus should cycle within modal
 *
 * 6. MOBILE TEST
 *    - Open DevTools, toggle device toolbar
 *    - Test on iPhone/Android viewport
 *    - Modal should appear as bottom sheet
 *    - All buttons should be touch-friendly
 */

// Helper functions for testing in browser console
window.testOnboarding = {
  reset: () => {
    localStorage.removeItem('deal_calculator_onboarding');
    console.log('Onboarding state reset. Refresh the page.');
  },

  check: () => {
    const state = localStorage.getItem('deal_calculator_onboarding');
    console.log('Onboarding state:', state ? JSON.parse(state) : 'Not set');
  },

  complete: () => {
    localStorage.setItem('deal_calculator_onboarding', JSON.stringify({
      completed: true,
      skipped: false,
      completedAt: new Date().toISOString(),
      version: 1
    }));
    console.log('Onboarding marked as complete. Refresh to verify.');
  }
};

console.log(`
╔════════════════════════════════════════════════════════════╗
║           ONBOARDING TEST HELPERS LOADED                   ║
╠════════════════════════════════════════════════════════════╣
║  testOnboarding.reset()    - Clear onboarding state        ║
║  testOnboarding.check()    - View current state            ║
║  testOnboarding.complete() - Mark as completed             ║
╚════════════════════════════════════════════════════════════╝
`);
