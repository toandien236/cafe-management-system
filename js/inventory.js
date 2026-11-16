const tableBody = document.getElementById("inventory-table-body");
const totalItems = document.getElementById("total-items");
const lowItems = document.getElementById("low-items");
const outItems = document.getElementById("out-items");
const modal = document.getElementById("inventory-modal");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("inventory-form");
const itemId = document.getElementById("item-id");
const itemCode = document.getElementById("item-code");
const itemName = document.getElementById("item-name");
const itemCategory = document.getElementById("item-category");
const itemQuantity = document.getElementById("item-quantity");
const itemUnit = document.getElementById("item-unit");
const itemMin = document.getElementById("item-min");
const itemPrice = document.getElementById("item-price");
const itemSupplier = document.getElementById("item-supplier");
const addItemBtn = document.getElementById("add-item-btn");
const cancelBtn = document.getElementById("cancel-btn");
const inventoryMessage = document.getElementById("inventory-message");
const importForm = document.getElementById("stock-import-form");
const exportForm = document.getElementById("stock-export-form");
const itemSearch = document.getElementById("item-search");
const ADMIN_EMAIL = "lehwangduong@gmail.com";
const INVENTORY_FIREBASE_PROJECT_ID = "project-quan-cafe";
const INVENTORY_COLUMNS = 9;

let inventoryItems = [];
let currentUser = null;
let searchTerm = "";
let inventoryUnsubscribe = null;
let importsUnsubscribe = null;
let exportsUnsubscribe = null;

function getFirestore() {
    return window.firebaseDb || window.db || null;
}

function getAuth() {
    return window.firebaseAuth || window.auth || null;
}

function showMessage(message, isError = false) {
    if (!inventoryMessage) return;
    inventoryMessage.textContent = message;
    inventoryMessage.dataset.error = String(isError);
}

function inventoryErrorMessage(error, fallback) {
    if (error && error.code === "permission-denied") {
        const activeProjectId = window.firebaseProjectId || "không xác định";
        if (activeProjectId !== INVENTORY_FIREBASE_PROJECT_ID) {
            return `Kho đang kết nối Firebase project "${activeProjectId}", cần dùng "${INVENTORY_FIREBASE_PROJECT_ID}". Kiểm tra cấu hình mocha_firebase_config trong trình duyệt.`;
        }
        return `Firestore từ chối quyền ghi trên project "${activeProjectId}". Hãy triển khai firestore.rules lên đúng project này.`;
    }
    return error && error.message ? error.message : fallback;
}

function showAuthMessage(message, isError = false) {
    const messageElement = document.getElementById("inventory-auth-message");
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.dataset.error = String(isError);
    }
}

function closeFirestoreListeners() {
    [inventoryUnsubscribe, importsUnsubscribe, exportsUnsubscribe].forEach(function (unsubscribe) {
        if (typeof unsubscribe === "function") unsubscribe();
    });
    inventoryUnsubscribe = null;
    importsUnsubscribe = null;
    exportsUnsubscribe = null;
}

function serverTimestamp() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
}

function getActor() {
    const actorName = currentUser && (currentUser.displayName || currentUser.email || currentUser.uid);
    if (!currentUser || !currentUser.uid || !actorName) {
        throw new Error("Không xác định được tài khoản quản trị đang đăng nhập.");
    }
    return { created_by: currentUser.uid, actor_name: actorName };
}

function parseDecimal(value) {
    if (value == null) return NaN;
    return parseFloat(String(value).trim().replace(",", "."));
}

function getQuantity(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) ? quantity : 0;
}

function formatQuantity(value) {
    return getQuantity(value).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = toDate(value);
    return date ? date.toLocaleString("vi-VN") : "—";
}

function formatDateOnly(value) {
    if (!value) return "—";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return formatDate(value);
}

function todayDateInput() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function setAuthenticatedView(user) {
    const app = document.getElementById("inventory-app");
    const authGate = document.getElementById("inventory-auth-required");
    const isAdmin = Boolean(user && String(user.email || "").toLowerCase() === ADMIN_EMAIL);
    if (app) app.hidden = !isAdmin;
    if (authGate) authGate.hidden = isAdmin;
    const email = document.getElementById("inventory-admin-email");
    if (email) email.textContent = user && user.email ? user.email : "";
}

