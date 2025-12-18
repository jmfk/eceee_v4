import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Beaker, Plus, Play, Pause, CheckCircle, AlertCircle } from 'lucide-react';

const ExperimentManager = ({ tenantId }) => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExperiment, setNewExperiment] = useState({
    name: '',
    goalMetric: 'conversion',
    variants: [
      { name: 'Control', allocationPercent: 50 },
      { name: 'Variant A', allocationPercent: 50 }
    ]
  });

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/statistics/experiments/', {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setExperiments(response.data.results || response.data);
    } catch (error) {
      console.error('Failed to fetch experiments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await axios.post('/api/statistics/experiments/', {
        ...newExperiment,
        tenantId
      }, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setShowCreateModal(false);
      fetchExperiments();
    } catch (error) {
      console.error('Failed to create experiment:', error);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`/api/statistics/experiments/${id}/`, { status }, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      fetchExperiments();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const StatusBadge = ({ status }) => {
    const styles = {
      running: 'bg-green-100 text-green-700',
      draft: 'bg-slate-100 text-slate-700',
      paused: 'bg-amber-100 text-amber-700',
      completed: 'bg-blue-100 text-blue-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || styles.draft}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Beaker className="w-6 h-6 text-indigo-600" />
            A/B Testing
          </h1>
          <p className="text-slate-500">Optimize your site performance with experiments.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Experiment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Experiment</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Goal</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Variants</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {experiments.map((exp) => (
              <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{exp.name}</div>
                  <div className="text-xs text-slate-500">{exp.description || 'No description'}</div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={exp.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {exp.goalMetric}
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                    {exp.variants?.map((v, i) => (
                      <div 
                        key={i} 
                        title={`${v.name}: ${v.allocationPercent}%`}
                        className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700"
                      >
                        {v.name[0]}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {exp.status === 'draft' || exp.status === 'paused' ? (
                      <button 
                        onClick={() => handleStatusChange(exp.id, 'running')}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Start"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    ) : exp.status === 'running' ? (
                      <button 
                        onClick={() => handleStatusChange(exp.id, 'paused')}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause className="w-5 h-5" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {experiments.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-500 italic">
                  No experiments found. Create one to get started!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[10010]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Create New Experiment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Experiment Name</label>
                <input 
                  type="text" 
                  value={newExperiment.name}
                  onChange={(e) => setNewExperiment({...newExperiment, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Hero Section Headline"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Goal Metric</label>
                <select 
                  value={newExperiment.goalMetric}
                  onChange={(e) => setNewExperiment({...newExperiment, goalMetric: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="conversion">Conversion</option>
                  <option value="click">Click CTR</option>
                  <option value="scroll">Scroll Depth</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperimentManager;

