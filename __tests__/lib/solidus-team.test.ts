import { parseArgs, TEAM_PLAN } from '../../scripts/solidus-team';

describe('solidus-team parseArgs', () => {
  const base = ['--company', 'VMG Health', '--billing-email', 'AP@Example.com', '--seats', 'a@x.com, B@x.com'];

  it('parses and lowercases; dry run by default', () => {
    const a = parseArgs(base);
    expect(a).toEqual({ company: 'VMG Health', billingEmail: 'ap@example.com', seats: ['a@x.com', 'b@x.com'], invoice: false, apply: false });
  });

  it('reads --invoice and --apply', () => {
    const a = parseArgs([...base, '--invoice', '--apply']);
    expect(a.invoice).toBe(true);
    expect(a.apply).toBe(true);
  });

  it(`rejects more than ${TEAM_PLAN.maxSeats} seats, duplicates, bad emails and missing fields`, () => {
    expect(() => parseArgs(['--company', 'X', '--billing-email', 'a@x.com', '--seats', '1@x.com,2@x.com,3@x.com,4@x.com,5@x.com,6@x.com'])).toThrow(/up to 5/);
    expect(() => parseArgs(['--company', 'X', '--billing-email', 'a@x.com', '--seats', '1@x.com,1@x.com'])).toThrow(/Duplicate/);
    expect(() => parseArgs(['--company', 'X', '--billing-email', 'nope', '--seats', '1@x.com'])).toThrow(/Invalid/);
    expect(() => parseArgs(['--company', 'X'])).toThrow(/Usage/);
  });
});
