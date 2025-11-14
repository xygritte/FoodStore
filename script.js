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

// === FUNGSI HELPER ===
function formatRupiah(value) {
    value = parseInt(value, 10);
    return "Rp " + value.toLocaleString('id-ID');
}

function showLoading() {
    // Implementasi loading jika diperlukan
    isProcessing = true;
}

function hideLoading() {
    isProcessing = false;
}

function validateCustomerName(name) {
    const trimmedName = name.trim();
    return trimmedName.length > 0 && 
            trimmedName !== "Customer" && 
            trimmedName !== "0" &&
            trimmedName !== "Pelanggan";
}

// === FUNGSI RENDER ===
function renderProducts() {
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
                    <span>${item.qty}</span>
                    <span>${formatRupiah(item.total)}</span>
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
    document.title = totalItems > 0 ? `(${totalItems}) Waring Bicem - Order Makanan` : 'Waring Bicem - Order Makanan';
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

// === FUNGSI API (DATABASE) ===
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
            } else {
                throw new Error(`Gagal menyimpan pesanan untuk ${item.name}: ${result.error}`);
            }
        }
        
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

// === FUNGSI NAVIGASI ===
function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
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
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(function() {
            document.getElementById('splash-screen').style.display = 'none';
        }, 500);
    }, 2500);
    
    // Setup navigation
    setupNavigation();
    setupCategoryFilter();
    
    // Load data
    loadProducts();
    
    
    
    document.getElementById('confirm-order-btn').addEventListener('click', processCheckout);
    
    document.getElementById('go-back-btn').addEventListener('click', () => {
        showPage('home-page');
    });
    
    // Search functionality
    searchInput.addEventListener('input', renderProducts);
    searchOrders.addEventListener('input', renderProducts);
    
    // Enter key in customer name
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
            this.classList.add('input-error');
        }
    });
    
    console.log('Aplikasi siap digunakan');
});

// Handle page visibility change
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadProducts();
    }
});

// Global function for retry
window.loadProducts = loadProducts;
window.addToCart = addToCart;