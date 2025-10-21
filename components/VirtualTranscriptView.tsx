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

    const renderDisplayText = () => {
        if (!searchQuery) {
            return displayText;
        }

        // Simple highlighting for search results
        const parts = displayText.split(new RegExp(`(${searchQuery})`, 'gi'));
        return parts.map((part, index) => {
            if (part.toLowerCase() === searchQuery.toLowerCase()) {
                const isActive = index === activeMatchIndex;
                return (
                    <mark 
                        key={index} 
                        className={isActive ? 'bg-brand-blue text-white' : 'bg-yellow-300 text-gray-900'}
                    >
                        {part}
                    </mark>
                );
            }
            return part;
        });
    };

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
            className="h-full bg-gray-900 rounded-lg border border-gray-700 relative overflow-auto transcript-editor-view"
            style={{ fontSize: `${textZoom}rem` }}
        >
            {!isEditing ? (
                <div 
                    className="p-4 cursor-text min-h-full whitespace-pre-wrap break-words"
                    onClick={handleStartEdit}
                    onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('text');
                        onTranscriptPaste(text);
                    }}
                >
                    <div className="text-gray-200 leading-relaxed">
                        {renderDisplayText()}
                    </div>
                    <div className="absolute top-2 right-2 text-xs text-gray-500">
                        ⚡ Virtual Editor - Click to edit
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