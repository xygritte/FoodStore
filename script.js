// === STATE APLIKASI ===
let cart = [];
let products = [];
let isProcessing = false;
let currentCategory = 'all';

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
// === TAMBAHAN BARU (History) ===
const historyListContainer = document.getElementById('history-list-container');


// === FUNGSI HELPER ===
function formatRupiah(value) {
    value = parseInt(value, 10);
    if (isNaN(value)) value = 0; // Menangani jika value bukan angka
    return "Rp " + value.toLocaleString('id-ID');
}

function showLoading() {
    // Implementasi loading jika diperlukan
    isProcessing = true;
    // (Misal: document.getElementById('checkout-btn').disabled = true;)
}

function hideLoading() {
    isProcessing = false;
    // (Misal: document.getElementById('checkout-btn').disabled = false;)
}

function validateCustomerName(name) {
    const trimmedName = name.trim();
    return trimmedName.length > 0 && 
            trimmedName !== "Customer" && 
            trimmedName !== "0" &&
            trimmedName !== "Pelanggan";
}

// === TAMBAHAN BARU (History - LocalStorage) ===
const LOCAL_STORAGE_KEY = 'warungBiEemOrderIds';

function getOrderIdsFromLocalStorage() {
    try {
        const idsJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (idsJson) {
            const ids = JSON.parse(idsJson);
            // Pastikan itu array angka
            return Array.isArray(ids) ? ids.map(Number).filter(id => !isNaN(id)) : [];
        }
        return [];
    } catch (e) {
        console.error("Gagal parse ID pesanan dari localStorage", e);
        return [];
    }
}

function saveOrderIdsToLocalStorage(newOrderIds) {
    if (!newOrderIds || newOrderIds.length === 0) return;
    
    try {
        const existingIds = getOrderIdsFromLocalStorage();
        // Gunakan Set untuk menghindari duplikat, lalu ubah kembali ke array
        const combinedIds = [...new Set([...existingIds, ...newOrderIds])];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combinedIds));
    } catch (e) {
        console.error("Gagal menyimpan ID pesanan ke localStorage", e);
    }
}
// === AKHIR TAMBAHAN (History) ===


// === FUNGSI RENDER ===
function renderProducts() {
    if (!menuGrid) return; // Penjagaan jika elemen tidak ada
    
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
    
    // Filter produk berdasarkan kategori
    let filteredProducts = products;
    if (currentCategory === 'food') {
        filteredProducts = products.filter(product => product.code.startsWith('MK'));
    } else if (currentCategory === 'beverage') {
        filteredProducts = products.filter(product => product.code.startsWith('MN'));
    }
    
    // Filter produk berdasarkan pencarian
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
                <p>Coba kata kunci lain atau lihat kategori berbeda.</p>
            </div>
        `;
        return;
    }
    
    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'menu-item';
        card.innerHTML = `
            <div class="menu-image">${product.code.startsWith('MK') ? '🍔' : '🥤'}</div>
            <div class.info">
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
    if (!cartItemsDiv) return; // Penjagaan
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <p>Keranjang masih kosong.</p>
            </div>
        `;
        totalAmountEl.textContent = 'Rp 0';
        totalPriceDisplay.textContent = 'Rp 0';
        
        // Update cart badge
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
    
    // Update cart badge
    updateCartBadge(totalItems);
    
    // Update cart counter in tab title
    document.title = totalItems > 0 ? `(${totalItems}) Warung Bi Eem` : 'Warung Bi Eem';
}

function updateCartBadge(totalItems) {
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        if (totalItems === 0) {
            cartBadge.style.display = 'none';
        } else {
            cartBadge.style.display = 'flex';
        }
    }
}

// === FUNGSI LOGIKA (CART) ===
function addToCart(product) {
    if (!product) {
        console.error('Product tidak ditemukan');
        return;
    }
    
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

function clearCart() {
    if (cart.length === 0) {
        showNotification("Keranjang sudah kosong!");
        return;
    }
    
    if (confirm("Apakah Anda yakin ingin mengosongkan keranjang?")) {
        cart = [];
        renderCart();
        showNotification("Keranjang berhasil dikosongkan");
    }
}

function showNotification(message) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// === FUNGSI API (SUPABASE) ===
async function loadProducts() {
    try {
        console.log('Memuat produk dari Supabase...');
        const result = await supabaseClient.getProducts();
        
        if (result.success) {
            products = result.products;
            renderProducts();
            console.log(`Berhasil memuat ${products.length} produk`);
        } else {
            throw new Error(result.error || 'Gagal memuat produk');
        }
    } catch (error) {
        console.error('Error memuat produk:', error);
        showNotification('❌ Gagal memuat menu. Silakan refresh halaman.');
        
        if (menuGrid) {
            menuGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #e74c3c;">
                    <div style="font-size: 3em;">⚠️</div>
                    <h3>Gagal memuat menu</h3>
                    <p>${error.message}</p>
                    <button onclick="loadProducts()" style="background: var(--primary-color); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                        🔄 Coba Lagi
                    </button>
                </div>
            `;
        }
    }
}

