import React, { useState, useEffect } from 'react';
import { BarChart2, Users, Eye, Clock, TrendingUp } from 'lucide-react';
import { statisticsApi } from '../../api/statistics';

const StatisticsDashboard = ({ tenantId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await statisticsApi.getSummary({
          start: dateRange.start,
          end: dateRange.end,
          tenantId,
        });
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [dateRange, tenantId]);

  const trafficOverview = stats?.trafficOverview || [];
  const topPages = stats?.topPages || [];
  const maxTrafficViews = Math.max(...trafficOverview.map((item) => item.views), 1);
  const maxPageViews = Math.max(...topPages.map((page) => page.views), 1);

  const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${color}`}>
          {React.createElement(icon, { className: 'w-6 h-6 text-white' })}
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          Selected range
        </span>
      </div>
      <h3 className="text-slate-600 text-sm font-medium">{title}</h3>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value ?? 0}</div>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-slate-500">Loading statistics…</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Analytics</h1>
          <p className="text-slate-500">Daily insights into your website performance.</p>
        </div>
        <div className="flex gap-4">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Page Views"
          value={stats?.totalViews}
          icon={Eye}
          color="bg-blue-600"
        />
        <StatCard
          title="Unique Visitors"
          value={stats?.totalUniques}
          icon={Users}
          color="bg-indigo-600"
        />
        <StatCard
          title="Avg. Time on Page"
          value={`${Math.round(stats?.avgTime || 0)}s`}
          icon={Clock}
          color="bg-emerald-600"
        />
        <StatCard
          title="Conversion Rate"
          value={`${(stats?.conversionRate || 0).toFixed(1)}%`}
          icon={TrendingUp}
          color="bg-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Traffic Overview</h3>
            <BarChart2 className="w-5 h-5 text-slate-400" />
          </div>
          {trafficOverview.length ? (
            <div className="h-64 flex items-end gap-4 px-2">
              {trafficOverview.map((item) => (
                <div key={item.date} className="flex-1 group relative h-full flex flex-col justify-end">
                  <div className="text-[10px] text-slate-500 text-center mb-1">{item.views}</div>
                  <div
                    className="bg-blue-100 group-hover:bg-blue-600 transition-all rounded-t-md"
                    style={{ height: `${(item.views / maxTrafficViews) * 85}%` }}
                  ></div>
                  <div className="mt-2 text-[10px] text-slate-400 text-center">{item.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No traffic recorded for this date range.
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Top Pages</h3>
          <div className="space-y-4">
            {topPages.map((page) => (
              <div key={page.url} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 truncate max-w-[150px]" title={page.url}>
                  {page.url}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full"
                      style={{ width: `${(page.views / maxPageViews) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{page.views}</span>
                </div>
              </div>
            ))}
            {!topPages.length && (
              <div className="py-12 text-center text-sm text-slate-500">
                No page views recorded for this date range.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsDashboard;
