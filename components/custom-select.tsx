"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export interface SelectOption {
  value: string | number;
  label: string;
  badge?: string;
  estimatedSize?: number | null;
}

interface CustomSelectProps {
  id?: string;
  value: string | number;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string | number) => void;
}

export function CustomSelect({
  id,
  value,
  options,
  disabled = false,
  placeholder = "Select quality",
  onChange,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) ?? options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-container ${disabled ? "is-disabled" : ""}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${isOpen ? "is-open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
      >
        <span className="selected-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`select-chevron ${isOpen ? "is-rotated" : ""}`} size={17} />
      </button>

      {isOpen && !disabled && (
        <ul className="custom-select-dropdown" role="listbox" tabIndex={-1}>
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <li
                key={String(option.value)}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleSelect(option.value)}
              >
                <div className="option-content">
                  <span className="option-label">{option.label}</span>
                  {option.estimatedSize ? (
                    <span className="option-size">{formatBytes(option.estimatedSize)}</span>
                  ) : null}
                </div>
                {isSelected ? <Check size={16} className="option-check" strokeWidth={2.5} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