function showTableMessage(message) {
    if (!tableBody) return;
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = INVENTORY_COLUMNS;
    cell.style.textAlign = "center";
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.replaceChildren(row);
}

function renderIngredientOptions() {
    ["import-item", "export-item"].forEach(function (id) {
        const select = document.getElementById(id);
        if (!select) return;
        const selectedId = select.value;
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Chọn nguyên liệu";
        select.appendChild(placeholder);

        inventoryItems
            .slice()
            .sort(function (left, right) {
                return String(left.name || "").localeCompare(String(right.name || ""), "vi");
            })
            .forEach(function (item) {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = `${item.code || item.id} · ${item.name} (${item.unit || ""} - còn ${formatQuantity(item.quantity)})`;
                select.appendChild(option);
            });

        if (selectedId && inventoryItems.some(function (entry) { return entry.id === selectedId; })) {
            select.value = selectedId;
        }
    });
}

function updateStats() {
    const lowStock = inventoryItems.filter(function (item) {
        const quantity = getQuantity(item.quantity);
        return quantity > 0 && quantity <= getQuantity(item.min_stock);
    });
    const outOfStock = inventoryItems.filter(function (item) {
        return getQuantity(item.quantity) <= 0;
    });

    if (totalItems) totalItems.textContent = String(inventoryItems.length);
    if (lowItems) lowItems.textContent = String(lowStock.length);
    if (outItems) outItems.textContent = String(outOfStock.length);

    const totalValueEl = document.getElementById("total-value");
    if (totalValueEl) {
        const sumValue = inventoryItems.reduce(function (sum, item) {
            return sum + getQuantity(item.quantity) * (Number(item.price) || 0);
        }, 0);
        totalValueEl.textContent = formatCurrency(sumValue);
    }

    const alert = document.getElementById("low-stock-alert");
    if (alert) {
        const alerts = outOfStock.map(function (item) {
            return `${item.name} (hết hàng)`;
        }).concat(lowStock.map(function (item) {
            return `${item.name} (${formatQuantity(item.quantity)} ${item.unit || ""})`;
        }));
        alert.hidden = alerts.length === 0;
        alert.textContent = alerts.length
            ? `Cảnh báo tồn kho: ${alerts.join(", ")}.`
            : "";
    }
}

function createTextCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    return cell;
}

function createInventoryIdentityCell(item) {
    const cell = document.createElement("td");
    cell.className = "inventory-item-identity-cell";
    const identity = document.createElement("div");
    identity.className = "inventory-item-identity";
    const name = document.createElement("strong");
    name.textContent = item.name || "—";
    const code = document.createElement("span");
    code.textContent = item.code || "—";
    identity.append(name, code);
    cell.appendChild(identity);
    return cell;
}

function createInventoryDateCell(item) {
    const cell = document.createElement("td");
    cell.className = "inventory-date-cell";
    const received = document.createElement("span");
    received.textContent = `Nhập: ${formatDateOnly(item.received_at)}`;
    const updated = document.createElement("span");
    updated.textContent = `Cập nhật: ${formatDate(item.updated_at)}`;
    cell.append(received, updated);
    return cell;
}

function createMobileDetail(label, value) {
    const detail = document.createElement("div");
    detail.className = "inventory-mobile-detail";
    const detailLabel = document.createElement("span");
    detailLabel.textContent = label;
    const detailValue = document.createElement("span");
    detailValue.textContent = value == null || value === "" ? "—" : String(value);
    detail.append(detailLabel, detailValue);
    return detail;
}

