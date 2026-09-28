// ==========================================
// QUẢN LÝ KHO
// ==========================================


// Danh sách nguyên liệu
let inventoryItems = [];


// ==========================================
// LẤY CÁC ELEMENT HTML
// ==========================================

const tableBody =
    document.getElementById("inventory-table-body");

const totalItems =
    document.getElementById("total-items");

const lowItems =
    document.getElementById("low-items");

const outItems =
    document.getElementById("out-items");

const modal =
    document.getElementById("inventory-modal");

const modalTitle =
    document.getElementById("modal-title");

const form =
    document.getElementById("inventory-form");

const itemId =
    document.getElementById("item-id");

const itemName =
    document.getElementById("item-name");

const itemCategory =
    document.getElementById("item-category");

const itemQuantity =
    document.getElementById("item-quantity");

const itemUnit =
    document.getElementById("item-unit");

const itemMin =
    document.getElementById("item-min");

const addItemBtn =
    document.getElementById("add-item-btn");

const cancelBtn =
    document.getElementById("cancel-btn");


// ==========================================
// MỞ FORM THÊM
// ==========================================

addItemBtn.addEventListener("click", function () {

    form.reset();

    itemId.value = "";

    modalTitle.textContent =
        "Thêm nguyên liệu";

    modal.style.display = "flex";

});


// ==========================================
// ĐÓNG FORM
// ==========================================

cancelBtn.addEventListener("click", function () {

    modal.style.display = "none";

});


// ==========================================
// THÊM / SỬA NGUYÊN LIỆU
// ==========================================

form.addEventListener("submit", async function (event) {

    event.preventDefault();


    const name =
        itemName.value.trim();

    const category =
        itemCategory.value;

    const quantity =
        Number(itemQuantity.value);

    const unit =
        itemUnit.value.trim();

    const minQuantity =
        Number(itemMin.value);


    if (name === "") {

        alert("Vui lòng nhập tên nguyên liệu!");

        return;

    }


    try {


        const data = {

            name: name,

            category: category,

            quantity: quantity,

            unit: unit,

            minQuantity: minQuantity,

            updatedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp()

        };


        // ==================================
        // SỬA
        // ==================================

        if (itemId.value !== "") {


            await db
                .collection("inventory")
                .doc(itemId.value)
                .update(data);


            alert("Cập nhật thành công!");

        }


        // ==================================
        // THÊM
        // ==================================

        else {


            data.createdAt =
                firebase.firestore
                    .FieldValue
                    .serverTimestamp();


            await db
                .collection("inventory")
                .add(data);


            alert("Thêm nguyên liệu thành công!");

        }


        modal.style.display = "none";

        form.reset();

        loadInventory();


    }

    catch (error) {

        console.error(error);

        alert(
            "Có lỗi xảy ra: "
            + error.message
        );

    }

});


// ==========================================
// LẤY DỮ LIỆU FIRESTORE
// ==========================================

async function loadInventory() {


    try {


        const snapshot =
            await db
                .collection("inventory")
                .orderBy("name")
                .get();


        inventoryItems = [];


        snapshot.forEach(function (doc) {


            inventoryItems.push({

                id: doc.id,

                ...doc.data()

            });


        });


        renderInventory();

        updateStats();


    }

    catch (error) {

        console.error(
            "Lỗi load kho:",
            error
        );

    }

}


// ==========================================
// HIỂN THỊ DANH SÁCH
// ==========================================

function renderInventory() {


    tableBody.innerHTML = "";


    if (inventoryItems.length === 0) {


        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    style="text-align:center">

                    Chưa có nguyên liệu nào.

                </td>

            </tr>

        `;


        return;

    }


    inventoryItems.forEach(function (item) {


        let status;

        let statusClass;


        // HẾT HÀNG

        if (item.quantity <= 0) {

            status = "Hết hàng";

            statusClass =
                "status-out";

        }


        // SẮP HẾT

        else if (
            item.quantity <=
            item.minQuantity
        ) {

            status = "Sắp hết";

            statusClass =
                "status-low";

        }


        // CÒN HÀNG

        else {

            status = "Còn hàng";

            statusClass =
                "status-good";

        }


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${item.name}
            </td>

            <td>
                ${item.category}
            </td>

            <td>
                ${item.quantity}
            </td>

            <td>
                ${item.unit}
            </td>

            <td>
                ${item.minQuantity}
            </td>

            <td class="${statusClass}">
                ${status}
            </td>

            <td>

                <button
                    class="btn btn-edit"
                    onclick="editItem('${item.id}')">

                    Sửa

                </button>


                <button
                    class="btn btn-delete"
                    onclick="deleteItem('${item.id}')">

                    Xóa

                </button>

            </td>

        `;


        tableBody.appendChild(row);

    });

}


// ==========================================
// THỐNG KÊ
// ==========================================

function updateStats() {


    totalItems.textContent =
        inventoryItems.length;


    const low =
        inventoryItems.filter(function (item) {

            return (
                item.quantity > 0 &&
                item.quantity <= item.minQuantity
            );

        });


    const out =
        inventoryItems.filter(function (item) {

            return item.quantity <= 0;

        });


    lowItems.textContent =
        low.length;

    outItems.textContent =
        out.length;

}


// ==========================================
// SỬA
// ==========================================

function editItem(id) {


    const item =
        inventoryItems.find(function (item) {

            return item.id === id;

        });


    if (!item) {

        return;

    }


    itemId.value =
        item.id;

    itemName.value =
        item.name;

    itemCategory.value =
        item.category;

    itemQuantity.value =
        item.quantity;

    itemUnit.value =
        item.unit;

    itemMin.value =
        item.minQuantity;


    modalTitle.textContent =
        "Sửa nguyên liệu";


    modal.style.display =
        "flex";

}


// ==========================================
// XÓA
// ==========================================

async function deleteItem(id) {


    const result =
        confirm(
            "Bạn có chắc muốn xóa nguyên liệu này?"
        );


    if (!result) {

        return;

    }


    try {


        await db
            .collection("inventory")
            .doc(id)
            .delete();


        alert("Đã xóa nguyên liệu!");


        loadInventory();


    }

    catch (error) {


        console.error(error);


        alert(
            "Không thể xóa: "
            + error.message
        );

    }

}


// ==========================================
// CHẠY KHI TRANG MỞ
// ==========================================

loadInventory();