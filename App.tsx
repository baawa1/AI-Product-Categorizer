
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { categorizeProduct } from './services/geminiService';
import { ImageUploader } from './components/ImageUploader';
import { CategorySelector } from './components/CategorySelector';
import { AttributeSelector } from './components/AttributeSelector';
import { SavedProductsModal } from './components/SavedProductsModal';
import { SearchableSelect } from './components/SearchableSelect';
import { BulkProcessor } from './components/BulkProcessor';
import { EnrichmentProcessor } from './components/EnrichmentProcessor';
import { CATEGORIES, BRANDS, ATTRIBUTES } from './constants';
import { GithubIcon, SaveIcon, CloseIcon, SparklesIcon } from './components/icons';
import { buildCategoryTree } from './utils/categoryTree';
import type { SavedProduct, Variant, BulkProduct, CsvProduct, EnrichmentCsvProduct } from './types';
import { generateCsvContent, parseCsv, parseEnrichmentCsv } from './utils/csv';

const ProductEditor: React.FC<{
    initialData: Partial<SavedProduct & { sku: string; productType: 'watch' | 'glasses'; brandId: number | null, model: string, price: string, userProvidedDetails: string, imageFile: File | null, imageUrl: string | null, imageSource: string | null }>;
    onSave: (product: SavedProduct, variants: Variant[]) => void;
    onCancel?: () => void;
    saveButtonText: string;
    isSaving: boolean;
}> = ({ initialData, onSave, onCancel, saveButtonText, isSaving }) => {
    const [sku, setSku] = useState<string>(initialData.sku || '');
    const [selectedProductType, setSelectedProductType] = useState<'watch' | 'glasses' | ''>(initialData.productType || '');
    const [selectedBrandId, setSelectedBrandId] = useState<string>(initialData.brandId ? String(initialData.brandId) : '');
    const [model, setModel] = useState<string>(initialData.model || '');
    const [price, setPrice] = useState<string>(initialData.price || '');
    const [userProvidedDetails, setUserProvidedDetails] = useState<string>(initialData.userProvidedDetails || '');
    
    const [imageFile, setImageFile] = useState<File | null>(initialData.imageFile || null);
    const [imageUrl, setImageUrl] = useState<string | null>(initialData.imageUrl || null);
    const [imageSource, setImageSource] = useState<string | null>(initialData.imageSource || null);

    const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set(initialData.categoryIds || []));
    const [selectedAttributes, setSelectedAttributes] = useState<Set<number>>(new Set(initialData.attributeIds || []));
    const [productName, setProductName] = useState<string>(initialData.productName || '');
    const [titleTag, setTitleTag] = useState<string>(initialData.titleTag || '');
    const [metaDescription, setMetaDescription] = useState<string>(initialData.metaDescription || '');
    const [suggestedTags, setSuggestedTags] = useState<string>(initialData.suggestedTags || '');
    const [shortDescription, setShortDescription] = useState<string>(initialData.shortDescription || '');
    const [longDescription, setLongDescription] = useState<string>(initialData.longDescription || '');

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isFetchingImage, setIsFetchingImage] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisCompleted, setAnalysisCompleted] = useState<boolean>(!!initialData.productName);

    const [variants, setVariants] = useState<Variant[]>([]);

    const categoryTree = useMemo(() => buildCategoryTree(CATEGORIES), []);
    const watchCategoryTree = useMemo(() => categoryTree.find(node => node.id === 4287)?.children ?? [], [categoryTree]);
    const glassCategoryTree = useMemo(() => categoryTree.find(node => node.id === 4296)?.children ?? [], [categoryTree]);

    const watchAttributes = useMemo(() => ATTRIBUTES.filter(attr => attr.type === 'watch'), []);
    const glassAttributes = useMemo(() => ATTRIBUTES.filter(attr => attr.type === 'glasses'), []);

    const handleStartAnalysis = async () => {
        if (!imageFile || !selectedProductType || !sku || !selectedBrandId) return;

        setIsLoading(true);
        setError(null);
        setAnalysisCompleted(false);
        try {
            const { categoryIds, attributeIds, productName, titleTag, metaDescription, suggestedTags, shortDescription, longDescription } = await categorizeProduct(
                imageFile,
                selectedProductType,
                selectedBrandId ? parseInt(selectedBrandId, 10) : null,
                model || undefined,
                price || undefined,
                userProvidedDetails || undefined,
                initialData.originalName // Pass original name if it exists (for editing enriched products)
            );
            setSelectedCategories(new Set(categoryIds));
            setSelectedAttributes(new Set(attributeIds));
            setProductName(productName);
            setTitleTag(titleTag);
            setMetaDescription(metaDescription);
            setSuggestedTags(suggestedTags);
            setShortDescription(shortDescription);
            setLongDescription(longDescription);
            setAnalysisCompleted(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleImageSelect = (file: File | null) => {
        setError(null);
        setAnalysisCompleted(false);
        if (file) {
            setImageFile(file);
            setImageSource(file.name);
            const reader = new FileReader();
            reader.onload = (e) => setImageUrl(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleImageUrlFetch = useCallback(async (url: string) => {
        if (!url) return;
        setIsFetchingImage(true);
        setError(null);
        setAnalysisCompleted(false);
        try {
            setImageSource(url);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);
            const blob = await response.blob();
            const fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'image.jpg';
            const file = new File([blob], fileName, { type: blob.type });
            handleImageSelect(file);
        } catch (e) {
            console.error("Failed to fetch image from URL:", e);
            if (e instanceof TypeError && e.message === 'Failed to fetch') {
                setError("Could not fetch image. This is often due to the server's CORS policy. Try downloading the image and uploading it directly.");
            } else {
                setError(e instanceof Error ? e.message : "Could not fetch image from URL. It may be due to server restrictions (CORS policy).");
            }
            setImageSource(null);
        } finally {
            setIsFetchingImage(false);
        }
    }, []);

    const handleCategoryToggle = useCallback((categoryId: number) => {
        setSelectedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) newSet.delete(categoryId);
            else newSet.add(categoryId);
            return newSet;
        });
    }, []);

    const handleAttributeToggle = useCallback((attributeId: number) => {
        setSelectedAttributes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(attributeId)) newSet.delete(attributeId);
            else newSet.add(attributeId);
            return newSet;
        });
    }, []);

    const handleSave = () => {
        if (!sku || !selectedProductType || !selectedBrandId || !imageSource || !productName) {
            setError("Cannot save, required fields are missing.");
            return;
        }

        const productData: SavedProduct = {
            sku,
            productType: selectedProductType,
            price: price || 'N/A',
            imageSource,
            productName,
            titleTag,
            metaDescription,
            suggestedTags,
            shortDescription,
            longDescription,
            categoryIds: Array.from(selectedCategories),
            attributeIds: Array.from(selectedAttributes),
            brandId: selectedBrandId ? parseInt(selectedBrandId, 10) : null,
            model,
            originalId: initialData.originalId,
            originalName: initialData.originalName,
        };
        onSave(productData, variants);
    };
    
    const handleAddVariant = () => setVariants(prev => [...prev, { id: Date.now(), sku: '', color: '', size: '', other: '' }]);
    const handleUpdateVariant = (index: number, field: keyof Omit<Variant, 'id'>, value: string) => {
        setVariants(prev => {
            const newVariants = [...prev];
            newVariants[index] = { ...newVariants[index], [field]: value };
            return newVariants;
        });
    };
    const handleRemoveVariant = (id: number) => setVariants(prev => prev.filter(variant => variant.id !== id));
    
    const inputStyle: React.CSSProperties = { width: '100%', backgroundColor: '#374151', color: '#F9FAFB', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', boxSizing: 'border-box' };
    const variantInputStyle: React.CSSProperties = { ...inputStyle, padding: '0.5rem 0.75rem', fontSize: '0.875rem' };
    const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#D1D5DB' };
    const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem', backgroundColor: '#4B5563', color: '#F9FAFB', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' };

    const isLgScreen = window.matchMedia('(min-width: 1024px)').matches;
    const isEditing = !!onCancel; 
    const analysisButtonReady = !!sku && !!selectedProductType && !!selectedBrandId && !!imageFile && !isLoading && !analysisCompleted;

    return (
        <main style={{ display: 'grid', gridTemplateColumns: isLgScreen ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)', gap: '2rem' }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem', opacity: isEditing ? 0.7 : 1 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem' }}>1. Product Details</h2>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                         <div>
                            <label htmlFor="sku" style={labelStyle}>Product SKU <span style={{color: '#F87171'}}>*</span></label>
                            <input id="sku" type="text" value={sku} onChange={e => setSku(e.target.value)} style={inputStyle} disabled={isEditing} />
                         </div>
                         <div>
                             <label htmlFor="productType" style={labelStyle}>Product Type <span style={{color: '#F87171'}}>*</span></label>
                             <select id="productType" value={selectedProductType} onChange={e => setSelectedProductType(e.target.value as any)} style={{ ...inputStyle, appearance: 'none' }} disabled={isEditing}>
                                 <option value="">-- Select a type --</option>
                                 <option value="watch">Watch</option>
                                 <option value="glasses">Glasses</option>
                             </select>
                         </div>
                         <div>
                             <label htmlFor="brand" style={labelStyle}>Brand <span style={{color: '#F87171'}}>*</span></label>
                             <SearchableSelect options={BRANDS} value={selectedBrandId} onChange={setSelectedBrandId} placeholder="-- Select a brand --" disabled={isEditing} />
                         </div>
                         <div>
                             <label htmlFor="model" style={labelStyle}>Model</label>
                             <input id="model" type="text" value={model} onChange={e => setModel(e.target.value)} style={inputStyle} disabled={isEditing} />
                         </div>
                         <div>
                             <label htmlFor="price" style={labelStyle}>Price (Naira)</label>
                             <input id="price" type="number" value={price} onChange={e => setPrice(e.target.value)} style={inputStyle} disabled={isEditing} />
                         </div>
                         <div>
                             <label htmlFor="userProvidedDetails" style={labelStyle}>Product Notes / Details</label>
                             <textarea id="userProvidedDetails" value={userProvidedDetails} onChange={e => setUserProvidedDetails(e.target.value)} rows={5} style={{...inputStyle, resize: 'vertical'}} disabled={isEditing} />
                         </div>
                     </div>
                </div>
                <ImageUploader imageUrl={imageUrl} onImageSelect={handleImageSelect} onImageUrlFetch={handleImageUrlFetch} onReset={() => {}} isLoading={isLoading} isFetchingImage={isFetchingImage} error={error} hasImage={!!imageFile} disabled={isEditing} hideReset={isEditing} />
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
               { (isLoading || analysisCompleted) ? (
                   <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', flexGrow: 1, opacity: isLoading ? 0.6 : 1 }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem' }}>3. Review & Adjust</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
                            {initialData.originalName && <div><label style={{...labelStyle, color: '#9CA3AF'}}>Original Name</label><input type="text" value={initialData.originalName} disabled style={{...inputStyle, backgroundColor: '#1F2937'}} /></div>}
                            <div><label htmlFor="productName" style={labelStyle}>{initialData.originalName ? 'Refined Product Name' : 'Product Name'}</label><input id="productName" type="text" placeholder={isLoading ? "Generating..." : ""} value={productName} onChange={e => setProductName(e.target.value)} disabled={isLoading} style={inputStyle} /></div>
                            <div><label htmlFor="titleTag" style={labelStyle}>SEO Title Tag</label><input id="titleTag" type="text" placeholder={isLoading ? "Generating..." : ""} value={titleTag} onChange={e => setTitleTag(e.target.value)} disabled={isLoading} style={inputStyle} /></div>
                            <div><label htmlFor="metaDescription" style={labelStyle}>SEO Meta Description</label><textarea id="metaDescription" placeholder={isLoading ? "Generating..." : ""} value={metaDescription} onChange={e => setMetaDescription(e.target.value)} disabled={isLoading} rows={3} style={{...inputStyle, resize: 'vertical'}} /></div>
                            <div><label htmlFor="suggestedTags" style={labelStyle}>Suggested Tags</label><textarea id="suggestedTags" placeholder={isLoading ? "Generating..." : ""} value={suggestedTags} onChange={e => setSuggestedTags(e.target.value)} disabled={isLoading} rows={2} style={{...inputStyle, resize: 'vertical'}} /></div>
                            <div><label htmlFor="shortDescription" style={labelStyle}>Short Description</label><textarea id="shortDescription" placeholder={isLoading ? "Generating..." : ""} value={shortDescription} onChange={e => setShortDescription(e.target.value)} disabled={isLoading} rows={3} style={{...inputStyle, resize: 'vertical'}} /></div>
                            <div><label htmlFor="longDescription" style={labelStyle}>Long Description (HTML)</label><textarea id="longDescription" placeholder={isLoading ? "Generating..." : ""} value={longDescription} onChange={e => setLongDescription(e.target.value)} disabled={isLoading} rows={10} style={{...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.875rem'}} /></div>
                            { selectedProductType && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '300px' }}>
                                    <CategorySelector title={'Product Categories'} categoryTree={selectedProductType === 'watch' ? watchCategoryTree : glassCategoryTree} selectedCategories={selectedCategories} onCategoryToggle={handleCategoryToggle} isLoading={isLoading} />
                                    <AttributeSelector title={'Product Attributes'} attributes={selectedProductType === 'watch' ? watchAttributes : glassAttributes} selectedAttributes={selectedAttributes} onAttributeToggle={handleAttributeToggle} isLoading={isLoading} />
                                </div>
                            )}
                        </div>
                         <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #374151' }}>
                             <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1rem' }}>4. Product Variants</h2>
                             {variants.map((variant, index) => (
                                 <div key={variant.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '0.75rem', alignItems: 'center', backgroundColor: '#374151', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                     <input type="text" placeholder="Variant SKU" value={variant.sku} onChange={e => handleUpdateVariant(index, 'sku', e.target.value)} style={variantInputStyle} />
                                     <input type="text" placeholder="Color" value={variant.color} onChange={e => handleUpdateVariant(index, 'color', e.target.value)} style={variantInputStyle} />
                                     <input type="text" placeholder="Size" value={variant.size} onChange={e => handleUpdateVariant(index, 'size', e.target.value)} style={variantInputStyle} />
                                     <input type="text" placeholder="Other" value={variant.other} onChange={e => handleUpdateVariant(index, 'other', e.target.value)} style={variantInputStyle} />
                                     <button onClick={() => handleRemoveVariant(variant.id)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}><CloseIcon /></button>
                                 </div>
                             ))}
                             <button onClick={handleAddVariant} disabled={isLoading} style={{...buttonStyle, width: '100%'}}>+ Add Variant</button>
                         </div>
                        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                           {onCancel && <button onClick={onCancel} style={{...buttonStyle, flex: 1}}>Cancel</button>}
                           <button onClick={handleSave} disabled={isSaving || isLoading || !productName} style={{...buttonStyle, flex: 2, backgroundColor: '#4F46E5', ...(isSaving || isLoading || !productName ? { backgroundColor: '#374151', cursor: 'not-allowed' } : {})}}>
                               <SaveIcon /> <span style={{marginLeft: '0.5rem'}}>{saveButtonText}</span>
                           </button>
                        </div>
                   </div>
               ) : imageFile ? (
                   <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937', borderRadius: '0.75rem' }}>
                        <button onClick={handleStartAnalysis} disabled={!analysisButtonReady} style={{ ...buttonStyle, padding: '1rem 2rem', fontSize: '1.125rem', backgroundColor: '#4F46E5', ...(!analysisButtonReady ? { backgroundColor: '#374151', cursor: 'not-allowed' } : {}) }}>
                            <SparklesIcon /> <span style={{ marginLeft: '0.75rem' }}>Analyze Product</span>
                        </button>
                   </div>
               ) : (
                    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937', borderRadius: '0.75rem', border: '2px dashed #4B5563', color: '#6B7280' }}>
                        <p>Results will appear here after analyzing an image.</p>
                    </div>
               )}
            </div>
        </main>
    );
};

