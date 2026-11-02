const tableBody = document.getElementById("inventory-table-body");
const totalItems = document.getElementById("total-items");
const lowItems = document.getElementById("low-items");
const outItems = document.getElementById("out-items");
const modal = document.getElementById("inventory-modal");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("inventory-form");
const itemId = document.getElementById("item-id");
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

let inventoryItems = [];
let inventoryChannels = [];
let searchTerm = "";
let isCatalogPreview = false;

const INVENTORY_STORAGE_KEY = "mocha_inventory";
const IMPORTS_STORAGE_KEY = "mocha_stock_imports";
const EXPORTS_STORAGE_KEY = "mocha_stock_exports";

function saveToLocalStorage(items) {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
        }
    } catch (e) {
        console.warn("Không thể lưu kho vào localStorage:", e);
    }
}

function loadFromLocalStorage() {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const data = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        }
    } catch (e) {
        console.warn("Không thể đọc kho từ localStorage:", e);
    }
    return null;
}

function saveLocalHistory(table, record) {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const key = "mocha_" + table;
            const existing = JSON.parse(window.localStorage.getItem(key) || "[]");
            existing.unshift(record);
            window.localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
        }
    } catch (e) {
        console.warn("Không thể lưu lịch sử cục bộ:", e);
    }
}

function loadLocalHistory(table) {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const key = "mocha_" + table;
            return JSON.parse(window.localStorage.getItem(key) || "[]");
        }
    } catch (e) {
        console.warn("Không thể đọc lịch sử cục bộ:", e);
    }
    return [];
}

function getStarterCatalogWithData() {
    const catalog = Array.isArray(window.INVENTORY_STARTER_CATALOG)
        ? window.INVENTORY_STARTER_CATALOG
        : [];
    const now = new Date().toISOString();
    return catalog.map(function (item, index) {
        return {
            id: "cat-" + (index + 1),
            name: item.name,
            category: item.category || "Khác",
            unit: item.unit || "",
            quantity: Number(item.quantity) || 0,
            min_stock: Number(item.min_stock) || 0,
            price: Number(item.price) || 0,
            supplier: item.supplier || "—",
            updated_at: now
        };
    });
}

async function seedStarterCatalog(isManual = false) {
    const items = getStarterCatalogWithData();
    inventoryItems = items;
    saveToLocalStorage(items);
    setCatalogPreview(false);
    renderInventory();

    const client = getSupabase();
    let supabaseSaved = false;
    if (client && typeof client.from === "function") {
        try {
            const rowsToInsert = items.map(function (item) {
                return {
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    unit: item.unit,
                    min_stock: item.min_stock,
                    price: item.price,
                    supplier: item.supplier !== "—" ? item.supplier : null
                };
            });
            const { error } = await client.from("inventory").upsert(rowsToInsert, { onConflict: "name" });
            if (!error) supabaseSaved = true;
        } catch (e) {
            console.warn("Lỗi seed Supabase:", e);
        }
    }

    if (isManual) {
        showMessage(supabaseSaved
            ? "✅ Đã nạp thành công 46 nguyên liệu vào kho (Đã đồng bộ Supabase & Cục bộ)!"
            : "✅ Đã nạp thành công 46 nguyên liệu vào kho (Lưu trong bộ nhớ cục bộ)!"
        );
    }
}

function getSupabase() {
    return window.supabaseClient || window.supabaseDb || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
}

function showMessage(message, isError = false) {
    if (!inventoryMessage) return;
    inventoryMessage.textContent = message;
    inventoryMessage.dataset.error = String(isError);
}

function setCatalogPreview(isPreview) {
    isCatalogPreview = isPreview;
    if (addItemBtn) addItemBtn.disabled = false;

    [importForm, exportForm].forEach(function (stockForm) {
        if (!stockForm) return;
        stockForm.querySelectorAll("input, select, textarea, button").forEach(function (control) {
            control.disabled = isPreview;
        });
    });

    const stats = document.querySelector(".inventory-stats");
    if (stats) stats.hidden = isPreview;
}

