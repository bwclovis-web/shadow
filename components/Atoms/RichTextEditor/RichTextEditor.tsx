import { type FormEvent, useEffect, useRef, useState } from "react"
import { type KeyboardEvent } from "react"
import {
  type DetailedHTMLProps,
  type HTMLAttributes,
  type StyleHTMLAttributes,
} from "react"

import { sanitizeReviewHtml } from "~/utils/sanitize"
import { styleMerge } from "~/utils/styleUtils"

interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxLength?: number
}

const RichTextEditor = ({
  value = "",
  onChange,
  placeholder = "Write your review...",
  className,
  disabled = false,
  maxLength = 5000,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [currentLength, setCurrentLength] = useState(0)

  useEffect(() => {
    if (editorRef.current) {
      const safe = sanitizeReviewHtml(value)
      if (editorRef.current.innerHTML !== safe) {
        editorRef.current.innerHTML = safe
      }
      setCurrentLength(getTextLength(safe))
    }
  }, [value])

  const getTextLength = (html: string) => {
    const temp = document.createElement("div")
    temp.innerHTML = html
    return temp.textContent?.length || 0
  }

  const handleInput = (evt: FormEvent<HTMLDivElement>) => {
    if (editorRef.current && onChange) {
      const raw = editorRef.current.innerHTML
      const content = sanitizeReviewHtml(raw)
      // If sanitization removed something (e.g. script), keep editor in sync
      if (content !== raw && editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content
      }
      const textLength = getTextLength(content)

      if (textLength <= maxLength) {
        setCurrentLength(textLength)
        onChange(content)
      } else {
        evt.preventDefault()
        editorRef.current.innerHTML = sanitizeReviewHtml(value)
      }
    }
  }

  const handleKeyDown = (evt: KeyboardEvent<HTMLDivElement>) => {
    // Allow normal typing, but prevent if we're at the limit
    if (editorRef.current) {
      const currentLength = getTextLength(editorRef.current.innerHTML)
      if (
        currentLength >= maxLength &&
        evt.key !== "Backspace" &&
        evt.key !== "Delete" &&
        evt.key !== "ArrowLeft" &&
        evt.key !== "ArrowRight" &&
        evt.key !== "ArrowUp" &&
        evt.key !== "ArrowDown"
      ) {
        evt.preventDefault()
      }
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    if (editorRef.current && onChange) {
      const raw = editorRef.current.innerHTML
      const content = sanitizeReviewHtml(raw)
      if (content !== raw && editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content
      }
      const textLength = getTextLength(content)
      setCurrentLength(textLength)
      onChange(content)
    }
  }

  const formatButtons = [
    { command: "bold", icon: "B", title: "Bold" },
    { command: "italic", icon: "I", title: "Italic" },
    { command: "underline", icon: "U", title: "Underline" },
    { command: "insertUnorderedList", icon: "•", title: "Bullet List" },
    { command: "insertOrderedList", icon: "1.", title: "Numbered List" },
  ]

  return (
    <div className={styleMerge("rich-text-editor", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-300 bg-noir-gold-100 rounded-t-md">
        {formatButtons.map(button => (
          <button
            key={button.command}
            type="button"
            onClick={() => execCommand(button.command)}
            className="px-2 py-1 text-sm font-medium text-noir-gold bg-noir-dark border cursor-pointer
            border-noir-gold-500 rounded hover:bg-noir-gold-500 hover:text-noir-dark transition-colors 
            focus:outline-none focus:ring-2 focus:ring-noir-gold disabled:opacity-50 disabled:cursor-not-allowed"
            title={button.title}
            disabled={disabled}
          >
            {button.icon}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text editor"
        aria-describedby="rich-text-editor-description"
        aria-invalid={currentLength > maxLength}
        aria-required={true}
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={styleMerge(
          "min-h-[120px] p-3 border border-noir-gold focus:outline-none focus:ring-2 focus:bg-noir-light/10",
          " focus:ring-noir-gold focus:border-noir-gold-500 text-noir-gold-500 transition-all",
          disabled && "bg-gray-100 cursor-not-allowed",
          isFocused && "ring-2 ring-noir-gold border-noir-gold-500"
        )}
        style={{
          minHeight: "120px",
          direction: "ltr",
          textAlign: "left",
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Character count */}
      <div className="flex justify-between items-center px-3 py-1 text-xs text-noir-dark bg-noir-gold-500 rounded-b-md">
        <span>
          {currentLength} / {maxLength} characters
        </span>
        {currentLength > maxLength * 0.9 && (
          <span className="text-noir-gray">
            {maxLength - currentLength} characters remaining
          </span>
        )}
      </div>

      {/* Placeholder styling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .rich-text-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--color-noir-gold);
          pointer-events: none;
        }
      `,
        }}
      />
    </div>
  )
}

export default RichTextEditor