async function processCheckout() {
    if (isProcessing) return;
    
    const customerName = customerNameInput.value.trim();
    const notes = notesInput.value.trim();

    // VALIDASI
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
        const insertedOrderIds = []; // <-- TAMBAHAN BARU (History)

        // Insert each cart item as separate order
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
                status: 'pending'
            };
            
            const result = await supabaseClient.createOrder(orderData);
            
            if (result.success) {
                insertedOrders.push(result.data.id);
                insertedOrderIds.push(result.data.id); // <-- TAMBAHAN BARU (History)
            } else {
                throw new Error(`Gagal menyimpan pesanan untuk ${item.name}: ${result.error}`);
            }
        }
        
        // --- TAMBAHAN BARU (History) ---
        // Simpan ID pesanan baru ke localStorage
        saveOrderIdsToLocalStorage(insertedOrderIds);
        // --- AKHIR TAMBAHAN ---
        
        // Success
        cart = [];
        renderCart();
        customerNameInput.value = '';
        notesInput.value = '';
        customerNameInput.classList.remove('input-error');
        
        showNotification(`✅ PESANAN BERHASIL! ${insertedOrders.length} item diproses.`);
        showPage('success-page');
        
        console.log('Checkout berhasil:', insertedOrders);
        
    } catch (error) {
        console.error('Error checkout:', error);
        showNotification(`❌ Gagal checkout: ${error.message}`);
    } finally {
        hideLoading();
    }
}


// ======================================================
// === FUNGSI LOGIKA (HISTORY) - TAMBAHAN BARU ===
// ======================================================

