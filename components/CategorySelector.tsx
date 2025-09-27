import React from 'react';
import type { CategoryNode } from '../types';
import { CheckIcon } from './icons';

interface CategorySelectorProps {
    title: string;
    categoryTree: CategoryNode[];
    selectedCategories: Set<number>;
    onCategoryToggle: (id: number) => void;
    isLoading: boolean;
}

interface CheckboxProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: () => void;
    level: number;
}

const CustomCheckbox: React.FC<CheckboxProps> = React.memo(({ id, label, checked, onChange, level }) => {
    return (
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: `0.5rem 0.25rem 0.5rem ${level * 1.5}rem`, userSelect: 'none' }}>
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

const CategoryNodeRenderer: React.FC<{
    node: CategoryNode;
    selectedCategories: Set<number>;
    onCategoryToggle: (id: number) => void;
    level: number;
}> = ({ node, selectedCategories, onCategoryToggle, level }) => {
    const checkboxId = `category-${node.id}`;
    return (
        <div>
            <CustomCheckbox
                id={checkboxId}
                label={node.name}
                checked={selectedCategories.has(node.id)}
                onChange={() => onCategoryToggle(node.id)}
                level={level}
            />
            {node.children && node.children.length > 0 && (
                <div>
                    {node.children.map(child => (
                        <CategoryNodeRenderer
                            key={child.id}
                            node={child}
                            selectedCategories={selectedCategories}
                            onCategoryToggle={onCategoryToggle}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


export const CategorySelector: React.FC<CategorySelectorProps> = ({ title, categoryTree, selectedCategories, onCategoryToggle }) => {
    return (
         <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
             <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#FFFFFF', borderBottom: '1px solid #374151', paddingBottom: '0.5rem', marginBottom: '1rem', marginTop: 0 }}>{title}</h3>
             <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
                 <div>
                    {categoryTree.map(node => (
                        <CategoryNodeRenderer
                            key={node.id}
                            node={node}
                            selectedCategories={selectedCategories}
                            onCategoryToggle={onCategoryToggle}
                            level={0}
                        />
                    ))}
                 </div>
             </div>
        </div>
    );
};