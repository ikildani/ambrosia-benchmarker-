import { classifyJunk, isFundingSentence, isPersonName } from '@/lib/entities/junk-companies';

describe('isFundingSentence', () => {
  it.each([
    'Peginterferon supplied free of charge from Roche Pharmaceuticals.',
    'Antibiotics provided by CSL Ltd',
    'Roche Pharmaceuticals Research Grant',
    'Record Provided by the NHSTCT Register - 2006 Update - Department of Health',
    'Sponsor not defined - Record provided by the Medical Research Council',
    'Unrestricted educational grant from Allergan, Ltd',
    'Novartis Oncology (Switzerland); Grant Codes: CICL670AGB05T',
    "Pfizer's Upjohn has merged with Mylan to form Viatris Inc.",
    'Wyeth is now a wholly owned subsidiary of Pfizer',
    'The coffee to be tested is offered by A. Morettino s.p.a., Palermo',
    'Investigator initiated study - no extra funding required as Sub',
    'No grant nor payment from the pharmaceutical industry.',
    'UCB Pharma will provide levetiracetam and an EEG (Belgium)',
  ])('%s', name => {
    expect(isFundingSentence(name)).toBe(true);
  });

  it.each([
    'Campbell Grant',
    'Grant Jones',
    'David Grant U.S. Air Force Medical Center',
    'The Grant Medical College & Sir J.J. Group of Hospitals',
    'Rempex Pharmaceuticals (a wholly owned subsidiary of The Medicines Company)',
    'Regeneron Pharmaceuticals, Inc.',
    'Integrant Pty Ltd',
    'Fragrantia Investments (Australia)',
    'Odonate Therapeutics, Inc.',
    'European Foundation for the Study of Diabetes',
    'Institute for the Study of Aging (USA)',
    'DHA Coffee Co., Ltd',
    'The Pharmaceutical Company LEK-AM Sp. Zoo.',
  ])('%s is not a sentence', name => {
    expect(isFundingSentence(name)).toBe(false);
  });
});

describe('isPersonName', () => {
  it.each(['Amit Malhotra, MD', 'Dr François Bissonnette', 'Prof. Kristian Reich', 'Kenneth Krantz, MD, PhD', 'Jason Ahee, M.D.', 'Mónica Olivares Martín; PhD', 'Dr. Md. Alimur Reza'])(
    '%s',
    name => {
      expect(isPersonName(name)).toBe(true);
    },
  );

  it.each([
    'Dr. Falk Pharma GmbH',
    'Dr Reddy\'s Laboratories',
    'Dr. Willmar Schwabe GmbH & Co. KG',
    'Dr. Frank Arguello Cancer Clinic',
    'Prof. Franciszek Lukaszczyk Memorial Oncology Center',
    'Dr. John A. Thiel Medical Professional Corporation',
    'Regeneron',
    'MD Scientific',
    "Dr. Reddy's",
    'Dr. Ferrer BioPharma',
    'Dr Willmar Schwabe (Germany)',
  ])('%s is not a person', name => {
    expect(isPersonName(name)).toBe(false);
  });
});

describe('classifyJunk', () => {
  it('orders sentence before person and returns null otherwise', () => {
    expect(classifyJunk('Dr. Grant M. Pagdin')).toBe('person');
    expect(classifyJunk('Merck & Co. Inc. (USA) - unrestricted grant')).toBe('funding_sentence');
    expect(classifyJunk('Pfizer')).toBeNull();
  });
});
