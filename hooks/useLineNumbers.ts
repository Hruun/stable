import React, { useMemo, useRef } from 'react';
import type { MatchedWord } from '../types';

interface LineInfo {
    lineNumber: number;
    startWordIndex: number;
    endWordIndex: number;
    isWrapped: boolean;
    originalLineNumber?: number; // For wrapped lines, reference to the original line
}

interface UseLineNumbersReturn {
    lines: LineInfo[];
    totalLines: number;
    getLineFromWordIndex: (wordIndex: number) => number;
    getLineFromCursorPosition: (position: number, text: string) => number;
    getWordIndexFromLine: (lineNumber: number) => number;
}

export const useLineNumbers = (
    words: MatchedWord[],
    containerRef: React.RefObject<HTMLElement>,
    textZoom: number = 1
): UseLineNumbersReturn => {
    return useMemo(() => {
        if (!words.length || !containerRef.current) {
            return {
                lines: [],
                totalLines: 0,
                getLineFromWordIndex: () => 1,
                getLineFromCursorPosition: () => 1,
                getWordIndexFromLine: () => 0,
            };
        }

        const container = containerRef.current;
        const containerWidth = container.clientWidth - 48; // Account for padding
        
        // Create a temporary measurement element
        const measurer = document.createElement('div');
        measurer.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: ${textZoom}rem;
            line-height: 1.75;
            white-space: nowrap;
            visibility: hidden;
        `;
        document.body.appendChild(measurer);

        const lines: LineInfo[] = [];
        let currentLineNumber = 1;
        let currentLineStartWord = 0;
        let currentLineWidth = 0;
        let currentLineWords: string[] = [];

        try {
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const wordText = word.punctuated_word + ' ';
                
                // Check if this word starts a new paragraph
                if (word.isParagraphStart && i > 0) {
                    // Complete current line if it has content
                    if (currentLineWords.length > 0) {
                        lines.push({
                            lineNumber: currentLineNumber++,
                            startWordIndex: currentLineStartWord,
                            endWordIndex: i - 1,
                            isWrapped: false
                        });
                    }
                    
                    // Start new paragraph/line
                    currentLineStartWord = i;
                    currentLineWidth = 0;
                    currentLineWords = [];
                    
                    // Add timestamp and speaker if present
                    let prefixWidth = 0;
                    if (word.start !== null) {
                        measurer.textContent = `${formatTimestamp(word.start)} `;
                        prefixWidth += measurer.offsetWidth;
                    }
                    if (word.speakerLabel) {
                        measurer.textContent = `${word.speakerLabel}: `;
                        prefixWidth += measurer.offsetWidth;
                    }
                    currentLineWidth += prefixWidth;
                }
                
                // Measure word width
                measurer.textContent = wordText;
                const wordWidth = measurer.offsetWidth;
                
                // Check if adding this word would exceed line width
                if (currentLineWidth + wordWidth > containerWidth && currentLineWords.length > 0) {
                    // Complete current line
                    lines.push({
                        lineNumber: currentLineNumber++,
                        startWordIndex: currentLineStartWord,
                        endWordIndex: i - 1,
                        isWrapped: true
                    });
                    
                    // Start new wrapped line
                    currentLineStartWord = i;
                    currentLineWidth = wordWidth;
                    currentLineWords = [wordText];
                } else {
                    // Add word to current line
                    currentLineWidth += wordWidth;
                    currentLineWords.push(wordText);
                }
            }
            
            // Complete final line
            if (currentLineWords.length > 0) {
                lines.push({
                    lineNumber: currentLineNumber++,
                    startWordIndex: currentLineStartWord,
                    endWordIndex: words.length - 1,
                    isWrapped: false
                });
            }
            
        } finally {
            document.body.removeChild(measurer);
        }

        const getLineFromWordIndex = (wordIndex: number): number => {
            for (const line of lines) {
                if (wordIndex >= line.startWordIndex && wordIndex <= line.endWordIndex) {
                    return line.lineNumber;
                }
            }
            return 1;
        };

        const getLineFromCursorPosition = (position: number, text: string): number => {
            if (!text || position < 0) return 1;
            
            const textUpToCursor = text.substring(0, position);
            const lineBreaksCount = (textUpToCursor.match(/\n/g) || []).length;
            return Math.min(lineBreaksCount + 1, lines.length);
        };

        const getWordIndexFromLine = (lineNumber: number): number => {
            const line = lines.find(l => l.lineNumber === lineNumber);
            return line ? line.startWordIndex : 0;
        };

        return {
            lines,
            totalLines: currentLineNumber - 1,
            getLineFromWordIndex,
            getLineFromCursorPosition,
            getWordIndexFromLine,
        };
    }, [words, containerRef, textZoom]);
};

// Helper function for timestamp formatting
function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    } else {
        return `${secs}.${ms.toString().padStart(3, '0')}`;
    }
}