const App: React.FC = () => {
    const [appMode, setAppMode] = useState<'single' | 'bulk-create' | 'bulk-enrich'>('single');
    const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    
    // Bulk Create state
    const [bulkCreateProducts, setBulkCreateProducts] = useState<BulkProduct[]>([]);
    const [isBulkCreateProcessing, setIsBulkCreateProcessing] = useState<boolean>(false);
    const [currentlyEditingBulkCreateIndex, setCurrentlyEditingBulkCreateIndex] = useState<number | null>(null);

    // Bulk Enrich state
    const [bulkEnrichProducts, setBulkEnrichProducts] = useState<BulkProduct[]>([]);
    const [isBulkEnrichProcessing, setIsBulkEnrichProcessing] = useState<boolean>(false);
    const [currentlyEditingBulkEnrichIndex, setCurrentlyEditingBulkEnrichIndex] = useState<number | null>(null);

    useEffect(() => {
        try { const stored = localStorage.getItem('savedProducts'); if (stored) setSavedProducts(JSON.parse(stored)); } catch (e) { console.error(e); }
    }, []);

    const handleSaveSingleProduct = (product: SavedProduct, variants: Variant[]) => {
        let productsToSave: SavedProduct[];
        if (variants.length > 0) {
            productsToSave = variants.map(v => ({ ...product, variantSku: v.sku, variantColor: v.color, variantSize: v.size, variantOther: v.other }));
        } else {
            productsToSave = [product];
        }
        const updated = [...savedProducts, ...productsToSave];
        setSavedProducts(updated);
        localStorage.setItem('savedProducts', JSON.stringify(updated));
        setAppMode('single'); 
    };

    // --- Bulk Create Logic ---
    const handleBulkCreateProcess = async (file: File) => {
        try {
            const content = await file.text();
            const products = parseCsv(content, BRANDS);
            setBulkCreateProducts(products.map((p, i) => ({ id: i, source: p, status: 'pending', isReviewed: false })));
            setIsBulkCreateProcessing(true);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to parse CSV.');
        }
    };
    
    useEffect(() => {
        if (!isBulkCreateProcessing) return;
        const processQueue = async () => {
            for (let i = 0; i < bulkCreateProducts.length; i++) {
                if (bulkCreateProducts[i].status !== 'pending') continue;
                setBulkCreateProducts(prev => { const next = [...prev]; next[i].status = 'processing'; return next; });
                try {
                    const source = bulkCreateProducts[i].source as CsvProduct;
                    const response = await fetch(source.imageUrl);
                    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
                    const blob = await response.blob();
                    const file = new File([blob], "image.jpg", { type: blob.type });
                    setBulkCreateProducts(prev => { const next = [...prev]; next[i].imageFile = file; return next; });
                    const { id: brandId } = BRANDS.find(b => b.name.toLowerCase() === source.brandName.toLowerCase()) || {id: null};
                    const resultData = await categorizeProduct(file, source.productType as 'watch' | 'glasses', brandId, source.model, source.price, source.userProvidedDetails);
                    setBulkCreateProducts(prev => {
                        const next = [...prev];
                        next[i].status = 'completed';
                        next[i].result = { sku: source.sku, productType: source.productType as 'watch'|'glasses', brandId, model: source.model, price: source.price, imageSource: source.imageUrl, isReviewed: prev[i].isReviewed, ...resultData };
                        return next;
                    });
                } catch (e) {
                    setBulkCreateProducts(prev => { const next = [...prev]; next[i].status = 'error'; next[i].error = e instanceof Error ? e.message : String(e); return next; });
                }
            }
            setIsBulkCreateProcessing(false);
        };
        processQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBulkCreateProcessing]);

    const handleToggleBulkCreateReviewed = (index: number) => {
        setBulkCreateProducts(prev => {
            const next = [...prev];
            const product = next[index];
            product.isReviewed = !product.isReviewed;
            if (product.result) product.result.isReviewed = product.isReviewed;
            return next;
        });
    };
    
    const handleUpdateBulkCreateProduct = (updatedProduct: SavedProduct) => {
        if (currentlyEditingBulkCreateIndex === null) return;
        setBulkCreateProducts(prev => {
            const next = [...prev];
            const productToUpdate = next[currentlyEditingBulkCreateIndex];
            productToUpdate.isReviewed = true;
            productToUpdate.result = { ...updatedProduct, isReviewed: true };
            return next;
        });
        setCurrentlyEditingBulkCreateIndex(null);
    };
    
    const handleDownloadBulkCreateCsv = () => {
        const products = bulkCreateProducts.filter(p => p.status === 'completed' && p.result).map(p => p.result!);
        const csv = generateCsvContent(products, CATEGORIES, BRANDS, ATTRIBUTES);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `bulk-create-results_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // --- Bulk Enrich Logic ---
    const handleBulkEnrichProcess = async (file: File) => {
        try {
            const content = await file.text();
            const products = parseEnrichmentCsv(content, BRANDS);
            setBulkEnrichProducts(products.map((p, i) => ({ id: i, source: p, status: 'pending', isReviewed: false })));
            setIsBulkEnrichProcessing(true);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to parse CSV.');
        }
    };
    
    useEffect(() => {
        if (!isBulkEnrichProcessing) return;
        const processQueue = async () => {
            for (let i = 0; i < bulkEnrichProducts.length; i++) {
                if (bulkEnrichProducts[i].status !== 'pending') continue;
                setBulkEnrichProducts(prev => { const next = [...prev]; next[i].status = 'processing'; return next; });
                try {
                    const source = bulkEnrichProducts[i].source as EnrichmentCsvProduct;
                    const response = await fetch(source.imageUrl);
                    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
                    const blob = await response.blob();
                    const file = new File([blob], "image.jpg", { type: blob.type });
                    setBulkEnrichProducts(prev => { const next = [...prev]; next[i].imageFile = file; return next; });
                    const { id: brandId } = BRANDS.find(b => b.name.toLowerCase() === source.brandName.toLowerCase()) || {id: null};
                    const resultData = await categorizeProduct(file, source.productType as 'watch' | 'glasses', brandId, undefined, source.price, undefined, source.name);
                    setBulkEnrichProducts(prev => {
                        const next = [...prev];
                        next[i].status = 'completed';
                        next[i].result = { sku: source.sku, productType: source.productType as 'watch'|'glasses', brandId, model: '', price: source.price, imageSource: source.imageUrl, isReviewed: prev[i].isReviewed, originalId: source.id, originalName: source.name, ...resultData };
                        return next;
                    });
                } catch (e) {
                    setBulkEnrichProducts(prev => { const next = [...prev]; next[i].status = 'error'; next[i].error = e instanceof Error ? e.message : String(e); return next; });
                }
            }
            setIsBulkEnrichProcessing(false);
        };
        processQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBulkEnrichProcessing]);
    
    const handleToggleBulkEnrichReviewed = (index: number) => {
        setBulkEnrichProducts(prev => {
            const next = [...prev];
            const product = next[index];
            product.isReviewed = !product.isReviewed;
            if (product.result) product.result.isReviewed = product.isReviewed;
            return next;
        });
    };
    
    const handleUpdateBulkEnrichProduct = (updatedProduct: SavedProduct) => {
        if (currentlyEditingBulkEnrichIndex === null) return;
        setBulkEnrichProducts(prev => {
            const next = [...prev];
            const productToUpdate = next[currentlyEditingBulkEnrichIndex];
            productToUpdate.isReviewed = true;
            productToUpdate.result = { ...updatedProduct, isReviewed: true };
            return next;
        });
        setCurrentlyEditingBulkEnrichIndex(null);
    };

    const handleDownloadBulkEnrichCsv = () => {
        const products = bulkEnrichProducts.filter(p => p.status === 'completed' && p.result).map(p => p.result!);
        const csv = generateCsvContent(products, CATEGORIES, BRANDS, ATTRIBUTES);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `bulk-enrich-results_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleClearAllData = useCallback(() => {
        if (window.confirm('Are you sure you want to delete all saved products from this session?')) {
            localStorage.removeItem('savedProducts');
            setSavedProducts([]);
            setIsModalOpen(false);
        }
    }, []);
    
    const currentlyEditingProduct = currentlyEditingBulkCreateIndex !== null ? bulkCreateProducts[currentlyEditingBulkCreateIndex] : (currentlyEditingBulkEnrichIndex !== null ? bulkEnrichProducts[currentlyEditingBulkEnrichIndex] : null);
    const inEditMode = currentlyEditingBulkCreateIndex !== null || currentlyEditingBulkEnrichIndex !== null;

    const getAppSubtitle = () => {
        if (inEditMode) return `Editing Product: ${currentlyEditingProduct?.source.sku}`;
        if (appMode === 'bulk-create') return 'Process a batch of new products from a CSV file.';
        if (appMode === 'bulk-enrich') return 'Enrich existing products with AI-generated content via CSV.';
        return 'Enter product details to automatically assign categories.';
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: '#F9FAFB', padding: '2rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.25rem', margin: 0 }}>AI Product Categorizer</h1>
                        <p style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#9CA3AF', margin: 0 }}>
                           {getAppSubtitle()}
                        </p>
                    </div>
                     <div style={{display: 'flex', gap: '1rem'}}>
                        {appMode === 'single' && savedProducts.length > 0 && (
                            <button onClick={() => setIsModalOpen(true)} style={{padding: '0.5rem 1rem', backgroundColor: '#4B5563', color: '#F9FAFB', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer'}}>
                                View Saved ({savedProducts.length})
                            </button>
                        )}
                        {!inEditMode && (
                            <div style={{backgroundColor: '#374151', borderRadius: '0.5rem', padding: '0.25rem', display: 'flex'}}>
                                <button onClick={() => setAppMode('single')} style={{padding: '0.5rem 1rem', border: 'none', borderRadius: '0.375rem', backgroundColor: appMode === 'single' ? '#4F46E5' : 'transparent', color: '#F9FAFB', cursor: 'pointer'}}>Single Product</button>
                                <button onClick={() => setAppMode('bulk-create')} style={{padding: '0.5rem 1rem', border: 'none', borderRadius: '0.375rem', backgroundColor: appMode === 'bulk-create' ? '#4F46E5' : 'transparent', color: '#F9FAFB', cursor: 'pointer'}}>Bulk Create</button>
                                <button onClick={() => setAppMode('bulk-enrich')} style={{padding: '0.5rem 1rem', border: 'none', borderRadius: '0.375rem', backgroundColor: appMode === 'bulk-enrich' ? '#4F46E5' : 'transparent', color: '#F9FAFB', cursor: 'pointer'}}>Bulk Enrich</button>
                            </div>
                        )}
                     </div>
                </header>

                {inEditMode && currentlyEditingProduct?.result ? (
                     <ProductEditor
                        key={currentlyEditingProduct.id}
                        initialData={{ 
                            ...currentlyEditingProduct.result,
                            userProvidedDetails: (currentlyEditingProduct.source as CsvProduct).userProvidedDetails,
                            imageFile: currentlyEditingProduct.imageFile || null,
                            imageUrl: currentlyEditingProduct.imageFile ? URL.createObjectURL(currentlyEditingProduct.imageFile) : currentlyEditingProduct.source.imageUrl,
                        }}
                        onSave={(updated) => {
                            if (currentlyEditingBulkCreateIndex !== null) handleUpdateBulkCreateProduct(updated);
                            if (currentlyEditingBulkEnrichIndex !== null) handleUpdateBulkEnrichProduct(updated);
                        }}
                        onCancel={() => {
                            setCurrentlyEditingBulkCreateIndex(null);
                            setCurrentlyEditingBulkEnrichIndex(null);
                        }}
                        saveButtonText="Update Product"
                        isSaving={false}
                    />
                ) : appMode === 'bulk-create' ? (
                     <BulkProcessor
                        onProcess={handleBulkCreateProcess}
                        processingProducts={bulkCreateProducts}
                        isProcessing={isBulkCreateProcessing}
                        onEdit={setCurrentlyEditingBulkCreateIndex}
                        onDownload={handleDownloadBulkCreateCsv}
                        onReset={() => setBulkCreateProducts([])}
                        onToggleReviewed={handleToggleBulkCreateReviewed}
                    />
                ) : appMode === 'bulk-enrich' ? (
                    <EnrichmentProcessor 
                        onProcess={handleBulkEnrichProcess}
                        processingProducts={bulkEnrichProducts}
                        isProcessing={isBulkEnrichProcessing}
                        onEdit={setCurrentlyEditingBulkEnrichIndex}
                        onDownload={handleDownloadBulkEnrichCsv}
                        onReset={() => setBulkEnrichProducts([])}
                        onToggleReviewed={handleToggleBulkEnrichReviewed}
                    />
                ) : (
                    <ProductEditor
                        key={savedProducts.length} 
                        initialData={{}}
                        onSave={(product, variants) => handleSaveSingleProduct(product, variants)}
                        saveButtonText="Save Product & Start New"
                        isSaving={false}
                    />
                )}

                <footer style={{ textAlign: 'center', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #374151' }}>
                    <a href="https://github.com/google/genai-js" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', color: '#9CA3AF', textDecoration: 'none' }}>
                        <GithubIcon />
                        <span style={{ marginLeft: '0.5rem' }}>Powered by Gemini API</span>
                    </a>
                </footer>
            </div>
            {isModalOpen && <SavedProductsModal products={savedProducts} onClose={() => setIsModalOpen(false)} onDownload={() => { /* Not implemented for single mode */ }} onClearAll={handleClearAllData} brands={BRANDS} />}
        </div>
    );
};

export default App;
