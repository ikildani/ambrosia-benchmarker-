import { aiBudgetMode, budgetCap, budgetModel, leanSkip } from '@/lib/ai/budget';

const lean = {} as NodeJS.ProcessEnv;
const full = { AI_BUDGET_MODE: 'full' } as NodeJS.ProcessEnv;

describe('AI budget mode', () => {
  it('defaults to lean and switches with AI_BUDGET_MODE=full', () => {
    expect(aiBudgetMode(lean)).toBe('lean');
    expect(aiBudgetMode(full)).toBe('full');
    expect(aiBudgetMode({ AI_BUDGET_MODE: ' FULL ' } as NodeJS.ProcessEnv)).toBe('full');
  });
  it('picks the lean model unless overridden', () => {
    expect(budgetModel(undefined, 'claude-opus-4-6', 'claude-sonnet-5', lean)).toBe('claude-sonnet-5');
    expect(budgetModel(undefined, 'claude-opus-4-6', 'claude-sonnet-5', full)).toBe('claude-opus-4-6');
    expect(budgetModel('claude-haiku-4-5', 'claude-opus-4-6', 'claude-sonnet-5', lean)).toBe('claude-haiku-4-5');
  });
  it('bounds caps in lean mode and keeps explicit values in full mode', () => {
    expect(budgetCap(undefined, 5, 1, lean)).toBe(1);
    expect(budgetCap('10', 3, 1, lean)).toBe(1);
    expect(budgetCap('0.5', 3, 1, lean)).toBe(0.5);
    expect(budgetCap('10', 3, 1, full)).toBe(10);
    expect(budgetCap(undefined, 5, 1, full)).toBe(5);
  });
  it('skips all but every Nth hour in lean mode only', () => {
    expect(leanSkip(new Date('2026-09-29T12:00:00Z'), 12, lean)).toBe(false);
    expect(leanSkip(new Date('2026-09-29T04:00:00Z'), 12, lean)).toBe(true);
    expect(leanSkip(new Date('2026-09-29T04:00:00Z'), 12, full)).toBe(false);
  });
});
