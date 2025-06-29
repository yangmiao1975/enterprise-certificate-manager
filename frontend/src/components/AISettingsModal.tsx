import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { AIProvider, AIUserSettings, AIProviderConfig } from '../types';
import { aiService, AI_PROVIDER_INFO } from '../services/aiService';
import { notificationService } from '../services/notificationService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [settings, setSettings] = useState<AIUserSettings>({
    primaryProvider: null,
    fallbackProvider: null,
    usePersonalKeys: false,
    providers: []
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<AIProvider | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<AIProvider, boolean>>({} as Record<AIProvider, boolean>);
  const [newProvider, setNewProvider] = useState<AIProvider | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [availableSystemProviders, setAvailableSystemProviders] = useState<AIProvider[]>([]);
  const [activeTab, setActiveTab] = useState<'providers' | 'preferences'>('providers');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadAvailableProviders();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const userSettings = await aiService.getUserAISettings();
      setSettings(userSettings);
    } catch (error) {
      notificationService?.addNotification?.('Failed to load AI settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableProviders = async () => {
    try {
      const { system } = await aiService.getAvailableProviders();
      setAvailableSystemProviders(system);
    } catch (error) {
      console.error('Failed to load available providers:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await aiService.updateUserAISettings({
        primaryProvider: settings.primaryProvider,
        fallbackProvider: settings.fallbackProvider,
        usePersonalKeys: settings.usePersonalKeys
      });
      notificationService?.addNotification?.('AI settings saved successfully', 'success');
      onClose();
    } catch (error) {
      notificationService?.addNotification?.('Failed to save AI settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider || !newApiKey) {
      notificationService?.addNotification?.('Please select a provider and enter an API key', 'error');
      return;
    }

    const validation = aiService.validateApiKey(newProvider, newApiKey);
    if (!validation.valid) {
      notificationService?.addNotification?.(validation.message || 'Invalid API key format', 'error');
      return;
    }

    try {
      await aiService.addOrUpdateProvider(newProvider, newApiKey);
      await loadSettings(); // Reload to get updated list
      setNewProvider(null);
      setNewApiKey('');
      notificationService?.addNotification?.('AI provider added successfully', 'success');
    } catch (error) {
      notificationService?.addNotification?.('Failed to add AI provider', 'error');
    }
  };

  const handleRemoveProvider = async (provider: AIProvider) => {
    try {
      await aiService.removeProvider(provider);
      await loadSettings(); // Reload to get updated list
      
      // Clear from primary/fallback if was selected
      if (settings.primaryProvider === provider) {
        setSettings(prev => ({ ...prev, primaryProvider: null }));
      }
      if (settings.fallbackProvider === provider) {
        setSettings(prev => ({ ...prev, fallbackProvider: null }));
      }
      
      notificationService?.addNotification?.('AI provider removed successfully', 'success');
    } catch (error) {
      notificationService?.addNotification?.('Failed to remove AI provider', 'error');
    }
  };

  const handleTestProvider = async (provider: AIProvider) => {
    setTesting(provider);
    try {
      const result = await aiService.testProvider(provider);
      if (result.success) {
        notificationService?.addNotification?.(`${AI_PROVIDER_INFO[provider].name} connection successful`, 'success');
      } else {
        notificationService?.addNotification?.(`${AI_PROVIDER_INFO[provider].name} test failed: ${result.message}`, 'error');
      }
    } catch (error) {
      notificationService?.addNotification?.(`Failed to test ${AI_PROVIDER_INFO[provider].name}`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const toggleApiKeyVisibility = (provider: AIProvider) => {
    setShowApiKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const getAvailableProviders = () => {
    return Object.values(AIProvider).filter(provider => 
      !settings.providers.some(p => p.provider === provider)
    );
  };

  const maskApiKey = (apiKey: string) => {
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length);
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="AI Configuration" size="xl">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading AI settings...</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Configuration" size="xl">
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-slate-600">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('providers')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'providers'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                API Keys
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'preferences'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Preferences
              </button>
            </nav>
          </div>

          {activeTab === 'providers' && (
            <div className="space-y-6">
              {/* Add New Provider */}
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Add AI Provider</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Add your personal API keys for enhanced security and private certificate analysis.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Provider</label>
                    <select 
                      value={newProvider || ''} 
                      onChange={(e) => setNewProvider(e.target.value as AIProvider || null)}
                      className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-800"
                    >
                      <option value="">Select AI provider</option>
                      {getAvailableProviders().map(provider => (
                        <option key={provider} value={provider}>
                          {AI_PROVIDER_INFO[provider].name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder={newProvider ? AI_PROVIDER_INFO[newProvider].keyExample : 'Select provider first'}
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        disabled={!newProvider}
                        className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-800"
                      />
                      {newProvider && (
                        <a 
                          href={AI_PROVIDER_INFO[newProvider].website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          title="Get API Key"
                        >
                          🔗
                        </a>
                      )}
                    </div>
                    {newProvider && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Format: {AI_PROVIDER_INFO[newProvider].keyFormat}
                      </p>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={handleAddProvider}
                  disabled={!newProvider || !newApiKey}
                  className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔑 Add Provider
                </button>
              </div>

              {/* Current Providers */}
              <div>
                <h3 className="text-lg font-medium mb-4">Your AI Providers</h3>
                {settings.providers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-4">🔑</div>
                    <p>No AI providers configured</p>
                    <p className="text-sm">Add your API keys above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settings.providers.map((config) => (
                      <div key={config.provider} className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-600 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="font-medium">{AI_PROVIDER_INFO[config.provider].name}</span>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {showApiKeys[config.provider] 
                                ? config.apiKey 
                                : maskApiKey(config.apiKey)
                              }
                            </div>
                          </div>
                          {config.isActive && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded-full">
                              ✓ Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleApiKeyVisibility(config.provider)}
                            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            title={showApiKeys[config.provider] ? "Hide API Key" : "Show API Key"}
                          >
                            {showApiKeys[config.provider] ? '🙈' : '👁️'}
                          </button>
                          <button
                            onClick={() => handleTestProvider(config.provider)}
                            disabled={testing === config.provider}
                            className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-50"
                            title="Test Connection"
                          >
                            {testing === config.provider ? '⏳' : '🧪'}
                          </button>
                          <button
                            onClick={() => handleRemoveProvider(config.provider)}
                            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400"
                            title="Remove Provider"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Providers */}
              {availableSystemProviders.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">System Providers</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    AI providers available through system configuration (for non-sensitive data).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableSystemProviders.map(provider => (
                      <span key={provider} className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm rounded-full">
                        {AI_PROVIDER_INFO[provider].name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Provider Preferences</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Configure which AI providers to use and when.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Primary Provider</label>
                    <select 
                      value={settings.primaryProvider || ''} 
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        primaryProvider: e.target.value as AIProvider || null 
                      }))}
                      className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-800"
                    >
                      <option value="">None</option>
                      {settings.providers.map(config => (
                        <option key={config.provider} value={config.provider}>
                          {AI_PROVIDER_INFO[config.provider].name} (Personal)
                        </option>
                      ))}
                      {availableSystemProviders.map(provider => (
                        <option key={provider} value={provider}>
                          {AI_PROVIDER_INFO[provider].name} (System)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Fallback Provider</label>
                    <select 
                      value={settings.fallbackProvider || ''} 
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        fallbackProvider: e.target.value as AIProvider || null 
                      }))}
                      className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-800"
                    >
                      <option value="">None</option>
                      {settings.providers.map(config => (
                        <option 
                          key={config.provider} 
                          value={config.provider}
                          disabled={settings.primaryProvider === config.provider}
                        >
                          {AI_PROVIDER_INFO[config.provider].name} (Personal)
                        </option>
                      ))}
                      {availableSystemProviders.map(provider => (
                        <option 
                          key={provider} 
                          value={provider}
                          disabled={settings.primaryProvider === provider}
                        >
                          {AI_PROVIDER_INFO[provider].name} (System)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">Use Personal Keys for Sensitive Data</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Automatically use your personal API keys when analyzing certificates or private keys
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.usePersonalKeys}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        usePersonalKeys: e.target.checked 
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex">
                    <div className="text-yellow-800 dark:text-yellow-200">
                      ⚠️ <strong>Security Notice:</strong> For certificate analysis, personal API keys are always required for security. 
                      Your certificate data will never be sent to system providers.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-slate-600">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳ Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};