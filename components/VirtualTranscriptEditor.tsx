import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import type { MatchedWord } from '../types';
import { formatTimestamp, parseTimestamp } from '../services/processingService';

export interface VirtualTranscriptEditorHandle {
    insertTimestampAtCursor: (time: number) => void;
    insertSegmentTimestamp: (time: number, speakerLabel: string) => void;
    scrollToWord: (wordIndex: number) => void;
    getText: () => string;
    setText: (text: string) => void;
}

interface VirtualTranscriptEditorProps {
    words: MatchedWord[];
    onSeekToTime: (time: number | null) => void;
    onSaveTranscript: (words: MatchedWord[]) => void;
    onTranscriptPaste?: (text: string) => void;
    textZoom: number;
    isLineNumbersVisible: boolean;
    searchQuery: string;
    activeMatchIndex: number;
    onFindWord: (query: string) => void;
    onEditStart: () => void;
}

interface WordPosition {
    wordIndex: number;
    charStart: number;
    charEnd: number;
    lineIndex: number;
}

/**
 * VirtualTranscriptEditor - A hybrid approach combining a hidden textarea for editing
 * with a virtual rendering layer for display and word-level interactions.
 * 
 * Features:
 * - Always editable without mode switching
 * - Word-level click-to-play functionality
 * - Smart timestamp preservation during edits
 * - Real-time reconciliation between text and word data
 * - Seamless speaker tag and timestamp handling
 */
