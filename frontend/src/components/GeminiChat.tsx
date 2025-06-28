import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DatabaseContext {
  certificateCount: number;
  expiringSoon: number;
  expired: number;
}

interface GeminiChatProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCertificateId?: string;
}

export const GeminiChat: React.FC<GeminiChatProps> = ({ 
  isOpen, 
  onClose, 
  selectedCertificateId 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbContext, setDbContext] = useState<DatabaseContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
      if (selectedCertificateId) {
        initializeWithCertificate(selectedCertificateId);
      }
    }
  }, [isOpen, selectedCertificateId]);

  const loadChatHistory = async () => {
    try {
      const response = await apiService.getChatHistory();
      if (response.success && response.history.messages) {
        setMessages(response.history.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const initializeWithCertificate = async (certificateId: string) => {
    const welcomeMessage = `I see you've selected a certificate to discuss. How can I help you analyze certificate ${certificateId}?`;
    
    const initialMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, initialMessage]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    console.log('Sending user message:', userMessage);
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('Updated messages array:', newMessages);
      return newMessages;
    });
    setInputMessage('');
    setIsLoading(true);

    try {
      // Include the new user message in the history
      const chatHistory = [...messages, userMessage];
      const response = await apiService.sendChatMessage(
        chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        userMessage.content
      );

      if (response.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        if (response.context) {
          setDbContext(response.context);
        }
      } else {
        throw new Error(response.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await apiService.clearChatHistory();
      setMessages([]);
      setDbContext(null);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  const analyzeCertificate = async (certificateId: string) => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await apiService.analyzeCertificate(certificateId);
      
      if (response.success) {
        const analysisMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**Certificate Analysis for ${response.certificate.common_name}:**\n\n${response.analysis}`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, analysisMessage]);
      } else {
        throw new Error(response.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing certificate:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Failed to analyze the certificate. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getDatabaseInsights = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await apiService.getDatabaseInsights();
      
      if (response.success) {
        const insightsMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**Database Insights:**\n\n${response.insights}`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, insightsMessage]);
      } else {
        throw new Error(response.message || 'Failed to get insights');
      }
    } catch (error) {
      console.error('Error getting database insights:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Failed to generate database insights. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-gray-900">🤖 Certificate AI Assistant</h2>
            {dbContext && (
              <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                {dbContext.certificateCount} certs • {dbContext.expiringSoon} expiring • {dbContext.expired} expired
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={getDatabaseInsights}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              📊 Get Insights
            </button>
            <button
              onClick={clearChat}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              🗑️ Clear Chat
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setInputMessage('What certificates are expiring soon?')}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200 border border-yellow-200"
            >
              🕐 Expiring Certificates
            </button>
            <button
              onClick={() => setInputMessage('Show me security recommendations for my certificates')}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200 border border-green-200"
            >
              🔒 Security Recommendations
            </button>
            <button
              onClick={() => setInputMessage('What are the best practices for certificate management?')}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200 border border-blue-200"
            >
              📋 Best Practices
            </button>
            {selectedCertificateId && (
              <button
                onClick={() => analyzeCertificate(selectedCertificateId)}
                disabled={isLoading}
                className="px-3 py-2 text-sm bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200 border border-purple-200"
              >
                🔍 Analyze Selected Certificate
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-700 mt-8">
              <div className="text-lg mb-4 font-medium">👋 Hi! I'm your Certificate AI Assistant</div>
              <div className="text-gray-600 mb-3">I can help you with:</div>
              <ul className="list-disc list-inside mt-2 text-left max-w-md mx-auto text-gray-600 space-y-1">
                <li>🔍 Certificate analysis and recommendations</li>
                <li>🛡️ Security best practices</li>
                <li>⏰ Expiration monitoring</li>
                <li>📊 Database insights</li>
                <li>📋 Certificate management guidance</li>
              </ul>
              <div className="mt-6 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border">
                💡 <strong>Tip:</strong> Use the quick action buttons above or type your question below to get started!
              </div>
            </div>
          )}
          
          {messages.map((message) => {
            console.log('Rendering message:', message);
            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-3 rounded-lg whitespace-pre-wrap shadow-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white border border-blue-700'
                      : 'bg-gray-50 text-gray-900 border border-gray-200'
                  }`}
                >
                  <div className="leading-relaxed">{message.content}</div>
                  <div className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-600'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask me about your certificates..."
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};