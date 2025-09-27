import React, { useMemo } from 'react';
import type { Attribute } from '../types';
import { CheckIcon } from './icons';

interface AttributeSelectorProps {
    title: string;
    attributes: Attribute[];
    selectedAttributes: Set<number>;
    onAttributeToggle: (id: number) => void;
    isLoading: boolean;
}

interface CheckboxProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: () => void;
}

const CustomCheckbox: React.FC<CheckboxProps> = React.memo(({ id, label, checked, onChange }) => {
    return (
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.5rem 0.25rem', userSelect: 'none' }}>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{
                    position: 'absolute',
                    opacity: 0,
                    cursor: 'pointer',
                    height: 0,
                    width: 0,
                }}
            />
            <div
                aria-hidden="true"
                style={{
                    width: '1rem',
                    height: '1rem',
                    backgroundColor: checked ? '#60A5FA' : '#374151',
                    border: '1px solid',
                    borderColor: checked ? '#60A5FA' : '#4B5563',
                    borderRadius: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    marginRight: '0.75rem',
                    flexShrink: 0
                }}
            >
                {checked && <CheckIcon />}
            </div>
            <span style={{ color: '#D1D5DB' }}>{label}</span>
        </label>
    );
});


export const AttributeSelector: React.FC<AttributeSelectorProps> = ({ title, attributes, selectedAttributes, onAttributeToggle }) => {
    
    const groupedAttributes = useMemo(() => {
        const groups: { [key: string]: Attribute[] } = {};
        for (const attr of attributes) {
            if (!groups[attr.group]) {
                groups[attr.group] = [];
            }
            groups[attr.group].push(attr);
        }
        return Object.entries(groups);
    }, [attributes]);

    return (
         <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
             <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#FFFFFF', borderBottom: '1px solid #374151', paddingBottom: '0.5rem', marginBottom: '1rem', marginTop: 0 }}>{title}</h3>
             <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
                {groupedAttributes.map(([groupName, attrs]) => (
                    <div key={groupName} style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem 0' }}>{groupName}</h4>
                        {attrs.map(attr => (
                             <CustomCheckbox
                                key={attr.id}
                                id={`attribute-${attr.id}`}
                                label={attr.name}
                                checked={selectedAttributes.has(attr.id)}
                                onChange={() => onAttributeToggle(attr.id)}
                            />
                        ))}
                    </div>
                ))}
             </div>
        </div>
    );
};