export const VirtualTranscriptEditor = forwardRef<VirtualTranscriptEditorHandle, VirtualTranscriptEditorProps>(({
    words,
    onSeekToTime,
    onSaveTranscript,
    onTranscriptPaste,
    textZoom,
    isLineNumbersVisible,
    searchQuery,
    activeMatchIndex,
    onFindWord,
    onEditStart
}, ref) => {
    // Core state
    const [text, setText] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [wordPositions, setWordPositions] = useState<WordPosition[]>([]);
    const [hoveredWordIndex, setHoveredWordIndex] = useState<number | null>(null);
    
    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const displayRef = useRef<HTMLDivElement>(null);
    const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const lastWordsRef = useRef<MatchedWord[]>(words);
    
    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, word: MatchedWord } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Generate display text from words
    const generateTextFromWords = useCallback((wordsArray: MatchedWord[]): string => {
        if (wordsArray.length === 0) return '';
        
        let result = '';
        let currentParagraph: string[] = [];
        
        wordsArray.forEach((word, index) => {
            if (word.isParagraphStart && index > 0) {
                // End current paragraph and start new one
                if (currentParagraph.length > 0) {
                    result += currentParagraph.join(' ') + '\n\n';
                    currentParagraph = [];
                }
                
                // Add timestamp and speaker if present
                if (word.start !== null) {
                    result += formatTimestamp(word.start) + ' ';
                }
                if (word.speakerLabel) {
                    result += word.speakerLabel + ': ';
                }
            } else if (index === 0) {
                // First word - add timestamp and speaker if present
                if (word.start !== null) {
                    result += formatTimestamp(word.start) + ' ';
                }
                if (word.speakerLabel) {
                    result += word.speakerLabel + ': ';
                }
            }
            
            currentParagraph.push(word.punctuated_word);
        });
        
        // Add remaining paragraph
        if (currentParagraph.length > 0) {
            result += currentParagraph.join(' ');
        }
        
        return result;
    }, []);

    // Initialize text from words
    useEffect(() => {
        if (!isEditing && words !== lastWordsRef.current) {
            const newText = generateTextFromWords(words);
            setText(newText);
            lastWordsRef.current = words;
        }
    }, [words, isEditing, generateTextFromWords]);

    // Calculate word positions in the text
    useEffect(() => {
        const positions: WordPosition[] = [];
        let charOffset = 0;
        let lineIndex = 0;
        const lines = text.split('\n');
        
        words.forEach((word, wordIndex) => {
            // Find this word in the text starting from charOffset
            const searchText = word.punctuated_word;
            const foundIndex = text.indexOf(searchText, charOffset);
            
            if (foundIndex !== -1) {
                // Calculate line index
                const textUpToWord = text.substring(0, foundIndex);
                lineIndex = textUpToWord.split('\n').length - 1;
                
                positions.push({
                    wordIndex,
                    charStart: foundIndex,
                    charEnd: foundIndex + searchText.length,
                    lineIndex
                });
                
                charOffset = foundIndex + searchText.length;
            }
        });
        
        setWordPositions(positions);
    }, [text, words]);

    // Reconcile text changes with word data
    const reconcileTextChanges = useCallback((newText: string): MatchedWord[] => {
        const lines = newText.split('\n');
        const reconciled: MatchedWord[] = [];
        let wordNumber = 1;
        
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;
            
            // Parse line for speaker and timestamp
            const match = trimmedLine.match(/^(?:((?:\d{2}:){1,2}\d{2}[.,]\d+)\s+)?(?:(S\d+|S\?|Speaker\s*\d+|[A-Z][a-zA-Z\s]*?):\s+)?(.*)$/);
            
            let timestamp: number | null = null;
            let speaker: string | null = null;
            let textContent = trimmedLine;
            
            if (match) {
                const [, timestampStr, speakerTag, content] = match;
                if (timestampStr) {
                    timestamp = parseTimestamp(timestampStr);
                }
                if (speakerTag) {
                    speaker = speakerTag;
                }
                if (content) {
                    textContent = content;
                }
            }
            
            // Split into words
            const wordsInLine = textContent.split(/\s+/).filter(w => w);
            
            wordsInLine.forEach((wordText, wordIndex) => {
                // Try to find matching word from original to preserve timestamps
                const originalWord = words.find(w => 
                    w.punctuated_word === wordText && 
                    Math.abs((w.number || 0) - wordNumber) < 10 // Within reasonable distance
                );
                
                reconciled.push({
                    number: wordNumber++,
                    punctuated_word: wordText,
                    cleaned_word: wordText.toLowerCase().replace(/[.,!?]/g, ''),
                    start: originalWord?.start ?? (wordIndex === 0 ? timestamp : null),
                    end: originalWord?.end ?? null,
                    isParagraphStart: lineIndex > 0 && wordIndex === 0,
                    speakerLabel: speaker || originalWord?.speakerLabel
                });
            });
        });
        
        return reconciled;
    }, [words]);

    // Handle text changes
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        setIsEditing(true);
        setCursorPosition(e.target.selectionStart);
    }, []);

    // Handle blur - save changes
    const handleBlur = useCallback(() => {
        if (isEditing) {
            const reconciledWords = reconcileTextChanges(text);
            onSaveTranscript(reconciledWords);
            setIsEditing(false);
        }
    }, [text, isEditing, reconcileTextChanges, onSaveTranscript]);

    // Handle focus
    const handleFocus = useCallback(() => {
        onEditStart();
        setIsEditing(true);
    }, [onEditStart]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleBlur();
        }
    }, [handleBlur]);

    // Handle word click
    const handleWordClick = useCallback((word: MatchedWord) => {
        if (word.start !== null) {
            onSeekToTime(word.start);
        }
    }, [onSeekToTime]);

    // Handle word context menu
    const handleWordContextMenu = useCallback((e: React.MouseEvent, word: MatchedWord) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, word });
    }, []);

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        
        if (contextMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [contextMenu]);

    // Auto-scroll to active search match
    useEffect(() => {
        if (activeMatchIndex !== -1) {
            const wordRef = wordRefs.current[activeMatchIndex];
            if (wordRef) {
                wordRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeMatchIndex]);

    // Handle paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        if (onTranscriptPaste) {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text/plain');
            onTranscriptPaste(pastedText);
        }
    }, [onTranscriptPaste]);

    // Imperative handle for parent component
    useImperativeHandle(ref, () => ({
        insertTimestampAtCursor: (time: number) => {
            if (textareaRef.current) {
                const textarea = textareaRef.current;
                const { selectionStart, selectionEnd } = textarea;
                const timestampText = `${formatTimestamp(time)} `;
                const newText = text.slice(0, selectionStart) + timestampText + text.slice(selectionEnd);
                setText(newText);
                
                // Set cursor after timestamp
                const newPosition = selectionStart + timestampText.length;
                setTimeout(() => {
                    textarea.selectionStart = newPosition;
                    textarea.selectionEnd = newPosition;
                    textarea.focus();
                }, 0);
            }
        },
        insertSegmentTimestamp: (time: number, speakerLabel: string) => {
            if (textareaRef.current) {
                const textarea = textareaRef.current;
                const { selectionStart, selectionEnd } = textarea;
                const insertText = `\n\n${formatTimestamp(time)} ${speakerLabel}: `;
                const newText = text.slice(0, selectionStart) + insertText + text.slice(selectionEnd);
                setText(newText);
                
                // Set cursor after insertion
                const newPosition = selectionStart + insertText.length;
                setTimeout(() => {
                    textarea.selectionStart = newPosition;
                    textarea.selectionEnd = newPosition;
                    textarea.focus();
                }, 0);
            }
        },
        scrollToWord: (wordIndex: number) => {
            const wordRef = wordRefs.current[wordIndex];
            if (wordRef) {
                wordRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        getText: () => text,
        setText: (newText: string) => {
            setText(newText);
            if (textareaRef.current) {
                textareaRef.current.value = newText;
            }
        }
    }), [text]);

    // Render visual layer with clickable words
    const renderVisualLayer = useMemo(() => {
        if (words.length === 0) {
            return (
                <div className="text-gray-500 text-center p-8">
                    <p>Transcript will appear here.</p>
                    <p className="mt-2 text-sm">Paste transcript text or use the chat to transcribe.</p>
                </div>
            );
        }

        let currentParagraph: React.JSX.Element[] = [];
        const paragraphs: React.JSX.Element[] = [];
        let paragraphKey = 0;
        
        words.forEach((word, index) => {
            const isMatch = searchQuery && word.punctuated_word.toLowerCase().includes(searchQuery.toLowerCase());
            const isActiveMatch = index === activeMatchIndex;
            const isHovered = hoveredWordIndex === index;
            
            const wordElement = (
                <span
                    key={`word-${index}`}
                    ref={el => { wordRefs.current[index] = el; }}
                    className={`
                        cursor-pointer transition-colors rounded px-0.5
                        ${isHovered ? 'bg-gray-700' : ''}
                        ${isActiveMatch ? 'bg-orange-500 text-white' : ''}
                        ${!isActiveMatch && isMatch ? 'bg-yellow-500/50' : ''}
                    `}
                    onClick={() => handleWordClick(word)}
                    onContextMenu={(e) => handleWordContextMenu(e, word)}
                    onMouseEnter={() => setHoveredWordIndex(index)}
                    onMouseLeave={() => setHoveredWordIndex(null)}
                >
                    {word.punctuated_word}
                </span>
            );
            
            if (word.isParagraphStart) {
                // Start new paragraph (including the very first word)
                if (currentParagraph.length > 0) {
                    paragraphs.push(
                        <div key={`para-${paragraphKey++}`} className="mb-4">
                            {currentParagraph}
                        </div>
                    );
                    currentParagraph = [];
                }
                
                // Add timestamp and speaker if present
                const metadata: React.JSX.Element[] = [];
                if (word.start !== null) {
                    metadata.push(
                        <span key="timestamp" className="font-mono text-sm text-brand-blue mr-3">
                            {formatTimestamp(word.start)}
                        </span>
                    );
                }
                if (word.speakerLabel) {
                    metadata.push(
                        <strong key="speaker" className="mr-2 text-gray-400">
                            {word.speakerLabel}:
                        </strong>
                    );
                }
                
                currentParagraph.push(...metadata, wordElement, <span key={`space-${index}`}> </span>);
            } else {
                currentParagraph.push(wordElement, <span key={`space-${index}`}> </span>);
            }
        });
        
        // Add last paragraph
        if (currentParagraph.length > 0) {
            paragraphs.push(
                <div key={`para-${paragraphKey}`} className="mb-4">
                    {currentParagraph}
                </div>
            );
        }
        
        return <>{paragraphs}</>;
    }, [words, searchQuery, activeMatchIndex, hoveredWordIndex, handleWordClick, handleWordContextMenu]);

    return (
        <div className="relative h-full">
            {/* Hidden textarea for editing */}
            <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="absolute inset-0 opacity-0 pointer-events-auto z-10 resize-none p-6"
                style={{
                    fontSize: `${textZoom}rem`,
                    lineHeight: `${1.75 * textZoom}rem`,
                    caretColor: 'transparent'
                }}
            />
            
            {/* Visual display layer */}
            <div
                ref={displayRef}
                className={`
                    h-full bg-gray-900 rounded-lg shadow-inner text-gray-300
                    overflow-y-auto scrollbar-thin p-6 cursor-text
                    ${isEditing ? 'ring-2 ring-brand-blue/50' : ''}
                `}
                style={{
                    fontSize: `${textZoom}rem`,
                    lineHeight: `${1.75 * textZoom}rem`
                }}
                onClick={() => textareaRef.current?.focus()}
            >
                {isLineNumbersVisible && (
                    <div className="float-left mr-4 text-gray-600 font-mono text-sm select-none">
                        {words.map((word, i) => (
                            word.isParagraphStart && (
                                <div key={i} style={{ lineHeight: `${1.75 * textZoom}rem` }}>
                                    {word.number}
                                </div>
                            )
                        ))}
                    </div>
                )}
                
                <div className="min-h-full">
                    {renderVisualLayer}
                </div>
                
                {/* Cursor indicator when editing */}
                {isEditing && (
                    <div className="absolute top-2 right-2 text-xs text-brand-blue bg-gray-800 px-2 py-1 rounded">
                        Editing...
                    </div>
                )}
            </div>
            
            {/* Context menu */}
            {contextMenu && (
                <div
                    ref={menuRef}
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="fixed bg-gray-700 text-white rounded-md shadow-lg p-1 z-50 text-sm"
                >
                    <ul className="space-y-1">
                        <li
                            onClick={() => {
                                handleWordClick(contextMenu.word);
                                setContextMenu(null);
                            }}
                            className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer"
                        >
                            Play word
                        </li>
                        <li
                            onClick={() => {
                                window.open(
                                    `https://www.google.com/search?q=${encodeURIComponent(contextMenu.word.punctuated_word)}`,
                                    '_blank'
                                );
                                setContextMenu(null);
                            }}
                            className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer"
                        >
                            Search word
                        </li>
                        <li
                            onClick={() => {
                                onFindWord(contextMenu.word.punctuated_word);
                                setContextMenu(null);
                            }}
                            className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer"
                        >
                            Find...
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
});

VirtualTranscriptEditor.displayName = 'VirtualTranscriptEditor';