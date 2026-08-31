import ExcelJS from "exceljs";
import { db, storage } from "../../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";

// Safe UUID generator
const generateUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

// Slug helper
const slugify = (text = "") =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

// Key for duplicate checking (slug + model)
const getProductKey = (p) => {
  const s = p.slug || p.title?.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "");
  const model = p.model || "";
  return `${(s || "").toLowerCase().trim()}_${(model || "").toLowerCase().trim()}`;
};

// Cache for Firebase Storage images
const firebaseImageCache = {};

const getFirebaseImages = async (category, subCategory) => {
  const cacheKey = `${category.toLowerCase()}/${subCategory.toLowerCase()}`;
  if (firebaseImageCache[cacheKey]) {
    return firebaseImageCache[cacheKey];
  }

  try {
    const folderRef = ref(storage, `${category}/${subCategory}`);
    const files = await listAll(folderRef);
    const urls = [];
    for (const file of files.items) {
      const url = await getDownloadURL(file);
      urls.push({
        name: file.name.toLowerCase(),
        fullPath: file.fullPath.toLowerCase(),
        url,
      });
    }
    firebaseImageCache[cacheKey] = urls;
    return urls;
  } catch (err) {
    console.log("Firebase images folder not found:", category, subCategory);
    firebaseImageCache[cacheKey] = [];
    return [];
  }
};

/**
 * Shared Excel Import Service
 */