function showCatalogPreview(reason) {
    const catalog = Array.isArray(window.INVENTORY_STARTER_CATALOG)
        ? window.INVENTORY_STARTER_CATALOG
        : [];
    inventoryItems = catalog.map(function (item, index) {
        return {
            id: "catalog-preview-" + index,
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantity: null,
            min_stock: null,
            price: null,
            supplier: null,
            updated_at: null
        };
    });
    setCatalogPreview(true);
    renderInventory();
    showMessage(
        reason + " Đang hiển thị danh sách mẫu " + inventoryItems.length +
        " nguyên liệu để bạn xem. Đây chưa phải dữ liệu đã lưu; hãy kết nối Supabase và chạy database/seed-inventory.sql để lưu vào kho.",
        true
    );
}

function showTableMessage(message) {
    if (!tableBody) return;
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 10;
    cell.style.textAlign = "center";
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.replaceChildren(row);
}

function parseDecimal(value) {
    if (value == null) return NaN;
    const str = String(value).trim().replace(',', '.');
    return parseFloat(str);
}

function getQuantity(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) ? quantity : 0;
}

function formatQuantity(value) {
    return getQuantity(value).toLocaleString("vi-VN", {
        maximumFractionDigits: 3
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function formatExpiryDate(value) {
    if (!value) return "—";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

async function getActor(client) {
    if (!client || !client.auth || typeof client.auth.getUser !== "function") {
        return { created_by: "local-user", actor_name: "Quản trị viên kho" };
    }

    try {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        const user = data && data.user;
        const actorName = user && (user.user_metadata?.full_name || user.email || user.phone || user.id);
        if (user && user.id && actorName) {
            return { created_by: user.id, actor_name: actorName };
        }
    } catch (e) {
        // Fall back safely to admin
    }

    return { created_by: "admin", actor_name: "Quản trị viên kho" };
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
                option.textContent = item.name + " (" + (item.unit || "") + " - còn " + formatQuantity(item.quantity) + ")";
                select.appendChild(option);
            });

        if (selectedId && inventoryItems.some(function (entry) { return entry.id === selectedId; })) {
            select.value = selectedId;
        }
    });
}

function updateStats() {
    if (totalItems) totalItems.textContent = String(inventoryItems.length);
    if (lowItems) lowItems.textContent = String(inventoryItems.filter(function (item) {
        const quantity = getQuantity(item.quantity);
        return quantity > 0 && quantity <= getQuantity(item.min_stock || item.minQuantity);
    }).length);
    if (outItems) outItems.textContent = String(inventoryItems.filter(function (item) {
        return getQuantity(item.quantity) <= 0;
    }).length);
    const totalValueEl = document.getElementById("total-value");
    if (totalValueEl) {
        const sumValue = inventoryItems.reduce(function (sum, item) {
            return sum + (getQuantity(item.quantity) * (Number(item.price) || 0));
        }, 0);
        totalValueEl.textContent = formatCurrency(sumValue);
    }
}

function createTextCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    return cell;
}

function renderInventory() {
    if (!tableBody) return;
    tableBody.replaceChildren();

    if (inventoryItems.length === 0) {
        showTableMessage("Chưa có nguyên liệu nào.");
        updateStats();
        renderIngredientOptions();
        return;
    }

    const visibleItems = inventoryItems.filter(function (item) {
        return String(item.name || "").toLocaleLowerCase("vi").includes(searchTerm);
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
        const minQuantity = getQuantity(item.min_stock || item.minQuantity);
        const price = Number(item.price || item.purchasePrice) || 0;

        let statusText = "Đủ hàng";
        let statusColor = "#2e7d32";
        if (isCatalogPreview) {
            statusText = "Chưa nhập tồn";
            statusColor = "#806e64";
        } else if (quantity <= 0) {
            statusText = "Hết hàng";
            statusColor = "#c62828";
        } else if (quantity <= minQuantity) {
            statusText = "Sắp hết";
            statusColor = "#ef6c00";
        }

        const statusCell = document.createElement("td");
        statusCell.textContent = statusText;
        statusCell.style.color = statusColor;
        statusCell.style.fontWeight = "bold";

        const actionCell = document.createElement("td");
        if (isCatalogPreview) {
            actionCell.textContent = "Danh sách xem trước";
        } else {
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "btn-secondary";
            editBtn.style.marginRight = "6px";
            editBtn.style.padding = "4px 8px";
            editBtn.textContent = "Sửa";
            editBtn.onclick = function () { openEditModal(item); };

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn-logout";
            deleteBtn.style.padding = "4px 8px";
            deleteBtn.textContent = "Xóa";
            deleteBtn.onclick = function () { deleteItem(item.id); };

            actionCell.append(editBtn, deleteBtn);
        }

        row.append(
            createTextCell(item.name),
            createTextCell(item.category || "Khác"),
            createTextCell(isCatalogPreview ? "Chưa nhập" : formatQuantity(quantity)),
            createTextCell(isCatalogPreview ? "Chưa có" : formatCurrency(price)),
            createTextCell(item.unit || ""),
            createTextCell(isCatalogPreview ? "—" : formatQuantity(minQuantity)),
            statusCell,
            createTextCell(isCatalogPreview ? "—" : formatDate(item.updated_at || item.updatedAt)),
            createTextCell(item.supplier || "—"),
            actionCell
        );

        tableBody.appendChild(row);
    });

    updateStats();
    renderIngredientOptions();
}

