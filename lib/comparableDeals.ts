// Comparable deal references for PDF/Excel reports
// Data sourced from publicly disclosed deal terms (2017-2026)
// Includes extended deals covering CV, ID, ophthalmology, women's health,
// rare disease, hematology, dermatology, gastroenterology,
// combination therapy, and geographic-specific transactions.

import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';

export interface ComparableDeal {
  licensor: string;
  licensee: string;
  value: string;
  year: number;
  relevance: string;
  modalities?: string[];
  indications?: string[];
  therapeuticArea: 'oncology' | 'neurology' | 'immunology' | 'metabolic' | 'cardiovascular' | 'infectiousDisease' | 'ophthalmology' | 'womensHealth' | 'rareDisease' | 'hematology' | 'dermatology' | 'gastroenterology' | 'both';
}

export const COMPARABLE_DEALS: ComparableDeal[] = [
  // Oncology
  { licensor: 'Seagen', licensee: 'Pfizer', value: '$43B', year: 2023, relevance: 'ADC platform acquisition', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'RayzeBio', licensee: 'BMS', value: '$4.1B', year: 2024, relevance: 'Radiopharmaceutical acquisition', modalities: ['radiopharmaceutical'], therapeuticArea: 'oncology' },
  { licensor: 'Point Biopharma', licensee: 'Eli Lilly', value: '$4.9B', year: 2023, relevance: 'Radiopharmaceutical platform', modalities: ['radiopharmaceutical'], therapeuticArea: 'oncology' },
  { licensor: 'Daiichi Sankyo', licensee: 'Merck', value: '$22B', year: 2023, relevance: 'ADC co-development (3 assets)', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'Mirati Therapeutics', licensee: 'BMS', value: '$4.8B', year: 2024, relevance: 'Small molecule (KRAS)', modalities: ['smallMolecule'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'GSK', licensee: 'N/A (standalone)', value: '$2B+ revenue', year: 2024, relevance: 'Dostarlimab PD-1 in endometrial/MSI-H', modalities: ['mab'], indications: ['endometrial'], therapeuticArea: 'oncology' },
  { licensor: 'Genmab/Seagen', licensee: 'Pfizer', value: '$1.6B milestone', year: 2024, relevance: 'Tisotumab vedotin ADC for cervical', modalities: ['adc'], indications: ['cervical'], therapeuticArea: 'oncology' },
  { licensor: 'Blueprint Medicines', licensee: 'Roche', value: '$1.7B', year: 2023, relevance: 'RET inhibitor (pralsetinib) - thyroid and lung', modalities: ['smallMolecule'], indications: ['thyroid', 'lung_nsclc'], therapeuticArea: 'oncology' },
  // Neurology
  { licensor: 'Karuna Therapeutics', licensee: 'BMS', value: '$14B', year: 2024, relevance: 'Schizophrenia (KarXT/Cobenfy)', modalities: ['smallMolecule'], indications: ['schizophrenia'], therapeuticArea: 'neurology' },
  { licensor: 'Cerevel Therapeutics', licensee: 'AbbVie', value: '$8.7B', year: 2024, relevance: 'CNS pipeline acquisition', indications: ['schizophrenia', 'parkinsons'], therapeuticArea: 'neurology' },
  { licensor: 'JCR Pharmaceuticals', licensee: 'AstraZeneca', value: '$825M', year: 2024, relevance: 'BBB delivery platform', modalities: ['bbbPlatform'], therapeuticArea: 'neurology' },
  { licensor: 'ABL Bio', licensee: 'GSK', value: '$2.7B', year: 2024, relevance: 'BBB bispecific platform', modalities: ['bbbPlatform', 'bispecific'], therapeuticArea: 'neurology' },
  { licensor: 'Gilgamesh', licensee: 'AbbVie', value: '$1.2B', year: 2024, relevance: 'Neuroplastogen (Phase 2)', modalities: ['psychedelic'], indications: ['depression'], therapeuticArea: 'neurology' },
  { licensor: 'PTC Therapeutics', licensee: 'Novartis', value: '$1B upfront', year: 2024, relevance: "Huntington's gene therapy", modalities: ['geneTherapy'], indications: ['huntingtons'], therapeuticArea: 'neurology' },
  { licensor: 'Ionis/Biogen', licensee: 'N/A', value: '$1.8B+ revenue', year: 2024, relevance: 'ASO in rare neuro (tofersen/SOD1 ALS)', modalities: ['aso'], indications: ['als'], therapeuticArea: 'neurology' },
  { licensor: 'Acadia Pharmaceuticals', licensee: 'N/A (standalone)', value: '$3B+ market cap', year: 2023, relevance: 'Trofinetide (Daybue) first approved Rett therapy', modalities: ['peptide'], indications: ['rett'], therapeuticArea: 'neurology' },
  { licensor: 'Sarepta Therapeutics', licensee: 'Roche', value: '$1.5B upfront', year: 2024, relevance: 'Gene therapy for DMD (delandistrogene)', modalities: ['geneTherapy'], indications: ['dmd'], therapeuticArea: 'neurology' },
  { licensor: 'Compass Pathways', licensee: 'N/A (standalone)', value: '$1B+ market cap', year: 2024, relevance: 'Psilocybin therapy PTSD/depression', modalities: ['psychedelic'], indications: ['ptsd', 'depression'], therapeuticArea: 'neurology' },
  { licensor: 'Intra-Cellular', licensee: 'Johnson & Johnson', value: '$14.6B', year: 2025, relevance: 'J&J acquisition for CAPLYTA (bipolar/schizophrenia)', modalities: ['smallMolecule'], indications: ['bipolar', 'schizophrenia'], therapeuticArea: 'neurology' },
  // Immunology / Autoimmune
  { licensor: 'Prometheus Biosciences', licensee: 'Merck', value: '$10.8B', year: 2023, relevance: 'Anti-TL1A (IBD)', modalities: ['tl1aInhibitor'], indications: ['crohns', 'ulcerativeColitis'], therapeuticArea: 'immunology' },
  { licensor: 'Telavant', licensee: 'Roche', value: '$7.1B', year: 2023, relevance: 'Anti-TL1A (IBD)', modalities: ['tl1aInhibitor'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
  { licensor: 'Arena Pharmaceuticals', licensee: 'Pfizer', value: '$6.7B', year: 2022, relevance: 'S1P modulator (UC)', modalities: ['s1pModulator'], indications: ['ulcerativeColitis'], therapeuticArea: 'immunology' },
  { licensor: 'Momenta Pharmaceuticals', licensee: 'J&J', value: '$6.5B', year: 2020, relevance: 'FcRn antagonist (MG, HDFN)', modalities: ['fcrnAntagonist'], indications: ['myastheniaGravis'], therapeuticArea: 'immunology' },
  { licensor: 'Alpine Immune Sciences', licensee: 'Vertex', value: '$4.9B', year: 2024, relevance: 'BAFF/APRIL dual antagonist (IgAN)', modalities: ['dualAntagonist'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Galapagos', licensee: 'Gilead', value: '$5.1B', year: 2019, relevance: 'JAK1 inhibitor (RA, IBD)', modalities: ['jakInhibitor'], indications: ['rheumatoidArthritis', 'ibd_broad'], therapeuticArea: 'immunology' },
  { licensor: 'Morphic Therapeutic', licensee: 'Eli Lilly', value: '$3.2B', year: 2024, relevance: 'Oral integrin inhibitor (IBD)', modalities: ['oralIntegrin'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
  { licensor: 'ChemoCentryx', licensee: 'Amgen', value: '$3.7B', year: 2022, relevance: 'C5aR inhibitor (vasculitis)', modalities: ['complementInhibitor'], indications: ['aancaVasculitis'], therapeuticArea: 'immunology' },
  { licensor: 'Capstan Therapeutics', licensee: 'AbbVie', value: '$2.1B', year: 2025, relevance: 'In vivo CAR-T (autoimmune)', modalities: ['inVivoCarT'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Dren Bio', licensee: 'Sanofi', value: '$1.9B', year: 2024, relevance: 'Bispecific myeloid engager (lupus)', modalities: ['bispecific'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Ventyx Biosciences', licensee: 'Eli Lilly', value: '$1.2B', year: 2024, relevance: 'TYK2+S1P dual (Crohn\'s, psoriasis)', modalities: ['jakInhibitor', 's1pModulator'], indications: ['crohns', 'psoriasis'], therapeuticArea: 'immunology' },
  { licensor: 'HI-Bio', licensee: 'Biogen', value: '$1.8B', year: 2024, relevance: 'Anti-CD38 (IgAN, AMR)', modalities: ['mab'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Harbour BioMed', licensee: 'AstraZeneca', value: '$4.575B', year: 2024, relevance: 'Bispecific platform (autoimmune)', modalities: ['bispecific'], therapeuticArea: 'immunology' },
  { licensor: 'Earendil Labs', licensee: 'Sanofi', value: '$2.56B', year: 2025, relevance: 'AI-designed bispecifics (IBD)', modalities: ['bispecific'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
  { licensor: 'RemeGen', licensee: 'Vor Bio', value: '$4B+', year: 2025, relevance: 'BAFF/APRIL (MG, SLE, RA)', modalities: ['dualAntagonist'], indications: ['myastheniaGravis', 'sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Sanofi', licensee: 'N/A (standalone)', value: '$13B+ Dupixent revenue', year: 2024, relevance: 'IL-4/13 mAb for asthma, EoE, AD', modalities: ['mab'], indications: ['asthma', 'eosinophilicEsophagitis', 'atopicderm'], therapeuticArea: 'immunology' },
  { licensor: 'Horizon Therapeutics', licensee: 'Amgen', value: '$27.8B', year: 2023, relevance: 'Tepezza (thyroid eye disease) + rare portfolio', modalities: ['mab'], indications: ['thyroidEye', 'gout'], therapeuticArea: 'immunology' },
  { licensor: 'Incyte', licensee: 'N/A (standalone)', value: '$1.2B Jakafi', year: 2024, relevance: 'JAK inhibitor ruxolitinib (GVHD approval)', modalities: ['jakInhibitor'], indications: ['gvhd'], therapeuticArea: 'immunology' },
  { licensor: 'Chinook Therapeutics', licensee: 'Novartis', value: '$3.5B', year: 2023, relevance: 'BAFF/APRIL atralisimab for IgAN and lupus nephritis', modalities: ['dualAntagonist'], indications: ['igan', 'lupusNephritis'], therapeuticArea: 'immunology' },
  { licensor: 'Ipsen', licensee: 'Genfit', value: '$480M', year: 2024, relevance: 'Elafibranor PPAR agonist for PBC', modalities: ['smallMolecule'], indications: ['pbc'], therapeuticArea: 'immunology' },
  // Metabolic / Obesity
  { licensor: 'Carmot Therapeutics', licensee: 'Roche', value: '$2.7B', year: 2023, relevance: 'GLP-1R/GCGR/FGF21 obesity pipeline acquisition', modalities: ['glp1Agonist', 'tripleIncretin'], indications: ['obesity', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Inversago Pharma', licensee: 'Novo Nordisk', value: '$1.075B', year: 2023, relevance: 'CB1 inverse agonist for obesity', modalities: ['smallMolecule'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Scholar Rock', licensee: 'Eli Lilly', value: '$1.3B', year: 2024, relevance: 'Anti-activin muscle-sparing obesity apamistamab', modalities: ['antiActivin'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Akero Therapeutics', licensee: 'Novo Nordisk', value: '$1.4B', year: 2024, relevance: 'FGF21 analog efruxifermin for MASH', modalities: ['peptide'], indications: ['nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Terns Pharmaceuticals', licensee: 'Roche', value: '$2.1B', year: 2024, relevance: 'GLP-1R agonist for obesity and MASH', modalities: ['glp1Agonist'], indications: ['obesity', 'nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Zealand Pharma', licensee: 'Roche', value: '$5.3B', year: 2025, relevance: 'Amylin analog petrelintide for obesity partnership', modalities: ['amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Madrigal Pharmaceuticals', licensee: 'N/A (standalone)', value: '$7B+ market cap', year: 2024, relevance: 'First approved MASH drug (resmetirom/Rezdiffra)', modalities: ['smallMolecule'], indications: ['nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Gubra', licensee: 'AbbVie', value: '$2.2B', year: 2025, relevance: 'GLP-1/amylin dual agonist for obesity', modalities: ['dualIncretin', 'amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Provention Bio', licensee: 'Sanofi', value: '$2.9B', year: 2023, relevance: 'Teplizumab (Tzield) for T1D delay', modalities: ['mab'], indications: ['type1Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Bayer', licensee: 'N/A (standalone)', value: '$3.5B+ finerenone', year: 2024, relevance: 'Finerenone MRA for CKD in T2D', modalities: ['smallMolecule'], indications: ['ckdMetabolic', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'AstraZeneca', licensee: 'N/A (standalone)', value: '$4.5B Farxiga', year: 2024, relevance: 'SGLT2 inhibitor for HFpEF and CKD', modalities: ['sglt2Inhibitor'], indications: ['hfpef', 'ckdMetabolic'], therapeuticArea: 'metabolic' },
  { licensor: 'Novartis', licensee: 'N/A (standalone)', value: '$2B+ inclisiran', year: 2024, relevance: 'siRNA PCSK9 for familial hypercholesterolemia', modalities: ['rnai'], indications: ['familialHypercholesterolemia'], therapeuticArea: 'metabolic' },
  { licensor: 'Ultragenyx', licensee: 'N/A (standalone)', value: '$800M+ Crysvita', year: 2024, relevance: 'FGF23 antibody for rare metabolic (XLH)', indications: ['rareMetabolic'], therapeuticArea: 'metabolic' },
  { licensor: '4D Molecular Therapeutics', licensee: 'Bayer', value: '$1.5B', year: 2024, relevance: 'AAV gene therapy for Fabry disease', modalities: ['geneTherapy'], indications: ['fabry'], therapeuticArea: 'metabolic' },
  // 2023-2025 Additional Oncology
  { licensor: 'SpringWorks Therapeutics', licensee: 'Pfizer', value: '$7.5B', year: 2023, relevance: 'Nirogacestat/gamma-secretase inhibitor (desmoid tumors)', modalities: ['smallMolecule'], indications: ['sarcoma'], therapeuticArea: 'oncology' },
  { licensor: 'Summit Therapeutics', licensee: 'Akeso', value: '$5B', year: 2025, relevance: 'PD-1/VEGF bispecific ivonescimab US rights (NSCLC)', modalities: ['bispecific'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  // Rare Disease
  { licensor: 'Alexion', licensee: 'AstraZeneca', value: '$39B', year: 2021, relevance: 'Complement franchise acquisition (Soliris/Ultomiris) (acquisition)', modalities: ['complementInhibitor'], indications: ['pnh', 'rareAutoimmune'], therapeuticArea: 'immunology' },
  { licensor: 'BioMarin', licensee: 'N/A (standalone)', value: '$4.8B+ revenue', year: 2024, relevance: 'Rare disease portfolio (Vimizim, Naglazyme, Palynziq, Roctavian)', modalities: ['enzymeReplacement', 'geneTherapy'], indications: ['mpsDisorders', 'pku'], therapeuticArea: 'rareDisease' },
  { licensor: 'Sarepta Therapeutics', licensee: 'Roche', value: '$1.5B upfront', year: 2019, relevance: 'Gene therapy co-development for DMD (SRP-9001/delandistrogene)', modalities: ['geneTherapy'], indications: ['dmd'], therapeuticArea: 'rareDisease' },
  { licensor: 'Alnylam Pharmaceuticals', licensee: 'Roche', value: '$310M upfront + $2.2B milestones', year: 2024, relevance: 'RNAi therapeutics for complement-mediated diseases', modalities: ['rnai'], indications: ['pnh', 'igan'], therapeuticArea: 'immunology' },
  { licensor: 'Ultragenyx', licensee: 'N/A (standalone)', value: '$800M+ Crysvita', year: 2024, relevance: 'FGF23 antibody burosumab for X-linked hypophosphatemia', modalities: ['mab'], indications: ['rareMetabolic'], therapeuticArea: 'rareDisease' },
  { licensor: 'Vertex Pharmaceuticals', licensee: 'CRISPR Therapeutics', value: '$900M upfront', year: 2023, relevance: 'Casgevy (exa-cel) first approved CRISPR gene therapy for SCD/TDT', modalities: ['geneTherapyRare'], indications: ['sickleCell', 'betaThalassemia'], therapeuticArea: 'rareDisease' },
  { licensor: 'Takeda', licensee: 'N/A (standalone)', value: '$6.5B+ rare disease revenue', year: 2024, relevance: 'Rare disease franchise (TAK-755 TTP, HAE, Hunter/Fabry enzyme replacement)', modalities: ['enzymeReplacement', 'mab'], indications: ['rareAutoimmune', 'fabryDisease', 'mpsDisorders'], therapeuticArea: 'rareDisease' },
  { licensor: 'Ionis Pharmaceuticals', licensee: 'Biogen', value: '$2.6B', year: 2018, relevance: 'Spinraza (nusinersen) ASO collaboration for SMA', modalities: ['aso'], indications: ['spinalMuscularAtrophy'], therapeuticArea: 'rareDisease' },
  { licensor: 'Amicus Therapeutics', licensee: 'N/A (standalone)', value: '$3B+ market cap', year: 2024, relevance: 'Galafold (migalastat) oral chaperone for Fabry disease', modalities: ['smallMolecule'], indications: ['fabry'], therapeuticArea: 'rareDisease' },
  { licensor: 'Bluebird Bio', licensee: 'N/A (standalone)', value: '$2.8M price', year: 2023, relevance: 'Lenti-D (elivaldogene) gene therapy for cerebral adrenoleukodystrophy', modalities: ['geneTherapyRare'], indications: ['rareNeuro'], therapeuticArea: 'rareDisease' },
  { licensor: 'Argenx', licensee: 'N/A (standalone)', value: '$2B+ Vyvgart revenue', year: 2024, relevance: 'FcRn blocker efgartigimod for generalized myasthenia gravis', modalities: ['fcrnAntagonist'], indications: ['myastheniaGravis'], therapeuticArea: 'rareDisease' },
  { licensor: 'Regeneron', licensee: 'Alnylam', value: '$1B upfront + $400M equity', year: 2024, relevance: 'RNAi collaboration for cardiometabolic and neurological rare diseases', modalities: ['rnai'], indications: ['rareNeuro', 'cardiomyopathy'], therapeuticArea: 'rareDisease' },
  // Hematology
  { licensor: 'Celgene', licensee: 'BMS', value: '$74B', year: 2019, relevance: 'Revlimid, Pomalyst, Abraxane hematology franchise (acquisition)', modalities: ['smallMolecule'], indications: ['myeloma', 'mds'], therapeuticArea: 'hematology' },
  { licensor: 'Novartis', licensee: 'N/A (standalone)', value: '$5.4B Kymriah + Promacta', year: 2024, relevance: 'CAR-T (tisagenlecleucel) for ALL/DLBCL and Promacta for ITP', modalities: ['carT_heme', 'smallMolecule'], indications: ['all', 'dlbcl', 'itp'], therapeuticArea: 'hematology' },
  { licensor: 'Kite Pharma', licensee: 'Gilead', value: '$11.9B', year: 2017, relevance: 'CAR-T platform (Yescarta for DLBCL) (acquisition)', modalities: ['carT_heme'], indications: ['dlbcl', 'follicularLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'Juno Therapeutics', licensee: 'Celgene/BMS', value: '$9B', year: 2018, relevance: 'CAR-T (Breyanzi/lisocabtagene maraleucel) (acquisition)', modalities: ['carT_heme'], indications: ['dlbcl', 'mantleCellLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'Legend Biotech', licensee: 'Johnson & Johnson', value: '$350M upfront + milestones', year: 2017, relevance: 'BCMA CAR-T (Carvykti/ciltacabtagene autoleucel) for myeloma', modalities: ['carT_heme'], indications: ['myeloma'], therapeuticArea: 'hematology' },
  { licensor: 'BeiGene', licensee: 'N/A (standalone)', value: '$3.4B Brukinsa revenue', year: 2024, relevance: 'Zanubrutinib (Brukinsa) BTK inhibitor for CLL/MCL', modalities: ['smallMolecule'], indications: ['cll', 'mantleCellLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'AbbVie', licensee: 'N/A (standalone)', value: '$2.3B Venclexta revenue', year: 2024, relevance: 'Venetoclax (Venclexta) BCL-2 inhibitor for CLL/AML', modalities: ['smallMolecule'], indications: ['cll', 'aml'], therapeuticArea: 'hematology' },
  { licensor: 'Pfizer', licensee: 'Global Blood Therapeutics', value: '$5.4B', year: 2022, relevance: 'Oxbryta (voxelotor) in sickle cell disease (acquisition)', modalities: ['smallMolecule'], indications: ['sickleCell'], therapeuticArea: 'hematology' },
  { licensor: 'Syndax Pharmaceuticals', licensee: 'Incyte', value: '$1.4B', year: 2024, relevance: 'Revumenib (Augtyro) menin inhibitor collaboration for AML', modalities: ['smallMolecule'], indications: ['aml'], therapeuticArea: 'hematology' },
  { licensor: 'MorphoSys', licensee: 'Novartis', value: '$2.9B', year: 2024, relevance: 'Pelabresib BET inhibitor acquisition for myelofibrosis', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },
  { licensor: 'CTI BioPharma', licensee: 'Sobi', value: '$1.7B', year: 2023, relevance: 'Pacritinib (Vonjo) JAK2/IRAK1 inhibitor for myelofibrosis', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },
  { licensor: 'Blueprint Medicines', licensee: 'N/A (standalone)', value: '$1.2B Ayvakit revenue', year: 2024, relevance: 'Avapritinib (Ayvakit) KIT D816V inhibitor for systemic mastocytosis', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },
  // Dermatology
  { licensor: 'AbbVie', licensee: 'N/A (standalone)', value: '$8.2B Skyrizi revenue', year: 2024, relevance: 'Risankizumab (Skyrizi) IL-23 blockbuster for psoriasis', modalities: ['mab'], indications: ['psoriasis', 'psoriaticArthritis'], therapeuticArea: 'dermatology' },
  { licensor: 'AbbVie', licensee: 'N/A (standalone)', value: '$4.6B Rinvoq revenue', year: 2024, relevance: 'Upadacitinib (Rinvoq) JAK1 inhibitor for atopic dermatitis', modalities: ['jakInhibitorDerm'], indications: ['atopicderm', 'psoriasis'], therapeuticArea: 'dermatology' },
  { licensor: 'Eli Lilly', licensee: 'N/A (standalone)', value: '$2.8B Taltz revenue', year: 2024, relevance: 'Ixekizumab (Taltz) IL-17A inhibitor for psoriasis', modalities: ['mab'], indications: ['psoriasis', 'psoriaticArthritis'], therapeuticArea: 'dermatology' },
  { licensor: 'UCB', licensee: 'N/A (standalone)', value: '$1.4B Bimzelx revenue', year: 2024, relevance: 'Bimekizumab (Bimzelx) dual IL-17A/F inhibitor for psoriasis', modalities: ['mab'], indications: ['psoriasis', 'psoriaticArthritis'], therapeuticArea: 'dermatology' },
  { licensor: 'Arcutis Biotherapeutics', licensee: 'N/A (standalone)', value: '$1.2B market cap', year: 2023, relevance: 'Roflumilast cream (Zoryve) PDE4 inhibitor for psoriasis/AD', modalities: ['smallMolecule'], indications: ['psoriasis', 'atopicderm'], therapeuticArea: 'dermatology' },
  { licensor: 'Dermavant Sciences', licensee: 'N/A (standalone)', value: '$500M+ market cap', year: 2023, relevance: 'Tapinarof (Vtama) AhR agonist cream for psoriasis', modalities: ['smallMolecule'], indications: ['psoriasis', 'atopicderm'], therapeuticArea: 'dermatology' },
  { licensor: 'Leo Pharma', licensee: 'N/A (standalone)', value: '$1.6B Enstilar/Adtralza', year: 2024, relevance: 'Tralokinumab (Adtralza) IL-13 antibody for atopic dermatitis', modalities: ['mab'], indications: ['atopicderm'], therapeuticArea: 'dermatology' },
  { licensor: 'Sanofi/Regeneron', licensee: 'N/A (standalone)', value: '$13B+ Dupixent revenue', year: 2024, relevance: 'Dupilumab (Dupixent) IL-4/13 first-in-class for atopic dermatitis', modalities: ['mab'], indications: ['atopicderm', 'prurigo'], therapeuticArea: 'dermatology' },
  { licensor: 'Concert Pharmaceuticals', licensee: 'Sun Pharma', value: '$576M', year: 2023, relevance: 'Deuruxolitinib JAK inhibitor for alopecia areata acquisition', modalities: ['jakInhibitorDerm'], indications: ['alopeciaAreata'], therapeuticArea: 'dermatology' },
  { licensor: 'Eli Lilly', licensee: 'N/A (standalone)', value: '$1B+ Olumiant derm', year: 2024, relevance: 'Baricitinib (Olumiant) JAK1/2 inhibitor for alopecia areata and AD', modalities: ['jakInhibitorDerm'], indications: ['alopeciaAreata', 'atopicderm'], therapeuticArea: 'dermatology' },
  { licensor: 'Almirall', licensee: 'AbbVie', value: '$660M', year: 2023, relevance: 'EU rights to TYK2 inhibitor for psoriasis and atopic dermatitis', modalities: ['jakInhibitorDerm'], indications: ['psoriasis', 'atopicderm'], therapeuticArea: 'dermatology' },
  // Gastroenterology
  { licensor: 'Prometheus Biosciences', licensee: 'Merck', value: '$10.8B', year: 2023, relevance: 'Anti-TL1A acquisition for Crohn\'s and ulcerative colitis', modalities: ['tl1aInhibitor'], indications: ['crohns', 'ulcerativeColitis'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Arena Pharmaceuticals', licensee: 'Pfizer', value: '$6.7B', year: 2022, relevance: 'Etrasimod S1P modulator acquisition for ulcerative colitis', modalities: ['s1pModulator'], indications: ['ulcerativeColitis'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Telavant', licensee: 'Roche', value: '$7.1B', year: 2023, relevance: 'Anti-TL1A (RVT-3101) acquisition for IBD', modalities: ['tl1aInhibitor'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'AbbVie', licensee: 'N/A (standalone)', value: '$8.2B Skyrizi IBD', year: 2024, relevance: 'Risankizumab (Skyrizi) IL-23 expansion into Crohn\'s disease', modalities: ['mab'], indications: ['crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'J&J', licensee: 'N/A (standalone)', value: '$3.2B Tremfya revenue', year: 2024, relevance: 'Guselkumab (Tremfya) IL-23 approved for UC, advancing in Crohn\'s', modalities: ['mab'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Morphic Therapeutic', licensee: 'Eli Lilly', value: '$3.2B', year: 2024, relevance: 'Oral integrin inhibitor (MORF-057) acquisition for IBD', modalities: ['oralIntegrin'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Takeda', licensee: 'N/A (standalone)', value: '$4.2B Entyvio revenue', year: 2024, relevance: 'Vedolizumab (Entyvio) gut-selective integrin for IBD', modalities: ['mab'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Iterative Health', licensee: 'Pfizer', value: '$1.6B', year: 2024, relevance: 'AI-powered GI diagnostics platform for IBD and endoscopy', modalities: ['smallMolecule'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Bristol-Myers Squibb', licensee: 'N/A (standalone)', value: '$2.1B Zeposia revenue', year: 2024, relevance: 'Ozanimod (Zeposia) S1P modulator for ulcerative colitis', modalities: ['s1pModulator'], indications: ['ulcerativeColitis'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Protagonist Therapeutics', licensee: 'J&J', value: '$1B upfront + milestones', year: 2024, relevance: 'Icotrokinra (JNJ-2113) oral IL-23 peptide for UC/Crohn\'s', modalities: ['peptide'], indications: ['ulcerativeColitis', 'crohns', 'psoriasis'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Ventyx Biosciences', licensee: 'Eli Lilly', value: '$1.2B', year: 2024, relevance: 'TYK2+S1P dual inhibitor for Crohn\'s disease', modalities: ['jakInhibitor', 's1pModulator'], indications: ['crohns'], therapeuticArea: 'gastroenterology' },
];

// Convert extended deal to base ComparableDeal format
function toComparableDeal(d: ExtendedComparableDeal): ComparableDeal {
  const value = d.totalDealValue >= 1000
    ? `$${(d.totalDealValue / 1000).toFixed(1)}B`
    : `$${d.totalDealValue}M`;
  return {
    licensor: d.licensor,
    licensee: d.licensee,
    value,
    year: d.year,
    relevance: d.headline,
    modalities: [d.modality],
    indications: [d.indication_specific],
    therapeuticArea: d.therapeuticArea as ComparableDeal['therapeuticArea'],
  };
}

// Merge curated deals with extended deals (deduplicate by licensor+licensee+year)
const ALL_DEALS: ComparableDeal[] = (() => {
  const seen = new Set(COMPARABLE_DEALS.map(d => `${d.licensor}|${d.licensee}|${d.year}`));
  const extended = EXTENDED_COMPARABLE_DEALS
    .filter(d => !seen.has(`${d.licensor}|${d.licensee}|${d.year}`))
    .map(toComparableDeal);
  return [...COMPARABLE_DEALS, ...extended];
})();

// Extended interface for web UI component
export interface ComparableDealForUI {
  id: string;
  parties: string;
  totalValue: string;
  upfront?: string;
  year: number;
  phase?: string;
  relevanceReasons: string[];
}

// Find comparable deals scored by relevance to current inputs (for web UI)
export function findComparableDeals(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string },
  maxDeals: number = 5
): ComparableDealForUI[] {
  const scored = ALL_DEALS.map((deal, idx) => {
    let score = 0;
    const reasons: string[] = [];

    if (deal.therapeuticArea === inputs.therapeuticArea || deal.therapeuticArea === 'both') {
      score += 3;
      reasons.push(`Same therapeutic area`);
    }
    if (inputs.modality && deal.modalities?.includes(inputs.modality)) {
      score += 4;
      reasons.push(`Same modality`);
    }
    if (inputs.indication && deal.indications?.includes(inputs.indication)) {
      score += 3;
      reasons.push(`Same indication`);
    }

    return {
      deal,
      score,
      reasons,
      id: `deal-${idx}`,
    };
  });

  return scored
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals)
    .map(s => ({
      id: s.id,
      parties: `${s.deal.licensor} / ${s.deal.licensee}`,
      totalValue: s.deal.value,
      year: s.deal.year,
      relevanceReasons: s.reasons,
    }));
}

export function getRelevantDeals(
  therapeuticArea: string,
  modality?: string,
  indication?: string,
  maxDeals: number = 4
): ComparableDeal[] {
  const scored = ALL_DEALS.map(deal => {
    let score = 0;
    if (deal.therapeuticArea === therapeuticArea || deal.therapeuticArea === 'both') score += 1;
    if (modality && deal.modalities?.includes(modality)) score += 3;
    if (indication && deal.indications?.includes(indication)) score += 3;
    return { deal, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals)
    .map(s => s.deal);
}

// Re-export server-only DB functions — import from '@/lib/comparableDeals.server' in API routes
// This file must remain safe for client-side imports (no next/headers dependency)
