import React, { useContext } from 'react';
import { Header } from './components/Header';
import { Editor } from './components/Editor';
import { VirtualEditor } from './components/VirtualEditor';
import { LeftSidebar } from './components/LeftSidebar';
import { Chat } from './components/Chat';
import { SettingsModal } from './components/SettingsModal';
import { SpeakerEditorModal } from './components/SpeakerEditorModal';
import { TextSpeakerEditorModal } from './components/TextSpeakerEditorModal';
import { GeminiProductionEditor } from './components/GeminiProductionEditor';
import { GPT4oProductionEditor } from './components/GPT4oProductionEditor';
import { DataProvider, useData } from './contexts/DataContext';
import { VirtualDataProvider, useVirtualData } from './contexts/VirtualDataContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { ChatProvider, useChat } from './contexts/ChatContext';

const ClassicEditorContent: React.FC = () => {
    const { transcriptVersions, currentVersionIndex, setCurrentVersionIndex } = useData();
    const { leftSidebarOpen, chatOpen, setChatOpen } = useUI();
    const { isLoading, loadingMessage } = useChat();

    return (
        <>
            <LeftSidebar
                isOpen={leftSidebarOpen}
                versions={transcriptVersions}
                currentVersionIndex={currentVersionIndex}
                onSelectVersion={setCurrentVersionIndex}
            />
            <div className="flex-1 flex flex-col relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-blue mx-auto"></div>
                            <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
                        </div>
                    </div>
                )}
                <Chat
                    isOpen={chatOpen}
                    onClose={() => setChatOpen(false)}
                />
                <Editor />
            </div>
        </>
    );
};

const VirtualEditorContent: React.FC = () => {
    const { transcriptVersions, currentVersionIndex, setCurrentVersionIndex } = useVirtualData();
    const { leftSidebarOpen, chatOpen, setChatOpen } = useUI();
    const { isLoading, loadingMessage } = useChat();

    return (
        <>
            <LeftSidebar
                isOpen={leftSidebarOpen}
                versions={transcriptVersions}
                currentVersionIndex={currentVersionIndex}
                onSelectVersion={setCurrentVersionIndex}
            />
            <div className="flex-1 flex flex-col relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-blue mx-auto"></div>
                            <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
                        </div>
                    </div>
                )}
                <Chat
                    isOpen={chatOpen}
                    onClose={() => setChatOpen(false)}
                />
                <VirtualEditor />
            </div>
        </>
    );
};

const AppContent: React.FC = () => {
    const {
        isSettingsOpen, setIsSettingsOpen,
        isSpeakerEditorOpen, setIsSpeakerEditorOpen,
        isTextSpeakerEditorOpen, setIsTextSpeakerEditorOpen,
        currentTab,
    } = useUI();

    return (
        <div className="flex flex-col h-screen font-sans bg-gray-900 text-gray-200 overflow-hidden">
            <Header />
            <SettingsModal />
            <SpeakerEditorModal />
            <TextSpeakerEditorModal />
            <main className="flex flex-1 overflow-hidden relative z-10">
                {currentTab === 'editor' && <ClassicEditorContent />}
                {currentTab === 'virtual' && (
                    <VirtualDataProvider>
                        <VirtualEditorContent />
                    </VirtualDataProvider>
                )}
                {currentTab === 'gemini' && (
                    <div className="flex-1 flex flex-col relative">
                        <GeminiProductionEditor />
                    </div>
                )}
                {currentTab === 'gpt4o' && (
                    <div className="flex-1 flex flex-col relative">
                        <GPT4oProductionEditor />
                    </div>
                )}
            </main>
        </div>
    );
};


const App: React.FC = () => {
    return (
        <DataProvider>
            <UIProvider>
                <ChatProvider>
                    <AppContent />
                </ChatProvider>
            </UIProvider>
        </DataProvider>
    );
};

export default App;