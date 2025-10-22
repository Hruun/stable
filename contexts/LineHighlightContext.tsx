import React, { createContext, useContext, useState, useCallback } from 'react';

export interface LineHighlightSettings {
    enabled: boolean;
    color: string;
    opacity: number;
    style: 'outline' | 'fill';
    thickness: number;
}

export interface LineHighlightContextType {
    // Settings
    settings: LineHighlightSettings;
    updateSettings: (partial: Partial<LineHighlightSettings>) => void;
    
    // Current line tracking
    currentLine: number;
    setCurrentLine: (line: number) => void;
    
    // Line navigation
    navigateUp: () => void;
    navigateDown: () => void;
    
    // Total lines tracking (set by editors)
    totalLines: number;
    setTotalLines: (total: number) => void;
}

const defaultSettings: LineHighlightSettings = {
    enabled: true,
    color: '#3b82f6', // blue-500
    opacity: 0.15,
    style: 'fill',
    thickness: 1
};

const LineHighlightContext = createContext<LineHighlightContextType | null>(null);

export const useLineHighlight = () => {
    const context = useContext(LineHighlightContext);
    if (!context) {
        throw new Error('useLineHighlight must be used within LineHighlightProvider');
    }
    return context;
};

export const LineHighlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<LineHighlightSettings>(() => {
        // Load from localStorage
        try {
            const saved = localStorage.getItem('line-highlight-settings');
            if (saved) {
                return { ...defaultSettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Failed to load line highlight settings:', error);
        }
        return defaultSettings;
    });
    
    const [currentLine, setCurrentLine] = useState(1);
    const [totalLines, setTotalLines] = useState(0);
    
    const updateSettings = useCallback((partial: Partial<LineHighlightSettings>) => {
        const newSettings = { ...settings, ...partial };
        setSettings(newSettings);
        
        // Save to localStorage
        try {
            localStorage.setItem('line-highlight-settings', JSON.stringify(newSettings));
        } catch (error) {
            console.warn('Failed to save line highlight settings:', error);
        }
    }, [settings]);
    
    const navigateUp = useCallback(() => {
        setCurrentLine(prev => Math.max(1, prev - 1));
    }, []);
    
    const navigateDown = useCallback(() => {
        setCurrentLine(prev => Math.min(totalLines, prev + 1));
    }, [totalLines]);
    
    const value: LineHighlightContextType = {
        settings,
        updateSettings,
        currentLine,
        setCurrentLine,
        navigateUp,
        navigateDown,
        totalLines,
        setTotalLines
    };
    
    return (
        <LineHighlightContext.Provider value={value}>
            {children}
        </LineHighlightContext.Provider>
    );
};