import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Settings, 
  Database,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Phone
} from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time updates
    const interval = setInterval(loadRealtimeMetrics, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load analytics data
      const [chatAnalytics, salesAnalytics, flowAnalytics, performanceMetrics] = await Promise.all([
        fetch('/api/analytics/chat').then(r => r.json()),
        fetch('/api/analytics/sales').then(r => r.json()),
        fetch('/api/analytics/flows').then(r => r.json()),
        fetch('/api/analytics/performance').then(r => r.json())
      ]);

      setAnalytics({
        chat: chatAnalytics.analytics || {},
        sales: salesAnalytics.analytics || {},
        flows: flowAnalytics.analytics || [],
        performance: performanceMetrics
      });

      await loadRealtimeMetrics();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealtimeMetrics = async () => {
    try {
      const response = await fetch('/api/analytics/realtime');
      const data = await response.json();
      setRealtimeMetrics(data.realtime || {});
    } catch (error) {
      console.error('Error loading realtime metrics:', error);
    }
  };

  const MetricCard = ({ title, value, icon: Icon, color = 'blue', trend = null }) => (
    <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderLeftColor: `var(--${color}-500, #3b82f6)` }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {trend && (
            <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last period
            </p>
          )}
        </div>
        <Icon className={`h-8 w-8 text-${color}-500`} />
      </div>
    </div>
  );

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Sessions"
          value={realtimeMetrics?.activeSessions || 0}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="New Sessions (1h)"
          value={realtimeMetrics?.newSessions || 0}
          icon={MessageSquare}
          color="green"
        />
        <MetricCard
          title="Escalations (1h)"
          value={realtimeMetrics?.escalations || 0}
          icon={Phone}
          color="orange"
        />
        <MetricCard
          title="Pending Leads"
          value={realtimeMetrics?.pendingLeads || 0}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Chat Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Sessions:</span>
                <span className="font-semibold">{analytics.chat.totalSessions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Escalation Rate:</span>
                <span className="font-semibold">
                  {analytics.chat.escalationRate ? `${analytics.chat.escalationRate.toFixed(1)}%` : '0%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Response Time:</span>
                <span className="font-semibold">
                  {analytics.chat.averageResponseTime ? `${Math.round(analytics.chat.averageResponseTime)}ms` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Messages/Session:</span>
                <span className="font-semibold">
                  {analytics.chat.averageMessages ? analytics.chat.averageMessages.toFixed(1) : '0'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Sales Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Leads:</span>
                <span className="font-semibold">{analytics.sales.totalLeads || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Conversion Rate:</span>
                <span className="font-semibold">
                  {analytics.sales.conversionRate ? `${analytics.sales.conversionRate.toFixed(1)}%` : '0%'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Response Time:</span>
                <span className="font-semibold">
                  {analytics.sales.averageResponseTime ? 
                    `${Math.round(analytics.sales.averageResponseTime / 60000)}min` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Conversion Value:</span>
                <span className="font-semibold">
                  ₹{analytics.sales.totalConversionValue?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const FlowsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Flow Management</h2>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
          Create New Flow
        </button>
      </div>

      {analytics?.flows && analytics.flows.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flow ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Executions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.flows.map((flow, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {flow.flowId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.totalExecutions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.completionRate ? `${flow.completionRate.toFixed(1)}%` : '0%'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.averageDuration ? `${Math.round(flow.averageDuration / 1000)}s` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">No flows available. Create your first flow to get started.</p>
        </div>
      )}
    </div>
  );

  const SettingsTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Chat Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Welcome Message
              </label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                defaultValue="Hello! I'm here to help you find the perfect property. How can I assist you today?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Response Timeout (seconds)
              </label>
              <input
                type="number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue={30}
              />
            </div>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
              Save Changes
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI Model
              </label>
              <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                defaultValue="0.7"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue={500}
              />
            </div>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'flows', label: 'Flows', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Chatbot Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                realtimeMetrics ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  realtimeMetrics ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span>{realtimeMetrics ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={20} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'flows' && <FlowsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};

export default AdminDashboard;