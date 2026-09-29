import { answeredDimensions, parseMandateText, suggestMandateName } from '@/lib/radar/client/intent-parse';
import { radarLabel } from '@/lib/radar/vocab';

describe('parseMandateText', () => {
  it('reads a full BD brief', () => {
    const r = parseMandateText('Phase 2 ADCs in solid tumors from Korea or Japan with ex-Asia rights, unpartnered');
    expect(r.filters.ta).toEqual(['oncology']);
    expect(r.filters.modality).toEqual(['adc']);
    expect(r.filters.phase_min).toBe('phase_2');
    expect(r.filters.phase_max).toBe('phase_2');
    expect(r.filters.country.sort()).toEqual(['JP', 'KR']);
    expect(r.filters.rights).toEqual(['us', 'eu', 'row']);
    expect(r.filters.partnership).toEqual(['unpartnered']);
    expect(r.leftover).toBe('');
  });

  it('handles phase ranges, sub-phases and open ranges', () => {
    let f = parseMandateText('phase 1/2 bispecifics').filters;
    expect([f.phase_min, f.phase_max]).toEqual(['phase_1', 'phase_2']);
    f = parseMandateText('P2-3 obesity peptides').filters;
    expect([f.phase_min, f.phase_max]).toEqual(['phase_2', 'phase_3']);
    expect(f.ta).toEqual(['metabolic']);
    expect(f.modality).toEqual(['peptide']);
    f = parseMandateText('phase 2+ immunology').filters;
    expect([f.phase_min, f.phase_max]).toEqual(['phase_2', 'phase_3']);
    f = parseMandateText('preclinical gene therapy for rare disease').filters;
    expect([f.phase_min, f.phase_max]).toEqual(['preclinical', 'preclinical']);
    expect(f.modality).toEqual(['gene_therapy']);
    expect(f.ta).toEqual(['rare_disease']);
    f = parseMandateText('late-stage cardiovascular').filters;
    expect([f.phase_min, f.phase_max]).toEqual(['phase_2_3', 'phase_3']);
  });

  it('does not read ex-China as China, and keeps country over its region', () => {
    const f = parseMandateText('Chinese CAR-T with ex-China rights').filters;
    expect(f.country).toEqual(['CN']);
    expect(f.rights).toEqual(['us', 'eu', 'japan', 'row']);
    expect(f.modality).toEqual(['car_t']);
    expect(f.region).toEqual([]);
  });

  it('reads academic sources and worldwide rights', () => {
    const f = parseMandateText('academic siRNA programs, worldwide rights, europe').filters;
    expect(f.owner_type).toEqual(['academic', 'hospital']);
    expect(f.modality).toEqual(['oligonucleotide']);
    expect(f.rights).toEqual(['global']);
    expect(f.region).toEqual(['europe']);
  });

  it('keeps unknown words as leftover text', () => {
    const r = parseMandateText('KRAS G12D oncology');
    expect(r.filters.ta).toEqual(['oncology']);
    expect(r.leftover).toBe('KRAS G12D');
  });

  it('reports answered dimensions and suggests a name', () => {
    const f = parseMandateText('phase 2 ADCs in oncology from Korea').filters;
    expect([...answeredDimensions(f)].sort()).toEqual(['modality', 'phase', 'region', 'ta']);
    expect(suggestMandateName(f, v => radarLabel(v))).toBe('Oncology · Antibody-Drug Conjugate · Phase 2 · KR');
  });
});
