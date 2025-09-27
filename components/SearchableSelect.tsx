import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Brand } from '../types';

interface SearchableSelectProps {
    options: Brand[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => options.find(option => String(option.id) === value), [options, value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [wrapperRef]);
    
    const filteredOptions = useMemo(() =>
        options.filter(option =>
            option.name.toLowerCase().includes(searchTerm.toLowerCase())
        ),
    [options, searchTerm]);

    const handleSelectOption = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        fontFamily: "'Inter', sans-serif"
    };

    const selectButtonStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: '#374151',
        color: selectedOption ? '#F9FAFB' : '#9CA3AF',
        border: '1px solid #4B5563',
        borderRadius: '0.375rem',
        padding: '0.625rem 0.75rem',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxSizing: 'border-box'
    };

    const dropdownStyle: React.CSSProperties = {
        position: 'absolute',
        top: 'calc(100% + 0.5rem)',
        left: 0,
        width: '100%',
        backgroundColor: '#374151',
        border: '1px solid #4B5563',
        borderRadius: '0.375rem',
        zIndex: 10,
        maxHeight: '250px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    };
    
    const searchInputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.75rem',
        backgroundColor: '#1F2937',
        border: 'none',
        borderBottom: '1px solid #4B5563',
        color: '#F9FAFB',
        boxSizing: 'border-box'
    };
    
    const optionsListStyle: React.CSSProperties = {
        overflowY: 'auto',
        listStyle: 'none',
        margin: 0,
        padding: '0.5rem',
    };
    
    const optionStyle: React.CSSProperties = {
        padding: '0.625rem 0.75rem',
        borderRadius: '0.25rem',
        cursor: 'pointer',
        color: '#D1D5DB'
    };

    return (
        <div ref={wrapperRef} style={containerStyle}>
            <button
                type="button"
                style={selectButtonStyle}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {selectedOption ? selectedOption.name : placeholder}
                <span style={{
                    border: 'solid #9CA3AF',
                    borderWidth: '0 2px 2px 0',
                    display: 'inline-block',
                    padding: '3px',
                    transform: isOpen ? 'rotate(-135deg)' : 'rotate(45deg)',
                    transition: 'transform 0.2s',
                }}></span>
            </button>
            {isOpen && (
                <div style={dropdownStyle}>
                    <input
                        type="text"
                        placeholder="Search brands..."
                        style={searchInputStyle}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <ul style={optionsListStyle}>
                        {filteredOptions.length > 0 ? filteredOptions.map(option => (
                            <li
                                key={option.id}
                                style={optionStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4B5563'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                onClick={() => handleSelectOption(String(option.id))}
                            >
                                {option.name}
                            </li>
                        )) : (
                             <li style={{...optionStyle, cursor: 'default', color: '#6B7280'}}>No brands found</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};