function openEditModal(item) {
    modalTitle.textContent = "Chỉnh sửa nguyên liệu";
    itemId.value = item.id;
    itemName.value = item.name || "";
    itemCategory.value = item.category || "Cà phê";
    itemQuantity.value = getQuantity(item.quantity);
    itemQuantity.disabled = true; // Sửa số lượng qua nhập/xuất kho
    itemUnit.value = item.unit || "";
    itemMin.value = getQuantity(item.min_stock || item.minQuantity);
    itemPrice.value = Number(item.price || item.purchasePrice) || 0;
    if (itemSupplier) itemSupplier.value = item.supplier && item.supplier !== "—" ? item.supplier : "";
    modal.style.display = "flex";
}

function openAddModal() {
    modalTitle.textContent = "Thêm nguyên liệu mới";
    form.reset();
    itemId.value = "";
    itemQuantity.disabled = false;
    if (itemSupplier) itemSupplier.value = "";
    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
}

async function handleSaveItem(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    const name = itemName.value.trim();
    const category = itemCategory.value || "Khác";
    const unit = itemUnit.value.trim();
    const quantity = parseDecimal(itemQuantity.value);
    const minStock = parseDecimal(itemMin.value);
    const price = parseDecimal(itemPrice.value);
    const supplier = itemSupplier ? itemSupplier.value.trim() : "";
    const isEditing = itemId.value !== "";

    if (!name || !unit) {
        showMessage("Vui lòng nhập tên nguyên liệu và đơn vị tính.", true);
        return;
    }

    if (!isEditing && (Number.isNaN(quantity) || quantity < 0)) {
        showMessage("Tồn đầu kỳ phải là số không âm (>= 0).", true);
        if (itemQuantity && typeof itemQuantity.focus === "function") itemQuantity.focus();
        return;
    }

    if (Number.isNaN(minStock) || minStock < 0) {
        showMessage("Mức tồn tối thiểu phải là số không âm (>= 0).", true);
        if (itemMin && typeof itemMin.focus === "function") itemMin.focus();
        return;
    }

    if (Number.isNaN(price) || price < 0) {
        showMessage("Giá nhập phải là số không âm (>= 0 VND).", true);
        if (itemPrice && typeof itemPrice.focus === "function") itemPrice.focus();
        return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const client = getSupabase();
        let supabaseSaved = false;

        if (client && typeof client.from === "function") {
            try {
                if (isEditing) {
                    const { error } = await client.from("inventory").update({
                        name,
                        category,
                        unit,
                        min_stock: minStock,
                        price: price,
                        supplier: supplier || null
                    }).eq("id", itemId.value);

                    if (!error) supabaseSaved = true;
                } else {
                    const { error } = await client.from("inventory").insert([{
                        name,
                        category,
                        quantity,
                        unit,
                        min_stock: minStock,
                        price: price,
                        supplier: supplier || null
                    }]);

                    if (!error) supabaseSaved = true;
                }
            } catch (supErr) {
                console.warn("Lưu Supabase không thành công, lưu vào bộ nhớ cục bộ:", supErr);
            }
        }

        const now = new Date().toISOString();
        if (isEditing) {
            const index = inventoryItems.findIndex(function (entry) { return entry.id === itemId.value; });
            if (index !== -1) {
                inventoryItems[index] = {
                    ...inventoryItems[index],
                    name,
                    category,
                    unit,
                    min_stock: minStock,
                    price,
                    supplier: supplier || "—",
                    updated_at: now
                };
            }
        } else {
            const newItem = {
                id: "inv-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
                name,
                category,
                quantity: quantity || 0,
                unit,
                min_stock: minStock,
                price: price || 0,
                supplier: supplier || "—",
                updated_at: now
            };

            if (isCatalogPreview) {
                isCatalogPreview = false;
                setCatalogPreview(false);
            }
            inventoryItems.unshift(newItem);
        }

        saveToLocalStorage(inventoryItems);
        closeModal();
        form.reset();
        itemId.value = "";
        itemQuantity.disabled = false;

        const successMsg = isEditing
            ? `Đã cập nhật nguyên liệu "${name}".`
            : `Đã thêm mới nguyên liệu "${name}" thành công!`;
        showMessage(supabaseSaved ? successMsg : `${successMsg} (Đã lưu vào bộ nhớ cục bộ)`);

        renderInventory();
    } catch (error) {
        console.error("Lỗi lưu kho:", error);
        showMessage(error.message || "Không thể lưu nguyên liệu.", true);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function deleteItem(id) {
    const item = inventoryItems.find(function (entry) { return entry.id === id; });
    if (!item || !confirm("Bạn có chắc muốn xóa “" + item.name + "”?")) return;

    const client = getSupabase();
    if (client && typeof client.from === "function") {
        try {
            await client.from("inventory").delete().eq("id", id);
        } catch (e) {
            console.warn("Lỗi xóa trên Supabase:", e);
        }
    }

    inventoryItems = inventoryItems.filter(function (entry) { return entry.id !== id; });
    saveToLocalStorage(inventoryItems);
    showMessage(`Đã xóa nguyên liệu "${item.name}".`);
    renderInventory();
}

async function loadInventory() {
    const client = getSupabase();

    if (client && typeof client.from === "function") {
        try {
            const { data, error } = await client.from("inventory").select("*").order("name");
            if (!error && Array.isArray(data) && data.length > 0) {
                setCatalogPreview(false);
                inventoryItems = data;
                saveToLocalStorage(data);
                renderInventory();
                return;
            }
        } catch (err) {
            console.warn("Không thể tải kho từ Supabase:", err);
        }
    }

    // In a browser with localStorage:
    const localData = loadFromLocalStorage();
    if (localData && localData.length > 0) {
        setCatalogPreview(false);
        inventoryItems = localData;
        renderInventory();
        showMessage("Đang sử dụng dữ liệu kho từ bộ nhớ cục bộ. Bạn có thể thêm, sửa, nhập, xuất nguyên liệu bình thường.");
        return;
    }

    // Browser initial load with starter catalog
    if (typeof window !== "undefined" && window.localStorage && Array.isArray(window.INVENTORY_STARTER_CATALOG) && window.INVENTORY_STARTER_CATALOG.length > 0) {
        await seedStarterCatalog(false);
        return;
    }

    // Fallback for mock/test environments
    showCatalogPreview(client && typeof client.from === "function" ? "Kho Supabase hiện chưa có nguyên liệu." : "Chưa kết nối Supabase.");
}

async function loadHistory(tableName, tbodyElement, createRowFn, columnCount) {
    if (!tbodyElement) return;
    const client = getSupabase();

    if (client && typeof client.from === "function") {
        try {
            const { data, error } = await client
                .from(tableName)
                .select("*")
                .order("created_at", { ascending: false })
                .limit(20);

            if (!error && Array.isArray(data)) {
                tbodyElement.replaceChildren();
                if (data.length === 0) {
                    const row = document.createElement("tr");
                    const cell = document.createElement("td");
                    cell.colSpan = columnCount;
                    cell.style.textAlign = "center";
                    cell.textContent = "Chưa có giao dịch.";
                    row.appendChild(cell);
                    tbodyElement.appendChild(row);
                    return;
                }

                data.forEach(function (record) {
                    tbodyElement.appendChild(createRowFn(record));
                });
                return;
            }
        } catch (e) {
            console.warn("Không thể tải lịch sử " + tableName + " từ Supabase:", e);
        }
    }

    // Fallback to local history
    const localRecords = loadLocalHistory(tableName);
    tbodyElement.replaceChildren();
    if (!localRecords || localRecords.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columnCount;
        cell.style.textAlign = "center";
        cell.textContent = "Chưa có giao dịch.";
        row.appendChild(cell);
        tbodyElement.appendChild(row);
        return;
    }

    localRecords.slice(0, 20).forEach(function (record) {
        tbodyElement.appendChild(createRowFn(record));
    });
}

function createImportHistoryRow(data) {
    const row = document.createElement("tr");
    row.append(
        createTextCell(formatDate(data.created_at)),
        createTextCell(data.item_name || data.itemName),
        createTextCell("+" + formatQuantity(data.quantity) + " " + (data.unit || "")),
        createTextCell(data.supplier || "—"),
        createTextCell(data.batch_number || "—"),
        createTextCell(formatExpiryDate(data.expiry_date)),
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
        createTextCell(data.item_name || data.itemName),
        createTextCell("-" + formatQuantity(data.quantity) + " " + (data.unit || "")),
        createTextCell(data.reason || "—"),
        createTextCell(data.actor_name || "—"),
        createTextCell(data.note || "—")
    );
    return row;
}

async function recordStockImport(event) {
    event.preventDefault();
    const submitBtn = importForm.querySelector('[type="submit"]');
    const selectedId = document.getElementById("import-item").value;
    const quantityInput = document.getElementById("import-quantity").value;
    const unitPriceInput = document.getElementById("import-unit-price").value;
    const supplier = document.getElementById("import-supplier").value.trim();
    const batchNumber = document.getElementById("import-batch").value.trim();
    const expiryDate = document.getElementById("import-expiry").value || null;
    const note = document.getElementById("import-note") ? document.getElementById("import-note").value.trim() : "";
    const quantity = Number(quantityInput);
    const unitPrice = Number(unitPriceInput);
    const item = inventoryItems.find(function (entry) { return entry.id === selectedId; });

    if (!item || !quantityInput || !Number.isFinite(quantity) || quantity <= 0) {
        showMessage("Vui lòng chọn nguyên liệu và nhập số lượng hợp lệ.", true);
        return;
    }

    if (!Number.isInteger(unitPrice) || unitPrice < 0) {
        showMessage("Giá nhập phải là số nguyên VND không âm.", true);
        document.getElementById("import-unit-price").focus();
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    const client = getSupabase();

    try {
        const actor = await getActor(client);
        const newQty = getQuantity(item.quantity) + quantity;
        const totalCost = quantity * (unitPrice || 0);

        // Update in memory & localStorage
        item.quantity = newQty;
        item.price = unitPrice;
        if (supplier) item.supplier = supplier;
        item.updated_at = new Date().toISOString();
        saveToLocalStorage(inventoryItems);

        const historyRecord = {
            id: "imp-" + Date.now(),
            item_id: selectedId,
            item_name: item.name,
            quantity: quantity,
            unit: item.unit,
            cost_price: unitPrice,
            total_cost: totalCost,
            supplier: supplier,
            batch_number: batchNumber || null,
            expiry_date: expiryDate,
            created_at: new Date().toISOString(),
            ...actor,
            note: note
        };
        saveLocalHistory("stock_imports", historyRecord);

        // Try Supabase if available
        if (client && typeof client.from === "function") {
            try {
                const { error: updateError } = await client.from("inventory").update({
                    quantity: newQty,
                    price: unitPrice,
                    supplier: supplier
                }).eq("id", selectedId);

                if (updateError) console.warn("Supabase update error:", updateError);

                const { error: logError } = await client.from("stock_imports").insert([{
                    item_id: selectedId,
                    item_name: item.name,
                    quantity: quantity,
                    unit: item.unit,
                    cost_price: unitPrice,
                    total_cost: totalCost,
                    supplier: supplier,
                    batch_number: batchNumber || null,
                    expiry_date: expiryDate,
                    ...actor,
                    note: note
                }]);

                if (logError) console.warn("Supabase insert error:", logError);
            } catch (err) {
                console.warn("Lỗi đồng bộ Supabase khi nhập kho:", err);
            }
        }

        importForm.reset();
        showMessage("Đã nhập kho thành công.");
        renderInventory();
        loadHistory("stock_imports", document.getElementById("stock-imports-body"), createImportHistoryRow, 10);
    } catch (error) {
        console.error("Lỗi nhập kho:", error);
        showMessage(error.message || "Không thể thực hiện nhập kho.", true);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function recordStockExport(event) {
    event.preventDefault();
    const submitBtn = exportForm.querySelector('[type="submit"]');
    const selectedId = document.getElementById("export-item").value;
    const quantityInput = document.getElementById("export-quantity").value;
    const reason = document.getElementById("export-reason").value;
    const note = document.getElementById("export-note") ? document.getElementById("export-note").value.trim() : "";
    const quantity = Number(quantityInput);
    const item = inventoryItems.find(function (entry) { return entry.id === selectedId; });

    if (!item || !quantityInput || !Number.isFinite(quantity) || quantity <= 0) {
        showMessage("Vui lòng chọn nguyên liệu và nhập số lượng xuất hợp lệ.", true);
        return;
    }

    if (quantity > getQuantity(item.quantity)) {
        showMessage("Số lượng xuất vượt quá số lượng tồn kho hiện tại.", true);
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    const client = getSupabase();

    try {
        const actor = await getActor(client);
        const newQty = getQuantity(item.quantity) - quantity;

        // Update in memory & localStorage
        item.quantity = newQty;
        item.updated_at = new Date().toISOString();
        saveToLocalStorage(inventoryItems);

        const historyRecord = {
            id: "exp-" + Date.now(),
            item_id: selectedId,
            item_name: item.name,
            quantity: quantity,
            unit: item.unit,
            reason: reason,
            created_at: new Date().toISOString(),
            ...actor,
            note: note
        };
        saveLocalHistory("stock_exports", historyRecord);

        // Try Supabase if available
        if (client && typeof client.from === "function") {
            try {
                const { error: updateError } = await client.from("inventory").update({
                    quantity: newQty
                }).eq("id", selectedId);

                if (updateError) console.warn("Supabase update error:", updateError);

                const { error: logError } = await client.from("stock_exports").insert([{
                    item_id: selectedId,
                    item_name: item.name,
                    quantity: quantity,
                    unit: item.unit,
                    reason: reason,
                    ...actor,
                    note: note
                }]);

                if (logError) console.warn("Supabase insert error:", logError);
            } catch (err) {
                console.warn("Lỗi đồng bộ Supabase khi xuất kho:", err);
            }
        }

        exportForm.reset();
        showMessage("Đã xuất kho thành công.");
        renderInventory();
        loadHistory("stock_exports", document.getElementById("stock-exports-body"), createExportHistoryRow, 6);
    } catch (error) {
        console.error("Lỗi xuất kho:", error);
        showMessage(error.message || "Không thể thực hiện xuất kho.", true);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function initInventory() {
    if (addItemBtn) addItemBtn.addEventListener("click", openAddModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (form) form.addEventListener("submit", handleSaveItem);
    window.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
    });
    if (importForm) importForm.addEventListener("submit", recordStockImport);
    if (exportForm) exportForm.addEventListener("submit", recordStockExport);

    const seedBtn = document.getElementById("seed-catalog-btn");
    if (seedBtn) {
        seedBtn.addEventListener("click", function () {
            if (inventoryItems.length > 0 && !confirm("Bạn có muốn nạp hoặc đặt lại danh sách 46 nguyên liệu mẫu từ thực đơn không?")) {
                return;
            }
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

    if (itemSearch) {
        itemSearch.addEventListener("input", function (e) {
            searchTerm = e.target.value.toLowerCase().trim();
            renderInventory();
        });
    }

    const client = getSupabase();
    if (client && client.channel) {
        const channel = client.channel("public:inventory_changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => loadInventory())
            .on("postgres_changes", { event: "*", schema: "public", table: "stock_imports" }, () => loadHistory("stock_imports", document.getElementById("stock-imports-body"), createImportHistoryRow, 10))
            .on("postgres_changes", { event: "*", schema: "public", table: "stock_exports" }, () => loadHistory("stock_exports", document.getElementById("stock-exports-body"), createExportHistoryRow, 6))
            .subscribe();

        inventoryChannels.push(channel);
    }

    loadInventory();
    loadHistory("stock_imports", document.getElementById("stock-imports-body"), createImportHistoryRow, 10);
    loadHistory("stock_exports", document.getElementById("stock-exports-body"), createExportHistoryRow, 6);
}

document.addEventListener("DOMContentLoaded", initInventory);
