// === STATE APLIKASI ===
let cart = [];
let products = [];
let isProcessing = false;
let currentCategory = 'all';
// State Antrian
let currentQueueNumber = null;
let yourQueueNumber = parseInt(localStorage.getItem('lastQueueNumber')) || null; // Persist antrian terakhir

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
        menuGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 3em;">😔</div>
                <h3>Menu tidak tersedia</h3>
                <p>Silakan refresh halaman atau coba lagi nanti.</p>
            </div>
        `;
        return;
    }
    
    // Filter produk
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
        menuGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #7f8c8d;">
                <div style="font-size: 3em;">🔍</div>
                <h3>Tidak ada hasil ditemukan</h3>
            </div>
        `;
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
                <button class="add-btn" data-code="${product.code}">
                    + Tambah
                </button>
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
        cartItemsDiv.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <p>Keranjang masih kosong.</p>
            </div>
        `;
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
            </div>
            `;
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
            code: product.code,
            name: product.name,
            price: parseFloat(product.price),
            qty: 1,
            total: parseFloat(product.price)
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

// === FUNGSI API (Supabase) ===
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
        showNotification('❌ Gagal memuat menu. Silakan refresh halaman.');
    }
}

// === CHECKOUT LOGIC (MODIFIED FOR QUEUE) ===
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
        const insertedOrders = [];
        const insertedOrderIds = [];

        // 1. DAPATKAN NOMOR ANTRIAN BARU
        // (Pastikan fungsi getNextQueueNumber ada di supabase-client.js nanti)
        const queueResult = await supabaseClient.getNextQueueNumber();
        if (!queueResult.success) {
            throw new Error("Gagal mendapatkan nomor antrian: " + queueResult.error);
        }
        
        yourQueueNumber = queueResult.queue_number;
        localStorage.setItem('lastQueueNumber', yourQueueNumber); // Simpan agar tahan refresh

        // 2. INSERT ITEMS DENGAN NOMOR ANTRIAN
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
                queue_number: yourQueueNumber // <--- TAMBAHAN PENTING
            };
            
            const result = await supabaseClient.createOrder(orderData);
            
            if (result.success) {
                insertedOrders.push(result.data.id);
                insertedOrderIds.push(result.data.id);
            } else {
                throw new Error(`Gagal menyimpan pesanan untuk ${item.name}: ${result.error}`);
            }
        }
        
        saveOrderIdsToLocalStorage(insertedOrderIds);
        
        // 3. SUKSES
        cart = [];
        renderCart();
        customerNameInput.value = '';
        notesInput.value = '';
        customerNameInput.classList.remove('input-error');
        
        // Update UI Success Page dengan nomor antrian
        const queueNumberDisplay = document.getElementById('queue-number');
        if (queueNumberDisplay) {
            queueNumberDisplay.textContent = yourQueueNumber;
        }
        
        showNotification(`✅ Order Berhasil! Antrian No: ${yourQueueNumber}`);
        showPage('success-page');
        
        // Refresh display antrian jika ada di background
        updateQueueDisplay();
        
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
    
    historyListContainer.innerHTML = `
        <div class="loading" style="display: block; padding-top: 20px;">
            <div class="spinner"></div>
            <p>Memuat riwayat pesanan...</p>
        </div>
    `;
    
    const orderIds = getOrderIdsFromLocalStorage();
    
    if (orderIds.length === 0) {
        historyListContainer.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📜</div>
                <p>Belum ada riwayat pesanan.</p>
            </div>`;
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
        console.error('Gagal memuat riwayat:', error);
        historyListContainer.innerHTML = `<p style="text-align:center; color:red;">Gagal memuat riwayat.</p>`;
    }
}

// Upload Bukti (Integrasi History)
async function handleProofUpload(event, itemIds) {
    const file = event.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        alert('Hanya file JPG/PNG!');
        return;
    }

    if (!confirm("Upload screenshot bukti pembayaran?")) {
        event.target.value = '';
        return;
    }

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

// Cancel Order (Integrasi History)
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
    // Grouping logic
    const groupedOrders = {};
    for (const order of orders) {
        const groupKey = `${order.customer_name}_${order.sale_date}`;
        if (!groupedOrders[groupKey]) {
            groupedOrders[groupKey] = {
                key: groupKey,
                customer: order.customer_name,
                datetime: order.sale_date,
                notes: order.notes,
                items: [],
                total_amount: 0,
                status: 'mixed',
                // Tambahkan queue_number ke grouping display jika ada
                queue_number: order.queue_number
            };
        }
        groupedOrders[groupKey].items.push(order);
        groupedOrders[groupKey].total_amount += order.total;
    }
    
    // Sorting & Status Logic
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

        // Tampilkan Nomor Antrian di Header History jika ada
        const queueBadge = group.queue_number 
            ? `<span style="background:var(--primary-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:5px;">Antrian #${group.queue_number}</span>` 
            : '';

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
                </div>
            `;
        }

        groupEl.innerHTML = `
            <div class="history-group-header">
                <div class="history-date">${readableDate}</div>
                <div class="history-customer">${group.customer} ${queueBadge}</div>
                <div class="history-status status-${group.status}">${group.status}</div>
            </div>
            <div class="history-items-list">${itemsHtml}</div>
            <div class="history-total">Total: ${formatRupiah(group.total_amount)}</div>
            ${actionButtonsHtml}
        `;
        historyListContainer.appendChild(groupEl);
    }
}

// === FUNGSI ANTRIAN (QUEUE LOGIC) - BARU ===
async function updateQueueDisplay() {
    try {
        const result = await supabaseClient.getQueueStatus();
        
        if (result.success) {
            const queueData = result.data;
            
            // Update Antrian Saat Ini
            const currentQueueEl = document.getElementById('current-queue-number');
            if (currentQueueEl) {
                // Jika 0 atau null, tampilkan '-'
                currentQueueEl.textContent = queueData.current_queue ? queueData.current_queue : '-';
            }
            
            // Update Antrian Anda (dari LocalStorage atau Checkout barusan)
            const yourQueueEl = document.getElementById('your-queue-number');
            if (yourQueueEl && yourQueueNumber) {
                yourQueueEl.textContent = yourQueueNumber;
                
                // Estimasi Waktu
                const estimationEl = document.getElementById('queue-estimation');
                if (estimationEl && queueData.current_queue) {
                    const current = queueData.current_queue;
                    const yours = yourQueueNumber;
                    
                    if (yours === current) {
                        estimationEl.textContent = 'Giliran Anda! Silakan ke kasir/menunggu dipanggil.';
                        estimationEl.style.color = 'var(--primary-color)';
                        estimationEl.style.fontWeight = 'bold';
                    } else if (yours > current) {
                        const diff = yours - current;
                        const estimatedTime = diff * 5; // Asumsi 5 menit per antrian
                        estimationEl.textContent = `Menunggu ${diff} antrian lagi (±${estimatedTime} menit)`;
                        estimationEl.style.color = 'var(--text-light)';
                    } else {
                        estimationEl.textContent = 'Antrian Anda sudah lewat.';
                        estimationEl.style.color = '#7f8c8d';
                    }
                } else {
                    if (estimationEl) estimationEl.textContent = 'Menunggu antrian dimulai...';
                }
            } else if (yourQueueEl) {
                yourQueueEl.textContent = '-';
            }
            
            // Render List Antrian
            renderQueueList(queueData.queue_list || []);
        }
    } catch (error) {
        console.error('Error updating queue:', error);
    }
}

function renderQueueList(queueList) {
    const queueListEl = document.getElementById('queue-list');
    if (!queueListEl) return;
    
    // Filter antrian yang statusnya pending atau processing saja untuk tampilan customer
    // dan urutkan
    const activeQueues = queueList.filter(q => 
        q.status === 'pending' || q.status === 'processing'
    ).sort((a, b) => a.queue_number - b.queue_number);

    if (activeQueues.length === 0) {
        queueListEl.innerHTML = '<div class="empty-queue">Tidak ada antrian yang menunggu.</div>';
        return;
    }
    
    // Ambil nomor antrian current dari DOM jika ada, untuk highlight
    const currentQText = document.getElementById('current-queue-number')?.textContent;
    const currentQ = parseInt(currentQText) || 0;

    queueListEl.innerHTML = activeQueues.map(queue => {
        const isCurrent = queue.queue_number === currentQ;
        const isYours = queue.queue_number === yourQueueNumber;
        
        let statusClass = 'pending';
        if (queue.status === 'processing') statusClass = 'processing';
        
        return `
        <div class="queue-item ${isCurrent ? 'current' : ''} ${isYours ? 'yours' : ''}">
            <span class="queue-item-number">#${queue.queue_number}</span>
            <span class="queue-item-customer">${queue.customer_name}</span>
            <span class="queue-item-status status-${statusClass}">${queue.status}</span>
        </div>
        `;
    }).join('');
}

// === NAVIGASI ===
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.add('active');

    // Trigger loads based on page
    if (pageId === 'history-page') loadOrderHistory();
    if (pageId === 'queue-page') updateQueueDisplay();
    
    // Update nav icons
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const activeNavItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNavItem) activeNavItem.classList.add('active');
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            if (pageId) showPage(pageId);
        });
    });
}

function setupCategoryFilter() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            categoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentCategory = this.getAttribute('data-category');
            
            if (currentCategory === 'confirmation') {
                showPage('orders-page');
            } else {
                if (!document.getElementById('home-page').classList.contains('active')) {
                    showPage('home-page');
                }
                renderProducts();
            }
        });
    });
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('App Started');
    
    // Splash
    setTimeout(function() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 500);
        }
    }, 2000);
    
    setupNavigation();
    setupCategoryFilter();
    loadProducts(); // Load Menu awal
    
    // Event Listeners
    const confirmBtn = document.getElementById('confirm-order-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', processCheckout);
    
    const goPayBtn = document.getElementById('go-pay-btn');
    if (goPayBtn) {
        goPayBtn.addEventListener('click', () => {
            showPage('queue-page'); // Arahkan ke halaman antrian setelah sukses
        });
    }

    const refreshQueueBtn = document.getElementById('refresh-queue-btn');
    if (refreshQueueBtn) {
        refreshQueueBtn.addEventListener('click', () => {
            updateQueueDisplay();
            showNotification('🔄 Status antrian diperbarui');
        });
    }
    
    if (searchInput) searchInput.addEventListener('input', renderProducts);
    if (searchOrders) searchOrders.addEventListener('input', renderProducts);
    
    // Load queue data awal jika ada lastQueueNumber
    if (yourQueueNumber) {
        console.log("Welcome back queue #" + yourQueueNumber);
    }
    
    // Auto-refresh queue setiap 10 detik jika di halaman queue
    setInterval(() => {
        const queuePage = document.getElementById('queue-page');
        if (queuePage && queuePage.classList.contains('active')) {
            updateQueueDisplay();
        }
    }, 10000);
});

// Window exposure
window.loadProducts = loadProducts;
window.addToCart = addToCart;