function createMobileInventoryCell(item, quantity, minQuantity, statusText, statusClass, onEdit, onDelete) {
    const cell = document.createElement("td");
    cell.className = "inventory-mobile-card";
    cell.colSpan = INVENTORY_COLUMNS;

    const card = document.createElement("div");
    card.className = "inventory-mobile-card-content";

    const heading = document.createElement("div");
    heading.className = "inventory-mobile-card-heading";
    const identity = document.createElement("div");
    identity.className = "inventory-mobile-card-identity";
    const name = document.createElement("strong");
    name.textContent = item.name || "Nguyên liệu";
    const code = document.createElement("span");
    code.textContent = item.code || "Chưa có mã";
    const status = document.createElement("span");
    status.className = `inventory-mobile-status ${statusClass}`;
    status.textContent = statusText;
    identity.append(name, code);

    const controls = document.createElement("div");
    controls.className = "inventory-mobile-card-controls";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn-secondary";
    editButton.textContent = "Sửa";
    editButton.onclick = onEdit;
    controls.append(status, editButton);
    heading.append(identity, controls);

    const stock = document.createElement("div");
    stock.className = "inventory-mobile-stock";
    stock.append(
        createMobileDetail("Tồn kho", `${formatQuantity(quantity)} ${item.unit || ""}`.trim()),
        createMobileDetail("Tối thiểu", `${formatQuantity(minQuantity)} ${item.unit || ""}`.trim())
    );

    const details = document.createElement("details");
    details.className = "inventory-mobile-details";
    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = "Thông tin chi tiết";
    const detailsGrid = document.createElement("div");
    detailsGrid.className = "inventory-mobile-details-grid";
    [
        ["Danh mục", item.category || "Khác"],
        ["Giá nhập", formatCurrency(item.price)],
        ["Ngày nhập gần nhất", formatDateOnly(item.received_at)],
        ["Cập nhật lần cuối", formatDate(item.updated_at)],
        ["Nhà cung cấp", item.supplier || "—"]
    ].forEach(function (entry) {
        detailsGrid.appendChild(createMobileDetail(entry[0], entry[1]));
    });
    details.append(detailsSummary, detailsGrid);

    const actions = document.createElement("div");
    actions.className = "inventory-mobile-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-logout";
    deleteButton.textContent = "Xóa";
    deleteButton.onclick = onDelete;
    actions.appendChild(deleteButton);

    card.append(heading, stock, details, actions);
    cell.appendChild(card);
    return cell;
}

function renderInventory() {
    if (!tableBody) return;
    tableBody.replaceChildren();

    if (inventoryItems.length === 0) {
        showTableMessage("Chưa có nguyên liệu trong Firestore. Nếu kho cũ đang ở Supabase, hãy chạy bước di trú; dữ liệu nguồn vẫn được giữ nguyên.");
        updateStats();
        renderIngredientOptions();
        return;
    }

    const visibleItems = inventoryItems.filter(function (item) {
        const searchable = `${item.code || ""} ${item.name || ""} ${item.supplier || ""}`.toLocaleLowerCase("vi");
        return searchable.includes(searchTerm);
    });

    if (visibleItems.length === 0) {
        showTableMessage("Không tìm thấy nguyên liệu phù hợp.");
        updateStats();
        renderIngredientOptions();
        return;
    }

    visibleItems.forEach(function (item) {
        const row = document.createElement("tr");
        const quantity = getQuantity(item.quantity);
        const minQuantity = getQuantity(item.min_stock);
        const statusCell = document.createElement("td");
        statusCell.style.fontWeight = "bold";
        let statusText;
        let statusClass;

        if (quantity <= 0) {
            statusText = "Hết hàng";
            statusClass = "is-out";
            statusCell.style.color = "#c62828";
        } else if (quantity <= minQuantity) {
            statusText = "Sắp hết";
            statusClass = "is-low";
            statusCell.style.color = "#ef6c00";
        } else {
            statusText = "Đủ hàng";
            statusClass = "is-good";
            statusCell.style.color = "#2e7d32";
        }
        statusCell.textContent = statusText;

        const actionCell = document.createElement("td");
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn-secondary";
        editBtn.style.marginRight = "6px";
        editBtn.style.padding = "4px 8px";
        editBtn.textContent = "Sửa";
        const editItem = function () { openEditModal(item); };
        editBtn.onclick = editItem;

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn-logout";
        deleteBtn.style.padding = "4px 8px";
        deleteBtn.textContent = "Xóa";
        const removeItem = function () { deleteItem(item.id); };
        deleteBtn.onclick = removeItem;
        actionCell.append(editBtn, deleteBtn);

        row.append(
            createInventoryIdentityCell(item),
            createTextCell(item.category || "Khác"),
            createTextCell(`${formatQuantity(quantity)} ${item.unit || ""}`.trim()),
            createTextCell(formatCurrency(item.price)),
            createTextCell(`${formatQuantity(minQuantity)} ${item.unit || ""}`.trim()),
            statusCell,
            createInventoryDateCell(item),
            createTextCell(item.supplier || "—"),
            actionCell,
            createMobileInventoryCell(item, quantity, minQuantity, statusText, statusClass, editItem, removeItem)
        );
        tableBody.appendChild(row);
    });

    updateStats();
    renderIngredientOptions();
}

