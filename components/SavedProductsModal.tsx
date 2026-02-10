
import React, { useMemo } from 'react';
import type { SavedProduct, Brand } from '../types';
import { CloseIcon, DownloadIcon, TrashIcon } from './icons';

interface SavedProductsModalProps {
    products: SavedProduct[];
    onClose: () => void;
    onDownload: () => void;
    onClearAll: () => void;
    brands: Brand[];
}

export const SavedProductsModal: React.FC<SavedProductsModalProps> = ({ products, onClose, onDownload, onClearAll, brands }) => {
    
    const brandMap = useMemo(() => new Map<number, string>(brands.map(brand => [brand.id, brand.name])), [brands]);

    const modalStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '2rem',
    };

    const contentStyle: React.CSSProperties = {
        backgroundColor: '#1F2937',
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
    };
    
    const headerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #374151',
    };
    
    const tableContainerStyle: React.CSSProperties = {
        overflowY: 'auto',
        padding: '1.5rem',
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        color: '#D1D5DB',
    };

    const thStyle: React.CSSProperties = {
        textAlign: 'left',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #4B5563',
        backgroundColor: '#374151',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    };
    
    const tdStyle: React.CSSProperties = {
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #374151',
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    };

    const buttonStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem 1rem',
        backgroundColor: '#4B5563',
        color: '#F9FAFB',
        border: 'none',
        borderRadius: '0.375rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    };

    // Flatten products to show variants as separate rows
    const displayRows = useMemo(() => {
        const rows: any[] = [];
        products.forEach(p => {
            if (p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    rows.push({
                        sku: v.sku,
                        baseSku: p.sku,
                        name: p.productName,
                        brand: p.brandId ? brandMap.get(p.brandId) : 'N/A',
                        model: p.model,
                        color: v.color || 'N/A',
                        size: v.size || 'N/A',
                        price: v.price || p.price
                    });
                });
            } else {
                rows.push({
                    sku: p.sku,
                    baseSku: p.sku,
                    name: p.productName,
                    brand: p.brandId ? brandMap.get(p.brandId) : 'N/A',
                    model: p.model,
                    color: 'N/A',
                    size: 'N/A',
                    price: p.price
                });
            }
        });
        return rows;
    }, [products, brandMap]);

    return (
        <div style={modalStyle} onClick={onClose}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
                <header style={headerStyle}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Saved Items ({displayRows.length})</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                         <button
                            style={{...buttonStyle, backgroundColor: '#DC2626'}}
                            onMouseOver={e => e.currentTarget.style.backgroundColor='#EF4444'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor='#DC2626'}
                            onClick={onClearAll}
                         >
                            <TrashIcon />
                            <span style={{marginLeft: '0.5rem'}}>Clear All</span>
                         </button>
                         <button
                            style={{...buttonStyle, backgroundColor: '#16A34A'}}
                            onMouseOver={e => e.currentTarget.style.backgroundColor='#22C55E'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor='#16A34A'}
                            onClick={onDownload}
                         >
                            <DownloadIcon />
                            <span style={{marginLeft: '0.5rem'}}>Download CSV</span>
                         </button>
                        <button
                            style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <CloseIcon />
                        </button>
                    </div>
                </header>
                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>SKU</th>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Brand</th>
                                <th style={thStyle}>Model</th>
                                <th style={thStyle}>Color</th>
                                <th style={thStyle}>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.length > 0 ? displayRows.map((row, index) => (
                                <tr key={`${row.sku}-${index}`} style={{ backgroundColor: '#1F2937' }}>
                                    <td style={{ ...tdStyle, fontWeight: 500 }}>{row.sku}</td>
                                    <td style={tdStyle} title={row.name}>{row.name}</td>
                                    <td style={tdStyle}>{row.brand}</td>
                                    <td style={tdStyle}>{row.model || 'N/A'}</td>
                                    <td style={tdStyle}>{row.color}</td>
                                    <td style={tdStyle}>{row.price}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} style={{...tdStyle, textAlign: 'center', color: '#6B7280', padding: '2rem'}}>
                                        No items saved yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
