'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CalculationResult, formatCurrency } from '@/lib/calculations';
import { SavedScenario } from '@/lib/scenarioComparison';
import ScenarioCompareTable from './ScenarioCompareTable';
import ScenarioAIRecommendation from './ScenarioAIRecommendation';
import { captureClientError } from '@/lib/sentry-client';

interface ScenarioComparisonProps {
  currentResult?: CalculationResult;
  currentInputs?: Record<string, string>;
  currentLabels?: { phase: string; modality: string; indication: string };
  onSaveScenario?: (name: string, notes?: string) => void;
  maxCompareCount?: number;
}

export default function ScenarioComparison({
  currentResult,
  currentInputs,
  currentLabels,
  onSaveScenario,
  maxCompareCount = 4,
}: ScenarioComparisonProps) {
  const { user, tier } = useAuth();
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showScenarioPicker, setShowScenarioPicker] = useState(false);

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
      captureClientError(error, 'ScenarioComparison', { context: 'Failed to fetch saved scenarios' });
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
          notes: saveNotes.trim() || null,
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
      setSaveNotes('');
      fetchScenarios();
      onSaveScenario?.(saveName.trim(), saveNotes.trim() || undefined);
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
      captureClientError(error, 'ScenarioComparison', { context: 'Failed to delete scenario' });
    }
  };

  const toggleScenarioSelection = (id: string) => {
    if (selectedScenarios.includes(id)) {
      setSelectedScenarios(selectedScenarios.filter((sid) => sid !== id));
    } else if (selectedScenarios.length < maxCompareCount) {
      setSelectedScenarios([...selectedScenarios, id]);
    }
  };

  const handleRemoveFromComparison = (id: string) => {
    setSelectedScenarios(selectedScenarios.filter((sid) => sid !== id));
    if (selectedScenarios.length <= 2) {
      setIsComparing(false);
    }
  };

  const handleAddToComparison = () => {
    setShowScenarioPicker(true);
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
          <svg
            className="w-5 h-5 text-teal-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="font-semibold text-navy-800 dark:text-white">Saved Scenarios</h3>
          <span className="text-xs px-2 py-0.5 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-full">
            {scenarios.length}/20
          </span>
        </div>

        {currentResult && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            Save Current
          </button>
        )}
      </div>

      {/* Scenarios List */}
      {loading ? (
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
          Loading scenarios...
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
          <svg
            className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-neutral-500 dark:text-neutral-400 mb-2">No saved scenarios yet</p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
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
                className={`p-4 bg-white dark:bg-neutral-800 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedScenarios.includes(scenario.id)
                    ? 'border-teal-500 shadow-soft'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-navy-800 dark:text-white truncate">
                      {scenario.name}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(scenario.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(scenario.id);
                    }}
                    className="p-1 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                {scenario.notes && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 line-clamp-2">
                    {scenario.notes}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded">
                    {scenario.labels?.phase}
                  </span>
                  <span className="px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded">
                    {scenario.labels?.modality}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-success-600 dark:text-success-400">
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
              {isComparing
                ? 'Hide Comparison'
                : `Compare ${selectedScenarios.length} Scenario${selectedScenarios.length > 1 ? 's' : ''}`}
            </button>
          )}

          {/* Enhanced Comparison View */}
          {isComparing && compareScenarios.length > 0 && (
            <div className="mt-4 animate-fade-in">
              {/* Comparison Header */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-navy-800 dark:text-white">Compare Scenarios</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => { const { exportComparisonToExcel } = await import('@/lib/exportComparison'); void exportComparisonToExcel(compareScenarios); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Excel
                  </button>
                  <button
                    onClick={async () => { const { exportComparisonToPDF } = await import('@/lib/exportComparison'); exportComparisonToPDF(compareScenarios); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>

              {/* Enhanced Comparison Table */}
              <ScenarioCompareTable
                scenarios={compareScenarios}
                onRemoveScenario={handleRemoveFromComparison}
                onAddScenario={
                  selectedScenarios.length < maxCompareCount && scenarios.length > selectedScenarios.length
                    ? handleAddToComparison
                    : undefined
                }
                maxScenarios={maxCompareCount}
              />

              {/* AI Recommendation */}
              {compareScenarios.length >= 2 && (
                <ScenarioAIRecommendation scenarios={compareScenarios} />
              )}
            </div>
          )}
        </>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => {
              setShowSaveModal(false);
              setSaveName('');
              setSaveNotes('');
              setSaveError(null);
            }}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-navy-800 dark:text-white mb-4">Save Scenario</h3>

            {/* Scenario Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Scenario Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g., 'Phase 2 - Conservative Structure'"
                className="w-full px-4 py-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-navy-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Notes <span className="text-neutral-400 dark:text-neutral-500">(optional)</span>
              </label>
              <textarea
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                placeholder="Add context, assumptions, or comparison notes..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-navy-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 text-right">
                {saveNotes.length}/500
              </p>
            </div>

            {saveError && <p className="mb-4 text-sm text-red-500">{saveError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName('');
                  setSaveNotes('');
                  setSaveError(null);
                }}
                className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Scenario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Picker Modal (for adding to comparison) */}
      {showScenarioPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => setShowScenarioPicker(false)}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-bold text-navy-800 dark:text-white mb-4">
              Add Scenario to Comparison
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2">
              {scenarios
                .filter((s) => !selectedScenarios.includes(s.id))
                .map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setSelectedScenarios([...selectedScenarios, scenario.id]);
                      setShowScenarioPicker(false);
                    }}
                    className="w-full p-3 text-left bg-neutral-50 dark:bg-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors"
                  >
                    <div className="font-medium text-navy-800 dark:text-white">{scenario.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {scenario.labels?.phase} &bull; {scenario.labels?.modality} &bull;{' '}
                      {formatCurrency(scenario.results?.terms?.totalDealValue?.median || 0)}
                    </div>
                  </button>
                ))}
            </div>

            <button
              onClick={() => setShowScenarioPicker(false)}
              className="mt-4 w-full px-4 py-2 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
