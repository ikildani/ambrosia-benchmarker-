import { briefInvoiceCopy, BRIEF_INVOICE_DAYS_UNTIL_DUE } from '@/lib/brief/invoice';

describe('brief invoice copy', () => {
  const row = { asset_name: 'AMB-201', indication: "Alzheimer's Disease", phase: 'Preclinical', company: 'Example Biotech', po_number: 'PO-4471' };
  it('names the asset on the line item and prints the wire details in the footer', () => {
    const c = briefInvoiceCopy(row, 'Wire / ACH: First Bank · Account name: Ambrosia Ventures LLC · Routing 000000000 · Account 111111111');
    expect(c.lineItem).toBe("Deal Intelligence Brief — AMB-201 (Alzheimer's Disease, Preclinical)");
    expect(c.footer).toContain(`Payable within ${BRIEF_INVOICE_DAYS_UNTIL_DUE} days`);
    expect(c.footer).toContain('Routing 000000000');
    expect(c.footer).toContain('credited in full');
    expect(c.customFields).toEqual([{ name: 'PO number', value: 'PO-4471' }]);
  });
  it('omits the wire block when no instructions are configured, and the PO field when none was given', () => {
    const c = briefInvoiceCopy({ ...row, po_number: null }, null);
    expect(c.footer).not.toContain('Routing');
    expect(c.footer).toContain('wire / ACH');
    expect(c.customFields).toEqual([]);
  });
});
