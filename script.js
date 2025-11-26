// === STATE APLIKASI ===
let cart = [];
let products = [];
let isProcessing = false;
let currentCategory = 'all';
let yourQueueNumber = parseInt(localStorage.getItem('lastQueueNumber')) || null; 

// === ELEMENT SELECTOR ===
const menuGrid = document.getElementById('menu-grid');
const cartItemsDiv = document.getElementById('cart-items');
const totalAmountEl = document.getElementById('total-amount');
const totalPriceDisplay = document.getElementById('total-price-display');
const customerNameInput = document.getElementById('customer-name');
const searchInput = document.getElementById('search-input');
const searchOrders = document.getElementById('search-orders');
const cartBadge = document.getElementById('cart-badge');
const notesInput = document.getElementById('notes');
const historyListContainer = document.getElementById('history-list-container');

// === FUNGSI HELPER ===
function formatRupiah(value) {
    value = parseInt(value, 10);
    if (isNaN(value)) value = 0;
    return "Rp " + value.toLocaleString('id-ID');
}

function showLoading() {
    isProcessing = true;
    const btn = document.getElementById('confirm-order-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memproses...';
    }
}

function hideLoading() {
    isProcessing = false;
    const btn = document.getElementById('confirm-order-btn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Konfirmasi';
    }
}

function validateCustomerName(name) {
    const trimmedName = name.trim();
    return trimmedName.length > 0 && 
            trimmedName !== "Customer" && 
            trimmedName !== "0" &&
            trimmedName !== "Pelanggan";
}

// === HISTORY (LocalStorage) ===
const LOCAL_STORAGE_KEY = 'warungBiEemOrderIds';

function getOrderIdsFromLocalStorage() {
    try {
        const idsJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (idsJson) {
            const ids = JSON.parse(idsJson);
            return Array.isArray(ids) ? ids.map(Number).filter(id => !isNaN(id)) : [];
        }
        return [];
    } catch (e) {
        console.error("Gagal parse ID pesanan", e);
        return [];
    }
}

function saveOrderIdsToLocalStorage(newOrderIds) {
    if (!newOrderIds || newOrderIds.length === 0) return;
    try {
        const existingIds = getOrderIdsFromLocalStorage();
        const combinedIds = [...new Set([...existingIds, ...newOrderIds])];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combinedIds));
    } catch (e) {
        console.error("Gagal menyimpan ID pesanan", e);
    }
}

// === FUNGSI RENDER PRODUK & CART ===
function renderProducts() {
    if (!menuGrid) return;
    menuGrid.innerHTML = '';
    
    if (products.length === 0) {
        menuGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #7f8c8d;"><h3>Menu tidak tersedia</h3></div>`;
        return;
    }
    
    let filteredProducts = products;
    if (currentCategory === 'food') {
        filteredProducts = products.filter(product => product.code.startsWith('MK'));
    } else if (currentCategory === 'beverage') {
        filteredProducts = products.filter(product => product.code.startsWith('MN'));
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => 
            product.name.toLowerCase().includes(searchTerm) || 
            product.code.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredProducts.length === 0) {
        menuGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #7f8c8d;"><h3>Tidak ada hasil ditemukan</h3></div>`;
        return;
    }
    
    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'menu-item';
        card.innerHTML = `
            <div class="menu-image">${product.code.startsWith('MK') ? '🍔' : '🥤'}</div>
            <div class="menu-info">
                <div class="menu-name">${product.name}</div>
                <div class="menu-desc">${product.code.startsWith('MK') ? 'Makanan' : 'Minuman'}</div>
                <div class="menu-price">${formatRupiah(product.price)}</div>
                <button class="add-btn" data-code="${product.code}">+ Tambah</button>
            </div>
        `;
        card.querySelector('.add-btn').addEventListener('click', () => {
            const p = products.find(item => item.code === product.code);
            addToCart(p);
        });
        menuGrid.appendChild(card);
    });
}

function renderCart() {
    if (!cartItemsDiv) return;
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = `<div class="empty-cart"><div class="empty-cart-icon">🛒</div><p>Keranjang masih kosong.</p></div>`;
        totalAmountEl.textContent = 'Rp 0';
        totalPriceDisplay.textContent = 'Rp 0';
        updateCartBadge(0);
        return;
    }

    cartItemsDiv.innerHTML = '';
    let totalAmount = 0;
    let totalItems = 0;

    cart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item';
        itemDiv.innerHTML = `
            <div class="order-item-info">
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-details">
                    <span>${item.qty} x ${formatRupiah(item.price)}</span>
                    <span style="font-weight: bold;">${formatRupiah(item.total)}</span>
                </div>
            </div>`;
        cartItemsDiv.appendChild(itemDiv);
        totalAmount += item.total;
        totalItems += item.qty;
    });

    totalAmountEl.textContent = formatRupiah(totalAmount);
    totalPriceDisplay.textContent = formatRupiah(totalAmount);
    updateCartBadge(totalItems);
}

