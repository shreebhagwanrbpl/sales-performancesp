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
    addDoc,
    onSnapshot,
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
export default function CategoryProduct() {
    const { pathname } = useLocation();
    const websiteName = "rajbiosislimited";
    const pathParts = pathname.split("/").filter(Boolean);
    const [bulkMode, setBulkMode] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [showCategoryInput, setShowCategoryInput] = useState(false);
    const [categories, setCategories] = useState([]);
    const [importingCategoryId, setImportingCategoryId] = useState(null);
    const [categoryName, setCategoryName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [activeId, setActiveId] = useState(null);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
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
    const handleEdit = (index) => {
        const product = selectedCategory.products[index];

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
                images: product.images || [],
                video: product.video || "",
                pdf: product.pdf || "",
            }
        ]);

        const realIndex =
            (currentPage - 1) * itemsPerPage + index;

        setEditIndex(realIndex);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };
    const handleMultipleImagesUpload = async (e) => {
        const file = e.target.files[0];

        if (!file) return;
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
            setProducts(prev => [
                {
                    ...prev[0],
                    image: imageUrl
                }
            ]);
            console.log("Uploaded URL:", imageUrl);
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
        try {
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

            // await fetchCategories();

            setSelectedCategory(null);

            setIsCategoryModalOpen(false);

            toast.success("Category Deleted");
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

        if (!selectedCategory) return;

        const unsubscribe = onSnapshot(
            doc(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id
            ),
            (snap) => {

                if (!snap.exists()) return;

                setSelectedCategory(prev => ({
                    ...prev,
                    ...snap.data(),
                    products: snap.data().products || [],
                }));

            }
        );

        return () => unsubscribe();

    }, [selectedCategory?.id]);
    const deleteSelectedProducts = async () => {
        if (selectedProducts.length === 0) {
            return toast.error("Select products first");
        }

        const updated = selectedCategory.products.filter(
            (p) => !selectedProducts.includes(p.id)
        );

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

        try {
            const docRef = doc(
                db,
                "websites",
                websiteName,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id
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

            const prefix = selectedCategory.category
                .split(" ")
                .map(word => word[0]?.toUpperCase())
                .join("");

            const nextCategoryId =
                existingProducts.length + 1;

            const newProduct = {
                id: crypto.randomUUID(),
                categoryProductId:
                    `${prefix}-${nextCategoryId}`,
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
                            categoryProductId: p.categoryProductId,
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
                        }
                        : p
                );
            } else {
                updatedProducts = [
                    newProduct,
                    ...existingProducts,
                ];
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

        setImportingCategoryId(selectedCategory.id);

        setImporting(true);

        setImportProgress(0);

        const file = e.target.files[0];

        if (!file) return;

        try {
            const workbook = new ExcelJS.Workbook();

            const buffer = await file.arrayBuffer();

            await workbook.xlsx.load(buffer);

            const worksheet = workbook.getWorksheet(1);
            const rowsCount = worksheet.rowCount - 1;

            const headers = {};

            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[
                    cell.value?.toString().trim().toLowerCase()
                ] = colNumber;
            });
            const imageMap = {};

            // 🔥 Extract Images
            // worksheet.getImages().forEach((img) => {
            //   imageMap[img.range.tl.nativeRow + 1] = img.imageId;
            // });
            worksheet.getImages().forEach((img) => {
                const media = workbook.model.media.find(
                    (m) => m.index === img.imageId
                );

                imageMap[img.imageId] = media;
            });

            const formatted = [];

            for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);

                let imageUrl = "";

                // 🔥 If image exists in row
                const currentImage = worksheet.getImages().find(
                    (img) => img.range.tl.nativeRow + 1 === rowNumber
                );

                if (currentImage) {
                    const image = imageMap[currentImage.imageId];

                    if (image?.buffer) {
                        const blob = new Blob([image.buffer]);

                        const imageRef = ref(
                            storage,
                            `websites/${websiteName}/category-products/${selectedCategory.id}/${Date.now()}-${rowNumber}.png`
                        );

                        await uploadBytes(imageRef, blob);

                        imageUrl = await getDownloadURL(imageRef);
                        console.log("IMAGE URL:", imageUrl);
                    }
                }

                const getValue = (key) => {
                    const col = headers[key];

                    if (!col) return "";

                    const value = row.getCell(col).value;

                    if (value == null) return "";

                    if (typeof value === "object") {
                        return value.text || value.richText?.map(t => t.text).join("") || "";
                    }

                    return String(value);
                };
                const title = getValue("title").trim();
                const desc = getValue("desc").trim();
                const brand = getValue("brand").trim();

                const hasData = [
                    title,
                    desc,
                    brand,
                    getValue("price").trim(),
                    getValue("capacity").trim(),
                    getValue("throughput").trim(),
                    getValue("instrument").trim(),
                    getValue("model").trim(),
                    getValue("usage").trim(),
                ]
                    .some(value => value !== "");

                if (!hasData) {
                    continue;
                }
                formatted.push({
                    id: crypto.randomUUID(),

                    title: getValue("title"),

                    price: getValue("price"),

                    desc: getValue("desc"),

                    capacity: getValue("capacity"),

                    throughput: getValue("throughput"),

                    instrument: getValue("instrument"),

                    model: getValue("model"),

                    usage: getValue("usage"),

                    brand: getValue("brand"),

                    parameters: getValue("parameters"),

                    automation: getValue("automation"),

                    availability: getValue("availability"),

                    size: getValue("size"),

                    slug: getValue("title")
                        ?.toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^\w-]+/g, ""),

                    image: imageUrl,

                    createdAt: new Date().toISOString(),

                    isPublished: true,
                });
                const processed = rowNumber - 1;

                setImportProgress(
                    Math.round(
                        (processed / rowsCount) * 100
                    )
                );


            }

            const approvalRef = doc(
                db,
                "websites",
                websiteName,
                "pages",
                "productApproval"
            );

            const approvalSnap = await getDoc(approvalRef);

            const pendingProducts = approvalSnap.exists()
                ? approvalSnap.data().products || []
                : [];
            console.log("Selected Category", selectedCategory);
            const approvalProducts = formatted.map((p) => ({
                ...p,
                category: selectedCategory.category,
                categoryId: selectedCategory.id,
                approvalStatus: "PENDING",
            }));
            console.log(approvalProducts);
            const pendingMap = new Map();

            pendingProducts.forEach((p) => {
                pendingMap.set(p.slug, p);
            });

            approvalProducts.forEach((p) => {
                if (pendingMap.has(p.slug)) {
                    const old = pendingMap.get(p.slug);

                    pendingMap.set(p.slug, {
                        ...old,
                        ...p,
                        id: old.id,
                        categoryProductId: old.categoryProductId,
                    });
                } else {
                    pendingMap.set(p.slug, p);
                }
            });

            await setDoc(
                approvalRef,
                {
                    products: Array.from(pendingMap.values()),
                },
                { merge: true }
            );
            // await fetchCategories();
            toast.success(
                "Products Imported. Waiting for Admin Approval."
            );
        } catch (err) {
            console.error(err);
            toast.error("Import failed ");
        } finally {
            setImporting(false);
            setImportingCategoryId(null);
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

            {/* Top Card */}
            <div className="product-page-card">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <button
                        className="product-page-btn product-page-add-btn"
                        onClick={() => setShowCategoryInput(true)}
                    >
                        + Add Category
                    </button>

                    <h2>Categories</h2>
                </div>
            </div>

            {/* Add Category */}
            {showCategoryInput && (
                <div className="product-page-card">
                    <h2>Add Category</h2>

                    <div
                        style={{
                            display: "flex",
                            gap: "10px",
                            marginTop: "20px",
                        }}
                    >
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
                    </div>
                </div>
            )}

            {/* Category Buttons */}
            {categories.length > 0 && (
                <div className="product-page-card">
                    <h2>All Categories</h2>

                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                            marginTop: "20px",
                        }}
                    >
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                className="product-page-btn product-page-categories-btn"
                                onClick={() => {

                                    setSelectedCategory(cat);

                                }}
                            >
                                {cat.category || cat.id.replace(/-/g, " ")}
                            </button>
                        ))}
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
                                    onClick={() => {
                                        setEditingCategory(selectedCategory);
                                        setIsCategoryModalOpen(true);
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
                            <input
                                id="categoryImport"
                                className="product-page-file-input"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleExcelImport}
                                style={{ display: "none" }}
                            />

                            <button
                                className="product-page-btn product-page-import-btn"
                                onClick={() =>
                                    document
                                        .getElementById("categoryImport")
                                        .click()
                                }
                                disabled={
                                    importing &&
                                    importingCategoryId === selectedCategory?.id
                                }
                            >
                                <FileUp
                                    size={16}
                                    style={{ marginRight: "6px" }}
                                />

                                {importing &&
                                    importingCategoryId === selectedCategory?.id
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
                            alignItems: "center",
                            marginTop: "20px",
                        }}
                    >
                        <div className="product-page-image-upload-box">
                            <input
                                id="productImage"
                                className="product-page-file-input"
                                type="file"
                                accept="image/*"
                                onChange={handleMultipleImagesUpload}
                            />

                            {products[0].image && (
                                <div
                                    className="product-page-image-file-name"
                                    onClick={() => setImageModal(products[0].image)}
                                >
                                    📷 Click to View Image
                                </div>
                            )}
                        </div>

                        <button
                            className="product-page-btn product-page-add-btn"
                            onClick={saveCategoryProduct}
                            disabled={saving || imageUploading}
                        >
                            {imageUploading
                                ? `Uploading ${uploadProgress}%`
                                : saving
                                    ? "Saving..."
                                    : editIndex !== null
                                        ? "Update Product"
                                        : "Save Product"}
                        </button>
                    </div>

                </div>
            )}

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
                                        disabled={currentPage === totalPages}
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

            <Modal
                isOpen={isCategoryModalOpen}
                onRequestClose={() => setIsCategoryModalOpen(false)}
                className="product-page-modal-box"
                overlayClassName="product-page-modal-overlay"
            >
                <h2>Edit Category</h2>

                <input
                    className="product-page-input"
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    style={{
                        width: "100%",
                        marginTop: "15px",
                    }}
                />

                <div className="product-page-modal-actions">
                    <button
                        className="product-page-btn product-page-cancel-btn"
                        onClick={() => setIsCategoryModalOpen(false)}
                    >
                        Cancel
                    </button>

                    <button
                        className="product-page-btn product-page-add-btn"
                        onClick={updateCategoryName}
                    >
                        Save
                    </button>

                    <button
                        className="product-page-btn product-page-delete-btn"
                        onClick={deleteCategory}
                    >
                        Delete
                    </button>
                </div>
            </Modal>
        </div>
    );

}