export const importExcelProducts = async ({
  files,
  websiteName,
  source,
  setImportStatus,
  setImportProgress,
}) => {
  let successCount = 0;
  let skippedCount = 0;

  try {
    // 1. Load normal products to check duplicates (both pending and approved)
    const approvalRef = doc(db, "websites", websiteName, "pages", "productApproval");
    const approvalSnap = await getDoc(approvalRef);
    let latestPending = approvalSnap.exists()
      ? approvalSnap.data().products || []
      : [];

    const productRef = doc(db, "websites", websiteName, "pages", "products");
    const productSnap = await getDoc(productRef);
    const existingProducts = productSnap.exists()
      ? productSnap.data().products || []
      : [];

    const normalKeysSet = new Set();
    latestPending.forEach((p) => normalKeysSet.add(getProductKey(p)));
    existingProducts.forEach((p) => normalKeysSet.add(getProductKey(p)));

    const newNormalProducts = [];
    const subCategoryCache = {}; // key: categoryId-subCategoryId -> { ref, name, products, keysSet, originalLength }

    // Helper to load/create subcategory and get existing products
    const getSubCategoryData = async (catId, catName, subCatId, subCatName) => {
      const cacheKey = `${catId}-${subCatId}`;
      if (subCategoryCache[cacheKey]) {
        return subCategoryCache[cacheKey];
      }

      // Check/Create Category
      const categoryRef = doc(
        db,
        "websites",
        websiteName,
        "pages",
        "categoryproducts",
        "categories",
        catId
      );
      const categorySnap = await getDoc(categoryRef);
      if (!categorySnap.exists()) {
        await setDoc(
          categoryRef,
          {
            id: catId,
            category: catName,
            website: websiteName,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      // Check/Create Subcategory
      const subCategoryRef = doc(
        db,
        "websites",
        websiteName,
        "pages",
        "categoryproducts",
        "categories",
        catId,
        "subcategories",
        subCatId
      );
      const subCategorySnap = await getDoc(subCategoryRef);
      let existingProds = [];
      if (!subCategorySnap.exists()) {
        await setDoc(
          subCategoryRef,
          {
            id: subCatId,
            subCategory: subCatName,
            categoryId: catId,
            category: catName,
            products: [],
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else {
        existingProds = subCategorySnap.data().products || [];
      }

      const keysSet = new Set();
      existingProds.forEach((p) => keysSet.add(getProductKey(p)));

      subCategoryCache[cacheKey] = {
        ref: subCategoryRef,
        name: subCatName,
        categoryId: catId,
        categoryName: catName,
        products: [...existingProds],
        keysSet,
        originalLength: existingProds.length,
      };

      return subCategoryCache[cacheKey];
    };

    // 2. Loop files
    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      const fileSubCategory = file.name.replace(/\.xlsx?$/i, "").trim();

      setImportStatus((prev) => ({
        ...prev,
        currentFileIndex: fileIdx,
        currentFileName: file.name,
        currentFileProgress: 0,
      }));

      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) continue;

      const rowsCount = Math.max(worksheet.rowCount - 1, 1);
      const headers = {};

      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[cell.value?.toString().trim().toLowerCase()] = colNumber;
      });

      // Extract embedded images from sheet
      const embeddedImageMap = {};
      worksheet.getImages().forEach((img) => {
        const media = workbook.model.media.find((m) => m.index === img.imageId);
        embeddedImageMap[img.imageId] = media;
      });

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);

        const getValue = (key) => {
          const col = headers[key];
          if (!col) return "";
          const value = row.getCell(col).value;
          if (value == null) return "";
          if (typeof value === "object") {
            return value.text || value.richText?.map((t) => t.text).join("") || "";
          }
          return String(value);
        };

        const title = getValue("title").trim();
        if (!title) {
          continue;
        }

        const slug = slugify(title);
        const categoryName = getValue("category").trim();
        let subCategoryName = getValue("sub category").trim() || getValue("subcategory").trim();

        // Rule 16 fallback subcategory
        if (categoryName && !subCategoryName) {
          subCategoryName = "General";
        }

        const tempProductForDup = { slug, model: getValue("model") };
        const productKey = getProductKey(tempProductForDup);

        // Deduplication Check
        if (categoryName) {
          const categoryId = slugify(categoryName);
          const subCategoryId = slugify(subCategoryName);
          const subCatData = await getSubCategoryData(categoryId, categoryName, subCategoryId, subCategoryName);

          if (subCatData.keysSet.has(productKey)) {
            skippedCount++;
            setImportStatus((prev) => ({ ...prev, skippedCount }));
            continue;
          }
        } else {
          if (normalKeysSet.has(productKey)) {
            skippedCount++;
            setImportStatus((prev) => ({ ...prev, skippedCount }));
            continue;
          }
        }

        // Image Resolution Flow
        let images = [];
        let imageUrl = "";

        // 1. Try embedded image in current row
        const currentImage = worksheet.getImages().find(
          (img) => img.range.tl.nativeRow + 1 === rowNumber
        );

        if (currentImage) {
          const image = embeddedImageMap[currentImage.imageId];
          if (image?.buffer) {
            const blob = new Blob([image.buffer]);
            const uploadPath = categoryName
              ? `websites/${websiteName}/category-products/${slugify(categoryName)}/${slugify(subCategoryName)}/${Date.now()}-${rowNumber}.png`
              : `websites/${websiteName}/products/${Date.now()}-${rowNumber}.png`;

            const imageRef = ref(storage, uploadPath);
            await uploadBytes(imageRef, blob);
            imageUrl = await getDownloadURL(imageRef);
            images = [imageUrl];
          }
        }

        // 2. Try URL text / Firebase matching if no embedded image found
        if (!imageUrl) {
          const imageUrls = [
            ...new Set(
              getValue("images")
                .split(/\r?\n|,/)
                .map((url) => url.trim())
                .filter((url) => /^https?:\/\//i.test(url))
            ),
          ];

          if (imageUrls.length > 0) {
            images = imageUrls;
          } else if (categoryName && subCategoryName) {
            // Firebase image matching
            const firebaseImages = await getFirebaseImages(categoryName, subCategoryName);
            const imageFileNames = imageUrls.map((url) =>
              url.split("/").pop().split("?")[0].toLowerCase()
            );

            const exactMatches = firebaseImages.filter((img) =>
              imageFileNames.includes(img.name.toLowerCase())
            );

            if (exactMatches.length > 0) {
              images = exactMatches.map((img) => img.url);
            } else {
              const normalize = (str = "") =>
                String(str)
                  .toLowerCase()
                  .replace(/^https?:\/\/.*\//, "")
                  .replace(/\?.*$/, "")
                  .replace(/\.(jpg|jpeg|png|webp)$/i, "")
                  .replace(/500x500|250x250|1000x1000/gi, "")
                  .replace(/[-_]/g, " ")
                  .replace(/\d+x\d+/g, "")
                  .replace(/[^a-z0-9]/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();

              const words = normalize(title).split(" ").filter((word) => word.length > 1);
              const titleText = normalize(title);

              const scored = firebaseImages
                .map((img) => {
                  const imageName = normalize(`${img.name} ${img.fullPath}`);
                  let score = 0;
                  for (const word of words) {
                    if (imageName.includes(word)) score += 2;
                  }
                  if (titleText && imageName.includes(titleText)) score += 20;
                  if (titleText && titleText.includes(imageName)) score += 10;
                  return { ...img, score };
                })
                .sort((a, b) => b.score - a.score);

              if (scored.length && scored[0].score > 0) {
                images = [scored[0].url];
              }
            }
          }
        }

        // Build product object
        const commonProduct = {
          id: generateUUID(),
          title,
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
          slug,
          images,
          image: images[0] || "",
          video: getValue("video").trim(),
          pdf: getValue("pdf").trim(),
          createdAt: new Date().toISOString(),
        };

        if (categoryName) {
          // Dynamic category/subcategory routing
          const categoryId = slugify(categoryName);
          const subCategoryId = slugify(subCategoryName);
          const subCatData = await getSubCategoryData(categoryId, categoryName, subCategoryId, subCategoryName);

          const prefix = catNameInitials(categoryName);
          const addedIndex = subCatData.products.length - subCatData.originalLength + 1;
          const nextIndex = subCatData.originalLength + addedIndex;
          const categoryProductId = `${prefix}-${nextIndex}`;

          const categoryProduct = {
            ...commonProduct,
            categoryProductId,
            categoryId,
            category: categoryName,
            subCategoryId,
            subCategory: subCategoryName,
            isPublished: true,
          };

          subCatData.products.unshift(categoryProduct);
          subCatData.keysSet.add(productKey);
          successCount++;
        } else {
          // Normal product approval flow
          const normalProduct = {
            ...commonProduct,
            productId: null,
            category: "",
            categoryId: "",
            approvalStatus: "PENDING",
            requestType: "APPROVAL",
            isPublished: false,
            approvedAt: null,
            approvedBy: "",
            recheckReason: "",
            importedAt: new Date().toISOString(),
          };

          newNormalProducts.push(normalProduct);
          normalKeysSet.add(productKey);
          successCount++;
        }

        const rowProgress = Math.round(((rowNumber - 1) / rowsCount) * 100);
        setImportProgress(rowProgress);
        setImportStatus((prev) => ({
          ...prev,
          currentFileProgress: rowProgress,
          successCount,
          skippedCount,
        }));
      }
    }

    // 3. Batch write all Category/Subcategory products to Firestore
    const subCategoryItems = Object.values(subCategoryCache);
    for (const item of subCategoryItems) {
      await setDoc(
        item.ref,
        {
          id: item.ref.id,
          subCategory: item.name,
          categoryId: item.categoryId,
          category: item.categoryName,
          products: item.products,
        },
        { merge: true }
      );
    }

    // 4. Batch write all normal products to productApproval
    if (newNormalProducts.length > 0) {
      await setDoc(
        approvalRef,
        {
          products: [...latestPending, ...newNormalProducts],
        },
        { merge: true }
      );
    }

    return {
      totalFiles: files.length,
      importedNormalProducts: newNormalProducts.length,
      importedCategoryProducts: successCount - newNormalProducts.length,
      skippedDuplicates: skippedCount,
    };
  } catch (err) {
    console.error("Shared import service failed:", err);
    throw err;
  }
};

// Prefix initials helper
const catNameInitials = (categoryName) => {
  const cleanName = (categoryName || "CAT").trim();
  const prefix = cleanName
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase())
    .join("")
    .replace(/[^A-Z]/g, "");

  return prefix || "CAT";
};
