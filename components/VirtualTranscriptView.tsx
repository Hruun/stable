import React, { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { MatchedWord, TranscriptParagraph } from '../types';
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
}

// A virtualized version of the transcript view for better performance with large transcripts
// This is a simplified virtual implementation focusing on rendering performance
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
    const [isEditing, setIsEditing] = useState(false);
    const [editableText, setEditableText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, word: MatchedWord } | null>(null);

    // Convert words to display text
    const displayText = useMemo(() => {
        let text = '';
        let currentLine: string[] = [];

        words.forEach(word => {
            if (word.isParagraphStart && currentLine.length > 0) {
                text += currentLine.join(' ') + '\n';
                currentLine = [];
            }
            if (word.isParagraphStart) {
                const speaker = word.speakerLabel;
                const timestamp = word.start !== null ? formatTimestamp(word.start) : null;
                if (timestamp) text += `${timestamp} `;
                if (speaker) text += `${speaker}: `;
            }
            currentLine.push(word.punctuated_word);
        });

        if (currentLine.length > 0) {
            text += currentLine.join(' ');
        }

        return text;
    }, [words]);

    useEffect(() => {
        setEditableText(displayText);
    }, [displayText]);

    // Handle context menu click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        if (contextMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [contextMenu]);

    const handleStartEdit = useCallback(() => {
        setIsEditing(true);
        setEditableText(displayText);
        onEditStart();
        setTimeout(() => {
            textAreaRef.current?.focus();
        }, 0);
    }, [displayText, onEditStart]);

    const handleSaveEdit = useCallback(() => {
        try {
            const newWords = parsePastedTranscript(editableText);
            onSaveTranscript(newWords);
            setIsEditing(false);
        } catch (error) {
            console.error('Error parsing edited transcript:', error);
            alert('Error parsing transcript. Please check formatting.');
        }
    }, [editableText, onSaveTranscript]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setEditableText(displayText);
    }, [displayText]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleCancelEdit();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSaveEdit();
        }
    }, [handleCancelEdit, handleSaveEdit]);

    const handleTimestampClick = useCallback((word: MatchedWord) => {
        if (word.start !== null) {
            onSeekToTime(word.start);
        }
    }, [onSeekToTime]);

    const handleDoubleClick = useCallback((word: MatchedWord) => {
        if (word.punctuated_word && !isEditing) {
            onFindWord(word.punctuated_word);
        }
    }, [onFindWord, isEditing]);

    const insertTimestampAtCursor = useCallback((time: number) => {
        if (!isEditing || !textAreaRef.current) return;
        
        const textarea = textAreaRef.current;
        const cursorPos = textarea.selectionStart;
        const timestamp = `[${formatTimestamp(time)}]`;
        const beforeCursor = editableText.substring(0, cursorPos);
        const afterCursor = editableText.substring(cursorPos);
        
        const newText = beforeCursor + timestamp + afterCursor;
        setEditableText(newText);
        
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = cursorPos + timestamp.length;
            textarea.focus();
        }, 0);
    }, [isEditing, editableText]);

    const insertSegmentTimestamp = useCallback((time: number, speakerLabel: string) => {
        if (!isEditing || !textAreaRef.current) return;
        
        const textarea = textAreaRef.current;
        const cursorPos = textarea.selectionStart;
        const timestamp = `\n[${formatTimestamp(time)}] ${speakerLabel}: `;
        const beforeCursor = editableText.substring(0, cursorPos);
        const afterCursor = editableText.substring(cursorPos);
        
        const newText = beforeCursor + timestamp + afterCursor;
        setEditableText(newText);
        
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = cursorPos + timestamp.length;
            textarea.focus();
        }, 0);
    }, [isEditing, editableText]);

    const scrollToWord = useCallback((wordIndex: number) => {
        // For virtual view, we'll scroll to the approximate position
        // This is a simplified implementation
        if (containerRef.current && wordIndex >= 0 && wordIndex < words.length) {
            const word = words[wordIndex];
            if (word.start !== null) {
                // Scroll based on word position in the text
                const wordRatio = wordIndex / words.length;
                const scrollHeight = containerRef.current.scrollHeight - containerRef.current.clientHeight;
                containerRef.current.scrollTop = scrollHeight * wordRatio;
            }
        }
    }, [words]);

    useImperativeHandle(ref, () => ({
        insertTimestampAtCursor,
        insertSegmentTimestamp,
        scrollToWord,
    }), [insertTimestampAtCursor, insertSegmentTimestamp, scrollToWord]);

    const handleWordContextMenu = (e: React.MouseEvent, word: MatchedWord) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, word: word });
    };

    const handleMenuAction = (action: () => void) => {
        action();
        setContextMenu(null);
    };

    const paragraphs: TranscriptParagraph[] = useMemo(() => {
        if (words.length === 0) return [];
        const result: TranscriptParagraph[] = [];
        let currentParagraph: MatchedWord[] = [];
        let startingIndex = 0;

        words.forEach((word, index) => {
            if (word.isParagraphStart && currentParagraph.length > 0) {
                result.push({ words: currentParagraph, startingWordIndex: startingIndex, endingWordIndex: index - 1 });
                currentParagraph = [];
                startingIndex = index;
            }
            currentParagraph.push(word);
        });

        if (currentParagraph.length > 0) {
            result.push({ words: currentParagraph, startingWordIndex: startingIndex, endingWordIndex: words.length - 1 });
        }
        
        return result;
    }, [words]);

    if (words.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                    <p className="text-lg">No transcript available</p>
                    <p className="text-sm mt-2">Upload an audio file and process it to begin editing</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className="h-full bg-gray-900 rounded-lg shadow-inner text-lg text-gray-300 focus:outline-none overflow-y-auto scrollbar-thin p-6"
            tabIndex={-1}
            style={{ fontSize: `${1 * textZoom}rem` }}
        >
            {!isEditing ? (
                <div>
                    {paragraphs.map((paragraph, pIndex) => {
                        const firstWord = paragraph.words[0];
                        const isEmptyPara = paragraph.words.length === 1 && paragraph.words[0].punctuated_word === '';
                        const showSpeaker = !!firstWord?.speakerLabel;
                        const showTimestamp = showSpeaker && firstWord?.start !== null;

                        return (
                            <div
                                key={paragraph.startingWordIndex}
                                className="virtualized-paragraph flex items-start mb-2 relative rounded -mx-2 px-2 transition-colors hover:bg-gray-800/50"
                                onDoubleClick={handleStartEdit}
                            >
                                {isLineNumbersVisible && (
                                    <div 
                                        className="pr-4 pt-1 text-right font-mono text-gray-600 select-none text-base flex-shrink-0"
                                        style={{ lineHeight: `${1.75 * textZoom}rem`, width: '4rem' }}
                                    >
                                        {firstWord?.number ?? ''}
                                    </div>
                                )}
                                <div 
                                    className="flex-1 pt-1 min-h-[1.75rem]"
                                    style={{ lineHeight: `${1.75 * textZoom}rem` }}
                                >
                                    <div className="outline-none">
                                        {showTimestamp && (
                                            <span className="font-mono text-sm text-brand-blue mr-3 select-none">
                                                {formatTimestamp(firstWord.start!)}
                                            </span>
                                        )}
                                        {showSpeaker && <strong className="mr-2 text-gray-400 select-none">{firstWord.speakerLabel}:</strong>}

                                        {!isEmptyPara && paragraph.words.map((word, wordIndexInPara) => {
                                            const globalWordIndex = paragraph.startingWordIndex + wordIndexInPara;
                                            const isMatch = searchQuery && word.punctuated_word.toLowerCase().includes(searchQuery.toLowerCase());
                                            const isActiveMatch = globalWordIndex === activeMatchIndex;
                                            
                                            return (
                                                <React.Fragment key={globalWordIndex}>
                                                    <span
                                                        onContextMenu={(e) => handleWordContextMenu(e, word)}
                                                        onClick={() => onSeekToTime(word.start)}
                                                        className={`
                                                            cursor-pointer hover:bg-gray-700 rounded
                                                            ${isActiveMatch ? 'bg-orange-500 text-white' : ''}
                                                            ${!isActiveMatch && isMatch ? 'bg-yellow-500/50' : ''}
                                                        `}
                                                    >{word.punctuated_word}</span>
                                                    {' '}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Context Menu */}
                    {contextMenu && (
                        <div ref={menuRef} style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed bg-gray-700 text-white rounded-md shadow-lg p-1 z-50 text-sm">
                            <ul className="space-y-1">
                                <li onClick={() => handleMenuAction(() => onSeekToTime(contextMenu.word.start))} className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer">Play word</li>
                                <li onClick={() => handleMenuAction(() => window.open(`https://www.google.com/search?q=${encodeURIComponent(contextMenu.word.punctuated_word)}`, '_blank'))} className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer">Search word</li>
                                <li onClick={() => handleMenuAction(() => onFindWord(contextMenu.word.punctuated_word))} className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer">Find...</li>
                            </ul>
                        </div>
                    )}

                    <div className="absolute top-2 right-2 text-xs text-gray-500">
                        ⚡ Virtual Editor - Double-click to edit
                    </div>
                </div>
            ) : (
                <div className="h-full relative">
                    <textarea
                        ref={textAreaRef}
                        value={editableText}
                        onChange={(e) => setEditableText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full h-full p-4 bg-gray-900 text-gray-200 border-none outline-none resize-none leading-relaxed"
                        placeholder="Enter transcript..."
                        style={{ fontSize: `${textZoom}rem` }}
                        onPaste={(e) => {
                            e.stopPropagation(); // Let the default paste behavior work in edit mode
                        }}
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                        <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1 bg-brand-green text-white text-xs rounded hover:bg-green-600"
                        >
                            Save (Ctrl+Enter)
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                        >
                            Cancel (Esc)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

VirtualTranscriptView.displayName = 'VirtualTranscriptView';

export { VirtualTranscriptView };