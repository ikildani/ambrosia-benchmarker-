import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamMember } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface AssetProfile {
  userId: string;
  companyName: string | null;
  email: string | null;
  assets: { therapeuticArea: string; modality: string; count: number; latestDate: string }[];
}

interface Overlap {
  therapeuticArea: string;
  modality: string;
  companies: string[];
}

interface Synergy {
  therapeuticArea: string;
  modalityA: string;
  modalityB: string;
  companyA: string;
  companyB: string;
}

const COMPLEMENTARY_PAIRS: [string, string][] = [
  ['adc', 'antibody'],
  ['small_molecule', 'biologic'],
  ['car_t', 'bispecific'],
  ['gene_therapy', 'mrna'],
];

export async function GET(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;

    const { teamId } = result;
    const supabase = createServiceClient();

    // Fetch active team member user_ids
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'active');

    const memberIds = (members || []).map(m => m.user_id);

    if (memberIds.length === 0) {
      return apiSuccess({ assetProfiles: [], overlaps: [], synergies: [] });
    }

    // Fetch calculations and user profiles in parallel
    const [calcResult, profileResult] = await Promise.all([
      supabase
        .from('calculations')
        .select('user_id, therapeutic_area, modality, indication_category, indication_specific, development_phase, created_at')
        .in('user_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('user_profiles')
        .select('id, company_name, email')
        .in('id', memberIds),
    ]);

    const calculations = calcResult.data || [];
    const profiles = profileResult.data || [];

    // Build a profile lookup
    const profileMap = new Map<string, { companyName: string | null; email: string | null }>();
    for (const p of profiles) {
      profileMap.set(p.id, { companyName: p.company_name, email: p.email });
    }

    // Build asset profiles: group each member's calculations by unique (TA, modality)
    const assetProfiles: AssetProfile[] = memberIds.map(userId => {
      const userCalcs = calculations.filter(c => c.user_id === userId);
      const comboMap = new Map<string, { count: number; latestDate: string }>();

      for (const calc of userCalcs) {
        const key = `${calc.therapeutic_area}|${calc.modality}`;
        const existing = comboMap.get(key);
        if (existing) {
          existing.count += 1;
          if (calc.created_at > existing.latestDate) {
            existing.latestDate = calc.created_at;
          }
        } else {
          comboMap.set(key, { count: 1, latestDate: calc.created_at });
        }
      }

      const profile = profileMap.get(userId);
      const assets = Array.from(comboMap.entries()).map(([key, val]) => {
        const [therapeuticArea, modality] = key.split('|');
        return { therapeuticArea, modality, count: val.count, latestDate: val.latestDate };
      });

      return {
        userId,
        companyName: profile?.companyName ?? null,
        email: profile?.email ?? null,
        assets,
      };
    });

    // Build overlaps: (TA, modality) pairs explored by 2+ different members
    const comboToCompanies = new Map<string, Set<string>>();
    for (const profile of assetProfiles) {
      for (const asset of profile.assets) {
        const key = `${asset.therapeuticArea}|${asset.modality}`;
        if (!comboToCompanies.has(key)) {
          comboToCompanies.set(key, new Set());
        }
        comboToCompanies.get(key)!.add(profile.companyName || profile.userId);
      }
    }

    const overlaps: Overlap[] = [];
    for (const [key, companies] of comboToCompanies.entries()) {
      if (companies.size >= 2) {
        const [therapeuticArea, modality] = key.split('|');
        overlaps.push({ therapeuticArea, modality, companies: Array.from(companies) });
      }
    }

    // Build synergies: within a TA, different members with complementary modalities
    const synergies: Synergy[] = [];
    const taToMembers = new Map<string, { company: string; modalities: Set<string> }[]>();

    for (const profile of assetProfiles) {
      for (const asset of profile.assets) {
        const ta = asset.therapeuticArea;
        if (!taToMembers.has(ta)) {
          taToMembers.set(ta, []);
        }
        const existing = taToMembers.get(ta)!.find(
          m => m.company === (profile.companyName || profile.userId)
        );
        if (existing) {
          existing.modalities.add(asset.modality);
        } else {
          taToMembers.get(ta)!.push({
            company: profile.companyName || profile.userId,
            modalities: new Set([asset.modality]),
          });
        }
      }
    }

    for (const [ta, members] of taToMembers.entries()) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          for (const [pairA, pairB] of COMPLEMENTARY_PAIRS) {
            if (
              (a.modalities.has(pairA) && b.modalities.has(pairB)) ||
              (a.modalities.has(pairB) && b.modalities.has(pairA))
            ) {
              const aModality = a.modalities.has(pairA) ? pairA : pairB;
              const bModality = b.modalities.has(pairA) ? pairA : pairB;
              synergies.push({
                therapeuticArea: ta,
                modalityA: aModality,
                modalityB: bModality,
                companyA: a.company,
                companyB: b.company,
              });
            }
          }
        }
      }
    }

    return apiSuccess({ assetProfiles, overlaps, synergies });
  } catch {
    return apiError('Internal server error', 500);
  }
}
