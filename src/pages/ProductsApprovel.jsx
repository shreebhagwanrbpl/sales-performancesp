import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    onSnapshot,
} from "firebase/firestore";
import Modal from "react-modal";
// import "./products.css";
import toast, { Toaster } from "react-hot-toast";
import { Pencil, Trash2, Upload, FileUp } from "lucide-react";
import ExcelJS from "exceljs";
import { db, storage } from "../firebase";
// import CategoryProduct from "./CategoryProduct";
import {
    useLocation,
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";


export default function ProductApproval() {
    const WEBSITE = "rajbiosislimited";
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [openIndex, setOpenIndex] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkMode, setBulkMode] = useState(false);
    const [importPercent, setImportPercent] = useState(0);
    const [totalRows, setTotalRows] = useState(0);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [imageGallery, setImageGallery] = useState([]);
    const [requestFilter, setRequestFilter] = useState("ALL");
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [products, setProducts] = useState([
        {
            productId: "",
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
        }
    ]);
    const cleanProduct = (p = {}) => ({
        id: p.id || "",
        productId: p.productId ?? null,

        title: p.title || "",
        slug: p.slug || "",
        originalSlug: p.originalSlug || "",

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

        category: p.category || "",
        categoryId: p.categoryId || "",

        images: Array.isArray(p.images)
            ? p.images.filter(Boolean)
            : p.image
                ? [p.image]
                : [],

        video: p.video || "",
        pdf: p.pdf || "",

        requestType: p.requestType || "APPROVAL",
        approvalStatus: p.approvalStatus || "PENDING",

        approvedAt: p.approvedAt ?? null,
        approvedBy: p.approvedBy || "",
        recheckReason: p.recheckReason || "",

        isPublished:
            typeof p.isPublished === "boolean"
                ? p.isPublished
                : false,

        importedAt: p.importedAt || "",
        createdAt: p.createdAt || new Date().toISOString(),
    });
    const [savedProducts, setSavedProducts] = useState([]);
    const loadPendingProducts = async () => {
        const snap = await getDoc(
            doc(db, "websites", WEBSITE, "pages", "productApproval")
        );

        if (snap.exists()) {
            const allProducts = (snap.data().products || []).map((p) => ({
                ...p,
                requestType: p.requestType || "APPROVAL",
            }));
            console.table(
                allProducts.map((p) => ({
                    title: p.title,
                    requestType: p.requestType,
                    approvalStatus: p.approvalStatus,
                }))
            );
            const pending = [...allProducts];

            setSavedProducts(pending);

            setSavedProducts(pending);
        } else {
            setSavedProducts([]);
        }
    };
    const approvalRef = doc(
        db,
        "websites",
        WEBSITE,
        "pages",
        "productApproval"
    );

    const productRef = doc(
        db,
        "websites",
        WEBSITE,
        "pages",
        "products"
    );


    const syncProductToProducts = async (product) => {
        const snap = await getDoc(productRef);

        const existing = snap.exists()
            ? snap.data().products || []
            : [];

        const index = existing.findIndex((x) => x.id === product.id);

        if (index !== -1) {
            existing[index] = {
                ...existing[index],
                ...product,
                isPublished: product.isPublished,
            };
        } else {

            existing.push({
                ...product,
                isPublished: product.isPublished,
            });

        }
        await setDoc(
            productRef,
            {
                products: existing,
            },
            { merge: true }
        );
    };
    const syncProductToCategory = async (product) => {
        if (!product.categoryId) return;

        const catDoc = doc(
            db,
            "websites",
            WEBSITE,
            "pages",
            "categoryproducts",
            "categories",
            product.categoryId
        );

        const snap = await getDoc(catDoc);

        if (!snap.exists()) return;

        const data = snap.data();

        let products = data.products || [];

        // Agar product APPROVED nahi hai ya Published nahi hai
        // to category se remove kar do
        if (
            product.approvalStatus !== "APPROVED" ||
            !product.isPublished
        ) {
            products = products.filter((p) => p.id !== product.id);
        } else {
            const index = products.findIndex((p) => p.id === product.id);

            if (index !== -1) {
                products[index] = {
                    ...products[index],
                    ...product,
                };
            } else {
                products.push(product);
            }
        }

        await setDoc(
            catDoc,
            {
                ...data,
                products,
            },
            { merge: true }
        );
    };
    const [editIndex, setEditIndex] = useState(null);
    const [imageModal, setImageModal] = useState(null);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const handleSelectProduct = (id) => {
        setSelectedProducts((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id]
        );
    };
    const totalPages = Math.ceil(savedProducts.length / itemsPerPage);

    // const paginatedProducts = useMemo(() => {
    //     return savedProducts.slice(
    //         (currentPage - 1) * itemsPerPage,
    //         currentPage * itemsPerPage
    //     );
    // }, [savedProducts, currentPage, itemsPerPage]);
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const activeTab =
        searchParams.get("tab") || "products";
    useEffect(() => {

        const unsubscribe = onSnapshot(
            approvalRef,
            (snap) => {

                if (!snap.exists()) {
                    setSavedProducts([]);
                    return;
                }

                const allProducts = (snap.data().products || []).map((p) => ({
                    ...p,
                    requestType: p.requestType || "APPROVAL",
                }));

                console.table(
                    allProducts.map((p) => ({
                        title: p.title,
                        requestType: p.requestType,
                        approvalStatus: p.approvalStatus,
                    }))
                );

                setSavedProducts(allProducts);

            }
        );

        return () => unsubscribe();

    }, []);

    useEffect(() => {
        setActiveId(null);
    }, [savedProducts, currentPage, itemsPerPage]);



    const approveSelected = async (ids = []) => {

        const selectedIds =
            ids.length > 0 ? ids : selectedProducts;

        if (!selectedIds.length) {
            return toast.error("Select products first");
        }

        await moveProducts(selectedIds, "APPROVE");
    };
    const approveAll = async () => {
        await moveProducts(
            savedProducts.map((p) => p.id),
            "APPROVE"
        );
    };

    const recheckSelected = async (ids) => {

        const selectedIds = ids ?? selectedProducts;

        if (!selectedIds.length) {
            return toast.error("Select products first");
        }

        await moveProducts(selectedIds, "RECHECK");
    };

    const recheckAll = async () => {
        await moveProducts(
            savedProducts.map((p) => p.id),
            "RECHECK"
        );
    };
    const moveProducts = async (ids, action) => {
        const idsArray = Array.isArray(ids) ? ids : [ids];
        const approvalSnap = await getDoc(approvalRef);

        const pendingProducts = approvalSnap.exists()
            ? approvalSnap.data().products || []
            : [];

        const updatedProducts = pendingProducts.map((product) => {

            if (!idsArray.includes(product.id)) return product;

            if (action === "APPROVE") {
                return {
                    ...product,
                    requestType: product.requestType,
                    approvalStatus: "APPROVED",
                    approvedAt: new Date().toISOString(),
                    approvedBy: "Admin",
                    isPublished: false,
                    recheckReason: "",
                };
            }

            return {
                ...product,
                approvalStatus: "RECHECK",
                isPublished: false,
                approvedBy: "",
                approvedAt: null,
            };
        });
        console.log(
            updatedProducts.find((p) => idsArray.includes(p.id))
        );
        const safeUpdatedProducts = updatedProducts.map((p) => cleanProduct(p));
        await setDoc(
            approvalRef,
            {
                products: safeUpdatedProducts,
            },
            { merge: true }
        );
        const affectedProducts = updatedProducts.filter((p) =>
            idsArray.includes(p.id)
        );

        for (const product of affectedProducts) {
            if (product.categoryId) {
                await syncProductToCategory(product);
            } else {
                await syncProductToProducts(product);
            }
        }
        setSelectedProducts([]);


        toast.success(
            action === "APPROVE"
                ? "Products Approved Successfully"
                : "Products Sent For Recheck"
        );
    };


    const filteredProducts = useMemo(() => {

        switch (requestFilter) {

            case "PENDING":
                return savedProducts.filter(
                    (p) =>
                        p.approvalStatus === "PENDING" &&
                        p.requestType !== "REAPPROVAL"
                );

            case "REAPPROVAL":
                return savedProducts.filter(
                    (p) =>
                        p.approvalStatus === "PENDING" &&
                        p.requestType === "REAPPROVAL"
                );

            case "RECHECK":
                return savedProducts.filter(
                    (p) => p.approvalStatus === "RECHECK"
                );

            case "APPROVED":
                return savedProducts.filter(
                    (p) => p.approvalStatus === "APPROVED"
                );

            case "PUBLISHED":
                return savedProducts.filter(
                    (p) =>
                        p.approvalStatus === "APPROVED" &&
                        p.isPublished
                );

            case "UNPUBLISHED":
                return savedProducts.filter(
                    (p) =>
                        p.approvalStatus === "APPROVED" &&
                        !p.isPublished
                );

            default:
                return savedProducts;
        }

    }, [savedProducts, requestFilter]);
    const pageAction = (() => {

        if (!filteredProducts.length) return null;

        const hasApprovalWork = filteredProducts.some(
            (p) =>
                p.approvalStatus === "PENDING" ||
                p.approvalStatus === "RECHECK"
        );

        if (hasApprovalWork) {
            return "APPROVE";
        }

        const hasUnpublished = filteredProducts.some(
            (p) =>
                p.approvalStatus === "APPROVED" &&
                !p.isPublished
        );

        if (hasUnpublished) {
            return "PUBLISH";
        }

        return "UNPUBLISH";

    })();
    const groupedProducts = useMemo(() => {
        console.log("FILTER =", requestFilter);
        console.log("FILTERED =", filteredProducts.length);
        const grouped = {};

        filteredProducts.forEach((product) => {
            const category = product.category || "Other Products";

            if (!grouped[category]) {
                grouped[category] = [];
            }

            grouped[category].push(product);
        });
        console.log(grouped);
        return grouped;
    }, [filteredProducts, requestFilter]);

    // TOGGLE PUBLISH
    const togglePublish = async (id) => {

        const approvalSnap = await getDoc(approvalRef);

        const approvalProducts = approvalSnap.data()?.products || [];

        const updated = approvalProducts.map((p) =>
            p.id === id
                ? {
                    ...p,
                    isPublished: !p.isPublished,
                }
                : p
        );

        await setDoc(
            approvalRef,
            {
                products: updated,
            },
            { merge: true }
        );

        const updatedProduct = updated.find((p) => p.id === id);
        if (updatedProduct) {

            if (updatedProduct.categoryId) {
                await syncProductToCategory(updatedProduct);
            } else {
                await syncProductToProducts(updatedProduct);
            }

        }


        toast.success(
            updatedProduct?.isPublished
                ? "Product Published"
                : "Product Unpublished"
        );
    };
    const publishSelected = async (ids) => {
        if (!ids.length) {
            return toast.error("Select approved products first");
        }

        const approvalSnap = await getDoc(approvalRef);

        const products = approvalSnap.data()?.products || [];

        // sirf approved aur unpublished products publish honge
        const publishIds = products
            .filter(
                (p) =>
                    idsArray.includes(p.id) &&
                    p.approvalStatus === "APPROVED" &&
                    !p.isPublished
            )
            .map((p) => p.id);

        if (!publishIds.length) {
            return toast.error("No approved products selected");
        }

        const updated = products.map((p) =>
            publishIds.includes(p.id)
                ? {
                    ...p,
                    isPublished: true,
                }
                : p
        );

        await setDoc(
            approvalRef,
            { products: updated },
            { merge: true }
        );

        const publishedProducts = updated.filter((p) =>
            publishIds.includes(p.id)
        );

        for (const product of publishedProducts) {
            if (product.categoryId) {
                await syncProductToCategory(product);
            } else {
                await syncProductToProducts(product);
            }
        }

        setSelectedProducts([]);

        toast.success(`${publishedProducts.length} Products Published`);
    };
    const publishAll = async () => {
        const ids = savedProducts
            .filter(
                (p) =>
                    p.approvalStatus === "APPROVED" &&
                    !p.isPublished
            )
            .map((p) => p.id);

        if (!ids.length) {
            return toast.error("No approved products found");
        }

        await publishSelected(ids);
    };
    const unpublishSelected = async (ids) => {
        const approvalSnap = await getDoc(approvalRef);

        const products =
            approvalSnap.data()?.products || [];

        const updated = products.map((p) =>
            idsArray.includes(p.id)
                ? {
                    ...p,
                    isPublished: false,
                }
                : p
        );

        await setDoc(
            approvalRef,
            { products: updated },
            { merge: true }
        );
        const unpublishedProducts = updated.filter((p) =>
            idsArray.includes(p.id)
        );

        for (const product of unpublishedProducts) {

            if (product.categoryId) {
                await syncProductToCategory(product);
            } else {
                await syncProductToProducts(product);
            }

        }

        setSelectedProducts([]);

        toast.success("Products Unpublished");
    };
    const unpublishAll = async () => {
        await unpublishSelected(
            savedProducts
                .filter(
                    (p) =>
                        p.approvalStatus === "APPROVED" &&
                        p.isPublished
                )
                .map((p) => p.id)
        );
    };
    const { pathname } = useLocation();
    const pathParts = pathname
        .split("/")
        .filter(Boolean);

    return (
        <>
            <Toaster
                position="top-right"
                reverseOrder={false}
                toastOptions={{
                    duration: 3000,
                }}
            />

            <div className="product-page-main">
                {/* <div className="product-page-tabs-wrapper">
                <button
                    className={
                        activeTab === "products"
                            ? "product-page-tab product-page-active"
                            : "product-page-tab"
                    }
                    onClick={() => navigate("?tab=products")}
                >
                    Products
                </button>

                <button
                    className={
                        activeTab === "categories"
                            ? "product-page-tab product-page-active"
                            : "product-page-tab"
                    }
                    onClick={() => navigate("?tab=categories")}
                >
                    Categories
                </button>
            </div> */}
                {activeTab === "products" && (
                    <>
                        <div className="product-page-top-header">

                            <div className="product-page-path">
                                {pathParts.map((part, index) => (
                                    <span key={index}>
                                        {part.charAt(0).toUpperCase() + part.slice(1)}
                                        {index !== pathParts.length - 1 && " > "}
                                    </span>
                                ))}
                            </div>

                            <h1 className="product-page-heading"> Product Approval</h1>

                        </div>


                        {/* TABLE */}
                        <div className="product-page-preview">
                            <div className="product-page-header-row">

                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>


                                    {/* 
                                    <button
                                        className="product-page-btn product-page-import-btn"
                                        onClick={() => document.getElementById("excelUpload").click()}
                                        disabled={importing}
                                    >
                                        <FileUp size={16} style={{ marginRight: "6px" }} />

                                        {importing
                                            ? `Importing ${importProgress}`
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
                                            {pageAction === "APPROVE" && (
                                                <>
                                                    <button
                                                        className="product-page-btn bulk-approve-selected"
                                                        onClick={() => approveSelected(selectedProducts)}
                                                    >
                                                        Approve Selected ({selectedProducts.length})
                                                    </button>

                                                    <button
                                                        className="product-page-btn bulk-approve-all"
                                                        onClick={approveAll}
                                                    >
                                                        Approve All
                                                    </button>
                                                </>
                                            )}

                                            {pageAction === "PUBLISH" && (
                                                <>
                                                    <button
                                                        className="product-page-btn bulk-publish-selected"
                                                        onClick={() => publishSelected(selectedProducts)}
                                                    >
                                                        Publish Selected ({selectedProducts.length})
                                                    </button>

                                                    <button
                                                        className="product-page-btn bulk-publish-all"
                                                        onClick={publishAll}
                                                    >
                                                        Publish All
                                                    </button>
                                                </>
                                            )}

                                            {pageAction === "UNPUBLISH" && (
                                                <>
                                                    <button
                                                        className="product-page-btn bulk-unpublish-selected"
                                                        onClick={() => unpublishSelected(selectedProducts)}
                                                    >
                                                        Unpublish Selected ({selectedProducts.length})
                                                    </button>

                                                    <button
                                                        className="product-page-btn bulk-unpublish-all"
                                                        onClick={unpublishAll}
                                                    >
                                                        Unpublish All
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                className="product-page-btn bulk-recheck-selected"
                                                onClick={() => recheckSelected(selectedProducts)}
                                            >
                                                Recheck Selected ({selectedProducts.length})
                                            </button>

                                            <button
                                                className="product-page-btn bulk-recheck-all"
                                                onClick={recheckAll}
                                            >
                                                Recheck All
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
                                    <div style={{ marginLeft: "auto" }}>
                                        <select
                                            value={requestFilter}
                                            onChange={(e) => setRequestFilter(e.target.value)}
                                            className="request-filter"
                                        >
                                            <option value="ALL">All Products</option>

                                            <option value="PENDING">Pending Approval</option>

                                            <option value="REAPPROVAL">Pending Re-Approval</option>

                                            <option value="RECHECK">Recheck</option>

                                            <option value="APPROVED">Approved</option>

                                            <option value="PUBLISHED">Published</option>

                                            <option value="UNPUBLISHED">Unpublished</option>
                                        </select>
                                    </div>
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
                                                        selectedProducts.length === savedProducts.length &&
                                                        savedProducts.length > 0
                                                    }
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedProducts(
                                                                savedProducts.map((p) => p.id)
                                                            );
                                                        } else {
                                                            setSelectedProducts([]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                        )}
                                        {/* <th>Product ID</th> */}
                                        <th>Create At</th>
                                        <th>Image</th>
                                        <th>Product</th>
                                        <th>Price ₹</th>
                                        <th>Description</th>

                                        <th>Status</th>
                                        {/* <th>Visibility</th> */}
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {Object.entries(groupedProducts).map(([category, products]) => (
                                        <React.Fragment key={category}>

                                            {/* Category Heading */}
                                            <tr className="approval-category-header">
                                                <td colSpan={bulkMode ? 8 : 7}>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            padding: "12px 16px",
                                                            background: "#f3f6fb",
                                                            borderRadius: "8px"
                                                        }}
                                                    >
                                                        <h3
                                                            style={{
                                                                margin: 0,
                                                                fontSize: "18px",
                                                                fontWeight: "700"
                                                            }}
                                                        >
                                                            📁 {category}
                                                        </h3>

                                                        <span
                                                            style={{
                                                                background: "#2563eb",
                                                                color: "#fff",
                                                                padding: "5px 12px",
                                                                borderRadius: "20px",
                                                                fontSize: "13px",
                                                                fontWeight: "600"
                                                            }}
                                                        >
                                                            {products.length} Products
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {products.map((item, i) => (

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
                                                        {/* <td>{item.productId || item.categoryProductId || "-"}</td> */}
                                                        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                                                        <td>
                                                            {item.images?.length > 0 ? (
                                                                <img
                                                                    src={item.images[0]}
                                                                    alt={item.title}
                                                                    className="product-page-thumb"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setImageModal(item.images[0]);
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
                                                            <span
                                                                className={`request-badge ${item.approvalStatus === "RECHECK"
                                                                    ? "status-recheck"
                                                                    : item.approvalStatus === "PENDING"
                                                                        ? (
                                                                            item.requestType === "REAPPROVAL"
                                                                                ? "status-reapproval"
                                                                                : "status-pending"
                                                                        )
                                                                        : item.isPublished
                                                                            ? "status-published"
                                                                            : "status-unpublished"
                                                                    }`}
                                                            >
                                                                {item.approvalStatus === "RECHECK"
                                                                    ? "Recheck"
                                                                    : item.approvalStatus === "PENDING"
                                                                        ? (
                                                                            item.requestType === "REAPPROVAL"
                                                                                ? "Re-Approval"
                                                                                : "Pending"
                                                                        )
                                                                        : item.isPublished
                                                                            ? "Published"
                                                                            : "Unpublished"}
                                                            </span>
                                                        </td>
                                                        {/* <td>
                        <span className={`product-page-status ${item.isPublished
                          ? "product-page-published"
                          : "product-page-unpublished"
                          }`}>
                          {item.isPublished ? "● Published" : "● Hidden"}
                        </span>
                      </td> */}

                                                        {/* <td>
                        <button
                          className={`product-page-btn product-page-toggle-btn ${item.isPublished
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
                      </td> */}

                                                        <td className="product-page-action-buttons">

                                                            {item.approvalStatus === "PENDING" ||
                                                                item.approvalStatus === "RECHECK" ? (

                                                                <button
                                                                    className="product-page-action-btn approve-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        approveSelected([item.id]);
                                                                    }}
                                                                >
                                                                    Approve
                                                                </button>

                                                            ) : (

                                                                <button
                                                                    className={`product-page-action-btn ${item.isPublished
                                                                        ? "unpublish-btn"
                                                                        : "publish-btn"
                                                                        }`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        togglePublish(item.id);
                                                                    }}
                                                                >
                                                                    {item.isPublished
                                                                        ? "Unpublish"
                                                                        : "Publish"}
                                                                </button>

                                                            )}

                                                            <button
                                                                className="product-page-action-btn recheck-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    recheckSelected([item.id]);
                                                                }}
                                                            >
                                                                Recheck
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
                                                                        <p><b>Parameters:</b> {item.parameters}</p>
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
                                                                                    rel="noreferrer"
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
                                                                                    rel="noreferrer"
                                                                                >
                                                                                    View PDF
                                                                                </a>
                                                                            ) : (
                                                                                "-"
                                                                            )}
                                                                        </p>

                                                                        {/* Images Row */}
                                                                        <div
                                                                            style={{
                                                                                gridColumn: "1 / -1",
                                                                                marginTop: "10px",
                                                                                background: "#fff",
                                                                                border: "1px solid #eee",
                                                                                borderRadius: "10px",
                                                                                padding: "12px"
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    fontWeight: "600",
                                                                                    marginBottom: "10px"
                                                                                }}
                                                                            >
                                                                                Images ({item.images?.length || 0})
                                                                            </div>

                                                                            <div
                                                                                style={{
                                                                                    display: "flex",
                                                                                    gap: "8px",
                                                                                    flexWrap: "wrap"
                                                                                }}
                                                                            >
                                                                                {item.images?.map((img, index) => (
                                                                                    <img
                                                                                        key={index}
                                                                                        src={img}
                                                                                        alt={`product-${index}`}
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

                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>

                                            ))}

                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* <div className="product-page-pagination-card">
                        <div className="product-page-pagination-wrapper">

                 
                            <div className="product-page-page-size">
                                <span>Per Page:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1); // reset page
                                    }}
                                >
                                    <option value={10}>10 items</option>
                                    <option value={25}>25 items</option>
                                    <option value={50}>50 items</option>
                                    <option value={100}>100 items</option>
                                </select>
                            </div>
                            <div className="product-page-pagination">

                 
                                <button
                                    className="product-page-nav-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                >
                                    ◀
                                </button>

                      
                                {currentPage > 1 && (
                                    <button
                                        className="product-page-page-btn"
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                    >
                                        {currentPage - 1}
                                    </button>
                                )}

                          
                                <button className="product-page-page-btn product-page-active">
                                    {currentPage}
                                </button>

                       
                                {currentPage < totalPages && (
                                    <button
                                        className="product-page-page-btn"
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                    >
                                        {currentPage + 1}
                                    </button>
                                )}

                        
                                <button
                                    className="product-page-nav-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                >
                                    ▶
                                </button>

                            </div>
                        </div>
                    </div> */}

                        {/* <Modal
            isOpen={imageGallery.length > 0}
            onRequestClose={() => {
              setImageGallery([]);
              setCurrentImageIndex(0);
            }}
            className="product-page-image-modal"
            overlayClassName="product-page-modal-overlay"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px"
              }}
            >
              <button
                disabled={currentImageIndex === 0}
                onClick={() =>
                  setCurrentImageIndex((prev) => prev - 1)
                }
              >
                ◀
              </button>

              <img
                src={imageGallery[currentImageIndex]}
                alt=""
                className="product-page-full-img"
              />

              <button
                disabled={
                  currentImageIndex === imageGallery.length - 1
                }
                onClick={() =>
                  setCurrentImageIndex((prev) => prev + 1)
                }
              >
                ▶
              </button>
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: "10px"
              }}
            >
              {currentImageIndex + 1} / {imageGallery.length}
            </p>
          </Modal> */}
                        <Modal
                            isOpen={!!imageModal}
                            onRequestClose={() => setImageModal(null)}
                            className="product-page-image-modal"
                            overlayClassName="product-page-modal-overlay"
                        >
                            <img src={imageModal} alt="preview" className="product-page-full-img" />
                        </Modal>
                    </>
                )}
                {activeTab === "categories" && (
                    <CategoryProduct />
                )}
            </div>
        </>
    );
}
