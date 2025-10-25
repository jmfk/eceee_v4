import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { EditorView } from '@codemirror/view';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable } from '../../hooks/useResizable';
import { IconX } from '../icons/IconX';
import { formatHtml } from '../../utils/htmlFormatter';
import { cleanHTMLStrict } from '../../utils/htmlCleanup';
import '../../styles/components/HtmlEditor.css';

interface HtmlEditorProps {
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export const HtmlEditor: React.FC<HtmlEditorProps> = ({
    value,
    onChange,
    onClose,
    onFocus,
    onBlur,
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [size, setSize] = useState({ width: 600, height: 400 });

    const { isDragging, handleMouseDown: handleDragMouseDown } = useDraggable({
        elementRef: editorRef,
        onDrag: (dx, dy) => {
            setPosition(prev => ({
                x: prev.x + dx,
                y: prev.y + dy,
            }));
        },
    });

    const { isResizing, handleMouseDown: handleResizeMouseDown } = useResizable({
        elementRef: editorRef,
        onResize: (width, height) => {
            setSize({ width, height });
        },
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleChange = (value: string) => {
        onChange(value);
    };

    const handleEditorFocus = () => {
        onFocus?.();
    };

    const handleEditorBlur = () => {
        onBlur?.();
    };

    // Create paste handler extension for CodeMirror
    const pasteExtension = useMemo(() => {
        return EditorView.domEventHandlers({
            paste(event, view) {
                // Get pasted content
                const clipboardData = event.clipboardData;
                if (!clipboardData) return false;

                const htmlData = clipboardData.getData('text/html');
                const textData = clipboardData.getData('text/plain');

                // If there's HTML content, clean it
                if (htmlData) {
                    event.preventDefault();
                    const cleaned = cleanHTMLStrict(htmlData);

                    // Insert cleaned HTML at cursor position
                    const selection = view.state.selection.main;
                    view.dispatch({
                        changes: {
                            from: selection.from,
                            to: selection.to,
                            insert: cleaned
                        }
                    });

                    return true;
                } else if (textData) {
                    // Plain text - let CodeMirror handle it normally
                    return false;
                }

                return false;
            }
        });
    }, []);

    return createPortal(
        <div
            ref={editorRef}
            className="html-editor-overlay"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                zIndex: 1000,
                backgroundColor: '#000000',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <div
                className="html-editor-header"
                onMouseDown={handleDragMouseDown}
                style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    backgroundColor: '#f3f4f6',
                    color: '#1f2937',
                }}
            >
                <span>HTML Editor</span>
                <button
                    onClick={onClose}
                    className="html-editor-close-button"
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#4b5563',
                        borderRadius: '4px',
                        transition: 'all 0.2s',
                    }}
                >
                    <IconX size={16} />
                </button>
            </div>

            <div
                className="html-editor-content"
                style={{
                    flex: 1,
                    overflow: 'hidden',
                }}
            >
                <CodeMirror
                    value={value}
                    height={`${size.height - 45}px`}
                    width="100%"
                    theme={dracula}
                    extensions={[html(), pasteExtension]}
                    onChange={handleChange}
                    onFocus={handleEditorFocus}
                    onBlur={handleEditorBlur}
                    basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        highlightActiveLine: true,
                        autocompletion: true,
                        closeBrackets: true,
                        matchBrackets: true,
                        indentOnInput: true,
                        lineWrap: true,
                    }}
                    style={{
                        fontSize: '14px',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    }}
                />
            </div>

            <div
                className="html-editor-resize-handle"
                onMouseDown={handleResizeMouseDown}
                style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    width: '15px',
                    height: '15px',
                    cursor: isResizing ? 'nwse-resize' : 'se-resize',
                }}
            />
        </div>,
        document.body
    );
};