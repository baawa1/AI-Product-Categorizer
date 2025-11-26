
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
import { GithubIcon, SaveIcon, CloseIcon, SparklesIcon, FileTextIcon } from './components/icons';
import { buildCategoryTree } from './utils/categoryTree';
import type { SavedProduct, Variant, BulkProduct, CsvProduct, EnrichmentCsvProduct, CategoryNode, Attribute } from './types';
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

    const [primaryCategoryId, setPrimaryCategoryId] = useState<string>(initialData.primaryCategoryId ? String(initialData.primaryCategoryId) : '');
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
    const allCategoriesFlat = useMemo(() => CATEGORIES.map(c => ({ id: c.id, name: c.name })), []);


    const watchAttributes = useMemo(() => ATTRIBUTES.filter(attr => attr.type === 'watch'), []);
    const glassAttributes = useMemo(() => ATTRIBUTES.filter(attr => attr.type === 'glasses'), []);

    const getDynamicContent = useCallback((type: typeof selectedProductType): { categories: CategoryNode[], attributes: Attribute[] } => {
        switch (type) {
            case 'watch': return { categories: watchCategoryTree, attributes: watchAttributes };
            case 'glasses': return { categories: glassCategoryTree, attributes: glassAttributes };
            default: return { categories: [], attributes: [] };
        }
    }, [watchCategoryTree, glassCategoryTree, watchAttributes, glassAttributes]);
    
    const { categories: currentCategoryTree, attributes: currentAttributes } = getDynamicContent(selectedProductType);

    const handleStartAnalysis = async () => {
        if (!imageFile || !selectedProductType || !sku || !selectedBrandId) return;

        setIsLoading(true);
        setError(null);
        setAnalysisCompleted(false);
        try {
            const { categoryIds, attributeIds, productName, titleTag, metaDescription, suggestedTags, shortDescription, longDescription, primaryCategoryId } = await categorizeProduct(
                imageFile,
                selectedProductType,
                selectedBrandId ? parseInt(selectedBrandId, 10) : null,
                model || undefined,
                price || undefined,
                userProvidedDetails || undefined,
                initialData.originalName || initialData.productName
            );
            setSelectedCategories(new Set(categoryIds));
            setSelectedAttributes(new Set(attributeIds));
            setProductName(productName);
            setTitleTag(titleTag);
            setMetaDescription(metaDescription);
            setSuggestedTags(suggestedTags);
            setShortDescription(shortDescription);
            setLongDescription(longDescription);
            setPrimaryCategoryId(primaryCategoryId ? String(primaryCategoryId) : '');
            setAnalysisCompleted(true);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred during analysis.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!productName || !primaryCategoryId) {
            setError("Product Name and Primary Category are required before saving.");
            return;
        }
        const product: SavedProduct = {
            sku: initialData.originalId ? initialData.sku! : sku, // Keep original SKU for enriched products
            productType: selectedProductType as 'watch' | 'glasses',
            price,
            imageSource: imageSource!,
            productName,
            titleTag,
            metaDescription,
            suggestedTags,
            shortDescription,
            longDescription,
            primaryCategoryId: parseInt(primaryCategoryId, 10),
            categoryIds: Array.from(selectedCategories),
            attributeIds: Array.from(selectedAttributes),
            brandId: selectedBrandId ? parseInt(selectedBrandId, 10) : null,
            model,
            isReviewed: true,
            originalId: initialData.originalId,
            originalName: initialData.originalName,
            variantSku: initialData.variantSku,
            variantColor: initialData.variantColor,
            variantSize: initialData.variantSize,
            variantOther: initialData.variantOther,
        };
        onSave(product, variants);
    };

    const handleImageFileSelect = (file: File | null) => {
        if (file) {
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
            setImageSource(file.name);
        } else {
            setImageFile(null);
            setImageUrl(null);
            setImageSource(null);
        }
    };
    
    const handleImageUrlFetch = async (url: string) => {
        setIsFetchingImage(true);
        setError(null);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) {
                throw new Error("The fetched URL does not point to a valid image type.");
            }
            const file = new File([blob], url.substring(url.lastIndexOf('/') + 1), { type: blob.type });
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
            setImageSource(url);
        } catch (e: any) {
            setError(e.message);
            setImageFile(null);
            setImageUrl(null);
            setImageSource(null);
        } finally {
            setIsFetchingImage(false);
        }
    };

    const handleResetImage = () => {
        setImageFile(null);
        setImageUrl(null);
        setImageSource(null);
    };

    const handleCategoryToggle = (id: number) => {
        setSelectedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleAttributeToggle = (id: number) => {
        setSelectedAttributes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const isStep1Complete = sku && selectedProductType && selectedBrandId;
    const isReadyForAnalysis = isStep1Complete && !!imageFile;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1rem' }}>1. Product Details</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input type="text" placeholder="SKU" value={sku} onChange={e => setSku(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <select value={selectedProductType} onChange={e => setSelectedProductType(e.target.value as any)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }}>
                            <option value="">Select Product Type</option>
                            <option value="watch">Watch</option>
                            <option value="glasses">Glasses</option>
                        </select>
                        <SearchableSelect options={BRANDS} value={selectedBrandId} onChange={setSelectedBrandId} placeholder="Select Brand" disabled={!selectedProductType} />
                        <input type="text" placeholder="Model / Style Name" value={model} onChange={e => setModel(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <input type="text" placeholder="Price (e.g., 50000)" value={price} onChange={e => setPrice(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <textarea placeholder="Optional: Provide any extra details for the AI..." value={userProvidedDetails} onChange={e => setUserProvidedDetails(e.target.value)} rows={3} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', resize: 'vertical' }} />
                    </div>
                </div>
                <ImageUploader imageUrl={imageUrl} onImageSelect={handleImageFileSelect} onImageUrlFetch={handleImageUrlFetch} onReset={handleResetImage} isLoading={isLoading} isFetchingImage={isFetchingImage} error={error} hasImage={!!imageUrl} disabled={!isStep1Complete} />
                <button onClick={handleStartAnalysis} disabled={!isReadyForAnalysis || isLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.75rem 1rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: !isReadyForAnalysis || isLoading ? 'not-allowed' : 'pointer', opacity: !isReadyForAnalysis || isLoading ? 0.6 : 1 }}>
                    <SparklesIcon /> <span style={{ marginLeft: '0.5rem' }}>{isLoading ? 'Analyzing...' : 'Start AI Analysis'}</span>
                </button>
            </div>

            <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem', opacity: analysisCompleted ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', marginTop: 0, marginBottom: '1rem' }}>3. AI Generated Content</h2>
                {!analysisCompleted ? (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '4rem 0' }}>Complete steps 1 & 2 and run analysis to see results.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <input type="text" placeholder="Product Name" value={productName} onChange={e => setProductName(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', gridColumn: '1 / -1' }} />
                            <select value={primaryCategoryId} onChange={e => setPrimaryCategoryId(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', gridColumn: '1 / -1' }}>
                                <option value="">Select Primary Category</option>
                                {allCategoriesFlat.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input type="text" placeholder="SEO Title Tag" value={titleTag} onChange={e => setTitleTag(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                            <input type="text" placeholder="Suggested Tags" value={suggestedTags} onChange={e => setSuggestedTags(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        </div>
                        <textarea placeholder="SEO Meta Description" value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={3} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <textarea placeholder="Short Description" value={shortDescription} onChange={e => setShortDescription(e.target.value)} rows={3} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <textarea placeholder="Long Description (HTML)" value={longDescription} onChange={e => setLongDescription(e.target.value)} rows={10} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', fontFamily: 'monospace' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', minHeight: '300px' }}>
                            <CategorySelector title="Categories" categoryTree={currentCategoryTree} selectedCategories={selectedCategories} onCategoryToggle={handleCategoryToggle} isLoading={isLoading} />
                            <AttributeSelector title="Attributes" attributes={currentAttributes} selectedAttributes={selectedAttributes} onAttributeToggle={handleAttributeToggle} isLoading={isLoading} />
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                            {onCancel && <button onClick={onCancel} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
                            <button onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1.5rem', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                                <SaveIcon /> <span style={{ marginLeft: '0.5rem' }}>{saveButtonText}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const App = () => {
    const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mode, setMode] = useState<'single' | 'bulk-create' | 'bulk-enrich'>('single');
    
    // Bulk Processing State
    const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [editingBulkIndex, setEditingBulkIndex] = useState<number | null>(null);

    const handleSaveProduct = (product: SavedProduct, variants: Variant[]) => {
        setSavedProducts(prev => [...prev, product]);
        alert("Product saved successfully!");
    };
    
    const handleSaveBulkEditedProduct = (product: SavedProduct) => {
        if (editingBulkIndex === null) return;
        
        // Capture isReviewed state BEFORE updating state to ensure we know if we need to sync to savedProducts
        const isReviewed = bulkProducts[editingBulkIndex].isReviewed;

        setBulkProducts(prev => {
            const newProducts = [...prev];
            newProducts[editingBulkIndex] = {
                ...newProducts[editingBulkIndex],
                result: product,
                status: 'completed'
            };
            return newProducts;
        });

        // Sync updates to savedProducts if the item was already reviewed/saved
        if (isReviewed) {
             setSavedProducts(prev => 
                prev.map(p => p.sku === product.sku ? { ...product, isReviewed: true } : p)
             );
        }

        setEditingBulkIndex(null);
    };

    const handleDownloadCsv = () => {
        const csvContent = generateCsvContent(savedProducts, CATEGORIES, BRANDS, ATTRIBUTES);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "products.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const fetchImageFromUrl = async (url: string): Promise<File> => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);
            const blob = await response.blob();
            return new File([blob], "product-image.jpg", { type: blob.type });
        } catch (error: any) {
            // Very common in browsers due to CORS
            throw new Error(`Image load failed (CORS?): ${error.message}`);
        }
    };

    const processBulkFile = async (file: File, type: 'create' | 'enrich') => {
        setIsBulkProcessing(true);
        // Force a brief delay to allow React to render the processing state before blocking operations
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const text = await file.text();
            let newProducts: BulkProduct[] = [];

            try {
                if (type === 'create') {
                     const parsed = parseCsv(text, BRANDS);
                     newProducts = parsed.map((p, i) => ({
                        id: Date.now() + i,
                        source: p,
                        status: 'pending',
                        isReviewed: false
                     }));
                } else {
                     const parsed = parseEnrichmentCsv(text, BRANDS);
                     newProducts = parsed.map((p, i) => ({
                        id: Date.now() + i,
                        source: p,
                        status: 'pending',
                        isReviewed: false
                     }));
                }
            } catch (parseError: any) {
                console.error("CSV Parse Error:", parseError);
                alert(`Error parsing CSV file: ${parseError.message}`);
                setIsBulkProcessing(false);
                return;
            }

            if (newProducts.length === 0) {
                alert("No valid products found in the CSV file.");
                setIsBulkProcessing(false);
                return;
            }

            setBulkProducts(newProducts);

            // Brief delay to allow the list to render in 'pending' state
            await new Promise(resolve => setTimeout(resolve, 100));

            // Process sequentially to be gentle on browser/API
            for (let i = 0; i < newProducts.length; i++) {
                const currentId = newProducts[i].id;
                
                // Update status to processing
                setBulkProducts(prev => prev.map(p => p.id === currentId ? { ...p, status: 'processing' } : p));

                try {
                    const productSource = newProducts[i].source;
                    const url = (productSource as any).imageUrl;
                    let imageFile = newProducts[i].imageFile;
                    
                    if (!imageFile && url) {
                         imageFile = await fetchImageFromUrl(url);
                    }

                    if (!imageFile) throw new Error("No image available");

                    // Prepare args for categorizeProduct
                    let brandId: number | null = null;
                    const brandName = (productSource as any).brandName;
                    if (brandName) {
                        const brand = BRANDS.find(b => b.name.toLowerCase() === brandName.toLowerCase());
                        if (brand) brandId = brand.id;
                    }

                    let result;
                    let savedProduct: SavedProduct;

                    if (type === 'create') {
                         const p = productSource as CsvProduct;
                         result = await categorizeProduct(
                            imageFile,
                            p.productType as 'watch' | 'glasses',
                            brandId,
                            p.model,
                            p.price,
                            p.userProvidedDetails,
                            undefined
                         );
                         
                         savedProduct = {
                            sku: p.sku,
                            productType: p.productType as 'watch' | 'glasses',
                            price: p.price,
                            imageSource: p.imageUrl,
                            productName: result.productName,
                            titleTag: result.titleTag,
                            metaDescription: result.metaDescription,
                            suggestedTags: result.suggestedTags,
                            shortDescription: result.shortDescription,
                            longDescription: result.longDescription,
                            primaryCategoryId: result.primaryCategoryId,
                            categoryIds: result.categoryIds,
                            attributeIds: result.attributeIds,
                            brandId: result.brandId,
                            model: p.model,
                            isReviewed: false,
                            imageFile: imageFile
                         } as any; // Cast to satisfy type system for helper fields

                    } else {
                         const p = productSource as EnrichmentCsvProduct;
                         result = await categorizeProduct(
                            imageFile,
                            p.productType as 'watch' | 'glasses',
                            brandId,
                            undefined,
                            p.price,
                            undefined,
                            p.name 
                         );

                         savedProduct = {
                            sku: p.sku,
                            productType: p.productType as 'watch' | 'glasses',
                            price: p.price,
                            imageSource: p.imageUrl,
                            productName: result.productName,
                            titleTag: result.titleTag,
                            metaDescription: result.metaDescription,
                            suggestedTags: result.suggestedTags,
                            shortDescription: result.shortDescription,
                            longDescription: result.longDescription,
                            primaryCategoryId: result.primaryCategoryId,
                            categoryIds: result.categoryIds,
                            attributeIds: result.attributeIds,
                            brandId: result.brandId,
                            model: '',
                            isReviewed: false,
                            originalId: p.id,
                            originalName: p.name,
                            imageFile: imageFile
                         } as any;
                    }

                    setBulkProducts(prev => prev.map(p => p.id === currentId ? { ...p, status: 'completed', result: savedProduct, imageFile } : p));

                } catch (e: any) {
                    console.error(`Error processing product ${currentId}:`, e);
                    setBulkProducts(prev => prev.map(p => p.id === currentId ? { ...p, status: 'error', error: e.message } : p));
                }
            }
        } catch (e: any) {
            console.error("Bulk process init error", e);
            alert(`An error occurred while reading the file: ${e.message}`);
        } finally {
            setIsBulkProcessing(false);
        }
    };
    
    const handleBulkReset = () => {
        setBulkProducts([]);
        setIsBulkProcessing(false);
        setEditingBulkIndex(null);
    };

    const handleBulkDownload = () => {
        const completedProducts = bulkProducts
            .filter(p => p.status === 'completed' && p.result)
            .map(p => p.result!);
            
        if (completedProducts.length === 0) {
            alert("No completed products to download.");
            return;
        }

        const csvContent = generateCsvContent(completedProducts, CATEGORIES, BRANDS, ATTRIBUTES);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "bulk_results.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleBulkToggleReviewed = (index: number) => {
        const product = bulkProducts[index];
        if (!product || !product.result) return;
        
        const newReviewedState = !product.isReviewed;

        setBulkProducts(prev => {
            const newProducts = [...prev];
            newProducts[index] = { ...newProducts[index], isReviewed: newReviewedState };
            return newProducts;
        });

        // Add or remove from Saved Products list automatically
        if (newReviewedState) {
             setSavedProducts(prev => {
                // Prevent duplicates based on SKU
                if (prev.some(p => p.sku === product.result!.sku)) return prev;
                return [...prev, { ...product.result!, isReviewed: true }];
             });
        } else {
             setSavedProducts(prev => prev.filter(p => p.sku !== product.result!.sku));
        }
    };
    
    const TabButton: React.FC<{ current: typeof mode, target: typeof mode, onClick: (m: typeof mode) => void, children: React.ReactNode }> = ({current, target, onClick, children}) => (
        <button
            onClick={() => onClick(target)}
            style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderBottom: `3px solid ${current === target ? '#4F46E5' : 'transparent'}`,
                backgroundColor: 'transparent',
                color: current === target ? '#FFFFFF' : '#9CA3AF',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
        >
            {children}
        </button>
    );

    // Prepare initial data for editing a bulk product
    const getBulkEditInitialData = () => {
        if (editingBulkIndex === null) return {};
        const p = bulkProducts[editingBulkIndex];
        const src = p.source as any;
        const res = p.result;
        
        // Prefer result data if available, fallback to source data
        return {
            sku: res?.sku || src.sku,
            productType: res?.productType || src.productType,
            brandId: res?.brandId || (src.brandName ? BRANDS.find(b => b.name.toLowerCase() === src.brandName.toLowerCase())?.id : null),
            model: res?.model || src.model || '',
            price: res?.price || src.price,
            userProvidedDetails: src.userProvidedDetails || '',
            imageFile: p.imageFile,
            imageUrl: src.imageUrl,
            imageSource: src.imageUrl,
            
            // Generated fields
            productName: res?.productName,
            titleTag: res?.titleTag,
            metaDescription: res?.metaDescription,
            suggestedTags: res?.suggestedTags,
            shortDescription: res?.shortDescription,
            longDescription: res?.longDescription,
            primaryCategoryId: res?.primaryCategoryId,
            categoryIds: res?.categoryIds,
            attributeIds: res?.attributeIds,
            
            // Enrichment specific
            originalId: res?.originalId || (p.source as EnrichmentCsvProduct).id,
            originalName: res?.originalName || (p.source as EnrichmentCsvProduct).name
        };
    };

    return (
        <div style={{ backgroundColor: '#111827', minHeight: '100vh', color: '#F9FAFB', padding: '2rem' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center' }}>
                        <SparklesIcon /> <span style={{ marginLeft: '0.75rem' }}>Gemini Product PIM</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                           <FileTextIcon /> <span style={{ marginLeft: '0.5rem' }}>View Saved ({savedProducts.length})</span>
                        </button>
                        <a href="https://github.com/google/gemini-ui-F-react" target="_blank" rel="noopener noreferrer" style={{ color: '#9CA3AF' }}><GithubIcon /></a>
                    </div>
                </header>

                <main>
                    <div style={{ marginBottom: '2rem', borderBottom: '1px solid #374151', display: 'flex' }}>
                        <TabButton current={mode} target="single" onClick={setMode}>Single Product</TabButton>
                        <TabButton current={mode} target="bulk-create" onClick={setMode}>Bulk Create</TabButton>
                        <TabButton current={mode} target="bulk-enrich" onClick={setMode}>Bulk Enrich</TabButton>
                    </div>

                    {mode === 'single' && <ProductEditor initialData={{}} onSave={handleSaveProduct} saveButtonText="Save Product" isSaving={false} />}
                    
                    {mode === 'bulk-create' && editingBulkIndex === null && (
                        <BulkProcessor 
                            onProcess={(file) => processBulkFile(file, 'create')} 
                            processingProducts={bulkProducts} 
                            isProcessing={isBulkProcessing} 
                            onEdit={setEditingBulkIndex} 
                            onDownload={handleBulkDownload} 
                            onReset={handleBulkReset} 
                            onToggleReviewed={handleBulkToggleReviewed}
                        />
                    )}
                    
                    {mode === 'bulk-enrich' && editingBulkIndex === null && (
                        <EnrichmentProcessor 
                            onProcess={(file) => processBulkFile(file, 'enrich')} 
                            processingProducts={bulkProducts} 
                            isProcessing={isBulkProcessing} 
                            onEdit={setEditingBulkIndex} 
                            onDownload={handleBulkDownload} 
                            onReset={handleBulkReset}
                            onToggleReviewed={handleBulkToggleReviewed}
                        />
                    )}
                    
                    {editingBulkIndex !== null && (
                        <div style={{ animation: 'fadeIn 0.2s ease-in' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Editing: {bulkProducts[editingBulkIndex].result?.sku || (bulkProducts[editingBulkIndex].source as any).sku}</h2>
                            </div>
                            <ProductEditor 
                                initialData={getBulkEditInitialData()} 
                                onSave={handleSaveBulkEditedProduct} 
                                onCancel={() => setEditingBulkIndex(null)}
                                saveButtonText="Update Bulk Product"
                                isSaving={false}
                            />
                        </div>
                    )}

                </main>
            </div>
            {isModalOpen && <SavedProductsModal products={savedProducts} onClose={() => setIsModalOpen(false)} onDownload={handleDownloadCsv} onClearAll={() => setSavedProducts([])} brands={BRANDS} />}
        </div>
    );
};

export default App;
