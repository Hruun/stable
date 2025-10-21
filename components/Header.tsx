import React, { memo, useState } from 'react';
import { useUI } from '../contexts/UIContext';
import { PanelLeftIcon, MessageSquareIcon, BotIcon, SettingsIcon, UsersIcon, EditTextIcon } from './icons/Icons';
import DebugPanel from './DebugPanel';

export const Header: React.FC = memo(() => {
    const { 
        setLeftSidebarOpen, 
        setChatOpen, 
        setIsSettingsOpen, 
        setIsSpeakerEditorOpen, 
        setIsTextSpeakerEditorOpen,
        currentTab,
        setCurrentTab
    } = useUI();

    const [debugPanelOpen, setDebugPanelOpen] = useState(false);

    return (
        <header className="flex items-center justify-between bg-gray-800 p-2 border-b border-gray-700 shadow-md h-14 shrink-0 relative z-30">
            <div className="flex items-center space-x-2">
                <button onClick={() => setLeftSidebarOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue">
                    <PanelLeftIcon className="w-5 h-5" />
                </button>
                 <div className="flex items-center space-x-3">
                   <BotIcon className="w-7 h-7 text-brand-blue" />
                    <h1 className="text-xl font-bold text-gray-100 tracking-tight">Gemini Transcription AI Editor</h1>
                    
                    {/* Tab Switcher */}
                    <div className="ml-6 flex bg-gray-700 rounded-md p-1">
                        <button
                            onClick={() => setCurrentTab('editor')}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                currentTab === 'editor' 
                                    ? 'bg-brand-blue text-white' 
                                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            📝 Classic Editor
                        </button>
                        <button
                            onClick={() => setCurrentTab('virtual')}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                currentTab === 'virtual' 
                                    ? 'bg-brand-blue text-white' 
                                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            ⚡ Virtual Editor
                        </button>
                        <button
                            onClick={() => setCurrentTab('gemini')}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                currentTab === 'gemini' 
                                    ? 'bg-brand-blue text-white' 
                                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            🤖 Gemini AI
                        </button>
                        <button
                            onClick={() => setCurrentTab('gpt4o')}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                currentTab === 'gpt4o' 
                                    ? 'bg-brand-blue text-white' 
                                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                            🧠 GPT-4o
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                 <button onClick={() => setIsSpeakerEditorOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="Timeline Speaker Configuration">
                    <UsersIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setIsTextSpeakerEditorOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="Text Speaker Configuration">
                    <EditTextIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setDebugPanelOpen(true)} 
                    className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" 
                    title="Debug Panel - Eye-Bleeding Detail Logs"
                >
                    <span className="text-base">🐛</span>
                </button>
                 <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="Settings">
                    <SettingsIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setChatOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="AI Assistant">
                    <MessageSquareIcon className="w-5 h-5" />
                </button>
            </div>
            
            {/* Debug Panel */}
            <DebugPanel 
                isOpen={debugPanelOpen} 
                onClose={() => setDebugPanelOpen(false)} 
            />
        </header>
    );
});