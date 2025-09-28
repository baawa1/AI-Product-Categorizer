import React, { useRef, useCallback, useState } from 'react';
import { UploadIcon, LoadingSpinner, ResetIcon, LinkIcon } from './icons';

interface ImageUploaderProps {
    imageUrl: string | null;
    onImageSelect: (file: File | null) => void;
    onImageUrlFetch: (url: string) => void;
    onReset: () => void;
    isLoading: boolean;
    isFetchingImage: boolean;
    error: string | null;
    hasImage: boolean;
    disabled: boolean;
    hideReset?: boolean;
}

type Tab = 'upload' | 'url';

export const ImageUploader: React.FC<ImageUploaderProps> = ({ imageUrl, onImageSelect, onImageUrlFetch, onReset, isLoading, isFetchingImage, error, hasImage, disabled, hideReset }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<Tab>('upload');
    const [urlInputValue, setUrlInputValue] = useState('');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const file = event.target.files?.[0];
        if (file) {
            onImageSelect(file);
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            onImageSelect(file);
        }
    }, [onImageSelect, disabled]);

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
    };

    const triggerFileSelect = () => {
        if (disabled) return;
        fileInputRef.current?.click();
    };
    
    const handleUrlLoad = () => {
        if (disabled || !urlInputValue || isFetchingImage) return;
        onImageUrlFetch(urlInputValue);
    };

    const containerStyle: React.CSSProperties = {
        backgroundColor: '#1F2937',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        transition: 'opacity 0.3s',
        opacity: disabled ? 0.6 : 1,
    };
    
    const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '0.5rem 1rem',
        border: 'none',
        borderBottom: `2px solid ${isActive ? '#60A5FA' : 'transparent'}`,
        backgroundColor: 'transparent',
        color: isActive ? '#F9FAFB' : '#9CA3AF',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        transition: 'all 0.2s',
    });

    return (
        <div style={containerStyle}>
             <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1rem' }}>2. Upload Product Image</h2>
             
             {!hasImage && !disabled && (
                <div style={{ display: 'flex', marginBottom: '1rem', borderBottom: '1px solid #374151' }}>
                    <button style={tabButtonStyle(activeTab === 'upload')} onClick={() => setActiveTab('upload')} disabled={disabled}>
                        Upload File
                    </button>
                    <button style={tabButtonStyle(activeTab === 'url')} onClick={() => setActiveTab('url')} disabled={disabled}>
                        From URL
                    </button>
                </div>
             )}

            {activeTab === 'upload' && !hasImage && !disabled && (
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: 'calc(100% - 74px)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        backgroundColor: '#374151',
                        cursor: disabled ? 'not-allowed' : 'default',
                    }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <div onClick={triggerFileSelect} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #4B5563', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'center' }}>
                        <UploadIcon />
                        <p style={{ marginTop: '1rem', color: '#9CA3AF', fontWeight: 500 }}>
                            {disabled
                                ? 'Please complete step 1.'
                                : <>Drag & drop or <span style={{ color: '#60A5FA', textDecoration: 'underline' }}>click to browse</span></>
                            }
                        </p>
                    </div>
                </div>
            )}
            
            {activeTab === 'url' && !hasImage && !disabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                        type="text"
                        placeholder="https://example.com/image.jpg"
                        value={urlInputValue}
                        onChange={e => setUrlInputValue(e.target.value)}
                        disabled={disabled || isFetchingImage}
                        style={{
                            width: '100%',
                            backgroundColor: '#374151',
                            color: '#F9FAFB',
                            border: '1px solid #4B5563',
                            borderRadius: '0.375rem',
                            padding: '0.625rem 0.75rem',
                            boxSizing: 'border-box'
                        }}
                    />
                     <button
                        onClick={handleUrlLoad}
                        disabled={disabled || !urlInputValue || isFetchingImage}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '0.75rem 1rem',
                            backgroundColor: '#4B5563',
                            color: '#F9FAFB',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            cursor: (disabled || !urlInputValue || isFetchingImage) ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                        }}
                    >
                        {isFetchingImage ? <LoadingSpinner /> : <LinkIcon />}
                        <span style={{ marginLeft: '0.5rem' }}>{isFetchingImage ? 'Loading...' : 'Load Image'}</span>
                    </button>
                    <p style={{fontSize: '0.875rem', color: '#9CA3AF', margin: '0.25rem 0 0 0'}}>Note: Some images may fail to load due to server restrictions (CORS policy).</p>
                </div>
            )}
            
            {hasImage && (
                 <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '100%',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        backgroundColor: '#374151',
                    }}
                >
                    <img src={imageUrl!} alt="Product preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    {isLoading && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                            <LoadingSpinner />
                            <p style={{ color: '#D1D5DB', fontWeight: 500 }}>Analyzing...</p>
                        </div>
                    )}
                 </div>
            )}
            
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                disabled={disabled}
            />

            {error && <p style={{ color: '#F87171', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}
             {hasImage && !isLoading && !hideReset && (
                <button
                    onClick={onReset}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        marginTop: '1.5rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#374151',
                        color: '#F9FAFB',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor='#4B5563'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor='#374151'}
                >
                    <ResetIcon />
                    <span style={{ marginLeft: '0.5rem' }}>Start Over</span>
                </button>
             )}
        </div>
    );
};