function updateCartBadge(totalItems) {
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems === 0 ? 'none' : 'flex';
    }
}

function addToCart(product) {
    if (!product) return;
    const existingItem = cart.find(item => item.code === product.code);
    if (existingItem) {
        existingItem.qty += 1;
        existingItem.total = existingItem.qty * existingItem.price;
    } else {
        cart.push({
            code: product.code, name: product.name, price: parseFloat(product.price), qty: 1, total: parseFloat(product.price)
        });
    }
    renderCart();
    showNotification(`✅ ${product.name} ditambahkan ke keranjang`);
}

function showNotification(message) {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// === FUNGSI API ===
async function loadProducts() {
    try {
        const result = await supabaseClient.getProducts();
        if (result.success) {
            products = result.products;
            renderProducts();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error memuat produk:', error);
        showNotification('❌ Gagal memuat menu.');
    }
}

// === CHECKOUT LOGIC ===
async function processCheckout() {
    if (isProcessing) return;
    
    const customerName = customerNameInput.value.trim();
    const notes = notesInput.value.trim();

    if (!customerName || !validateCustomerName(customerName)) {
        showNotification("❌ Harap masukkan nama pemesan yang valid!");
        customerNameInput.focus();
        customerNameInput.classList.add('input-error');
        return;
    }

    if (cart.length === 0) {
        showNotification("❌ Keranjang kosong!");
        return;
    }
    
    showLoading();

    try {
        const saleTime = new Date().toISOString();
        const insertedOrderIds = [];

        // INSERT (Pending)
        for (const item of cart) {
            const orderData = {
                sale_date: saleTime,
                product_code: item.code,
                product_name: item.name,
                price: item.price,
                quantity: item.qty,
                total: item.total,
                customer_name: customerName,
                notes: notes,
                status: 'pending',
                // queue_number null awal
                payment_proof_url: null 
            };
            
            const result = await supabaseClient.createOrder(orderData);
            
            if (result.success) {
                insertedOrderIds.push(result.data.id);
            } else {
                throw new Error(`Gagal menyimpan pesanan: ${result.error}`);
            }
        }
        
        saveOrderIdsToLocalStorage(insertedOrderIds);
        
        cart = [];
        renderCart();
        customerNameInput.value = '';
        notesInput.value = '';
        customerNameInput.classList.remove('input-error');
        localStorage.removeItem('lastQueueNumber');
        yourQueueNumber = null;
        
        showNotification(`✅ Pesanan Terkirim! Mohon upload bukti pembayaran.`);
        showPage('history-page'); 
        
    } catch (error) {
        console.error('Error checkout:', error);
        showNotification(`❌ Gagal checkout: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// === FUNGSI HISTORY ===
async function loadOrderHistory() {
    if (!historyListContainer) return;
    historyListContainer.innerHTML = `<div class="loading" style="display: block;"><div class="spinner"></div><p>Memuat riwayat...</p></div>`;
    
    const orderIds = getOrderIdsFromLocalStorage();
    if (orderIds.length === 0) {
        historyListContainer.innerHTML = `<div class="empty-history"><p>Belum ada riwayat pesanan.</p></div>`;
        return;
    }
    
    try {
        const result = await supabaseClient.getOrdersByIds(orderIds);
        if (result.success) {
            renderOrderHistory(result.orders);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        historyListContainer.innerHTML = `<p style="text-align:center; color:red;">Gagal memuat riwayat.</p>`;
    }
}

async function handleProofUpload(event, itemIds) {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) return alert('Hanya file JPG/PNG!');
    if (!confirm("Upload screenshot bukti pembayaran?")) { event.target.value = ''; return; }

    showNotification("⏳ Mengupload bukti...");
    try {
        const uploadResult = await supabaseClient.uploadProofImage(file);
        if (!uploadResult.success) throw new Error(uploadResult.error);
        const updateResult = await supabaseClient.updateOrderProof(itemIds, uploadResult.url);
        if (!updateResult.success) throw new Error(updateResult.error);
        showNotification("✅ Bukti berhasil diupload!");
        loadOrderHistory();
    } catch (error) {
        showNotification(`❌ Upload gagal: ${error.message}`);
    }
}
window.handleProofUpload = handleProofUpload;

async function handleCancelOrderGroup(itemIds, customerName) {
    if (isProcessing) return;
    if (!confirm(`Batalkan pesanan untuk ${customerName}?`)) return;

    isProcessing = true;
    showNotification("Membatalkan pesanan...");
    try {
        const result = await supabaseClient.updateOrderStatusByIds(itemIds, 'cancelled');
        if (result.success) {
            showNotification("✅ Pesanan dibatalkan.");
            loadOrderHistory();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showNotification(`❌ Gagal batal: ${error.message}`);
    } finally {
        isProcessing = false;
    }
}
window.handleCancelOrderGroup = handleCancelOrderGroup;

function renderOrderHistory(orders) {
    const groupedOrders = {};
    for (const order of orders) {
        const groupKey = `${order.customer_name}_${order.sale_date}`;
        if (!groupedOrders[groupKey]) {
            groupedOrders[groupKey] = {
                key: groupKey, customer: order.customer_name, datetime: order.sale_date,
                items: [], total_amount: 0, status: 'mixed', queue_number: order.queue_number
            };
        }
        groupedOrders[groupKey].items.push(order);
        groupedOrders[groupKey].total_amount += order.total;
    }
    
    const sortedGroups = Object.values(groupedOrders).map(group => {
        const statuses = new Set(group.items.map(item => item.status));
        if (statuses.size === 1) group.status = statuses.values().next().value;
        else if (statuses.has('pending')) group.status = 'mixed';
        else if (statuses.has('confirmed')) group.status = 'confirmed';
        else group.status = 'cancelled';
        return group;
    }).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

    historyListContainer.innerHTML = '';
    
    // Refresh Button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'history-refresh-btn';
    refreshBtn.innerHTML = '🔄 Refresh Status';
    refreshBtn.onclick = loadOrderHistory;
    historyListContainer.appendChild(refreshBtn);

    if (sortedGroups.length === 0) {
        historyListContainer.innerHTML += `<p style="text-align:center;">Riwayat kosong.</p>`;
        return;
    }

    for (const group of sortedGroups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'history-group';
        
        let itemsHtml = group.items.map(item => `
            <div class="history-item">
                <div class="history-item-info">
                    <div class="history-item-name">${item.product_name}</div>
                    <div class="history-item-details">${item.quantity} x ${formatRupiah(item.price)}</div>
                </div>
                <span class="history-item-total">${formatRupiah(item.total)}</span>
            </div>
        `).join('');

        const readableDate = new Date(group.datetime).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const hasQueueNumber = (group.status === 'confirmed' || group.status === 'processing') && group.queue_number;
        const queueBadge = hasQueueNumber
            ? `<span style="background:var(--primary-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:5px;">Antrian #${group.queue_number}</span>` 
            : '';

        if (hasQueueNumber && sortedGroups.indexOf(group) === 0) {
             yourQueueNumber = group.queue_number;
             localStorage.setItem('lastQueueNumber', yourQueueNumber);
        }

        let actionButtonsHtml = '';
        if (group.status === 'pending' || group.status === 'mixed') {
            const itemIds = group.items.map(item => item.id);
            const existingProof = group.items.find(i => i.payment_proof_url)?.payment_proof_url;
            let uploadLabel = existingProof ? '📷 Ganti Bukti' : '📷 Upload Bukti';
            let proofStatus = existingProof 
                ? '<div class="proof-badge" style="background:#d4edda; color:#155724;">Bukti Terkirim ✅</div>' 
                : '<div class="proof-badge pending">Menunggu Pembayaran ⚠️</div>';

            actionButtonsHtml = `
                <div class="history-actions">
                    ${proofStatus}
                    <div class="action-row">
                        <input type="file" id="file-${group.key}" accept="image/*" style="display:none;" 
                               onchange='handleProofUpload(event, ${JSON.stringify(itemIds)})'>
                        <button class="btn-upload" onclick="document.getElementById('file-${group.key}').click()">
                            ${uploadLabel}
                        </button>
                        <button class="history-cancel-btn" onclick='handleCancelOrderGroup(${JSON.stringify(itemIds)}, "${group.customer}")'>
                            ❌ Batal
                        </button>
                    </div>
                </div>`;
        }

        let displayStatus = group.status === 'pending' || group.status === 'mixed' ? 'Menunggu Konfirmasi' : group.status;

        groupEl.innerHTML = `
            <div class="history-group-header">
                <div class="history-date">${readableDate}</div>
                <div class="history-customer">${group.customer} ${queueBadge}</div>
                <div class="history-status status-${group.status}">${displayStatus}</div>
            </div>
            <div class="history-items-list">${itemsHtml}</div>
            <div class="history-total">Total: ${formatRupiah(group.total_amount)}</div>
            ${actionButtonsHtml}
        `;
        historyListContainer.appendChild(groupEl);
    }
}

// === QUEUE DISPLAY ===
async function updateQueueDisplay() {
    try {
        yourQueueNumber = parseInt(localStorage.getItem('lastQueueNumber')) || null;
        const result = await supabaseClient.getQueueStatus();
        
        if (result.success) {
            const queueData = result.data;
            const currentQ = queueData.current_queue || '-';
            const currentQueueEl = document.getElementById('current-queue-number');
            if(currentQueueEl) currentQueueEl.textContent = currentQ;
            
            const yourQueueEl = document.getElementById('your-queue-number');
            const estimationEl = document.getElementById('queue-estimation');
            
            if (yourQueueEl) {
                if (yourQueueNumber) {
                    yourQueueEl.textContent = yourQueueNumber;
                    const isInList = queueData.queue_list.find(q => q.queue_number === yourQueueNumber);
                    
                    if (currentQ === yourQueueNumber) {
                        estimationEl.textContent = 'Giliran Anda! Silakan ke kasir/menunggu sajian.';
                        estimationEl.style.color = 'var(--primary-color)';
                        estimationEl.style.fontWeight = 'bold';
                    } else if (isInList) {
                        const peopleAhead = queueData.queue_list.filter(q => q.queue_number < yourQueueNumber && (q.status === 'confirmed' || q.status === 'processing')).length;
                        estimationEl.textContent = `Dalam Antrian (Menunggu ${peopleAhead} orang lagi)`;
                        estimationEl.style.color = 'var(--text-dark)';
                    } else {
                        estimationEl.textContent = 'Antrian Selesai atau Tidak Ditemukan.';
                        estimationEl.style.color = '#777';
                    }
                } else {
                    yourQueueEl.textContent = '-';
                    estimationEl.textContent = 'Pesanan Anda masih menunggu konfirmasi Admin.';
                    estimationEl.style.color = '#e67e22'; 
                }
            }
            renderQueueList(queueData.queue_list || []);
        }
    } catch (error) {
        console.error('Error updating queue:', error);
    }
}

function renderQueueList(queueList) {
    const queueListEl = document.getElementById('queue-list');
    if (!queueListEl) return;
    
    if (queueList.length === 0) {
        queueListEl.innerHTML = '<div class="empty-queue">Belum ada antrian yang dipanggil.</div>';
        return;
    }
    
    queueListEl.innerHTML = queueList.map(queue => {
        const isCurrent = queue.status === 'processing'; 
        const isYours = queue.queue_number === yourQueueNumber;
        let statusClass = queue.status === 'processing' ? 'processing' : 'confirmed';
        let statusText = queue.status === 'processing' ? 'Diproses' : 'Menunggu';
        
        return `
        <div class="queue-item ${isCurrent ? 'current' : ''} ${isYours ? 'yours' : ''}">
            <span class="queue-item-number">#${queue.queue_number}</span>
            <span class="queue-item-customer">${queue.customer_name}</span>
            <span class="queue-item-status status-${statusClass}">${statusText}</span>
        </div>`;
    }).join('');
}

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    if (pageId === 'history-page') loadOrderHistory();
    if (pageId === 'queue-page') updateQueueDisplay();
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 500);
        }
    }, 2000);
    
    // Setup Nav & Listeners
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            if (pageId) showPage(pageId);
        });
    });

    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            categoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            if (currentCategory === 'confirmation') showPage('orders-page');
            else {
                if (!document.getElementById('home-page').classList.contains('active')) showPage('home-page');
                renderProducts();
            }
        });
    });

    loadProducts();
    const confirmBtn = document.getElementById('confirm-order-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', processCheckout);
    const goPayBtn = document.getElementById('go-pay-btn');
    if (goPayBtn) goPayBtn.addEventListener('click', () => showPage('history-page'));
    const refreshQueueBtn = document.getElementById('refresh-queue-btn');
    if (refreshQueueBtn) refreshQueueBtn.addEventListener('click', updateQueueDisplay);
    if (searchInput) searchInput.addEventListener('input', renderProducts);
    if (searchOrders) searchOrders.addEventListener('input', renderProducts);
    
    setInterval(() => {
        const queuePage = document.getElementById('queue-page');
        if (queuePage && queuePage.classList.contains('active')) updateQueueDisplay();
    }, 5000);
});

window.loadProducts = loadProducts;
window.addToCart = addToCart;