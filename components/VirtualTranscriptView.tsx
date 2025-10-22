import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { MatchedWord } from '../types';
import { formatTimestamp, parsePastedTranscript, parseTimestamp } from '../services/processingService';

interface VirtualTranscriptViewProps {
    words: MatchedWord[];
    onSeekToTime: (time: number | null) => void;
    onSaveTranscript: (words: MatchedWord[]) => void;
    onTranscriptPaste: (text: string) => void;
    textZoom: number;
    isLineNumbersVisible: boolean;
    searchQuery: string;
    activeMatchIndex: number;
    onFindWord: (query: string) => void;
    onEditStart: () => void;
}

export interface VirtualTranscriptViewHandle {
    insertTimestampAtCursor: (time: number) => void;
    insertSegmentTimestamp: (time: number, speakerLabel: string) => void;
    scrollToWord: (wordIndex: number) => void;
    getText: () => string;
    setText: (text: string) => void;
}

/**
 * VirtualTranscriptView - A hybrid dual-layer approach combining a hidden textarea for editing
 * with a visual rendering layer for display and word-level interactions.
 * 
 * Features:
 * - Always editable without mode switching
 * - Word-level click-to-play functionality
 * - Smart timestamp preservation during edits
 * - Real-time reconciliation between text and word data
 * - Seamless speaker tag and timestamp handling
 */
const VirtualTranscriptView = forwardRef<VirtualTranscriptViewHandle, VirtualTranscriptViewProps>(({
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
                    result += currentParagraph.join(' ') + '\n';
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

    // Reconcile text changes back to word data structure
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
                const insertText = `\n${formatTimestamp(time)} ${speakerLabel}: `;
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
        }
    }), [text]);

    // Visual rendering layer 
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
            
            if (word.isParagraphStart && index > 0) {
                // Start new paragraph
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
            } else if (index === 0) {
                // First word - add timestamp and speaker if present
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
        <div className="h-full">
            {!isEditing ? (
                // Visual display layer for viewing and word interactions
                <div
                    ref={displayRef}
                    className="h-full bg-gray-900 rounded-lg shadow-inner text-gray-300 overflow-y-auto scrollbar-thin p-6 cursor-text"
                    style={{
                        fontSize: `${textZoom}rem`,
                        lineHeight: `${1.75 * textZoom}rem`
                    }}
                    onClick={() => {
                        setIsEditing(true);
                        onEditStart();
                        setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
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
                </div>
            ) : (
                // Editing mode with textarea
                <div className="h-full relative">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleTextChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        className="w-full h-full p-6 bg-gray-900 text-gray-200 border-none outline-none resize-none rounded-lg shadow-inner ring-2 ring-brand-blue/50"
                        style={{
                            fontSize: `${textZoom}rem`,
                            lineHeight: `${1.75 * textZoom}rem`
                        }}
                        placeholder="Enter transcript..."
                        autoFocus
                    />
                    <div className="absolute top-2 right-2 text-xs text-brand-blue bg-gray-800 px-2 py-1 rounded">
                        Editing... (Click outside to save)
                    </div>
                </div>
            )}
            
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

VirtualTranscriptView.displayName = 'VirtualTranscriptView';

export { VirtualTranscriptView };