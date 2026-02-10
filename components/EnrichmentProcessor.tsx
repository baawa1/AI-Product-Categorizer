
import React, { useState, useRef } from 'react';
import { generateEnrichmentTemplateCsvUrl } from '../utils/csv';
import { SparklesIcon, FileTextIcon, ResetIcon, LoadingSpinner, UploadIcon } from './icons';
import type { BulkProduct, EnrichmentCsvProduct } from '../types';

export const EnrichmentProcessor: React.FC<{
    onProcess: (file: File) => void;
    processingProducts: BulkProduct[];
    isProcessing: boolean;
    onEdit: (index: number) => void;
    onDownload: () => void;
    onReset: () => void;
    onToggleReviewed: (index: number) => void;
}> = ({ onProcess, processingProducts, isProcessing, onEdit, onDownload, onReset, onToggleReviewed }) => {
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const dropzoneRef = useRef<HTMLDivElement>(null);

    const handleFileChange = (files: FileList | null) => {
        setError(null);
        if (files && files[0]) {
            if (files[0].type === 'text/csv' || files[0].name.endsWith('.csv')) {
                setCsvFile(files[0]);
            } else {
                setError('Invalid file type. Please upload a CSV file.');
            }
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneRef.current?.classList.remove('drag-over');
        handleFileChange(e.dataTransfer.files);
    };

    const allDone = !isProcessing && processingProducts.length > 0;
    const progress = processingProducts.filter(p => p.status === 'completed' || p.status === 'error').length;
    const total = processingProducts.length;

    const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #4B5563', backgroundColor: '#374151' };
    const tdStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid #374151', verticalAlign: 'middle' };

    if (isProcessing || allDone) {
        return (
            <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>{allDone ? 'Enrichment Complete' : 'Enriching Products...'}</h2>
                        <p style={{ margin: '0.25rem 0 0', color: '#9CA3AF' }}>{progress} of {total} products processed.</p>
                    </div>
                    {allDone && (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={onReset} style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem', backgroundColor: '#4B5563', color: '#F9FAFB', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer'}}>
                                <ResetIcon /> <span style={{marginLeft: '0.5rem'}}>Start New Enrichment</span>
                            </button>
                             <button onClick={onDownload} style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem', backgroundColor: '#16A34A', color: '#F9FAFB', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer'}}>
                                Download Results (CSV)
                            </button>
                        </div>
                    )}
                </div>
                {total > 0 && <div style={{ width: '100%', backgroundColor: '#374151', borderRadius: '99px' }}><div style={{ width: `${(progress / total) * 100}%`, height: '8px', backgroundColor: '#4F46E5', borderRadius: '99px', transition: 'width 0.3s' }}></div></div>}
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>SKU</th>
                                <th style={{...thStyle, width: '70px'}}>Image</th>
                                <th style={thStyle}>Original Name</th>
                                <th style={thStyle}>{allDone ? 'Refined Name' : 'Status'}</th>
                                <th style={{...thStyle, width: '100px'}}>Variants</th>
                                {allDone && <th style={{...thStyle, textAlign: 'center', width: '100px'}}>Reviewed</th>}
                                {allDone && <th style={{...thStyle, width: '100px'}}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {processingProducts.map((p, index) => (
                                <tr key={p.id}>
                                    <td style={{...tdStyle, fontWeight: p.status === 'completed' ? 600 : 400}}>
                                        {p.result?.sku || (p.source as EnrichmentCsvProduct).sku}
                                    </td>
                                    <td style={tdStyle}><img src={p.imageFile ? URL.createObjectURL(p.imageFile) : (p.source as EnrichmentCsvProduct).imageUrl} alt={(p.source as EnrichmentCsvProduct).sku} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '0.25rem' }} /></td>
                                    <td style={{...tdStyle, maxWidth: '300px', whiteSpace: 'normal', color: '#9CA3AF'}}>{(p.source as EnrichmentCsvProduct).name}</td>
                                    <td style={{...tdStyle, maxWidth: '300px', whiteSpace: 'normal'}}>
                                        {p.status === 'pending' && 'Queued...'}
                                        {p.status === 'processing' && <span style={{ display: 'flex', alignItems: 'center' }}><LoadingSpinner/> <span style={{marginLeft: '0.5rem'}}>Processing...</span></span>}
                                        {p.status === 'error' && <span style={{ color: '#F87171' }} title={p.error}>Error</span>}
                                        {p.status === 'completed' && (p.result?.productName || <span style={{color: '#9CA3AF'}}>No name generated</span>)}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ fontSize: '0.875rem', backgroundColor: '#374151', padding: '0.25rem 0.5rem', borderRadius: '99px' }}>
                                            {p.result?.variants?.length || 0} variants
                                        </span>
                                    </td>
                                     {allDone && (
                                        <td style={{...tdStyle, textAlign: 'center'}}>
                                            {p.status === 'completed' && (
                                                <input
                                                    type="checkbox"
                                                    checked={!!p.isReviewed}
                                                    onChange={() => onToggleReviewed(index)}
                                                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: '#4F46E5' }}
                                                    aria-label={`Mark ${(p.source as EnrichmentCsvProduct).sku} as reviewed`}
                                                />
                                            )}
                                        </td>
                                    )}
                                    {allDone && (
                                        <td style={tdStyle}>
                                            {p.status === 'completed' && <button onClick={() => onEdit(index)} style={{padding: '0.25rem 0.5rem', backgroundColor: '#374151', color: '#F9FAFB', border: '1px solid #4B5563', borderRadius: '0.25rem', cursor: 'pointer'}}>Edit</button>}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <div style={{ backgroundColor: '#1F2937', padding: '2rem', borderRadius: '0.75rem', textAlign: 'center' }}>
            <h2 style={{ marginTop: 0 }}>Bulk Enrich Existing Products</h2>
            <p style={{ color: '#9CA3AF' }}>Upload a CSV with existing product data (ID, SKU, Name, Image URL etc.) to enrich them with AI-generated content.</p>
            <div
                ref={dropzoneRef}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); dropzoneRef.current?.classList.add('drag-over'); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); dropzoneRef.current?.classList.remove('drag-over'); }}
                onClick={() => document.getElementById('csv-input-enrich')?.click()}
                style={{ border: '2px dashed #4B5563', padding: '2rem', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}
            >
                <UploadIcon />
                <p>{csvFile ? `Selected: ${csvFile.name}` : 'Drag & drop a CSV file here, or click to select.'}</p>
            </div>
            <input type="file" id="csv-input-enrich" accept=".csv" onChange={e => handleFileChange(e.target.files)} style={{ display: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <a href={generateEnrichmentTemplateCsvUrl()} download="template-enrich.csv" style={{display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#F9FAFB', border: 'none', borderRadius: '0.375rem', fontWeight: 600}}>
                    <FileTextIcon /> <span style={{marginLeft: '0.5rem'}}>Download Template</span>
                </a>
                <button onClick={() => csvFile && onProcess(csvFile)} disabled={!csvFile} style={{display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: '#4F46E5', color: '#F9FAFB', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer', opacity: !csvFile ? 0.6 : 1 }}>
                    <SparklesIcon /> <span style={{marginLeft: '0.5rem'}}>Start Enrichment</span>
                </button>
            </div>
            {error && <p style={{ color: '#F87171', marginTop: '1rem' }}>{error}</p>}
        </div>
    );
}