function openEditModal(item) {
    modalTitle.textContent = "Chỉnh sửa nguyên liệu";
    itemId.value = item.id;
    if (itemCode) itemCode.value = item.code || "";
    itemName.value = item.name || "";
    itemCategory.value = item.category || "Cà phê";
    itemQuantity.value = getQuantity(item.quantity);
    itemQuantity.disabled = true;
    itemUnit.value = item.unit || "";
    itemMin.value = getQuantity(item.min_stock);
    itemPrice.value = Number(item.price) || 0;
    if (itemSupplier) itemSupplier.value = item.supplier || "";
    modal.style.display = "flex";
}

function openAddModal() {
    modalTitle.textContent = "Thêm nguyên liệu mới";
    form.reset();
    itemId.value = "";
    if (itemCode) itemCode.value = "";
    itemQuantity.disabled = false;
    if (itemSupplier) itemSupplier.value = "";
    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
}

async function handleSaveItem(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();

    const name = itemName.value.trim();
    const category = itemCategory.value || "Khác";
    const unit = itemUnit.value.trim();
    const quantity = parseDecimal(itemQuantity.value);
    const minStock = parseDecimal(itemMin.value);
    const price = parseDecimal(itemPrice.value);
    const supplier = itemSupplier ? itemSupplier.value.trim() : "";
    const editingId = itemId.value;

    if (!name || !unit) {
        showMessage("Vui lòng nhập tên nguyên liệu và đơn vị tính.", true);
        return;
    }
    if (!editingId && (!Number.isFinite(quantity) || quantity < 0)) {
        showMessage("Tồn đầu kỳ phải là số không âm (>= 0).", true);
        return;
    }
    if (!Number.isFinite(minStock) || minStock < 0) {
        showMessage("Mức tồn tối thiểu phải là số không âm (>= 0).", true);
        return;
    }
    if (!Number.isInteger(price) || price < 0) {
        showMessage("Giá nhập phải là số nguyên VND không âm.", true);
        return;
    }

    const db = getFirestore();
    if (!db) {
        showMessage("Firebase Firestore chưa được khởi tạo.", true);
        return;
    }
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        const now = serverTimestamp();
        if (editingId) {
            await db.collection("inventory").doc(editingId).update({
                name: name,
                category: category,
                unit: unit,
                min_stock: minStock,
                price: price,
                supplier: supplier,
                updated_at: now
            });
        } else {
            const reference = db.collection("inventory").doc();
            await reference.set({
                code: `NL-${reference.id.toUpperCase()}`,
                name: name,
                category: category,
                quantity: quantity,
                unit: unit,
                min_stock: minStock,
                price: price,
                supplier: supplier,
                received_at: todayDateInput(),
                created_at: now,
                updated_at: now
            });
        }

        closeModal();
        form.reset();
        itemId.value = "";
        if (itemCode) itemCode.value = "";
        itemQuantity.disabled = false;
        showMessage(editingId
            ? `Đã cập nhật nguyên liệu "${name}".`
            : `Đã thêm nguyên liệu "${name}" vào Firestore.`);
    } catch (error) {
        console.error("Lỗi lưu nguyên liệu Firestore:", error);
        showMessage(inventoryErrorMessage(error, "Không thể lưu nguyên liệu lên Firestore."), true);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

async function deleteItem(id) {
    const item = inventoryItems.find(function (entry) { return entry.id === id; });
    if (!item || !confirm(`Bạn có chắc muốn xóa “${item.name}”?`)) return;

    try {
        await getFirestore().collection("inventory").doc(id).delete();
        showMessage(`Đã xóa nguyên liệu "${item.name}" khỏi Firestore.`);
    } catch (error) {
        console.error("Lỗi xóa nguyên liệu Firestore:", error);
        showMessage(inventoryErrorMessage(error, "Không thể xóa nguyên liệu khỏi Firestore."), true);
    }
}

async function seedStarterCatalog(isManual = false) {
    const catalog = Array.isArray(window.INVENTORY_STARTER_CATALOG)
        ? window.INVENTORY_STARTER_CATALOG
        : [];
    if (!catalog.length) return;

    const db = getFirestore();
    if (!db) {
        showMessage("Firebase Firestore chưa được khởi tạo.", true);
        return;
    }

    const seedButton = document.getElementById("seed-catalog-btn");
    if (seedButton) seedButton.disabled = true;
    const existingNames = new Set(inventoryItems.map(function (item) {
        return String(item.name || "").trim().toLocaleLowerCase("vi");
    }));
    const missingItems = catalog.filter(function (item) {
        return !existingNames.has(String(item.name || "").trim().toLocaleLowerCase("vi"));
    });

    if (!missingItems.length) {
        if (isManual) showMessage("Danh mục mẫu đã có trong kho; không ghi đè số lượng hiện tại.");
        if (seedButton) seedButton.disabled = false;
        return;
    }

    try {
        const batch = db.batch();
        missingItems.forEach(function (item) {
            const reference = db.collection("inventory").doc();
            const now = serverTimestamp();
            batch.set(reference, {
                code: `NL-${reference.id.toUpperCase()}`,
                name: item.name,
                category: item.category || "Khác",
                quantity: Number(item.quantity) || 0,
                unit: item.unit || "",
                min_stock: Number(item.min_stock) || 0,
                price: Number(item.price) || 0,
                supplier: item.supplier || "",
                received_at: todayDateInput(),
                created_at: now,
                updated_at: now
            });
        });
        await batch.commit();
        if (isManual) {
            showMessage(`Đã thêm ${missingItems.length} nguyên liệu mẫu còn thiếu; dữ liệu đang có không bị ghi đè.`);
        }
    } catch (error) {
        console.error("Lỗi nạp danh mục mẫu vào Firestore:", error);
        showMessage(inventoryErrorMessage(error, "Không thể nạp danh mục mẫu vào Firestore."), true);
    } finally {
        if (seedButton) seedButton.disabled = false;
    }
}

function listenToInventory(db) {
    inventoryUnsubscribe = db.collection("inventory").orderBy("name", "asc").onSnapshot(function (snapshot) {
        inventoryItems = snapshot.docs.map(function (document) {
            return { id: document.id, ...document.data() };
        });
        renderInventory();
    }, function (error) {
        console.error("Lỗi tải nguyên liệu Firestore:", error);
        showMessage("Không đọc được kho từ Firestore. Kiểm tra đăng nhập admin và Firestore Rules.", true);
        showTableMessage("Không thể tải dữ liệu kho.");
    });

    importsUnsubscribe = db.collection("stock_imports")
        .orderBy("created_at", "desc")
        .limit(20)
        .onSnapshot(function (snapshot) {
            renderHistory(snapshot, document.getElementById("stock-imports-body"), createImportHistoryRow, 10);
        }, function (error) {
            console.error("Lỗi tải lịch sử nhập kho:", error);
            showHistoryError(document.getElementById("stock-imports-body"), 10);
        });

    exportsUnsubscribe = db.collection("stock_exports")
        .orderBy("created_at", "desc")
        .limit(20)
        .onSnapshot(function (snapshot) {
            renderHistory(snapshot, document.getElementById("stock-exports-body"), createExportHistoryRow, 6);
        }, function (error) {
            console.error("Lỗi tải lịch sử xuất kho:", error);
            showHistoryError(document.getElementById("stock-exports-body"), 6);
        });
}

function renderHistory(snapshot, tbody, createRow, columnCount) {
    if (!tbody) return;
    tbody.replaceChildren();
    if (snapshot.empty) {
        showHistoryEmpty(tbody, columnCount);
        return;
    }
    snapshot.docs.forEach(function (document) {
        tbody.appendChild(createRow(document.data()));
    });
}

function showHistoryEmpty(tbody, columnCount) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.style.textAlign = "center";
    cell.textContent = "Chưa có giao dịch.";
    row.appendChild(cell);
    tbody.replaceChildren(row);
}

