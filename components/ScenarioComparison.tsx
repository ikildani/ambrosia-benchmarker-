'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CalculationResult, formatCurrency } from '@/lib/calculations';

interface SavedScenario {
  id: string;
  name: string;
  inputs: Record<string, string>;
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
  created_at: string;
}

interface ScenarioComparisonProps {
  currentResult?: CalculationResult;
  currentInputs?: Record<string, string>;
  currentLabels?: { phase: string; modality: string; indication: string };
  onSaveScenario?: (name: string) => void;
}

export default function ScenarioComparison({
  currentResult,
  currentInputs,
  currentLabels,
  onSaveScenario,
}: ScenarioComparisonProps) {
  const { user, tier } = useAuth();
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    if (!user?.email || tier !== 'pro') return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/scenarios?email=${encodeURIComponent(user.email)}&tier=${tier}`
      );
      const data = await response.json();
      if (data.scenarios) {
        setScenarios(data.scenarios);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.email, tier]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleSave = async () => {
    if (!saveName.trim() || !user?.email || !currentResult || !currentInputs) return;

    setSaveError(null);
    try {
      const response = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: saveName.trim(),
          inputs: currentInputs,
          results: currentResult,
          labels: currentLabels,
          tier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error || 'Failed to save');
        return;
      }

      setShowSaveModal(false);
      setSaveName('');
      fetchScenarios();
      onSaveScenario?.(saveName.trim());
    } catch (error) {
      setSaveError('Failed to save scenario');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.email) return;

    try {
      await fetch(`/api/scenarios?id=${id}&email=${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
      });
      setScenarios(scenarios.filter((s) => s.id !== id));
      setSelectedScenarios(selectedScenarios.filter((sid) => sid !== id));
    } catch (error) {
      console.error('Error deleting scenario:', error);
    }
  };

  const toggleScenarioSelection = (id: string) => {
    if (selectedScenarios.includes(id)) {
      setSelectedScenarios(selectedScenarios.filter((sid) => sid !== id));
    } else if (selectedScenarios.length < 2) {
      setSelectedScenarios([...selectedScenarios, id]);
    }
  };

  const compareScenarios = scenarios.filter((s) => selectedScenarios.includes(s.id));

  if (tier !== 'pro') {
    return null;
  }

  return (
    <div className="mt-6 sm:mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="font-semibold text-navy-800">Saved Scenarios</h3>
          <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
            {scenarios.length}/20
          </span>
        </div>

        {currentResult && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Current
          </button>
        )}
      </div>

      {/* Scenarios List */}
      {loading ? (
        <div className="text-center py-8 text-neutral-500">Loading scenarios...</div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-8 bg-neutral-50 rounded-xl border border-neutral-200">
          <svg className="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-neutral-500 mb-2">No saved scenarios yet</p>
          <p className="text-sm text-neutral-400">
            Save your calculations to compare them later
          </p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => toggleScenarioSelection(scenario.id)}
                className={`p-4 bg-white rounded-xl border-2 cursor-pointer transition-all ${
                  selectedScenarios.includes(scenario.id)
                    ? 'border-teal-500 shadow-soft'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-navy-800">{scenario.name}</h4>
                    <p className="text-xs text-neutral-500">
                      {new Date(scenario.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(scenario.id);
                    }}
                    className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">
                    {scenario.labels?.phase}
                  </span>
                  <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded">
                    {scenario.labels?.modality}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-success-600">
                  {formatCurrency(scenario.results?.terms?.totalDealValue?.median || 0)}
                </p>
              </div>
            ))}
          </div>

          {selectedScenarios.length > 0 && (
            <button
              onClick={() => setIsComparing(!isComparing)}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
            >
              {isComparing ? 'Hide Comparison' : `Compare ${selectedScenarios.length} Scenario${selectedScenarios.length > 1 ? 's' : ''}`}
            </button>
          )}

          {/* Comparison Table */}
          {isComparing && compareScenarios.length > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-neutral-200 overflow-hidden animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">
                        Metric
                      </th>
                      {compareScenarios.map((s) => (
                        <th key={s.id} className="px-4 py-3 text-right text-xs font-semibold text-neutral-700">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    <tr>
                      <td className="px-4 py-3 text-sm text-neutral-600">Upfront</td>
                      {compareScenarios.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-sm font-medium text-navy-800 text-right">
                          {formatCurrency(s.results?.terms?.upfront?.median || 0)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-neutral-600">Total Deal Value</td>
                      {compareScenarios.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-sm font-bold text-success-600 text-right">
                          {formatCurrency(s.results?.terms?.totalDealValue?.median || 0)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-neutral-600">Dev Milestones</td>
                      {compareScenarios.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-sm font-medium text-neutral-800 text-right">
                          {formatCurrency(s.results?.terms?.devMilestones?.median || 0)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-neutral-600">Royalties (Base)</td>
                      {compareScenarios.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-sm font-medium text-neutral-800 text-right">
                          {s.results?.tieredRoyalties?.base?.low}% - {s.results?.tieredRoyalties?.base?.high}%
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-600">Phase</td>
                      {compareScenarios.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-sm text-neutral-700 text-right">
                          {s.labels?.phase}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-600">Modality</td>
                      {compareScenarios.map((s) => (
                        <td key={s.id} className="px-4 py-3 text-sm text-neutral-700 text-right">
                          {s.labels?.modality}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => setShowSaveModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-navy-800 mb-4">Save Scenario</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Scenario name (e.g., 'Phase 2 ADC Global')"
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
            {saveError && (
              <p className="mt-2 text-sm text-red-500">{saveError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
