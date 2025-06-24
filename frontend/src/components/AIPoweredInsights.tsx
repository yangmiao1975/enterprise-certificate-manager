/// <reference types="vite/client" />

import React, { useState, useEffect, useCallback } from 'react';
import { getCertificateManagementInsights, getChatResponse } from '../services/geminiService';
import { ICONS } from '../constants';
import { AIChatMessage, Certificate } from '../types';

interface AIPoweredInsightsProps {
    selectedCertificateCN?: string | null;
    certificates: Certificate[];
}

const AIPoweredInsights: React.FC<AIPoweredInsightsProps> = ({ selectedCertificateCN, certificates }) => {
  const [generalInsights, setGeneralInsights] = useState<string>('');
  const [isLoadingGeneral, setIsLoadingGeneral] = useState<boolean>(true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'general' | 'chat'>('general');

  const fetchGeneralInsights = useCallback(async () => {
    setIsLoadingGeneral(true);
    setErrorGeneral(null);
    try {
      const insights = await getCertificateManagementInsights();
      setGeneralInsights(insights);
    } catch (err) {
      setErrorGeneral('Failed to load general insights.');
      console.error(err);
    } finally {
      setIsLoadingGeneral(false);
    }
  }, []);

  useEffect(() => {
    fetchGeneralInsights();
  }, [fetchGeneralInsights]);

  useEffect(() => {
    if (selectedCertificateCN && activeTab === 'chat') {
        const autoMessage = `Tell me more about the certificate: ${selectedCertificateCN}`;
        setChatInput(autoMessage);
    }
  }, [selectedCertificateCN, activeTab]);

  const handleSendChatMessage = async (messageToSend?: string) => {
    const currentMessage = (messageToSend || chatInput).trim();
    if (!currentMessage) return;

    setIsLoadingChat(true);
    const newHumanMessage: AIChatMessage = { role: 'user', text: currentMessage };
    setChatHistory(prev => [...prev, newHumanMessage]);
    setChatInput('');

    try {
      const aiResponseText = await getChatResponse([...chatHistory, newHumanMessage], currentMessage, certificates);
      const newAiMessage: AIChatMessage = { role: 'model', text: aiResponseText };
      setChatHistory(prev => [...prev, newAiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorAiMessage: AIChatMessage = { role: 'model', text: "Sorry, I couldn't get a response. Please try again." };
      setChatHistory(prev => [...prev, errorAiMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const formatInsights = (text: string) => {
    return text.split('\n\n').map((paragraph, pIndex) => (
      <div key={pIndex} className="mb-4 text-slate-700 dark:text-slate-300">
        {paragraph.split('\n').map((line, lIndex) => {
          if (line.startsWith('**') && line.includes(':**')) {
            const [title, ...rest] = line.split(':**');
            return (<p key={lIndex}><strong className="text-slate-800 dark:text-slate-100">{title.replace(/\*\*/g, '')}:</strong>{rest.join(':**')}</p>);
          }
          return <p key={lIndex}>{line}</p>;
        })}
      </div>
    ));
  };

  return (
    <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 mt-8">
      <div className="flex items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
        {ICONS.lightbulb}
        <h2 className="ml-2 text-xl font-semibold text-slate-800 dark:text-slate-100">AI-Powered Insights</h2>
      </div>
      <div className="mb-4">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-4 -mb-px font-medium text-sm focus:outline-none ${activeTab === 'general' ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            General Advice
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-4 -mb-px font-medium text-sm focus:outline-none ${activeTab === 'chat' ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            AI Chat
          </button>
        </div>
      </div>
      {activeTab === 'general' && (
        <>
          {isLoadingGeneral && (
            <div className="flex items-center justify-center h-40">
              <svg className="animate-spin h-8 w-8 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="ml-2 text-slate-600 dark:text-slate-400">Loading insights...</p>
            </div>
          )}
          {errorGeneral && <p className="text-red-500">{errorGeneral}</p>}
          {!isLoadingGeneral && !errorGeneral && generalInsights && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {formatInsights(generalInsights)}
            </div>
          )}
        </>
      )}
      {activeTab === 'chat' && (
        <div className="flex flex-col h-[50vh]">
          <div className="flex-grow overflow-y-auto mb-4 p-2 space-y-3 bg-slate-50 dark:bg-slate-700 rounded-md">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-sky-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
             {isLoadingChat && (
                <div className="flex justify-start">
                    <div className="max-w-[70%] p-3 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100">
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-300"></div>
                        </div>
                    </div>
                </div>
            )}
          </div>
          <div className="flex items-center border-t border-slate-200 dark:border-slate-700 pt-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoadingChat && handleSendChatMessage()}
              placeholder={selectedCertificateCN ? `Ask about ${selectedCertificateCN} or general topics...` : "Ask about certificate management..."}
              className="flex-grow p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 dark:bg-slate-700 dark:text-slate-100"
              disabled={isLoadingChat}
            />
            <button
              onClick={() => handleSendChatMessage()}
              disabled={isLoadingChat || !chatInput.trim()}
              className="ml-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPoweredInsights; 