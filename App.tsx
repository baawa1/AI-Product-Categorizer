
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
import { GithubIcon, SaveIcon, CloseIcon, SparklesIcon, FileTextIcon, TrashIcon, ResetIcon } from './components/icons';
import { buildCategoryTree } from './utils/categoryTree';
import type { SavedProduct, Variant, BulkProduct, CsvProduct, EnrichmentCsvProduct, CategoryNode, Attribute } from './types';
import { generateCsvContent, parseCsv, parseEnrichmentCsv } from './utils/csv';
import { generateSmartSku } from './utils/product-utils';

const ProductEditor: React.FC<{
    initialData: Partial<SavedProduct & { sku: string; productType: 'watch' | 'glasses'; brandId: number | null, model: string, price: string, userProvidedDetails: string, imageFile: File | null, imageUrl: string | null, imageSource: string | null }>;
    onSave: (product: SavedProduct, variants: Variant[]) => void;
    onReset?: () => void;
    onCancel?: () => void;
    saveButtonText: string;
    isSaving: boolean;
}> = ({ initialData, onSave, onReset, onCancel, saveButtonText, isSaving }) => {
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

    const [variants, setVariants] = useState<Variant[]>(initialData.variants || []);
    const [quickAddColors, setQuickAddColors] = useState<string>('');

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

    const handleMagicSku = () => {
        const brandName = BRANDS.find(b => String(b.id) === selectedBrandId)?.name;
        const newSku = generateSmartSku(selectedProductType, brandName, model);
        setSku(newSku);
    };

    const handleStartAnalysis = async () => {
        if (!imageFile || !selectedProductType || !sku || !selectedBrandId) {
            setError("Please fill in SKU, Product Type, Brand, and upload an image before analyzing.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisCompleted(false);

        const variantColors = variants.map(v => v.color).filter(Boolean);

        try {
            const result = await categorizeProduct(
                imageFile,
                selectedProductType as 'watch' | 'glasses',
                selectedBrandId ? parseInt(selectedBrandId, 10) : null,
                model || undefined,
                price || undefined,
                userProvidedDetails || undefined,
                initialData.originalName || initialData.productName,
                variantColors
            );
            setSelectedCategories(new Set(result.categoryIds));
            setSelectedAttributes(new Set(result.attributeIds));
            setProductName(result.productName);
            setModel(result.model); 
            setTitleTag(result.titleTag);
            setMetaDescription(result.metaDescription);
            setSuggestedTags(result.suggestedTags);
            setShortDescription(result.shortDescription);
            setLongDescription(result.longDescription);
            setPrimaryCategoryId(result.primaryCategoryId ? String(result.primaryCategoryId) : '');
            setAnalysisCompleted(true);
            
            if (!sku || sku.includes('TEMP') || sku.toUpperCase() === 'AUTO') {
                const brandName = BRANDS.find(b => String(b.id) === selectedBrandId)?.name;
                setSku(generateSmartSku(selectedProductType, brandName, result.model));
            }

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
            sku: initialData.originalId ? initialData.sku! : sku, 
            productType: selectedProductType as 'watch' | 'glasses',
            price,
            imageSource: imageSource!,
            productName,
            titleTag,
            metaDescription,
            suggestedTags,
            shortDescription,
            longDescription,
            primaryCategoryId: primaryCategoryId ? parseInt(primaryCategoryId, 10) : null,
            categoryIds: Array.from(selectedCategories),
            attributeIds: Array.from(selectedAttributes),
            brandId: selectedBrandId ? parseInt(selectedBrandId, 10) : null,
            model,
            isReviewed: true,
            originalId: initialData.originalId,
            originalName: initialData.originalName,
            variants,
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

    const handleAddVariant = () => {
        const newVariant: Variant = {
            id: Math.random().toString(36).substr(2, 9),
            sku: `${sku}-${variants.length + 1}`,
            color: '',
            size: '',
            price: price,
            other: ''
        };
        setVariants([...variants, newVariant]);
    };

    const handleQuickAdd = () => {
        if (!quickAddColors) return;
        const colors = quickAddColors.split(',').map(c => c.trim()).filter(Boolean);
        const newVariants = colors.map((color, i) => ({
            id: Math.random().toString(36).substr(2, 9),
            sku: `${sku}-${variants.length + i + 1}`,
            color: color,
            size: '',
            price: price,
            other: ''
        }));
        setVariants([...variants, ...newVariants]);
        setQuickAddColors('');
    };

    const handleUpdateVariant = (id: string, field: keyof Variant, value: string) => {
        setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const handleRemoveVariant = (id: string) => {
        setVariants(prev => prev.filter(v => v.id !== id));
    };

    const isStep1Complete = sku && selectedProductType && selectedBrandId;
    const isReadyForAnalysis = isStep1Complete && !!imageFile;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>1. Product Details</h2>
                        {onReset && (
                            <button 
                                onClick={onReset} 
                                title="Start Over / Clear All"
                                style={{ backgroundColor: 'transparent', color: '#9CA3AF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                            >
                                <ResetIcon />
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="text" 
                                placeholder="Base SKU (e.g., WAT-RO-SUB-1234)" 
                                value={sku} 
                                onChange={e => setSku(e.target.value)} 
                                style={{ flex: 1, backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', width: '100%' }} 
                            />
                            <button 
                                onClick={handleMagicSku} 
                                title="Generate Smart SKU"
                                style={{ backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '0.375rem', width: '42px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <SparklesIcon />
                            </button>
                        </div>
                        <select value={selectedProductType} onChange={e => setSelectedProductType(e.target.value as any)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }}>
                            <option value="">Select Product Type</option>
                            <option value="watch">Watch</option>
                            <option value="glasses">Glasses</option>
                        </select>
                        <SearchableSelect options={BRANDS} value={selectedBrandId} onChange={setSelectedBrandId} placeholder="Select Brand" disabled={!selectedProductType} />
                        <input type="text" placeholder="Model / Style Name" value={model} onChange={e => setModel(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <input type="text" placeholder="Price (e.g., 50000)" value={price} onChange={e => setPrice(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }} />
                        <textarea placeholder="Extra details for AI..." value={userProvidedDetails} onChange={e => setUserProvidedDetails(e.target.value)} rows={3} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4B5563', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', resize: 'vertical' }} />
                    </div>
                </div>

                <ImageUploader 
                    imageUrl={imageUrl} 
                    onImageSelect={handleImageFileSelect} 
                    onImageUrlFetch={handleImageUrlFetch} 
                    onReset={onReset || (() => {})} 
                    isLoading={isLoading} 
                    isFetchingImage={isFetchingImage} 
                    error={error} 
                    hasImage={!!imageUrl} 
                    disabled={!isStep1Complete} 
                />
                <button onClick={handleStartAnalysis} disabled={!isReadyForAnalysis || isLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.75rem 1rem', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: !isReadyForAnalysis || isLoading ? 'not-allowed' : 'pointer', opacity: !isReadyForAnalysis || isLoading ? 0.6 : 1 }}>
                    <SparklesIcon /> <span style={{ marginLeft: '0.5rem' }}>{isLoading ? 'Analyzing...' : 'Start AI Analysis'}</span>
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ backgroundColor: '#1F2937', padding: '1.5rem', borderRadius: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Product Variations</h2>
                            <p style={{ color: '#9CA3AF', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Manage colors and sizes for this item.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', border: '1px solid #4B5563', borderRadius: '0.375rem', overflow: 'hidden' }}>
                                <input 
                                    type="text" 
                                    placeholder="Add multiple colors (e.g. Red, Blue)" 
                                    value={quickAddColors} 
                                    onChange={e => setQuickAddColors(e.target.value)}
                                    style={{ backgroundColor: '#111827', border: 'none', color: 'white', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '250px' }}
                                />
                                <button onClick={handleQuickAdd} style={{ padding: '0.5rem 1rem', backgroundColor: '#4B5563', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Quick Add</button>
                            </div>
                            <button onClick={handleAddVariant} style={{ padding: '0.5rem 1rem', backgroundColor: '#6366F1', color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>+ New Row</button>
                        </div>
                    </div>
                    
                    {variants.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #374151', borderRadius: '0.5rem', color: '#6B7280' }}>
                            No variants added. The master SKU will be used for export.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', color: '#9CA3AF', textTransform: 'uppercase', width: '25%' }}>SKU</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', color: '#9CA3AF', textTransform: 'uppercase', width: '25%' }}>Color</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', color: '#9CA3AF', textTransform: 'uppercase', width: '20%' }}>Size</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', color: '#9CA3AF', textTransform: 'uppercase', width: '20%' }}>Price</th>
                                        <th style={{ width: '10%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((v) => (
                                        <tr key={v.id}>
                                            <td style={{ padding: '0.25rem' }}>
                                                <input type="text" value={v.sku} onChange={e => handleUpdateVariant(v.id, 'sku', e.target.value)} style={{ width: '100%', backgroundColor: '#374151', border: '1px solid #4B5563', color: 'white', padding: '0.5rem', borderRadius: '0.25rem' }} />
                                            </td>
                                            <td style={{ padding: '0.25rem' }}>
                                                <input type="text" value={v.color} onChange={e => handleUpdateVariant(v.id, 'color', e.target.value)} style={{ width: '100%', backgroundColor: '#374151', border: '1px solid #4B5563', color: 'white', padding: '0.5rem', borderRadius: '0.25rem' }} />
                                            </td>
                                            <td style={{ padding: '0.25rem' }}>
                                                <input type="text" value={v.size} onChange={e => handleUpdateVariant(v.id, 'size', e.target.value)} style={{ width: '100%', backgroundColor: '#374151', border: '1px solid #4B5563', color: 'white', padding: '0.5rem', borderRadius: '0.25rem' }} />
                                            </td>
                                            <td style={{ padding: '0.25rem' }}>
                                                <input type="text" value={v.price} onChange={e => handleUpdateVariant(v.id, 'price', e.target.value)} style={{ width: '100%', backgroundColor: '#374151', border: '1px solid #4B5563', color: 'white', padding: '0.5rem', borderRadius: '0.25rem' }} />
                                            </td>
                                            <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                                                <button onClick={() => handleRemoveVariant(v.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem' }}><TrashIcon /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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
                                {onReset && (
                                    <button onClick={onReset} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1.5rem', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                                        <ResetIcon /> <span style={{ marginLeft: '0.5rem' }}>Start New</span>
                                    </button>
                                )}
                                {onCancel && <button onClick={onCancel} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
                                <button onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1.5rem', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                                    <SaveIcon /> <span style={{ marginLeft: '0.5rem' }}>{saveButtonText}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const App = () => {
    const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mode, setMode] = useState<'single' | 'bulk-create' | 'bulk-enrich'>('single');
    
    // Key-based reset for single product mode
    const [singleProductKey, setSingleProductKey] = useState(0);

    // Bulk Processing State
    const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [editingBulkIndex, setEditingBulkIndex] = useState<number | null>(null);

    const handleSaveProduct = (product: SavedProduct) => {
        setSavedProducts(prev => [...prev, product]);
        alert("Product saved successfully!");
        // Increment key to reset form for the next product
        setSingleProductKey(prev => prev + 1);
    };

    const handleResetSingleForm = () => {
        if (confirm("Are you sure you want to clear all fields to start a new product? This will not affect your saved items list.")) {
            setSingleProductKey(prev => prev + 1);
        }
    };
    
    const handleSaveBulkEditedProduct = (product: SavedProduct) => {
        if (editingBulkIndex === null) return;
        
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
            throw new Error(`Image load failed (CORS?): ${error.message}`);
        }
    };

    const processBulkFile = async (file: File, type: 'create' | 'enrich') => {
        setIsBulkProcessing(true);
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
            await new Promise(resolve => setTimeout(resolve, 100));

            for (let i = 0; i < newProducts.length; i++) {
                const currentId = newProducts[i].id;
                setBulkProducts(prev => prev.map(p => p.id === currentId ? { ...p, status: 'processing' } : p));

                try {
                    const productSource = newProducts[i].source;
                    const url = (productSource as any).imageUrl;
                    let imageFile = newProducts[i].imageFile;
                    
                    if (!imageFile && url) {
                         imageFile = await fetchImageFromUrl(url);
                    }

                    if (!imageFile) throw new Error("No image available");

                    let brandId: number | null = null;
                    const brandName = (productSource as any).brandName;
                    if (brandName) {
                        const brand = BRANDS.find(b => b.name.toLowerCase() === brandName.toLowerCase());
                        if (brand) brandId = brand.id;
                    }

                    const variantColorsStr = (productSource as any).variantColors || '';
                    const initialVariants: Variant[] = variantColorsStr.split(',')
                        .map((c: string) => c.trim())
                        .filter(Boolean)
                        .map((color: string, idx: number) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            sku: `${(productSource as any).sku}-${idx + 1}`,
                            color: color,
                            size: '',
                            price: (productSource as any).price || '',
                            other: ''
                        }));

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
                            undefined,
                            initialVariants.map(v => v.color)
                         );

                         let finalSku = p.sku;
                         if (!finalSku || finalSku.toUpperCase() === 'TEMP' || finalSku.toUpperCase() === 'AUTO') {
                             const finalBrandName = BRANDS.find(b => b.id === result.brandId)?.name;
                             finalSku = generateSmartSku(p.productType, finalBrandName, result.model);
                         }
                         
                         savedProduct = {
                            sku: finalSku,
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
                            model: result.model,
                            isReviewed: false,
                            variants: initialVariants
                         };

                    } else {
                         const p = productSource as EnrichmentCsvProduct;
                         result = await categorizeProduct(
                            imageFile,
                            p.productType as 'watch' | 'glasses',
                            brandId,
                            undefined,
                            p.price,
                            undefined,
                            p.name,
                            initialVariants.map(v => v.color)
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
                            model: result.model,
                            isReviewed: false,
                            originalId: p.id,
                            originalName: p.name,
                            variants: initialVariants
                         };
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
            link.setAttribute("download", "products.csv");
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

        if (newReviewedState) {
             setSavedProducts(prev => {
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

    const getBulkEditInitialData = () => {
        if (editingBulkIndex === null) return {};
        const p = bulkProducts[editingBulkIndex];
        const src = p.source as any;
        const res = p.result;
        
        return {
            sku: res?.sku || src.sku,
            productType: (res?.productType || src.productType || undefined) as 'watch' | 'glasses' | undefined,
            brandId: res?.brandId ?? (src.brandName ? BRANDS.find(b => b.name.toLowerCase() === src.brandName.toLowerCase())?.id : null) ?? null,
            model: res?.model || src.model || '',
            price: res?.price || src.price,
            userProvidedDetails: src.userProvidedDetails || '',
            imageFile: p.imageFile || null,
            imageUrl: src.imageUrl || null,
            imageSource: src.imageUrl || null,
            productName: res?.productName,
            titleTag: res?.titleTag,
            metaDescription: res?.metaDescription,
            suggestedTags: res?.suggestedTags,
            shortDescription: res?.shortDescription,
            longDescription: res?.longDescription,
            primaryCategoryId: res?.primaryCategoryId ?? null,
            categoryIds: res?.categoryIds,
            attributeIds: res?.attributeIds,
            variants: res?.variants || [],
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

                    {mode === 'single' && (
                        <ProductEditor 
                            key={`single-editor-${singleProductKey}`}
                            initialData={{}} 
                            onSave={handleSaveProduct} 
                            onReset={handleResetSingleForm}
                            saveButtonText="Save Product" 
                            isSaving={false} 
                        />
                    )}
                    
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
                            onDownload={handleDownloadCsv} 
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
