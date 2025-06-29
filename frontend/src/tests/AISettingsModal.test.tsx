/**
 * AI Settings Modal Tests
 * Tests for the AI configuration user interface
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AISettingsModal } from '../components/AISettingsModal';
import { AIProvider } from '../types';
import * as aiService from '../services/aiService';
import * as notificationService from '../services/notificationService';

// Mock the services
vi.mock('../services/aiService');
vi.mock('../services/notificationService');

const mockAiService = vi.mocked(aiService);
const mockNotificationService = vi.mocked(notificationService);

describe('AISettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  const mockUserSettings = {
    primaryProvider: AIProvider.OPENAI,
    fallbackProvider: AIProvider.CLAUDE,
    usePersonalKeys: true,
    providers: [
      {
        provider: AIProvider.OPENAI,
        apiKey: 'sk-test-openai-key',
        isActive: true,
        addedAt: '2024-01-01T00:00:00Z'
      },
      {
        provider: AIProvider.CLAUDE,
        apiKey: 'sk-ant-test-claude-key',
        isActive: true,
        addedAt: '2024-01-01T00:00:00Z'
      }
    ]
  };

  const mockAvailableProviders = {
    system: [AIProvider.GEMINI]
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockAiService.aiService.getUserAISettings.mockResolvedValue(mockUserSettings);
    mockAiService.aiService.getAvailableProviders.mockResolvedValue(mockAvailableProviders);
    mockAiService.aiService.updateUserAISettings.mockResolvedValue(undefined);
    mockAiService.aiService.addOrUpdateProvider.mockResolvedValue(undefined);
    mockAiService.aiService.removeProvider.mockResolvedValue(undefined);
    mockAiService.aiService.testProvider.mockResolvedValue({ success: true, message: 'Test successful' });
    mockAiService.aiService.validateApiKey.mockReturnValue({ valid: true });
    
    mockNotificationService.notificationService.addNotification = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should render when open', async () => {
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('AI Configuration')).toBeInTheDocument();
      });
    });

    it('should not render when closed', () => {
      render(<AISettingsModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('AI Configuration')).not.toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<AISettingsModal {...defaultProps} />);
      
      expect(screen.getByText('Loading AI settings...')).toBeInTheDocument();
    });
  });

  describe('API Keys Tab', () => {
    it('should display existing providers', async () => {
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.getByText('Anthropic Claude')).toBeInTheDocument();
      });
    });

    it('should mask API keys by default', async () => {
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('sk-t*******************-key')).toBeInTheDocument();
      });
    });

    it('should show/hide API keys when toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      // Find and click the show/hide button for OpenAI
      const showButton = screen.getAllByTitle('Show API Key')[0];
      await user.click(showButton);
      
      await waitFor(() => {
        expect(screen.getByText('sk-test-openai-key')).toBeInTheDocument();
      });
    });

    it('should add a new provider', async () => {
      const user = userEvent.setup();
      
      // Mock a configuration with no DeepSeek provider
      const settingsWithoutDeepSeek = {
        ...mockUserSettings,
        providers: mockUserSettings.providers.filter(p => p.provider !== AIProvider.DEEPSEEK)
      };
      
      mockAiService.aiService.getUserAISettings.mockResolvedValue(settingsWithoutDeepSeek);
      
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Add AI Provider')).toBeInTheDocument();
      });

      // Select provider
      const providerSelect = screen.getByDisplayValue('Select AI provider');
      await user.selectOptions(providerSelect, AIProvider.DEEPSEEK);

      // Enter API key
      const apiKeyInput = screen.getByPlaceholderText(/sk-/);
      await user.type(apiKeyInput, 'sk-deepseek-test-key');

      // Click add button
      const addButton = screen.getByText('🔑 Add Provider');
      await user.click(addButton);

      expect(mockAiService.aiService.addOrUpdateProvider).toHaveBeenCalledWith(
        AIProvider.DEEPSEEK,
        'sk-deepseek-test-key'
      );
    });

    it('should validate API key format', async () => {
      const user = userEvent.setup();
      
      mockAiService.aiService.validateApiKey.mockReturnValue({
        valid: false,
        message: 'Invalid API key format'
      });
      
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Add AI Provider')).toBeInTheDocument();
      });

      const providerSelect = screen.getByDisplayValue('Select AI provider');
      await user.selectOptions(providerSelect, AIProvider.OPENAI);

      const apiKeyInput = screen.getByPlaceholderText(/sk-/);
      await user.type(apiKeyInput, 'invalid-key');

      const addButton = screen.getByText('🔑 Add Provider');
      await user.click(addButton);

      expect(mockNotificationService.notificationService.addNotification).toHaveBeenCalledWith(
        'Invalid API key format',
        'error'
      );
    });

    it('should test provider connection', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      const testButton = screen.getAllByTitle('Test Connection')[0];
      await user.click(testButton);

      expect(mockAiService.aiService.testProvider).toHaveBeenCalledWith(AIProvider.OPENAI);
      
      await waitFor(() => {
        expect(mockNotificationService.notificationService.addNotification).toHaveBeenCalledWith(
          'OpenAI connection successful',
          'success'
        );
      });
    });

    it('should remove a provider', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      const removeButton = screen.getAllByTitle('Remove Provider')[0];
      await user.click(removeButton);

      expect(mockAiService.aiService.removeProvider).toHaveBeenCalledWith(AIProvider.OPENAI);
    });

    it('should display system providers', async () => {
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('System Providers')).toBeInTheDocument();
        expect(screen.getByText('Google Gemini')).toBeInTheDocument();
      });
    });
  });

  describe('Preferences Tab', () => {
    it('should switch to preferences tab', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('AI Configuration')).toBeInTheDocument();
      });

      const preferencesTab = screen.getByText('Preferences');
      await user.click(preferencesTab);

      expect(screen.getByText('Provider Preferences')).toBeInTheDocument();
    });

    it('should display current settings in preferences', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        const preferencesTab = screen.getByText('Preferences');
        await user.click(preferencesTab);
      });

      await waitFor(() => {
        const primarySelect = screen.getByDisplayValue('OpenAI (Personal)');
        const fallbackSelect = screen.getByDisplayValue('Anthropic Claude (Personal)');
        const personalKeysToggle = screen.getByRole('checkbox', { checked: true });
        
        expect(primarySelect).toBeInTheDocument();
        expect(fallbackSelect).toBeInTheDocument();
        expect(personalKeysToggle).toBeInTheDocument();
      });
    });

    it('should update primary provider', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        const preferencesTab = screen.getByText('Preferences');
        await user.click(preferencesTab);
      });

      await waitFor(() => {
        const primarySelect = screen.getByDisplayValue('OpenAI (Personal)');
        await user.selectOptions(primarySelect, 'claude');
      });

      const saveButton = screen.getByText('Save Settings');
      await user.click(saveButton);

      expect(mockAiService.aiService.updateUserAISettings).toHaveBeenCalledWith({
        primaryProvider: AIProvider.CLAUDE,
        fallbackProvider: AIProvider.CLAUDE,
        usePersonalKeys: true
      });
    });

    it('should toggle personal keys setting', async () => {
      const user = userEvent.setup();
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        const preferencesTab = screen.getByText('Preferences');
        await user.click(preferencesTab);
      });

      await waitFor(() => {
        const personalKeysToggle = screen.getByRole('checkbox');
        await user.click(personalKeysToggle);
      });

      const saveButton = screen.getByText('Save Settings');
      await user.click(saveButton);

      expect(mockAiService.aiService.updateUserAISettings).toHaveBeenCalledWith({
        primaryProvider: AIProvider.OPENAI,
        fallbackProvider: AIProvider.CLAUDE,
        usePersonalKeys: false
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockAiService.aiService.getUserAISettings.mockRejectedValue(new Error('API Error'));
      
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockNotificationService.notificationService.addNotification).toHaveBeenCalledWith(
          'Failed to load AI settings',
          'error'
        );
      });
    });

    it('should handle save errors', async () => {
      const user = userEvent.setup();
      mockAiService.aiService.updateUserAISettings.mockRejectedValue(new Error('Save failed'));
      
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        const preferencesTab = screen.getByText('Preferences');
        await user.click(preferencesTab);
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings');
        await user.click(saveButton);
      });

      await waitFor(() => {
        expect(mockNotificationService.notificationService.addNotification).toHaveBeenCalledWith(
          'Failed to save AI settings',
          'error'
        );
      });
    });
  });

  describe('Modal Controls', () => {
    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AISettingsModal {...defaultProps} onClose={onClose} />);
      
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        await user.click(cancelButton);
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('should close modal after successful save', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AISettingsModal {...defaultProps} onClose={onClose} />);
      
      await waitFor(() => {
        const preferencesTab = screen.getByText('Preferences');
        await user.click(preferencesTab);
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings');
        await user.click(saveButton);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show saving state', async () => {
      const user = userEvent.setup();
      
      // Make the save operation pending
      let resolveSave: (value: any) => void;
      const savePromise = new Promise(resolve => { resolveSave = resolve; });
      mockAiService.aiService.updateUserAISettings.mockReturnValue(savePromise);
      
      render(<AISettingsModal {...defaultProps} />);
      
      await waitFor(() => {
        const preferencesTab = screen.getByText('Preferences');
        await user.click(preferencesTab);
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings');
        await user.click(saveButton);
      });

      expect(screen.getByText('⏳ Saving...')).toBeInTheDocument();

      // Resolve the promise
      resolveSave!(undefined);
      
      await waitFor(() => {
        expect(screen.queryByText('⏳ Saving...')).not.toBeInTheDocument();
      });
    });
  });
});