// FIX: import useRef from react
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ShortcutConfig, UIContextType } from '../types';
import { useData } from './DataContext';

const UIContext = createContext<UIContextType | null>(null);

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
};

const DEFAULT_SHORTCUTS: ShortcutConfig = {
    playPause: ' ',
    rewind: 'ArrowLeft',
    forward: 'ArrowRight',
    undo: 'Control+z',
    redo: 'Control+y',
    interpolateEdits: 'Control+s',
    toggleLineNumbers: 'Control+l',
};

const loadInitialState = () => {
    try {
        const savedStateJSON = localStorage.getItem('autosave-ui-state');
        if (savedStateJSON) return JSON.parse(savedStateJSON);
    } catch (e) { console.error("Could not parse saved UI state", e); }
    return null;
};

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initialSavedState = useRef(loadInitialState()).current;
    
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(initialSavedState?.leftSidebarOpen ?? true);
    const [chatOpen, setChatOpen] = useState(initialSavedState?.chatOpen ?? false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSpeakerEditorOpen, setIsSpeakerEditorOpen] = useState(false);
    const [isTextSpeakerEditorOpen, setIsTextSpeakerEditorOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState<'editor' | 'virtual' | 'gemini' | 'gpt4o'>(initialSavedState?.currentTab ?? 'editor');

    const [isTimelineVisible, setIsTimelineVisible] = useState(initialSavedState?.isTimelineVisible ?? true);
    const [isLineNumbersVisible, setIsLineNumbersVisible] = useState(initialSavedState?.isLineNumbersVisible ?? true);
    const [timelineZoom, setTimelineZoom] = useState(initialSavedState?.timelineZoom ?? 1);
    const [textZoom, setTextZoom] = useState(initialSavedState?.textZoom ?? 1);
    const [volume, setVolume] = useState(initialSavedState?.volume ?? 1);
    const [lastPlaybackTime, setLastPlaybackTime] = useState(initialSavedState?.lastPlaybackTime ?? 0);

    const [shortcuts, setShortcuts] = useState<ShortcutConfig>(() => {
        try {
            const saved = localStorage.getItem('transcription-editor-shortcuts');
            return saved ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) } : DEFAULT_SHORTCUTS;
        } catch { return DEFAULT_SHORTCUTS; }
    });
    
    // Data context is a dependency for shortcuts
    const { undo, redo, audioRef } = useData();

    useEffect(() => {
        const stateToSave = {
            leftSidebarOpen, chatOpen, isTimelineVisible, isLineNumbersVisible,
            timelineZoom, textZoom, volume, lastPlaybackTime, currentTab,
        };
        localStorage.setItem('autosave-ui-state', JSON.stringify(stateToSave));
    }, [leftSidebarOpen, chatOpen, isTimelineVisible, isLineNumbersVisible, timelineZoom, textZoom, volume, lastPlaybackTime, currentTab]);
    
    const updateShortcuts = (newShortcuts: ShortcutConfig) => {
        setShortcuts(newShortcuts);
        localStorage.setItem('transcription-editor-shortcuts', JSON.stringify(newShortcuts));
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target.isContentEditable && !target.closest('.transcript-editor-view'))) return;

            const parts: string[] = [];
            if (e.ctrlKey) parts.push('Control');
            if (e.metaKey) parts.push('Meta');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            
            const key = e.key === ' ' ? ' ' : e.key;
            if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) parts.push(key);
            
            const keySignatureLower = parts.join('+').toLowerCase();

            const handlePlayPauseShortcut = () => {
                const audio = audioRef.current;
                if (!audio) return;

                if (audio.paused) {
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            if (error.name !== 'AbortError') {
                                console.error('Audio playback failed from shortcut:', error);
                            }
                        });
                    }
                } else {
                    audio.pause();
                }
            };
            
            const shortcutMap: { [key: string]: () => void } = {
                [shortcuts.playPause.toLowerCase()]: handlePlayPauseShortcut,
                [shortcuts.rewind.toLowerCase()]: () => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 3); },
                [shortcuts.forward.toLowerCase()]: () => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || Infinity, audioRef.current.currentTime + 3); },
                [shortcuts.toggleLineNumbers.toLowerCase()]: () => setIsLineNumbersVisible(v => !v),
                [shortcuts.undo.toLowerCase()]: undo,
                [shortcuts.redo.toLowerCase()]: redo,
            };

            if (shortcutMap[keySignatureLower]) {
                e.preventDefault();
                shortcutMap[keySignatureLower]();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, audioRef, undo, redo, setIsLineNumbersVisible]);

    const value: UIContextType = {
        leftSidebarOpen, setLeftSidebarOpen, chatOpen, setChatOpen, isSettingsOpen, setIsSettingsOpen,
        isSpeakerEditorOpen, setIsSpeakerEditorOpen, isTextSpeakerEditorOpen, setIsTextSpeakerEditorOpen,
        isTimelineVisible, setIsTimelineVisible, isLineNumbersVisible, setIsLineNumbersVisible,
        timelineZoom, setTimelineZoom, textZoom, setTextZoom, volume, setVolume,
        lastPlaybackTime, setLastPlaybackTime, shortcuts, updateShortcuts,
        currentTab, setCurrentTab,
    };

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};