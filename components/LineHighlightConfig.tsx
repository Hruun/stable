import React, { useState, useRef, useEffect } from 'react';
import { useLineHighlight } from '../contexts/LineHighlightContext';

interface LineHighlightConfigProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement>;
}

export const LineHighlightConfig: React.FC<LineHighlightConfigProps> = ({ isOpen, onClose, anchorRef }) => {
    const { settings, updateSettings } = useLineHighlight();
    const [localSettings, setLocalSettings] = useState(settings);
    const configRef = useRef<HTMLDivElement>(null);
    
    // Update local settings when global settings change
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);
    
    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (configRef.current && 
                !configRef.current.contains(event.target as Node) &&
                anchorRef.current &&
                !anchorRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, anchorRef]);
    
    if (!isOpen) return null;
    
    const handleSettingChange = (key: keyof typeof localSettings, value: any) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        updateSettings(newSettings);
    };
    
    // Common color presets
    const colorPresets = [
        { name: 'Blue', color: '#3b82f6' },
        { name: 'Green', color: '#10b981' },
        { name: 'Yellow', color: '#f59e0b' },
        { name: 'Purple', color: '#8b5cf6' },
        { name: 'Pink', color: '#ec4899' },
        { name: 'Orange', color: '#f97316' },
    ];
    
    return (
        <div 
            ref={configRef}
            className="absolute z-50 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4"
            style={{
                top: '100%',
                right: 0,
            }}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">
                        Line Highlighting
                    </label>
                    <input
                        type="checkbox"
                        checked={localSettings.enabled}
                        onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                        className="w-4 h-4 text-brand-blue bg-gray-700 border-gray-600 rounded focus:ring-brand-blue focus:ring-2"
                    />
                </div>
                
                {localSettings.enabled && (
                    <>
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-2">
                                Highlight Style
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSettingChange('style', 'fill')}
                                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                                        localSettings.style === 'fill'
                                            ? 'bg-brand-blue border-brand-blue text-white'
                                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    Fill
                                </button>
                                <button
                                    onClick={() => handleSettingChange('style', 'outline')}
                                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                                        localSettings.style === 'outline'
                                            ? 'bg-brand-blue border-brand-blue text-white'
                                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    Outline
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-2">
                                Color
                            </label>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                                {colorPresets.map((preset) => (
                                    <button
                                        key={preset.color}
                                        onClick={() => handleSettingChange('color', preset.color)}
                                        className={`p-2 rounded border-2 transition-all ${
                                            localSettings.color === preset.color
                                                ? 'border-white'
                                                : 'border-gray-600 hover:border-gray-500'
                                        }`}
                                        style={{ backgroundColor: preset.color }}
                                        title={preset.name}
                                    >
                                        <div className="w-4 h-4 rounded" />
                                    </button>
                                ))}
                            </div>
                            <input
                                type="color"
                                value={localSettings.color}
                                onChange={(e) => handleSettingChange('color', e.target.value)}
                                className="w-full h-8 rounded border border-gray-600 bg-gray-700"
                                title="Custom Color"
                            />
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-2">
                                Opacity: {Math.round(localSettings.opacity * 100)}%
                            </label>
                            <input
                                type="range"
                                min="0.05"
                                max="0.5"
                                step="0.05"
                                value={localSettings.opacity}
                                onChange={(e) => handleSettingChange('opacity', parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                            />
                        </div>
                        
                        {localSettings.style === 'outline' && (
                            <div>
                                <label className="text-sm font-medium text-gray-300 block mb-2">
                                    Border Thickness: {localSettings.thickness}px
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="4"
                                    step="1"
                                    value={localSettings.thickness}
                                    onChange={(e) => handleSettingChange('thickness', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                                />
                            </div>
                        )}
                        
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-2">
                                Preview
                            </label>
                            <div className="bg-gray-900 rounded p-2 font-mono text-sm">
                                <div className="flex">
                                    <span className="text-gray-600 mr-4">42</span>
                                    <div 
                                        className="flex-1 px-2 py-1"
                                        style={{
                                            ...(localSettings.style === 'fill' ? {
                                                backgroundColor: `${localSettings.color}${Math.round(localSettings.opacity * 255).toString(16).padStart(2, '0')}`,
                                                borderRadius: '3px'
                                            } : {
                                                border: `${localSettings.thickness}px solid ${localSettings.color}`,
                                                borderRadius: '3px',
                                                opacity: localSettings.opacity + 0.5
                                            })
                                        }}
                                    >
                                        This is a sample highlighted line
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};