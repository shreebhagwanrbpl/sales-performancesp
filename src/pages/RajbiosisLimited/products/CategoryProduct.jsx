import { db, storage } from "../../../firebase";
import React from "react";
import { FileUp } from "lucide-react";
import Modal from "react-modal";
import { Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { X } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    onSnapshot,
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./products.css";
import ImportProgressWidget from "./ImportProgressWidget";
import { importExcelProducts } from "./excelImportHelper";
export default function CategoryProduct() {
    const { pathname } = useLocation();
    const websiteName = "rajbiosislimited";
    const pathParts = pathname.split("/").filter(Boolean);
    const [bulkMode, setBulkMode] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importStatus, setImportStatus] = useState({
        importing: false,
        totalFiles: 0,
        currentFileIndex: 0,
        currentFileName: "",
        currentFileProgress: 0,
        skippedCount: 0,
        successCount: 0,
        isMinimized: false,
        filesList: []
    });
    const [showCategoryInput, setShowCategoryInput] = useState(false);
    const [categories, setCategories] = useState([]);
    const [importingCategoryId, setImportingCategoryId] = useState(null);
    const [categoryName, setCategoryName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([]);
    const [selectedSubCategory, setSelectedSubCategory] = useState(null);
    const [showSubCategoryInput, setShowSubCategoryInput] = useState(false);
    const [subCategoryName, setSubCategoryName] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [activeId, setActiveId] = useState(null);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isCategoryDeleteModalOpen, setIsCategoryDeleteModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [products, setProducts] = useState([
        {
            title: "",
            price: "",
            desc: "",
            capacity: "",
            throughput: "",
            instrument: "",
            model: "",
            usage: "",
            brand: "",
            parameters: "",
            automation: "",
            availability: "",
            size: "",

            images: [],
            video: "",
            pdf: ""
        }
    ]);

    const [editIndex, setEditIndex] = useState(null);
    const [saving, setSaving] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [videoUploading, setVideoUploading] = useState(false);
    const [pdfUploading, setPdfUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    useEffect(() => {

        const unsubscribe = onSnapshot(

            collection(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories"
            ),

            (snap) => {

                const data = snap.docs.map((doc) => ({
                    id: doc.id,
                    products: [],
                    ...doc.data(),
                }));

                setCategories(data);

            }

        );

        return () => unsubscribe();

    }, [websiteName]);
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);

    useEffect(() => {
        if (!selectedCategory?.id) {
            setSubCategories([]);
            setSelectedSubCategory(null);
            return;
        }

        const unsubscribe = onSnapshot(
            collection(
                db, "websites", websiteName, "pages", "categoryproducts",
                "categories", selectedCategory.id, "subcategories"
            ),
            (snap) => {
                const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setSubCategories(data);
            }
        );

        return () => unsubscribe();
    }, [selectedCategory?.id]);
    const getActiveProductsDocRef = () => {
        if (!selectedCategory?.id) return null;

        if (selectedSubCategory?.id) {
            return doc(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id,
                "subcategories",
                selectedSubCategory.id
            );
        }

        return doc(
            db,
            "websites",
            websiteName,
            "pages",
            "categoryproducts",
            "categories",
            selectedCategory.id
        );
    };

    const handleEdit = (realIndex) => {
        const product = selectedCategory?.products?.[realIndex];

        if (!product) {
            toast.error("Product not found");
            return;
        }

        setProducts([
            {
                title: product.title || "",
                price: product.price || "",
                desc: product.desc || "",
                capacity: product.capacity || "",
                throughput: product.throughput || "",
                instrument: product.instrument || "",
                model: product.model || "",
                usage: product.usage || "",
                brand: product.brand || "",
                parameters: product.parameters || "",
                automation: product.automation || "",
                availability: product.availability || "",
                size: product.size || "",
                images: product.images?.length
                    ? product.images
                    : product.image
                        ? [product.image]
                        : [],
                video: product.video || "",
                pdf: product.pdf || "",
            }
        ]);

        setEditIndex(realIndex);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };
    const handleMultipleImagesUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCategory?.id) return;

        setUploadProgress(0);

        try {
            setImageUploading(true);
            setUploadProgress(25);

            const imageRef = ref(
                storage,
                `websites/${websiteName}/category-products/${selectedCategory.id}/${Date.now()}-${file.name}`
            );

            await uploadBytes(imageRef, file);
            setUploadProgress(75);

            const imageUrl = await getDownloadURL(imageRef);
            setUploadProgress(100);

            setProducts((prev) => [
                {
                    ...prev[0],
                    images: [imageUrl],
                },
            ]);

            toast.success("Image Uploaded Successfully");
        } catch (error) {
            console.error(error);
            toast.error("Image Upload Failed");
        } finally {
            setTimeout(() => {
                setImageUploading(false);
                setUploadProgress(0);
            }, 500);
        }
    };

    const handleVideoUpload = async (e) => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!selectedCategory?.id || !selectedSubCategory?.id) {
            toast.error("Please select a subcategory first");
            e.target.value = "";
            return;
        }

        if (!file.type.startsWith("video/")) {
            toast.error("Please select a valid video file");
            e.target.value = "";
            return;
        }

        setUploadProgress(0);

        try {
            setVideoUploading(true);
            setUploadProgress(25);

            const videoRef = ref(
                storage,
                `websites/${websiteName}/category-products/${selectedCategory.id}/${selectedSubCategory.id}/videos/${Date.now()}-${file.name}`
            );

            await uploadBytes(videoRef, file);
            setUploadProgress(75);

            const videoUrl = await getDownloadURL(videoRef);
            setUploadProgress(100);

            setProducts((prev) => [
                {
                    ...prev[0],
                    video: videoUrl,
                },
            ]);

            toast.success("Video Uploaded Successfully");
        } catch (error) {
            console.error(error);
            toast.error("Video Upload Failed");
        } finally {
            setTimeout(() => {
                setVideoUploading(false);
                setUploadProgress(0);
            }, 500);
        }
    };

    const handlePdfUpload = async (e) => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!selectedCategory?.id || !selectedSubCategory?.id) {
            toast.error("Please select a subcategory first");
            e.target.value = "";
            return;
        }

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            toast.error("Please select a valid PDF file");
            e.target.value = "";
            return;
        }

        setUploadProgress(0);

        try {
            setPdfUploading(true);
            setUploadProgress(25);

            const pdfRef = ref(
                storage,
                `websites/${websiteName}/category-products/${selectedCategory.id}/${selectedSubCategory.id}/pdfs/${Date.now()}-${file.name}`
            );

            await uploadBytes(pdfRef, file);
            setUploadProgress(75);

            const pdfUrl = await getDownloadURL(pdfRef);
            setUploadProgress(100);

            setProducts((prev) => [
                {
                    ...prev[0],
                    pdf: pdfUrl,
                },
            ]);

            toast.success("PDF Uploaded Successfully");
        } catch (error) {
            console.error(error);
            toast.error("PDF Upload Failed");
        } finally {
            setTimeout(() => {
                setPdfUploading(false);
                setUploadProgress(0);
            }, 500);
        }
    };

    const updateCategoryName = async () => {
        try {
            await setDoc(
                doc(
                    db,
                    "websites",
                    websiteName,
                    "pages",
                    "categoryproducts",
                    "categories",
                    editingCategory.id
                ),
                {
                    category: editCategoryName
                },
                { merge: true }
            );

            // await fetchCategories();

            setSelectedCategory(prev => ({
                ...prev,
                category: editCategoryName
            }));

            toast.success("Category Updated");

            setIsCategoryModalOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Update Failed");
        }
    };

    const deleteCategory = async () => {
        if (!editingCategory?.id) return;

        try {
            const subcategoriesRef = collection(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories",
                editingCategory.id,
                "subcategories"
            );

            const subcategoriesSnap = await getDocs(subcategoriesRef);

            await Promise.all(
                subcategoriesSnap.docs.map((subDoc) =>
                    deleteDoc(subDoc.ref)
                )
            );

            await deleteDoc(
                doc(
                    db,
                    "websites",
                    websiteName,
                    "pages",
                    "categoryproducts",
                    "categories",
                    editingCategory.id
                )
            );

            setSelectedCategory(null);
            setSelectedSubCategory(null);
            setSubCategories([]);
            setEditingCategory(null);
            setEditCategoryName("");
            setIsCategoryDeleteModalOpen(false);
            setIsCategoryModalOpen(false);

            toast.success("Category Deleted Successfully");
        } catch (err) {
            console.error(err);
            toast.error("Delete Failed");
        }
    };

    const togglePublish = async (index) => {
        const updated = selectedCategory.products.map((p, i) =>
            i === index
                ? { ...p, isPublished: !p.isPublished }
                : p
        );

        setSelectedCategory(prev => ({
            ...prev,
            products: updated
        }));


        setSelectedCategory(prev => ({
            ...prev,
            products: updated
        }));


        toast.success(updated[index].isPublished ? "Product Visible" : "Product Hidden");

        try {
            const activeProductsRef = getActiveProductsDocRef();

            if (!activeProductsRef) {
                throw new Error("No active category/subcategory selected");
            }

            await setDoc(
                activeProductsRef,
                { products: updated },
                { merge: true }
            );
        } catch (err) {
            toast.error("Failed to update");

            // rollback (optional)
            selectedCategory(selectedCategory);
        }
    };
    const confirmDelete = async () => {
        const updated = selectedCategory.products.filter(
            (_, i) => i !== deleteIndex
        );
        setSelectedCategory(prev => ({
            ...prev,
            products: updated
        }));
        setIsModalOpen(false);

        toast.success("Deleted successfully");

        try {
            const activeProductsRef = getActiveProductsDocRef();

            if (!activeProductsRef) {
                throw new Error("No active category/subcategory selected");
            }

            await setDoc(
                activeProductsRef,
                { products: updated },
                { merge: true }
            );
        } catch (err) {
            toast.error("Delete failed");
        }
    };
    const handleSelectProduct = (id) => {
        setSelectedProducts((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id]
        );
    };
    // useEffect(() => {
    //     if (websiteName) {
    //         fetchCategories();
    //     }
    // }, [websiteName]);
    useEffect(() => {
        if (!selectedCategory?.id) return;

        const target = selectedSubCategory?.id
            ? doc(
                db, "websites", websiteName, "pages", "categoryproducts",
                "categories", selectedCategory.id, "subcategories", selectedSubCategory.id
            )
            : doc(
                db, "websites", websiteName, "pages", "categoryproducts",
                "categories", selectedCategory.id
            );

        const unsubscribe = onSnapshot(target, (snap) => {
            if (!snap.exists()) return;
            setSelectedCategory((prev) => ({
                ...prev,
                ...(selectedSubCategory?.id
                    ? { products: snap.data().products || [] }
                    : { ...snap.data(), products: snap.data().products || [] }),
            }));
        });

        return () => unsubscribe();
    }, [selectedCategory?.id, selectedSubCategory?.id]);

    const deleteSelectedProducts = async () => {
        if (selectedProducts.length === 0) {
            return toast.error("Select products first");
        }

        const updated = selectedCategory.products.filter(
            (p) => !selectedProducts.includes(p.id)
        );

        try {
            const activeProductsRef = getActiveProductsDocRef();

            if (!activeProductsRef) {
                throw new Error("No active category/subcategory selected");
            }

            await setDoc(
                activeProductsRef,
                { products: updated },
                { merge: true }
            );

            setSelectedCategory(prev => ({
                ...prev,
                products: updated
            }));
            setSelectedProducts([]);

            toast.success(
                `${selectedProducts.length} products deleted`
            );
        } catch (err) {
            console.error(err);
            toast.error("Delete failed");
        }
    };
    const deleteAllProducts = async () => {
        try {
            await setDoc(
                doc(
                    db,
                    "websites",
                    websiteName,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id
                ),
                { products: [] },
                { merge: true }
            );

            setSelectedCategory(prev => ({
                ...prev,
                products: []
            }));

            setSelectedProducts([]);

            toast.success("All products deleted");
        } catch (err) {
            console.error(err);
            toast.error("Delete failed");
        }
    };
    const handleSubCategorySave = async () => {
        if (!selectedCategory?.id) {
            toast.error("Please select a category first");
            return;
        }
        if (!subCategoryName.trim()) {
            toast.error("Please enter subcategory name");
            return;
        }

        const slug = subCategoryName.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        try {
            await setDoc(
                doc(
                    db, "websites", websiteName, "pages", "categoryproducts",
                    "categories", selectedCategory.id, "subcategories", slug
                ),
                {
                    id: slug,
                    subCategory: subCategoryName.trim(),
                    categoryId: selectedCategory.id,
                    category: selectedCategory.category || selectedCategory.id,
                    products: [],
                    createdAt: new Date().toISOString(),
                }
            );
            toast.success("Subcategory Saved Successfully");
            setSubCategoryName("");
            setShowSubCategoryInput(false);
        } catch (err) {
            console.error(err);
            toast.error("Subcategory Save Failed");
        }
    };

    const handleCategorySave = async () => {
        if (!categoryName.trim()) {
            toast.error("Please enter category name");
            return;
        }

        const slug = categoryName
            .toLowerCase()
            .replace(/\s+/g, "-");

        await setDoc(
            doc(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories",
                slug
            ),
            {
                id: slug,
                category: categoryName,
                products: [],
                createdAt: new Date().toISOString(),
            }
        );

        // await fetchCategories();

        toast.success("Category Saved Successfully");

        setCategoryName("");
        setShowCategoryInput(false);
    };
    const paginatedProducts =
        selectedCategory?.products?.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        ) || [];

    const totalPages = Math.ceil(
        (selectedCategory?.products?.length || 0) /
        itemsPerPage
    );
    const saveCategoryProduct = async () => {
        if (!selectedCategory) return;

        setSaving(true);

        const cleanCategoryProduct = (p) => {
            const imagesArray = Array.isArray(p.images)
                ? p.images
                : p.image
                    ? [p.image]
                    : [];
            return {
                id: p.id || crypto.randomUUID(),
                categoryProductId: p.categoryProductId || "",
                categoryId: p.categoryId || selectedCategory.id || "",
                category: p.category || selectedCategory.category || selectedCategory.id || "",
                subCategoryId: p.subCategoryId || selectedSubCategory?.id || "",
                subCategory: p.subCategory || selectedSubCategory?.subCategory || selectedSubCategory?.id || "",
                title: p.title || "",
                price: p.price || "",
                desc: p.desc || "",
                capacity: p.capacity || "",
                throughput: p.throughput || "",
                instrument: p.instrument || "",
                model: p.model || "",
                usage: p.usage || "",
                brand: p.brand || "",
                parameters: p.parameters || "",
                automation: p.automation || "",
                availability: p.availability || "",
                size: p.size || "",
                images: imagesArray,
                image: imagesArray[0] || "",
                video: p.video || "",
                pdf: p.pdf || "",
                createdAt: p.createdAt || new Date().toISOString(),
                isPublished: typeof p.isPublished === "boolean" ? p.isPublished : true,
                approvalStatus: p.approvalStatus || "APPROVED",
            };
        };

        try {
            if (!selectedSubCategory?.id) {
                toast.error("Please select a subcategory first");
                setSaving(false);
                return;
            }

            const docRef = doc(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id,
                "subcategories",
                selectedSubCategory.id
            );
            // if (imageUploading) {
            //     toast.error("Image is still uploading");
            //     return;
            // }
            const snap = await getDoc(docRef);

            const existingProducts =
                snap.exists()
                    ? snap.data().products || []
                    : [];

            const prefix = (selectedCategory.category || selectedCategory.id || "CAT")
                .split(" ")
                .map(word => word[0]?.toUpperCase())
                .join("");

            const nextCategoryId =
                existingProducts.length + 1;

            const newProduct = {
                id: crypto.randomUUID(),
                categoryProductId:
                    `${prefix}-${nextCategoryId}`,
                categoryId: selectedCategory.id,
                category: selectedCategory.category || selectedCategory.id,
                subCategoryId: selectedSubCategory.id,
                subCategory: selectedSubCategory.subCategory || selectedSubCategory.id,
                title: products[0].title,
                price: products[0].price,
                desc: products[0].desc,
                capacity: products[0].capacity,
                throughput: products[0].throughput,
                instrument: products[0].instrument,
                model: products[0].model,
                usage: products[0].usage,
                brand: products[0].brand,
                parameters: products[0].parameters,
                automation: products[0].automation,
                availability: products[0].availability,
                size: products[0].size,
                images: products[0].images || [],
                video: products[0].video || "",
                pdf: products[0].pdf || "",
                createdAt: new Date().toISOString(),
                isPublished: false,
                approvalStatus: "PENDING",
            };

            let updatedProducts;

            if (editIndex !== null) {
                updatedProducts = existingProducts.map((p, i) =>
                    i === editIndex
                        ? {
                            ...p,
                            title: products[0].title,
                            price: products[0].price,
                            desc: products[0].desc,
                            capacity: products[0].capacity,
                            throughput: products[0].throughput,
                            instrument: products[0].instrument,
                            model: products[0].model,
                            usage: products[0].usage,
                            brand: products[0].brand,
                            parameters: products[0].parameters,
                            automation: products[0].automation,
                            availability: products[0].availability,
                            size: products[0].size,

                            images: products[0].images,
                            video: products[0].video,
                            pdf: products[0].pdf,
                        }
                        : p
                ).map(p => cleanCategoryProduct(p));
            } else {
                updatedProducts = [
                    newProduct,
                    ...existingProducts,
                ].map(p => cleanCategoryProduct(p));
            }

            await setDoc(
                docRef,
                { products: updatedProducts },
                { merge: true }
            );

            setSelectedCategory((prev) => ({
                ...prev,
                products: updatedProducts,
            }));

            setProducts([
                {
                    title: "",
                    price: "",
                    desc: "",
                    capacity: "",
                    throughput: "",
                    instrument: "",
                    model: "",
                    usage: "",
                    brand: "",
                    parameters: "",
                    automation: "",
                    availability: "",
                    size: "",
                    images: [],
                    video: "",
                    pdf: "",
                },
            ]);
            // await fetchCategories();

            setProducts([
                {
                    title: "",
                    price: "",
                    desc: "",
                    capacity: "",
                    throughput: "",
                    instrument: "",
                    model: "",
                    usage: "",
                    brand: "",
                    parameters: "",
                    automation: "",
                    availability: "",
                    size: "",
                    images: [],
                    video: "",
                    pdf: "",
                },
            ]);

            const imageInput =
                document.getElementById("productImage");

            if (imageInput) {
                imageInput.value = "";
            }

            setEditIndex(null);

            toast.success(
                editIndex !== null
                    ? "Product Updated Successfully"
                    : "Product Saved Successfully"
            );

        } catch (err) {
            console.error(err);
            toast.error("Save Failed");
        } finally {
            setSaving(false);
        }
    };
    const handleExcelImport = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
            return;
        }

        setImporting(true);
        setImportProgress(0);

        setImportStatus({
            importing: true,
            totalFiles: files.length,
            currentFileIndex: 0,
            currentFileName: files[0].name,
            currentFileProgress: 0,
            skippedCount: 0,
            successCount: 0,
            isMinimized: false,
            filesList: files.map(f => f.name),
        });

        try {
            const stats = await importExcelProducts({
                files,
                websiteName,
                source: "category",
                setImportStatus,
                setImportProgress,
            });

            toast.success(
                `Import complete! Normal products: ${stats.importedNormalProducts}, Category products: ${stats.importedCategoryProducts}. Skipped: ${stats.skippedDuplicates}`
            );
        } catch (err) {
            console.error("Excel Import Error:", err);
            toast.error(err?.message || "Import failed");
        } finally {
            setImporting(false);
            setImportingCategoryId(null);
            setImportStatus(prev => ({ ...prev, importing: false }));
        }
    };
    return (
        <div>
            {/* Header */}
            <div className="product-page-top-header">
                <div className="product-page-path">
                    {pathParts.map((part, index) => (
                        <span key={index}>
                            {part.charAt(0).toUpperCase() + part.slice(1)}
                            {index !== pathParts.length - 1 && " > "}
                        </span>
                    ))}
                </div>

                <h3 className="product-page-heading">
                    Category Page
                </h3>
            </div>

            <div className="category-layout-shell">
                <aside className="category-sidebar">
                    <div className="category-sidebar-title">Categories</div>
                    <div className="category-sidebar-list">
                        {categories.map((cat) => (
                            <div key={cat.id} className="category-sidebar-item">
                                <button
                                    type="button"
                                    className={`category-sidebar-category ${selectedCategory?.id === cat.id ? "active" : ""}`}
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        setSelectedSubCategory(null);
                                        setCurrentPage(1);
                                        setEditIndex(null);
                                    }}
                                >
                                    <span>{cat.category || cat.id.replace(/-/g, " ")}</span>
                                </button>

                                {selectedCategory?.id === cat.id && (
                                    <div className="category-sidebar-subcategories">
                                        {subCategories.map((sub) => (
                                            <button
                                                key={sub.id}
                                                type="button"
                                                className={`category-sidebar-subcategory ${selectedSubCategory?.id === sub.id ? "active" : ""}`}
                                                onClick={() => {
                                                    setSelectedSubCategory(sub);
                                                    setCurrentPage(1);
                                                    setEditIndex(null);
                                                }}
                                            >
                                                {sub.subCategory || sub.id.replace(/-/g, " ")}
                                            </button>
                                        ))}
                                        {subCategories.length === 0 && (
                                            <div className="category-sidebar-empty">No subcategory</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </aside>

                <main className="category-main-content">
                    <div className="product-page-card category-add-category-card">
                        <div className="category-add-category-row">
                            <div>
                                <h2>Categories</h2>
                                <p className="category-add-category-help">
                                    Add a new category or import from excel.
                                </p>
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <input
                                    id="globalCategoryImport"
                                    className="product-page-file-input"
                                    type="file"
                                    accept=".xlsx,.xls"
                                    multiple
                                    onChange={handleExcelImport}
                                    style={{ display: "none" }}
                                />
                                <button
                                    className="product-page-btn product-page-import-btn"
                                    onClick={() => document.getElementById("globalCategoryImport").click()}
                                    disabled={importing}
                                >
                                    <FileUp size={16} style={{ marginRight: "6px" }} />
                                    {importing ? `Importing ${importProgress}%` : "Import Excel"}
                                </button>
                                <button
                                    className="product-page-btn product-page-add-btn"
                                    onClick={() => setShowCategoryInput(true)}
                                >
                                    + Add Category
                                </button>
                            </div>
                        </div>
                    </div>

                    {showCategoryInput && (
                        <div className="product-page-card">
                            <h2>Add Category</h2>
                            <div className="category-add-category-form">
                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Enter Category Name"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                />
                                <button
                                    className="product-page-btn product-page-add-btn"
                                    onClick={handleCategorySave}
                                >
                                    Save Category
                                </button>
                                <button
                                    className="product-page-btn product-page-cancel-btn"
                                    onClick={() => {
                                        setShowCategoryInput(false);
                                        setCategoryName("");
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Product Form */}
                    {selectedCategory && (
                        <div className="product-page-card">
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "20px",
                                }}
                            >
                                <div>
                                    <h2>Add Product</h2>

                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            marginTop: "5px",
                                        }}
                                    >
                                        <p style={{ margin: 0 }}>
                                            Category :
                                            <strong>
                                                {" "}
                                                {selectedCategory.category ||
                                                    selectedCategory.id.replace(/-/g, " ")}
                                            </strong>
                                        </p>

                                        <button
                                            className="product-page-category-icon-btn"
                                            onClick={() => {
                                                setEditingCategory(selectedCategory);
                                                setEditCategoryName(
                                                    selectedCategory.category || ""
                                                );
                                                setIsCategoryModalOpen(true);
                                            }}
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        <button
                                            className="product-page-category-icon-btn product-page-delete"
                                            title="Delete Category"
                                            onClick={() => {
                                                setEditingCategory(selectedCategory);
                                                setIsCategoryDeleteModalOpen(true);
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                    }}
                                >
                                    <button
                                        className="product-page-btn product-page-import-btn"
                                        onClick={() =>
                                            document
                                                .getElementById("globalCategoryImport")
                                                .click()
                                        }
                                        disabled={importing}
                                    >
                                        <FileUp
                                            size={16}
                                            style={{ marginRight: "6px" }}
                                        />

                                        {importing
                                            ? `Importing ${importProgress}%`
                                            : "Import Excel"}
                                    </button>

                                    <button
                                        className="product-page-btn"
                                        title="Close Form"
                                        onClick={() => setSelectedCategory(null)}
                                        style={{
                                            width: "52px",
                                            height: "42px",
                                            borderRadius: "8px",
                                            background: "#fff",
                                            color: "#3e14e7",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="category-subcategory-toolbar">
                                <div className="category-subcategory-title">
                                    <span>Subcategory:</span>
                                    <strong>
                                        {selectedSubCategory?.subCategory || "Select Subcategory"}
                                    </strong>
                                </div>
                                <div className="category-subcategory-actions">
                                    <select
                                        className="product-page-input category-subcategory-select"
                                        value={selectedSubCategory?.id || ""}
                                        onChange={(e) => {
                                            const sub = subCategories.find((x) => x.id === e.target.value);
                                            setSelectedSubCategory(sub || null);
                                            setCurrentPage(1);
                                            setEditIndex(null);
                                        }}
                                    >
                                        <option value="">Select Subcategory</option>
                                        {subCategories.map((sub) => (
                                            <option key={sub.id} value={sub.id}>
                                                {sub.subCategory || sub.id.replace(/-/g, " ")}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        className="product-page-btn product-page-add-btn"
                                        onClick={() => setShowSubCategoryInput(true)}
                                    >
                                        + Add Subcategory
                                    </button>
                                </div>
                            </div>

                            {showSubCategoryInput && (
                                <div className="category-subcategory-add-box">
                                    <input
                                        className="product-page-input"
                                        type="text"
                                        placeholder="Enter Subcategory Name"
                                        value={subCategoryName}
                                        onChange={(e) => setSubCategoryName(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="product-page-btn product-page-add-btn"
                                        onClick={handleSubCategorySave}
                                    >
                                        Save Subcategory
                                    </button>
                                    <button
                                        type="button"
                                        className="product-page-btn product-page-cancel-btn"
                                        onClick={() => {
                                            setShowSubCategoryInput(false);
                                            setSubCategoryName("");
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            <div className="product-page-form-row">

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Product Name"
                                    value={products[0].title}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].title = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Price"
                                    value={products[0].price}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].price = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Description"
                                    value={products[0].desc}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].desc = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Capacity"
                                    value={products[0].capacity}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].capacity = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Throughput"
                                    value={products[0].throughput}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].throughput = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Instrument Name"
                                    value={products[0].instrument}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].instrument = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Model Name/Number"
                                    value={products[0].model}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].model = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Usage/Application"
                                    value={products[0].usage}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].usage = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Brand"
                                    value={products[0].brand}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].brand = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Parameters"
                                    value={products[0].parameters}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].parameters = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Automation"
                                    value={products[0].automation}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].automation = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Availability"
                                    value={products[0].availability}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].availability = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                                <input
                                    className="product-page-input"
                                    type="text"
                                    placeholder="Size"
                                    value={products[0].size}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[0].size = e.target.value;
                                        setProducts(updated);
                                    }}
                                />

                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-end",
                                    gap: "20px",
                                    marginTop: "20px",
                                    flexWrap: "wrap",
                                }}
                            >
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                        gap: "14px",
                                        flex: "1 1 700px",
                                    }}
                                >
                                    {/* IMAGE UPLOAD */}
                                    <div className="product-page-image-upload-box">
                                        <label
                                            style={{
                                                display: "block",
                                                fontWeight: 600,
                                                marginBottom: "8px",
                                            }}
                                        >
                                            Product Image
                                        </label>

                                        <input
                                            id="productImage"
                                            className="product-page-file-input"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleMultipleImagesUpload}
                                        />

                                        {products[0].images?.[0] && (
                                            <div
                                                className="product-page-image-file-name"
                                                onClick={() =>
                                                    setImageModal(products[0].images[0])
                                                }
                                                style={{
                                                    cursor: "pointer",
                                                    marginTop: "8px",
                                                }}
                                            >
                                                📷 Click to View Image
                                            </div>
                                        )}

                                        {imageUploading && (
                                            <div
                                                style={{
                                                    marginTop: "8px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Uploading Image {uploadProgress}%
                                            </div>
                                        )}
                                    </div>

                                    {/* VIDEO UPLOAD */}
                                    <div className="product-page-image-upload-box">
                                        <label
                                            style={{
                                                display: "block",
                                                fontWeight: 600,
                                                marginBottom: "8px",
                                            }}
                                        >
                                            Product Video
                                        </label>

                                        <input
                                            id="productVideo"
                                            className="product-page-file-input"
                                            type="file"
                                            accept="video/*"
                                            onChange={handleVideoUpload}
                                        />

                                        {products[0].video && (
                                            <a
                                                href={products[0].video}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: "block",
                                                    marginTop: "8px",
                                                    fontSize: "13px",
                                                    color: "#16a34a",
                                                    fontWeight: 600,
                                                    textDecoration: "none",
                                                }}
                                            >
                                                ✓ View Uploaded Video
                                            </a>
                                        )}

                                        {videoUploading && (
                                            <div
                                                style={{
                                                    marginTop: "8px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Uploading Video {uploadProgress}%
                                            </div>
                                        )}
                                    </div>

                                    {/* PDF UPLOAD */}
                                    <div className="product-page-image-upload-box">
                                        <label
                                            style={{
                                                display: "block",
                                                fontWeight: 600,
                                                marginBottom: "8px",
                                            }}
                                        >
                                            Product PDF
                                        </label>

                                        <input
                                            id="productPdf"
                                            className="product-page-file-input"
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            onChange={handlePdfUpload}
                                        />

                                        {products[0].pdf && (
                                            <a
                                                href={products[0].pdf}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: "block",
                                                    marginTop: "8px",
                                                    fontSize: "13px",
                                                    color: "#2563eb",
                                                    fontWeight: 600,
                                                    textDecoration: "none",
                                                }}
                                            >
                                                📄 View Uploaded PDF
                                            </a>
                                        )}

                                        {pdfUploading && (
                                            <div
                                                style={{
                                                    marginTop: "8px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Uploading PDF {uploadProgress}%
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    className="product-page-btn product-page-add-btn"
                                    onClick={saveCategoryProduct}
                                    disabled={
                                        saving ||
                                        imageUploading ||
                                        videoUploading ||
                                        pdfUploading ||
                                        !selectedSubCategory
                                    }
                                    style={{ minWidth: "160px" }}
                                >
                                    {imageUploading
                                        ? `Uploading Image ${uploadProgress}%`
                                        : videoUploading
                                            ? `Uploading Video ${uploadProgress}%`
                                            : pdfUploading
                                                ? `Uploading PDF ${uploadProgress}%`
                                                : saving
                                                    ? "Saving..."
                                                    : editIndex !== null
                                                        ? "Update Product"
                                                        : "Save Product"}
                                </button>
                            </div>

                        </div>
                    )}
                </main>
            </div>

            {/* Product List */}
            {selectedCategory &&
                selectedCategory.products &&
                selectedCategory.products.length > 0 && (
                            <>
                                <div className="product-page-preview">
                                    <div className="product-page-header-row">

                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "10px",
                                                alignItems: "center",
                                            }}
                                        >

                                            {/* <input
      className="product-page-file-input"
      type="file"
      accept=".xlsx, .xls"
      onChange={handleExcelImport}
      style={{ display: "none" }}
      id="excelUpload"
    />

    <button
      className="product-page-btn product-page-import-btn"
      onClick={() => document.getElementById("excelUpload").click()}
      disabled={importing}
    >
      <FileUp
        size={16}
        style={{ marginRight: "6px" }}
      />

      {importing
        ? `Importing ${importProgress}%`
        : "Import"}
    </button> */}

                                            {!bulkMode ? (
                                                <button
                                                    className="product-page-btn product-page-bulk-btn"
                                                    onClick={() => setBulkMode(true)}
                                                >
                                                    Bulk Actions
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        className="product-page-btn product-page-delete-selected-btn"
                                                        onClick={deleteSelectedProducts}
                                                    >
                                                        Delete Selected ({selectedProducts.length})
                                                    </button>

                                                    <button
                                                        className="product-page-btn product-page-delete-all-btn"
                                                        onClick={() => {
                                                            setBulkMode(true);

                                                            setSelectedProducts(
                                                                selectedCategory.products.map((p) => p.id)
                                                            );

                                                            setIsDeleteAllModalOpen(true);
                                                        }}
                                                    >
                                                        Delete All
                                                    </button>

                                                    <button
                                                        className="product-page-btn product-page-cancel-btn"
                                                        onClick={() => {
                                                            setBulkMode(false);
                                                            setSelectedProducts([]);
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}

                                        </div>

                                    </div>
                                    <table className="product-page-table">
                                        <thead>
                                            <tr>
                                                {bulkMode && (
                                                    <th>
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                selectedProducts.length === selectedCategory?.products?.length &&
                                                                selectedCategory?.products?.length > 0
                                                            }
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedProducts(
                                                                        selectedCategory.products.map((p) => p.id)
                                                                    );
                                                                } else {
                                                                    setSelectedProducts([]);
                                                                }
                                                            }}
                                                        />
                                                    </th>
                                                )}
                                                {/* <th>Category ID</th> */}
                                                <th>Create At</th>
                                                <th>Image</th>
                                                <th>Product</th>
                                                <th>Price ₹</th>
                                                <th>Description</th>
                                                <th>Status</th>
                                                <th>Visibility</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {paginatedProducts.map((item, i) => (
                                                <React.Fragment key={item.id || i}>

                                                    {/* MAIN ROW */}
                                                    <tr
                                                        className="product-page-main-row"
                                                        onClick={() =>
                                                            setActiveId(activeId === (item.id || i) ? null : (item.id || i))
                                                        }
                                                    >
                                                        {bulkMode && (
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProducts.includes(item.id)}
                                                                    onChange={() =>
                                                                        handleSelectProduct(item.id)
                                                                    }
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </td>
                                                        )}
                                                        {/* <td>{item.categoryProductId || "-"}</td> */}
                                                        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                                                        <td>
                                                            {(item.images?.[0] || item.image) ? (
                                                                <img
                                                                    src={item.images?.[0] || item.image}
                                                                    alt={item.title}
                                                                    className="product-page-thumb"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setImageModal(item.images?.[0] || item.image);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="product-page-no-image">
                                                                    {item.title
                                                                        ? item.title
                                                                            .split(" ")
                                                                            .slice(0, 2)
                                                                            .join(" ")
                                                                        : "No Img"}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="product-page-title">
                                                            {String(item.title || "").length > 20
                                                                ? String(item.title).slice(0, 20) + "..."
                                                                : String(item.title || "")}
                                                        </td>

                                                        <td>₹ {item.price}</td>

                                                        <td>
                                                            {item.desc?.length > 30
                                                                ? item.desc.slice(0, 30) + "..."
                                                                : item.desc}
                                                        </td>

                                                        <td>
                                                            <span className={`product-page-status ${item.isPublished
                                                                ? "product-page-published"
                                                                : "product-page-unpublished"
                                                                }`}>
                                                                {item.isPublished ? "● Published" : "● Hidden"}
                                                            </span>
                                                        </td>

                                                        <td>
                                                            <button
                                                                className={`product-page-toggle-btn ${item.isPublished
                                                                    ? "product-page-unpublish"
                                                                    : "product-page-publish"
                                                                    }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const realIndex = (currentPage - 1) * itemsPerPage + i;
                                                                    togglePublish(realIndex);
                                                                }}
                                                            >
                                                                {item.isPublished ? "Hide" : "Show"}
                                                            </button>
                                                        </td>

                                                        <td className="product-page-action-buttons">
                                                            <button
                                                                className="product-page-btn product-page-edit"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const realIndex = (currentPage - 1) * itemsPerPage + i;
                                                                    handleEdit(realIndex);
                                                                }}
                                                            >
                                                                <Pencil size={16} />
                                                            </button>

                                                            <button
                                                                className="product-page-btn product-page-delete"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const realIndex = (currentPage - 1) * itemsPerPage + i;
                                                                    setDeleteIndex(realIndex);
                                                                    setIsModalOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {/* DETAIL ROW */}
                                                    {activeId === (item.id || i) && (
                                                        <tr className="product-page-detail-row-fixed">
                                                            <td colSpan="7">
                                                                <div className="product-page-details-wrapper">
                                                                    <div className="product-page-details">
                                                                        <p><b>Title:</b> {String(item.title || "")}</p>
                                                                        <p><b>Price:</b> ₹{item.price}</p>
                                                                        <p><b>Description:</b> {String(item.desc || "")}</p>
                                                                        <p><b>Capacity:</b> {item.capacity}</p>
                                                                        <p><b>Throughput:</b> {item.throughput}</p>
                                                                        <p><b>Instrument:</b> {item.instrument}</p>
                                                                        <p><b>Model:</b> {item.model}</p>
                                                                        <p><b>Usage:</b> {item.usage}</p>
                                                                        <p><b>Brand:</b> {item.brand}</p>
                                                                        <p><b>Automation:</b> {item.automation}</p>
                                                                        <p><b>Availability:</b> {item.availability}</p>
                                                                        <p><b>Size:</b> {item.size}</p>

                                                                        <p>
                                                                            <b>Video:</b>{" "}
                                                                            {item.video ? (
                                                                                <a
                                                                                    href={item.video}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    style={{
                                                                                        color: "#2563eb",
                                                                                        fontWeight: 600,
                                                                                    }}
                                                                                >
                                                                                    View Video
                                                                                </a>
                                                                            ) : (
                                                                                "-"
                                                                            )}
                                                                        </p>

                                                                        <p>
                                                                            <b>PDF:</b>{" "}
                                                                            {item.pdf ? (
                                                                                <a
                                                                                    href={item.pdf}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    style={{
                                                                                        color: "#2563eb",
                                                                                        fontWeight: 600,
                                                                                    }}
                                                                                >
                                                                                    View PDF
                                                                                </a>
                                                                            ) : (
                                                                                "-"
                                                                            )}
                                                                        </p>

                                                                        <p>
                                                                            <div
                                                                                style={{
                                                                                    gridColumn: "1 / -1",
                                                                                    marginTop: "10px"
                                                                                }}
                                                                            >
                                                                                <b>Images ({item.images?.length || 0})</b>

                                                                                <div
                                                                                    style={{
                                                                                        display: "flex",
                                                                                        gap: "8px",
                                                                                        flexWrap: "wrap",
                                                                                        marginTop: "10px"
                                                                                    }}
                                                                                >
                                                                                    {item.images?.map((img, index) => (
                                                                                        <img
                                                                                            key={index}
                                                                                            src={img}
                                                                                            onClick={() => setImageModal(img)}
                                                                                            style={{
                                                                                                width: "45px",
                                                                                                height: "45px",
                                                                                                objectFit: "cover",
                                                                                                borderRadius: "6px",
                                                                                                border: "1px solid #ddd",
                                                                                                cursor: "pointer"
                                                                                            }}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="product-page-pagination-card">
                                    <div className="product-page-pagination-wrapper">

                                        {/* Items per page */}
                                        <div className="product-page-page-size">
                                            <span>Per Page:</span>

                                            <select
                                                value={itemsPerPage}
                                                onChange={(e) => {
                                                    setItemsPerPage(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <option value={10}>10 items</option>
                                                <option value={25}>25 items</option>
                                                <option value={50}>50 items</option>
                                                <option value={100}>100 items</option>
                                            </select>
                                        </div>

                                        <div className="product-page-pagination">

                                            {/* Prev */}
                                            <button
                                                className="product-page-btn product-page-nav-btn"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage((p) => p - 1)}
                                            >
                                                ◀
                                            </button>

                                            {/* Previous Page */}
                                            {currentPage > 1 && (
                                                <button
                                                    className="product-page-btn product-page-page-btn"
                                                    onClick={() => setCurrentPage(currentPage - 1)}
                                                >
                                                    {currentPage - 1}
                                                </button>
                                            )}

                                            {/* Current Page */}
                                            <button className="product-page-btn product-page-page-btn product-page-active">
                                                {currentPage}
                                            </button>

                                            {/* Next Page */}
                                            {currentPage < totalPages && (
                                                <button
                                                    className="product-page-btn product-page-page-btn"
                                                    onClick={() => setCurrentPage(currentPage + 1)}
                                                >
                                                    {currentPage + 1}
                                                </button>
                                            )}

                                            {/* Next */}
                                            <button
                                                className="product-page-btn product-page-nav-btn"
                                                disabled={totalPages === 0 || currentPage === totalPages}
                                                onClick={() => setCurrentPage((p) => p + 1)}
                                            >
                                                ▶
                                            </button>

                                        </div>
                                    </div>
                                </div>
                            </>
                        )}


            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                className="product-page-modal-box"
                overlayClassName="product-page-modal-overlay"
            >
                <h2>Delete Product</h2>
                <p>Are you sure?</p>

                <div className="product-page-modal-actions">
                    <button
                        className="product-page-btn product-page-cancel-btn"
                        onClick={() => setIsModalOpen(false)}
                    >
                        Cancel
                    </button>

                    <button
                        className="product-page-btn product-page-delete-btn"
                        onClick={confirmDelete}
                    >
                        Delete
                    </button>
                </div>
            </Modal>

            <Modal
                isOpen={isDeleteAllModalOpen}
                onRequestClose={() => setIsDeleteAllModalOpen(false)}
                className="product-page-modal-box"
                overlayClassName="product-page-modal-overlay"
            >
                <h2>Delete All Products</h2>

                <p>
                    Are you sure you want to delete permanently
                    <b> {selectedCategory?.products?.length || 0} products</b>?
                </p>

                <div className="product-page-modal-actions">
                    <button
                        className="product-page-btn product-page-cancel-btn"
                        onClick={() => {
                            setIsDeleteAllModalOpen(false);
                            setSelectedProducts([]);
                        }}
                    >
                        Cancel
                    </button>

                    <button
                        className="product-page-btn product-page-delete-btn"
                        onClick={async () => {
                            await deleteAllProducts();
                            setIsDeleteAllModalOpen(false);
                        }}
                    >
                        Delete All
                    </button>
                </div>
            </Modal>

            <Modal
                isOpen={!!imageModal}
                onRequestClose={() => setImageModal(null)}
                className="product-page-image-modal"
                overlayClassName="product-page-modal-overlay"
            >
                <img
                    src={imageModal}
                    alt="preview"
                    className="product-page-full-img"
                />
            </Modal>

            {/* Edit Category */}
            <Modal
                isOpen={isCategoryModalOpen}
                onRequestClose={() => setIsCategoryModalOpen(false)}
                className="category-modal-box"
                overlayClassName="category-modal-overlay"
            >
                <div className="category-modal-icon edit">
                    <Pencil size={22} />
                </div>

                <h2 className="category-modal-title">Edit Category</h2>
                <p className="category-modal-description">
                    Update the category name without changing its subcategories or products.
                </p>

                <input
                    className="product-page-input category-modal-input"
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    autoFocus
                />

                <div className="category-modal-actions">
                    <button
                        className="category-modal-btn category-modal-cancel"
                        onClick={() => setIsCategoryModalOpen(false)}
                    >
                        Cancel
                    </button>

                    <button
                        className="category-modal-btn category-modal-save"
                        onClick={updateCategoryName}
                    >
                        Save Changes
                    </button>
                </div>
            </Modal>

            {/* Delete Category Confirmation */}
            <Modal
                isOpen={isCategoryDeleteModalOpen}
                onRequestClose={() => setIsCategoryDeleteModalOpen(false)}
                className="category-modal-box category-delete-modal-box"
                overlayClassName="category-modal-overlay"
            >
                <div className="category-modal-icon delete">
                    <Trash2 size={24} />
                </div>

                <h2 className="category-modal-title">Delete Category?</h2>

                <p className="category-modal-description">
                    Are you sure you want to delete{" "}
                    <strong>{editingCategory?.category || editingCategory?.id || "this category"}</strong>?
                    This will also remove its saved subcategories and their product data.
                </p>

                <div className="category-delete-warning">
                    <strong>Warning:</strong> This action cannot be undone.
                </div>

                <div className="category-modal-actions">
                    <button
                        className="category-modal-btn category-modal-cancel"
                        onClick={() => setIsCategoryDeleteModalOpen(false)}
                    >
                        Cancel
                    </button>

                    <button
                        className="category-modal-btn category-modal-delete"
                        onClick={deleteCategory}
                    >
                        <Trash2 size={17} />
                        Delete Category
                    </button>
                </div>
            </Modal>
            <ImportProgressWidget status={importStatus} setStatus={setImportStatus} />
        </div>
    );

}