function showHistoryError(tbody, columnCount) {
    if (!tbody) return;
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.style.textAlign = "center";
    cell.textContent = "Không thể tải lịch sử từ Firestore.";
    row.appendChild(cell);
    tbody.replaceChildren(row);
}

function createImportHistoryRow(data) {
    const row = document.createElement("tr");
    row.append(
        createTextCell(formatDate(data.created_at)),
        createTextCell(data.item_name),
        createTextCell("+" + formatQuantity(data.quantity) + " " + (data.unit || "")),
        createTextCell(data.supplier || "—"),
        createTextCell(data.batch_number || "—"),
        createTextCell(formatDateOnly(data.expiry_date)),
        createTextCell(formatCurrency(data.cost_price)),
        createTextCell(formatCurrency(data.total_cost)),
        createTextCell(data.actor_name || "—"),
        createTextCell(data.note || "—")
    );
    return row;
}

function createExportHistoryRow(data) {
    const row = document.createElement("tr");
    row.append(
        createTextCell(formatDate(data.created_at)),
        createTextCell(data.item_name),
        createTextCell("-" + formatQuantity(data.quantity) + " " + (data.unit || "")),
        createTextCell(data.reason || "—"),
        createTextCell(data.actor_name || "—"),
        createTextCell(data.note || "—")
    );
    return row;
}

function getDateInputValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

async function recordStockImport(event) {
    event.preventDefault();
    const submitButton = importForm.querySelector('[type="submit"]');
    const selectedId = document.getElementById("import-item").value;
    const quantityInput = document.getElementById("import-quantity").value;
    const unitPriceInput = document.getElementById("import-unit-price").value;
    const supplier = document.getElementById("import-supplier").value.trim();
    const receivedAt = document.getElementById("import-date").value;
    const batchNumber = document.getElementById("import-batch").value.trim();
    const expiryDate = document.getElementById("import-expiry").value || null;
    const note = document.getElementById("import-note").value.trim();
    const quantity = Number(quantityInput);
    const unitPrice = Number(unitPriceInput);
    const item = inventoryItems.find(function (entry) { return entry.id === selectedId; });

    if (!item || !Number.isFinite(quantity) || quantity <= 0 || !getDateInputValue(receivedAt)) {
        showMessage("Vui lòng chọn nguyên liệu, ngày nhập và số lượng hợp lệ.", true);
        return;
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 0 || !supplier) {
        showMessage("Nhập nhà cung cấp và giá nhập là số nguyên VND không âm.", true);
        return;
    }

    if (submitButton) submitButton.disabled = true;
    try {
        const db = getFirestore();
        const actor = getActor();
        const itemReference = db.collection("inventory").doc(selectedId);
        const historyReference = db.collection("stock_imports").doc();
        const totalCost = quantity * unitPrice;

        await db.runTransaction(async function (transaction) {
            const snapshot = await transaction.get(itemReference);
            if (!snapshot.exists) throw new Error("Nguyên liệu không còn tồn tại trong kho.");
            const currentItem = snapshot.data();
            transaction.update(itemReference, {
                quantity: getQuantity(currentItem.quantity) + quantity,
                price: unitPrice,
                supplier: supplier,
                received_at: receivedAt,
                updated_at: serverTimestamp()
            });
            transaction.set(historyReference, {
                item_id: selectedId,
                item_code: currentItem.code || item.code || "",
                item_name: currentItem.name || item.name,
                quantity: quantity,
                unit: currentItem.unit || item.unit || "",
                cost_price: unitPrice,
                total_cost: totalCost,
                supplier: supplier,
                batch_number: batchNumber || null,
                expiry_date: expiryDate,
                received_at: receivedAt,
                ...actor,
                note: note,
                created_at: serverTimestamp()
            });
        });

        importForm.reset();
        document.getElementById("import-date").value = todayDateInput();
        showMessage("Đã ghi phiếu nhập và cập nhật tồn kho Firestore.");
    } catch (error) {
        console.error("Lỗi nhập kho Firestore:", error);
        showMessage(inventoryErrorMessage(error, "Không thể thực hiện nhập kho."), true);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

async function recordStockExport(event) {
    event.preventDefault();
    const submitButton = exportForm.querySelector('[type="submit"]');
    const selectedId = document.getElementById("export-item").value;
    const quantityInput = document.getElementById("export-quantity").value;
    const reason = document.getElementById("export-reason").value;
    const note = document.getElementById("export-note").value.trim();
    const quantity = Number(quantityInput);
    const item = inventoryItems.find(function (entry) { return entry.id === selectedId; });

    if (!item || !Number.isFinite(quantity) || quantity <= 0) {
        showMessage("Vui lòng chọn nguyên liệu và nhập số lượng xuất hợp lệ.", true);
        return;
    }
    if (submitButton) submitButton.disabled = true;

    try {
        const db = getFirestore();
        const actor = getActor();
        const itemReference = db.collection("inventory").doc(selectedId);
        const historyReference = db.collection("stock_exports").doc();

        await db.runTransaction(async function (transaction) {
            const snapshot = await transaction.get(itemReference);
            if (!snapshot.exists) throw new Error("Nguyên liệu không còn tồn tại trong kho.");
            const currentItem = snapshot.data();
            const currentQuantity = getQuantity(currentItem.quantity);
            if (quantity > currentQuantity) {
                throw new Error("Số lượng xuất vượt quá số lượng tồn kho hiện tại.");
            }
            transaction.update(itemReference, {
                quantity: currentQuantity - quantity,
                updated_at: serverTimestamp()
            });
            transaction.set(historyReference, {
                item_id: selectedId,
                item_code: currentItem.code || item.code || "",
                item_name: currentItem.name || item.name,
                quantity: quantity,
                unit: currentItem.unit || item.unit || "",
                reason: reason,
                ...actor,
                note: note,
                created_at: serverTimestamp()
            });
        });

        exportForm.reset();
        showMessage("Đã ghi phiếu xuất và cập nhật tồn kho Firestore.");
    } catch (error) {
        console.error("Lỗi xuất kho Firestore:", error);
        showMessage(inventoryErrorMessage(error, "Không thể thực hiện xuất kho."), true);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function initInventory() {
    if (addItemBtn) addItemBtn.addEventListener("click", openAddModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (form) form.addEventListener("submit", handleSaveItem);
    window.addEventListener("click", function (event) {
        if (event.target === modal) closeModal();
    });
    if (importForm) importForm.addEventListener("submit", recordStockImport);
    if (exportForm) exportForm.addEventListener("submit", recordStockExport);

    const seedButton = document.getElementById("seed-catalog-btn");
    if (seedButton) {
        seedButton.addEventListener("click", function () {
            seedStarterCatalog(true);
        });
    }

    const importItemSelect = document.getElementById("import-item");
    if (importItemSelect) {
        importItemSelect.addEventListener("change", function () {
            const item = inventoryItems.find(function (entry) {
                return entry.id === importItemSelect.value;
            });
            const supplierInput = document.getElementById("import-supplier");
            if (supplierInput) supplierInput.value = item ? item.supplier || "" : "";
        });
    }

    const importDate = document.getElementById("import-date");
    if (importDate) importDate.value = todayDateInput();

    if (itemSearch) {
        itemSearch.addEventListener("input", function (event) {
            searchTerm = event.target.value.toLocaleLowerCase("vi").trim();
            renderInventory();
        });
    }

    const logoutButton = document.getElementById("inventory-logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", async function () {
            try {
                const auth = getAuth();
                if (!auth) throw new Error("Firebase Authentication chưa được khởi tạo.");
                await auth.signOut();
            } catch (error) {
                console.error("Lỗi đăng xuất Firebase:", error);
                showMessage(error.message || "Không thể đăng xuất.", true);
            }
        });
    }

    const auth = getAuth();
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
        setAuthenticatedView(null);
        showAuthMessage("Không thể khởi tạo Firebase Authentication. Kiểm tra cấu hình Firebase và tải lại trang.", true);
        return;
    }

    auth.onAuthStateChanged(function (user) {
        closeFirestoreListeners();
        currentUser = user;
        const activeProjectId = window.firebaseProjectId || "";
        if (activeProjectId !== INVENTORY_FIREBASE_PROJECT_ID) {
            setAuthenticatedView(null);
            showAuthMessage(
                `Cấu hình Firebase đang trỏ tới "${activeProjectId || "không xác định"}"; kho yêu cầu project "${INVENTORY_FIREBASE_PROJECT_ID}".`,
                true
            );
            return;
        }
        if (!user) {
            setAuthenticatedView(null);
            showAuthMessage("Vui lòng đăng nhập bằng tài khoản quản trị tại cổng Admin trước khi quản lý kho.");
            return;
        }
        if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL) {
            setAuthenticatedView(null);
            showAuthMessage("Tài khoản hiện tại không có quyền quản trị kho.", true);
            return;
        }

        setAuthenticatedView(user);
        const db = getFirestore();
        if (!db) {
            showMessage("Firebase Firestore chưa được khởi tạo.", true);
            return;
        }
        listenToInventory(db);
    }, function (error) {
        console.error("Lỗi xác thực Firebase:", error);
        setAuthenticatedView(null);
        showAuthMessage("Không thể xác minh phiên Firebase. Hãy đăng nhập lại qua cổng Admin.", true);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInventory, { once: true });
} else {
    initInventory();
}
