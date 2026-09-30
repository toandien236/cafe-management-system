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
const addItemBtn = document.getElementById("add-item-btn");
const cancelBtn = document.getElementById("cancel-btn");
const inventoryMessage = document.getElementById("inventory-message");
const importForm = document.getElementById("stock-import-form");
const exportForm = document.getElementById("stock-export-form");
const itemSearch = document.getElementById("item-search");

let inventoryItems = [];
let inventoryChannels = [];
let searchTerm = "";

function getSupabase() {
    return window.supabaseClient || window.supabaseDb || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
}

function showMessage(message, isError = false) {
    if (!inventoryMessage) return;
    inventoryMessage.textContent = message;
    inventoryMessage.dataset.error = String(isError);
}

function showTableMessage(message) {
    if (!tableBody) return;
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 8;
    cell.style.textAlign = "center";
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.replaceChildren(row);
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
                option.textContent = item.name + " (tồn: " + formatQuantity(item.quantity) + " " + item.unit + ")";
                option.selected = item.id === selectedId;
                select.appendChild(option);
            });
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
        if (quantity <= 0) {
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

        row.append(
            createTextCell(item.name),
            createTextCell(item.category || "Khác"),
            createTextCell(formatQuantity(quantity) + " " + (item.unit || "")),
            createTextCell(formatQuantity(minQuantity) + " " + (item.unit || "")),
            createTextCell(formatCurrency(price)),
            statusCell,
            createTextCell(formatDate(item.updated_at || item.updatedAt)),
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
    modal.style.display = "flex";
}

function openAddModal() {
    modalTitle.textContent = "Thêm nguyên liệu mới";
    form.reset();
    itemId.value = "";
    itemQuantity.disabled = false;
    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
}

async function handleSaveItem(e) {
    e.preventDefault();
    const client = getSupabase();
    const name = itemName.value.trim();
    const category = itemCategory.value;
    const unit = itemUnit.value.trim();
    const quantity = Number(itemQuantity.value);
    const minStock = Number(itemMin.value);
    const price = Number(itemPrice.value);
    const isEditing = itemId.value !== "";

    if (!name || !unit) {
        showMessage("Vui lòng nhập tên nguyên liệu và đơn vị.", true);
        return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        if (client && typeof client.from === "function") {
            if (isEditing) {
                const { error } = await client.from("inventory").update({
                    name,
                    category,
                    unit,
                    min_stock: minStock,
                    price: price
                }).eq("id", itemId.value);

                if (error) throw error;
            } else {
                const { error } = await client.from("inventory").insert([{
                    name,
                    category,
                    quantity,
                    unit,
                    min_stock: minStock,
                    price: price
                }]);

                if (error) throw error;
            }
        }

        closeModal();
        form.reset();
        itemId.value = "";
        itemQuantity.disabled = false;
        showMessage(isEditing ? "Đã cập nhật nguyên liệu." : "Đã thêm nguyên liệu.");
        loadInventory();
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
    try {
        if (client && typeof client.from === "function") {
            const { error } = await client.from("inventory").delete().eq("id", id);
            if (error) throw error;
        }
        showMessage("Đã xóa nguyên liệu.");
        loadInventory();
    } catch (error) {
        console.error("Lỗi xóa kho:", error);
        showMessage(error.message || "Không thể xóa nguyên liệu.", true);
    }
}

async function loadInventory() {
    const client = getSupabase();
    if (client && typeof client.from === "function") {
        try {
            const { data, error } = await client.from("inventory").select("*").order("name");
            if (error) throw error;
            inventoryItems = data || [];
            renderInventory();
        } catch (err) {
            console.warn("Lỗi tải kho:", err);
            renderInventory();
        }
    } else {
        renderInventory();
    }
}

async function loadHistory(tableName, tbodyElement, createRowFn) {
    if (!tbodyElement) return;
    const client = getSupabase();
    if (!client || typeof client.from !== "function") return;

    try {
        const { data, error } = await client
            .from(tableName)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) throw error;

        tbodyElement.replaceChildren();
        if (!data || data.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.style.textAlign = "center";
            cell.textContent = "Chưa có giao dịch.";
            row.appendChild(cell);
            tbodyElement.appendChild(row);
            return;
        }

        data.forEach(function (record) {
            tbodyElement.appendChild(createRowFn(record));
        });
    } catch (e) {
        console.warn("Lỗi tải lịch sử " + tableName, e);
    }
}

function createImportHistoryRow(data) {
    const row = document.createElement("tr");
    row.append(
        createTextCell(formatDate(data.created_at)),
        createTextCell(data.item_name || data.itemName),
        createTextCell("+" + formatQuantity(data.quantity) + " " + (data.unit || "")),
        createTextCell(data.supplier || "—"),
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
    const note = document.getElementById("import-note") ? document.getElementById("import-note").value.trim() : "";
    const quantity = Number(quantityInput);
    const unitPrice = Number(unitPriceInput);
    const item = inventoryItems.find(function (entry) { return entry.id === selectedId; });

    if (!item || !quantityInput || !Number.isFinite(quantity) || quantity <= 0) {
        showMessage("Vui lòng chọn nguyên liệu và nhập số lượng hợp lệ.", true);
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    const client = getSupabase();

    try {
        const newQty = getQuantity(item.quantity) + quantity;
        const totalCost = quantity * (unitPrice || 0);

        if (client && typeof client.from === "function") {
            // Update inventory
            const { error: updateError } = await client.from("inventory").update({
                quantity: newQty,
                price: unitPrice || item.price
            }).eq("id", selectedId);

            if (updateError) throw updateError;

            // Insert stock import log
            const { error: logError } = await client.from("stock_imports").insert([{
                item_id: selectedId,
                item_name: item.name,
                quantity: quantity,
                unit: item.unit,
                cost_price: unitPrice || 0,
                total_cost: totalCost,
                supplier: supplier,
                note: note
            }]);

            if (logError) throw logError;
        }

        importForm.reset();
        showMessage("Đã nhập kho thành công.");
        loadInventory();
        loadHistory("stock_imports", document.getElementById("stock-imports-body"), createImportHistoryRow);
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
        const newQty = getQuantity(item.quantity) - quantity;

        if (client && typeof client.from === "function") {
            const { error: updateError } = await client.from("inventory").update({
                quantity: newQty
            }).eq("id", selectedId);

            if (updateError) throw updateError;

            const { error: logError } = await client.from("stock_exports").insert([{
                item_id: selectedId,
                item_name: item.name,
                quantity: quantity,
                unit: item.unit,
                reason: reason,
                note: note
            }]);

            if (logError) throw logError;
        }

        exportForm.reset();
        showMessage("Đã xuất kho thành công.");
        loadInventory();
        loadHistory("stock_exports", document.getElementById("stock-exports-body"), createExportHistoryRow);
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
    if (importForm) importForm.addEventListener("submit", recordStockImport);
    if (exportForm) exportForm.addEventListener("submit", recordStockExport);

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
            .on("postgres_changes", { event: "*", schema: "public", table: "stock_imports" }, () => loadHistory("stock_imports", document.getElementById("stock-imports-body"), createImportHistoryRow))
            .on("postgres_changes", { event: "*", schema: "public", table: "stock_exports" }, () => loadHistory("stock_exports", document.getElementById("stock-exports-body"), createExportHistoryRow))
            .subscribe();

        inventoryChannels.push(channel);
    }

    loadInventory();
    loadHistory("stock_imports", document.getElementById("stock-imports-body"), createImportHistoryRow);
    loadHistory("stock_exports", document.getElementById("stock-exports-body"), createExportHistoryRow);
}

document.addEventListener("DOMContentLoaded", initInventory);
