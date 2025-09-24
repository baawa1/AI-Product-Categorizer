import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { categorizeProduct } from './services/geminiService';
import { ImageUploader } from './components/ImageUploader';
import { CategorySelector } from './components/CategorySelector';
import { SavedProductsModal } from './components/SavedProductsModal';
import { CATEGORIES, BRANDS } from './constants';
import { GithubIcon, SaveIcon, CloseIcon } from './components/icons';
import { buildCategoryTree } from './utils/categoryTree';
import type { SavedProduct, Variant } from './types';
import { generateCsvContent } from './utils/csv';


const App: React.FC = () => {
    const [sku, setSku] = useState<string>('');
    const [selectedProductType, setSelectedProductType] = useState<'watch' | 'glasses' | ''>('');
    const [selectedBrandId, setSelectedBrandId] = useState<string>('');
    const [model, setModel] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageSource, setImageSource] = useState<string | null>(null); // To store filename or URL
    const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
    const [productName, setProductName] = useState<string>('');
    const [suggestedTags, setSuggestedTags] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isFetchingImage, setIsFetchingImage] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const [variants, setVariants] = useState<Variant[]>([]);

    const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const [isLgScreen, setIsLgScreen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const handleResize = () => setIsLgScreen(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleResize);
        return () => mediaQuery.removeEventListener('change', handleResize);
    }, []);

    // Load saved products from local storage on initial render
    useEffect(() => {
        try {
            const storedProducts = localStorage.getItem('savedProducts');
            if (storedProducts) {
                setSavedProducts(JSON.parse(storedProducts));
            }
        } catch (e) {
            console.error("Failed to parse saved products from localStorage", e);
        }
    }, []);

    const categoryTree = useMemo(() => buildCategoryTree(CATEGORIES), []);
    const watchCategoryTree = useMemo(() => categoryTree.find(node => node.id === 4287)?.children ?? [], [categoryTree]);
    const glassCategoryTree = useMemo(() => categoryTree.find(node => node.id === 4296)?.children ?? [], [categoryTree]);


    useEffect(() => {
        if (!imageFile || !selectedProductType || !sku || !selectedBrandId) return;

        const processImage = async () => {
            setIsLoading(true);
            setError(null);
            setSelectedCategories(new Set());
            setProductName('');
            setSuggestedTags('');
            setVariants([]);

            try {
                const { categoryIds, productName, suggestedTags } = await categorizeProduct(
                    imageFile, 
                    selectedProductType, 
                    selectedBrandId ? parseInt(selectedBrandId, 10) : null,
                    model || undefined,
                    price || undefined
                );
                setSelectedCategories(new Set(categoryIds));
                setProductName(productName);
                setSuggestedTags(suggestedTags);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            } finally {
                setIsLoading(false);
            }
        };

        processImage();
    }, [imageFile, selectedProductType, sku, price, selectedBrandId, model]);

    const handleImageSelect = (file: File | null) => {
        setError(null);
        if (file) {
            setImageFile(file);
            setImageSource(file.name); // Save filename
            const reader = new FileReader();
            reader.onload = (e) => {
                setImageUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleImageUrlFetch = useCallback(async (url: string) => {
        if (!url) return;
        setIsFetchingImage(true);
        setError(null);
        try {
            setImageSource(url); // Save original URL
            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch image. Status: ${response.status}`);
            }
            const blob = await response.blob();
            const fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'image.jpg';
            const file = new File([blob], fileName, { type: blob.type });
            handleImageSelect(file);
        } catch (e) {
             console.error("Failed to fetch image from URL:", e);
             setError("Could not fetch image from URL. It may be due to server restrictions (CORS policy). Please try another URL or upload a file.");
             setImageSource(null); // Clear source on error
        } finally {
            setIsFetchingImage(false);
        }
    }, []);

    const handleCategoryToggle = useCallback((categoryId: number) => {
        setSelectedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    }, []);
    
    const handleAddVariant = () => {
        setVariants(prev => [...prev, { id: Date.now(), sku: '', color: '', size: '', other: '' }]);
    };

    const handleUpdateVariant = (index: number, field: keyof Variant, value: string) => {
        setVariants(prev => {
            const newVariants = [...prev];
            newVariants[index] = { ...newVariants[index], [field]: value };
            return newVariants;
        });
    };

    const handleRemoveVariant = (id: number) => {
        setVariants(prev => prev.filter(variant => variant.id !== id));
    };


    const handleReset = useCallback(() => {
        setSku('');
        setImageFile(null);
        setImageUrl(null);
        setImageSource(null);
        setSelectedCategories(new Set());
        setIsLoading(false);
        setIsFetchingImage(false);
        setError(null);
        setSelectedProductType('');
        setSelectedBrandId('');
        setModel('');
        setPrice('');
        setProductName('');
        setSuggestedTags('');
        setVariants([]);
    }, []);

    const handleSaveProduct = useCallback(() => {
        if (!sku || !selectedProductType || !selectedBrandId || !imageSource || !productName) {
            setError("Cannot save, required fields are missing.");
            return;
        }

        const baseProduct: Omit<SavedProduct, 'sku' | 'variantSku' | 'variantColor' | 'variantSize' | 'variantOther'> = {
            productType: selectedProductType,
            price: price || 'N/A',
            imageSource,
            productName,
            suggestedTags,
            categoryIds: Array.from(selectedCategories),
            brandId: selectedBrandId ? parseInt(selectedBrandId, 10) : null,
            model: model
        };

        let productsToSave: SavedProduct[];

        if (variants.length > 0) {
            productsToSave = variants.map(variant => ({
                ...baseProduct,
                sku: sku, // Main product SKU
                variantSku: variant.sku || undefined,
                variantColor: variant.color || undefined,
                variantSize: variant.size || undefined,
                variantOther: variant.other || undefined,
            }));
        } else {
            productsToSave = [{ ...baseProduct, sku }];
        }
        
        const updatedProducts = [...savedProducts, ...productsToSave];
        setSavedProducts(updatedProducts);
        localStorage.setItem('savedProducts', JSON.stringify(updatedProducts));

        // Reset form for next entry
        handleReset();

    }, [sku, selectedProductType, price, imageSource, productName, suggestedTags, selectedCategories, savedProducts, handleReset, selectedBrandId, model, variants]);
    
    const handleDownloadCsv = useCallback(() => {
        const csvContent = generateCsvContent(savedProducts, CATEGORIES, BRANDS);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        link.href = URL.createObjectURL(blob);
        link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [savedProducts]);

    const isDetailsComplete = !!sku && !!selectedProductType && !!selectedBrandId;

    const inputStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: '#374151',
        color: '#F9FAFB',
        border: '1px solid #4B5563',
        borderRadius: '0.375rem',
        padding: '0.625rem 0.75rem',
        boxSizing: 'border-box'
    };
    
    const variantInputStyle: React.CSSProperties = {
        ...inputStyle,
        padding: '0.5rem 0.75rem',
        fontSize: '0.875rem'
    };


    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: 500,
        color: '#D1D5DB'
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

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: '#F9FAFB', padding: '2rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#FFFFFF', margin: 0 }}>
                            AI Product Categorizer
                        </h1>
                        <p style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#9CA3AF', margin: 0 }}>
                            Enter product details and upload an image to automatically assign categories.
                        </p>
                    </div>
                     {savedProducts.length > 0 && (
                         <button
                             style={buttonStyle}
                             onMouseOver={e => e.currentTarget.style.backgroundColor='#6B7280'}
                             onMouseOut={e => e.currentTarget.style.backgroundColor='#4B5563'}
                             onClick={() => setIsModalOpen(true)}
                         >
                            View Saved Products ({savedProducts.length})
                         </button>
                     )}
                </header>

                <main style={{ display: 'grid', gridTemplateColumns: isLgScreen ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem' }}>1. Product Details</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label htmlFor="sku" style={labelStyle}>Product SKU <span style={{color: '#F87171'}}>*</span></label>
                                    <input
                                        id="sku"
                                        type="text"
                                        placeholder="e.g. WATCH-001"
                                        value={sku}
                                        onChange={e => setSku(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="productType" style={labelStyle}>Product Type <span style={{color: '#F87171'}}>*</span></label>
                                    <select
                                        id="productType"
                                        value={selectedProductType}
                                        onChange={e => setSelectedProductType(e.target.value as 'watch' | 'glasses' | '')}
                                        style={{ ...inputStyle, appearance: 'none' }}
                                    >
                                        <option value="">-- Select a type --</option>
                                        <option value="watch">Watch</option>
                                        <option value="glasses">Glasses</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="brand" style={labelStyle}>Brand <span style={{color: '#F87171'}}>*</span></label>
                                    <select
                                        id="brand"
                                        value={selectedBrandId}
                                        onChange={e => setSelectedBrandId(e.target.value)}
                                        style={{ ...inputStyle, appearance: 'none' }}
                                    >
                                        <option value="">-- Select a brand --</option>
                                        {BRANDS.map(brand => (
                                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="model" style={labelStyle}>Model</label>
                                    <input
                                        id="model"
                                        type="text"
                                        placeholder="e.g. T-Sport (Optional)"
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="price" style={labelStyle}>Price (Naira)</label>
                                    <input
                                        id="price"
                                        type="number"
                                        placeholder="e.g. 25000 (Optional)"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        </div>
                        <ImageUploader
                            imageUrl={imageUrl}
                            onImageSelect={handleImageSelect}
                            onImageUrlFetch={handleImageUrlFetch}
                            onReset={handleReset}
                            isLoading={isLoading}
                            isFetchingImage={isFetchingImage}
                            error={error}
                            hasImage={!!imageFile}
                            disabled={!isDetailsComplete}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
                       { (imageFile || isLoading) ? (
                           <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', flexGrow: 1, opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem' }}>3. Review & Adjust</h2>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="productName" style={labelStyle}>Product Name</label>
                                    <input
                                        id="productName"
                                        type="text"
                                        placeholder={isLoading ? "Generating..." : "e.g. Brand Model Feature Watch"}
                                        value={productName}
                                        onChange={e => setProductName(e.target.value)}
                                        disabled={isLoading}
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label htmlFor="suggestedTags" style={labelStyle}>Suggested Tags</label>
                                    <textarea
                                        id="suggestedTags"
                                        placeholder={isLoading ? "Generating..." : "e.g. water-resistant, luminous hands"}
                                        value={suggestedTags}
                                        onChange={e => setSuggestedTags(e.target.value)}
                                        disabled={isLoading}
                                        rows={3}
                                        style={{...inputStyle, resize: 'vertical'}}
                                    />
                                </div>
                                
                                { selectedProductType && (
                                    <CategorySelector
                                        title={'Product Categories'}
                                        categoryTree={selectedProductType === 'watch' ? watchCategoryTree : glassCategoryTree}
                                        selectedCategories={selectedCategories}
                                        onCategoryToggle={handleCategoryToggle}
                                        isLoading={isLoading}
                                    />
                                )}
                                
                                {/* Variants Section */}
                                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #374151' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1rem' }}>4. Product Variants</h2>
                                    {variants.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                                            {variants.map((variant, index) => (
                                                <div key={variant.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '0.75rem', alignItems: 'center', backgroundColor: '#374151', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                                    <input type="text" placeholder="Variant SKU" value={variant.sku} onChange={e => handleUpdateVariant(index, 'sku', e.target.value)} style={variantInputStyle} />
                                                    <input type="text" placeholder="Color" value={variant.color} onChange={e => handleUpdateVariant(index, 'color', e.target.value)} style={variantInputStyle} />
                                                    <input type="text" placeholder="Size" value={variant.size} onChange={e => handleUpdateVariant(index, 'size', e.target.value)} style={variantInputStyle} />
                                                    <input type="text" placeholder="Other (e.g. Material)" value={variant.other} onChange={e => handleUpdateVariant(index, 'other', e.target.value)} style={variantInputStyle} />
                                                    <button onClick={() => handleRemoveVariant(variant.id)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '0.5rem' }} aria-label="Remove variant">
                                                       <CloseIcon />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleAddVariant}
                                        disabled={isLoading}
                                        style={{...buttonStyle, width: '100%', justifyContent: 'center' }}
                                    >
                                        + Add Variant
                                    </button>
                                </div>


                                <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                                    <button
                                        onClick={handleSaveProduct}
                                        disabled={isLoading || !productName}
                                        style={{...buttonStyle, width: '100%', padding: '0.75rem', backgroundColor: '#4F46E5', ...(isLoading || !productName ? { backgroundColor: '#374151', cursor: 'not-allowed' } : {})}}
                                        onMouseOver={e => { if (!(isLoading || !productName)) e.currentTarget.style.backgroundColor='#6366F1'; }}
                                        onMouseOut={e => { if (!(isLoading || !productName)) e.currentTarget.style.backgroundColor='#4F46E5'; }}
                                    >
                                        <SaveIcon />
                                        <span style={{marginLeft: '0.5rem'}}>Save Product & Start New</span>
                                    </button>
                                </div>
                           </div>
                       ) : (
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937', borderRadius: '0.75rem', border: '2px dashed #4B5563', color: '#6B7280' }}>
                                <p style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'center', padding: '1rem' }}>Results will appear here after uploading an image.</p>
                            </div>
                       )}
                    </div>
                </main>

                <footer style={{ textAlign: 'center', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #374151' }}>
                    <a href="https://github.com/google/genai-js" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', color: '#9CA3AF', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='#FFFFFF'} onMouseOut={e => e.currentTarget.style.color='#9CA3AF'}>
                        <GithubIcon />
                        <span style={{ marginLeft: '0.5rem' }}>Powered by Gemini API</span>
                    </a>
                </footer>
            </div>
            {isModalOpen && <SavedProductsModal products={savedProducts} onClose={() => setIsModalOpen(false)} onDownload={handleDownloadCsv} brands={BRANDS} />}
        </div>
    );
};

export default App;