async function loadOrderHistory() {
    if (!historyListContainer) return;
    
    // Tampilkan loading spinner
    historyListContainer.innerHTML = `
        <div class="loading" style="display: block; padding-top: 20px;">
            <div class="spinner"></div>
            <p>Memuat riwayat pesanan...</p>
        </div>
    `;
    
    const orderIds = getOrderIdsFromLocalStorage();
    
    if (orderIds.length === 0) {
        renderOrderHistory([], 'empty');
        return;
    }
    
    try {
        const result = await supabaseClient.getOrdersByIds(orderIds);
        if (result.success) {
            renderOrderHistory(result.orders, 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Gagal memuat riwayat:', error);
        renderOrderHistory([], 'error');
    }
}

function renderOrderHistory(orders, status) {
    if (status === 'empty') {
        historyListContainer.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📜</div>
                <p>Anda belum memiliki riwayat pesanan di perangkat ini.</p>
            </div>
        `;
        return;
    }
    
    if (status === 'error') {
        historyListContainer.innerHTML = `
            <div class="empty-history" style="color: #e74c3c;">
                <div class="empty-history-icon">⚠️</div>
                <p>Gagal memuat riwayat pesanan Anda.</p>
                <button class="history-refresh-btn" style="background-color: #e74c3c; margin-top: 15px;" onclick="loadOrderHistory()">Coba Lagi</button>
            </div>
        `;
        return;
    }
    
    // Kelompokkan pesanan berdasarkan sale_date + customer_name (kunci "sesi")
    const groupedOrders = {};
    for (const order of orders) {
        // Kunci grup adalah waktu penjualan dan nama pelanggan
        const groupKey = `${order.customer_name}_${order.sale_date}`;
        if (!groupedOrders[groupKey]) {
            groupedOrders[groupKey] = {
                customer: order.customer_name,
                datetime: order.sale_date,
                notes: order.notes, // Catatan sudah diambil di sini
                items: [],
                total_amount: 0,
                status: 'mixed' // Status default
            };
        }
        
        groupedOrders[groupKey].items.push(order);
        groupedOrders[groupKey].total_amount += order.total;
    }
    
    // Tentukan status grup dan urutkan grup
    const sortedGroups = Object.values(groupedOrders).map(group => {
        const statuses = new Set(group.items.map(item => item.status));
        if (statuses.size === 1) {
            group.status = statuses.values().next().value; // Hanya ada satu status
        } else if (statuses.has('pending')) {
            group.status = 'mixed'; // Jika ada yg pending, statusnya mixed
        } else if (statuses.has('confirmed')) {
            group.status = 'confirmed'; // Jika tidak ada yg pending, tapi ada yg confirmed
        } else {
            group.status = 'cancelled'; // Jika semuanya cancelled
        }
        return group;
    }).sort((a, b) => new Date(b.datetime) - new Date(a.datetime)); // Urutkan, terbaru di atas

    // Bersihkan kontainer
    historyListContainer.innerHTML = '';
    
    // Tambahkan tombol refresh
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'history-refresh-btn';
    refreshBtn.innerHTML = '🔄 Refresh Status Pesanan';
    refreshBtn.onclick = loadOrderHistory;
    historyListContainer.appendChild(refreshBtn);
    
    if (sortedGroups.length === 0) {
         historyListContainer.innerHTML += `
            <div class="empty-history">
                <div class="empty-history-icon">📜</div>
                <p>Riwayat pesanan tidak ditemukan.</p>
            </div>
        `;
        return;
    }

    // Render setiap grup pesanan
    for (const group of sortedGroups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'history-group';
        
        let itemsHtml = '';
        for (const item of group.items) {
            itemsHtml += `
                <div class="history-item">
                    <div class="history-item-info">
                        <div class="history-item-name">${item.product_name}</div>
                        <div class="history-item-details">
                            ${item.quantity} x ${formatRupiah(item.price)}
                        </div>
                    </div>
                    <span class="history-item-total" style="font-weight: normal; color: #333;">${formatRupiah(item.total)}</span>
                </div>
            `;
        }

        const readableDate = new Date(group.datetime).toLocaleString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // --- INI PERUBAHANNYA ---
        // Buat blok HTML untuk catatan HANYA JIKA ada catatan
        let notesHtml = '';
        if (group.notes && group.notes.trim() !== '') {
            // Kita gunakan <pre> agar format baris baru dari catatan tetap tampil
            notesHtml = `
                <div class="history-notes">
                    <strong>Catatan:</strong>
                    <pre class="history-notes-text">${group.notes}</pre>
                </div>
            `;
        }
        // --- AKHIR PERUBAHAN ---
        
        groupEl.innerHTML = `
            <div class="history-group-header">
                <div class="history-date">${readableDate}</div>
                <div class="history-customer">${group.customer}</div>
                <div class="history-status status-${group.status}">${group.status}</div>
            </div>
            <div class="history-items-list">
                ${itemsHtml}
            </div>
            ${notesHtml} <div class="history-total">
                Total: ${formatRupiah(group.total_amount)}
            </div>
        `;
        historyListContainer.appendChild(groupEl);
    }
}
// === AKHIR FUNGSI (History) ===


// === FUNGSI NAVIGASI ===
function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    // Show selected page
    // --- MODIFIKASI DIMULAI ---
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.classList.add('active');
    }

    // Muat riwayat jika menavigasi ke halaman riwayat
    if (pageId === 'history-page') {
        loadOrderHistory();
    }
    // --- MODIFIKASI SELESAI ---
    
    // Update navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Find and activate corresponding nav item
    const activeNavItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
}

function setupNavigation() {
    // Navigation between pages
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            if (pageId) {
                showPage(pageId);
            }
        });
    });
}

function setupCategoryFilter() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active category button
            categoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update current category and re-render products
            currentCategory = this.getAttribute('data-category');
            
            // If clicking on orders category, go to orders page
            if (currentCategory === 'confirmation') {
                showPage('orders-page');
            } else {
                // Otherwise, stay on home page and filter products
                if (!document.getElementById('home-page').classList.contains('active')) {
                    showPage('home-page');
                }
                renderProducts();
            }
        });
    });
}

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('Aplikasi dimulai...');
    
    // Splash screen timeout
    setTimeout(function() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(function() {
                splash.style.display = 'none';
            }, 500);
        }
    }, 2500);
    
    // Setup navigation
    setupNavigation();
    setupCategoryFilter();
    
    // Load data
    loadProducts();
    
    
    const confirmBtn = document.getElementById('confirm-order-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', processCheckout);
    }
    
    const goBackBtn = document.getElementById('go-back-btn');
    if (goBackBtn) {
        goBackBtn.addEventListener('click', () => {
            showPage('home-page');
        });
    }
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', renderProducts);
    }
    if (searchOrders) {
        // Seharusnya ini memfilter keranjang, bukan produk. 
        // Untuk saat ini, saya biarkan sesuai kode asli Anda (memfilter produk).
        searchOrders.addEventListener('input', renderProducts); 
    }
    
    // Enter key in customer name
    if (customerNameInput) {
        customerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                processCheckout();
            }
        });

        // Validasi real-time pada input customer name
        customerNameInput.addEventListener('input', function() {
            const value = this.value.trim();
            if (validateCustomerName(value)) {
                this.classList.remove('input-error');
            } else {
                // Jangan tambahkan error jika masih kosong,
                // hanya jika sudah diisi tapi tidak valid
                if (value.length > 0) {
                     this.classList.add('input-error');
                } else {
                     this.classList.remove('input-error');
                }
            }
        });
    }
    
    console.log('Aplikasi siap digunakan');
});

// Handle page visibility change
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Refresh produk saat tab aktif kembali
        loadProducts();
        
        // Refresh juga riwayat jika sedang di halaman riwayat
        if (document.getElementById('history-page')?.classList.contains('active')) {
            loadOrderHistory();
        }
    }
});

// Global function for retry
window.loadProducts = loadProducts;
window.addToCart = addToCart;
window.loadOrderHistory = loadOrderHistory; // <-- TAMBAHAN BARU