document.addEventListener('DOMContentLoaded', () => {

    // === GLOBAL STATE ===
    let orders = [];
    let products = [];
    let groupedOrders = {};
    let autoRefresh = true;
    let autoRefreshTimer = null;
    let selectedOrders = new Set();
    const REFRESH_INTERVAL = 5000; // 5 detik

    // === ELEMENT SELECTORS ===
    // Navigasi
    const tabButtons = document.querySelectorAll('.tab-btn');
    const mobileTabButtons = document.querySelectorAll('.mobile-tab-btn');
    const pages = document.querySelectorAll('.page');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusBar = document.getElementById('status-bar');
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');

    // Halaman Pesanan
    const ordersPage = document.getElementById('orders-page');
    const ordersTableBody = document.getElementById('orders-table-body');
    const ordersLoading = document.getElementById('orders-loading');
    const ordersNoData = document.getElementById('orders-no-data');
    const statusFilter = document.getElementById('status-filter');
    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    const confirmOrderBtn = document.getElementById('confirm-order-btn');
    const cancelOrderBtn = document.getElementById('cancel-order-btn');
    const viewOrderBtn = document.getElementById('view-order-btn');
    const printOrderBtn = document.getElementById('print-order-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectedCount = document.getElementById('selected-count');
    const selectedInfo = document.getElementById('selected-info');

    // Dashboard Stats
    const statTotalSales = document.getElementById('stat-total-sales');
    const statTotalSold = document.getElementById('stat-total-sold');
    const statPendingOrders = document.getElementById('stat-pending-orders');
    const statConfirmedOrders = document.getElementById('stat-confirmed-orders');

    // Halaman Produk
    const productsPage = document.getElementById('products-page');
    const productsTableBody = document.getElementById('products-table-body');
    const productsLoading = document.getElementById('products-loading');
    const productsNoData = document.getElementById('products-no-data');
    const productForm = document.getElementById('product-form');
    const productIdInput = document.getElementById('product-id');
    const productNameInput = document.getElementById('product-name');
    const productPriceInput = document.getElementById('product-price');
    const productCodeInput = document.getElementById('product-code');
    const generateCodeBtn = document.getElementById('generate-code-btn');
    const saveProductBtn = document.getElementById('save-product-btn');
    const clearFormBtn = document.getElementById('clear-form-btn');
    const refreshProductsBtn = document.getElementById('refresh-products-btn');
    const deleteProductBtn = document.getElementById('delete-product-btn');

    // Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // === HELPER FUNCTIONS ===
    const showLoading = (msg = null) => {
        loadingOverlay.classList.add('active');
        if (msg) updateStatus(msg);
    };
    
    const hideLoading = () => loadingOverlay.classList.remove('active');
    
    const updateStatus = (message, isError = false) => {
        statusBar.textContent = message;
        statusBar.style.color = isError ? 'var(--danger-color)' : 'var(--secondary-text)';
    };

    const formatRupiah = (value) => {
        value = parseInt(value, 10) || 0;
        return "Rp " + value.toLocaleString('id-ID');
    };

    // === NAVIGATION LOGIC ===
    const showPage = (pageId) => {
        pages.forEach(page => page.classList.remove('active'));
        tabButtons.forEach(btn => btn.classList.remove('active'));
        mobileTabButtons.forEach(btn => btn.classList.remove('active'));

        document.getElementById(pageId)?.classList.add('active');
        document.querySelector(`.tab-btn[data-page="${pageId}"]`)?.classList.add('active');
        document.querySelector(`.mobile-tab-btn[data-page="${pageId}"]`)?.classList.add('active');
        
        // Tutup mobile nav jika terbuka
        mobileNav.classList.remove('active');
        
        // Muat data saat tab diaktifkan (jika data kosong)
        if (pageId === 'orders-page' && orders.length === 0) {
            loadOrders();
        } else if (pageId === 'products-page' && products.length === 0) {
            loadProducts();
        }
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    mobileTabButtons.forEach(btn => {
        btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
    });

    // === CHECKLIST SELECTION FUNCTIONS ===
    
    const updateSelectedInfo = () => {
        selectedCount.textContent = selectedOrders.size;
        
        if (selectedOrders.size > 0) {
            selectedInfo.style.display = 'inline-block';
        } else {
            selectedInfo.style.display = 'none';
        }
    };

    const toggleSelectAll = () => {
        const checkboxes = document.querySelectorAll('.order-checkbox');
        
        if (selectAllCheckbox.checked) {
            // Pilih semua
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                const groupKey = checkbox.dataset.groupKey;
                selectedOrders.add(groupKey);
            });
        } else {
            // Hapus semua pilihan
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            selectedOrders.clear();
        }
        
        updateSelectedInfo();
    };

    const toggleOrderSelection = (checkbox) => {
        const groupKey = checkbox.dataset.groupKey;
        
        if (checkbox.checked) {
            selectedOrders.add(groupKey);
        } else {
            selectedOrders.delete(groupKey);
            
            // Pastikan checkbox "pilih semua" tidak tercentang jika ada yang tidak dipilih
            selectAllCheckbox.checked = false;
        }
        
        updateSelectedInfo();
    };

    const clearAllSelections = () => {
        selectedOrders.clear();
        
        const checkboxes = document.querySelectorAll('.order-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        selectAllCheckbox.checked = false;
        
        updateSelectedInfo();
    };

    const selectAllOrders = () => {
        selectAllCheckbox.checked = true;
        toggleSelectAll();
    };

    // === DATA LOADING & PROCESSING (ORDERS) ===
    
    /**
     * Memuat semua pesanan dari Supabase
     */
    async function loadOrders() {
        ordersLoading.style.display = 'block';
        ordersNoData.style.display = 'none';
        ordersTableBody.innerHTML = '';
        updateStatus('Memuat data pesanan...');
        
        try {
            // Kita ambil semua pesanan, diurutkan terbaru dulu
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .order('sale_date', { ascending: false });

            if (error) throw error;
            
            orders = data || [];
            groupOrders(); // Kelompokkan pesanan
            renderOrders(); // Tampilkan ke tabel
            updateDashboardStats(); // Update statistik
            
            const timestamp = new Date().toLocaleTimeString('id-ID');
            updateStatus(`✅ Data pesanan terupdate ${timestamp} - ${orders.length} item`);
            
        } catch (error) {
            console.error('Error memuat pesanan:', error);
            updateStatus(`❌ Error memuat pesanan: ${error.message}`, true);
        } finally {
            ordersLoading.style.display = 'none';
            
            // Tampilkan pesan "tidak ada data" jika diperlukan
            if (orders.length === 0) {
                ordersNoData.style.display = 'block';
            }
        }
    }

    /**
     * Mengelompokkan pesanan individu berdasarkan customer + waktu (Mirip admin.py)
     */
    function groupOrders() {
        groupedOrders = {};
        for (const order of orders) {
            const customer = order.customer_name || 'Unknown';
            // Ambil hingga menit, abaikan detik/milidetik untuk pengelompokan
            const sale_date = order.sale_date.substring(0, 16); 
            const groupKey = `${customer}_${sale_date}`;
            
            if (!groupedOrders[groupKey]) {
                groupedOrders[groupKey] = {
                    key: groupKey,
                    customer: customer,
                    datetime: order.sale_date,
                    items: [],
                    total_amount: 0,
                    status: 'mixed',
                    notes: order.notes || '',
                    order_ids: []
                };
            }
            
            groupedOrders[groupKey].items.push(order);
            groupedOrders[groupKey].total_amount += order.total || 0;
            groupedOrders[groupKey].order_ids.push(order.id);
        }

        // Pass kedua: Tentukan status grup
        for (const key in groupedOrders) {
            const group = groupedOrders[key];
            const statuses = new Set(group.items.map(item => item.status || 'pending'));
            
            if (statuses.size === 1) {
                group.status = statuses.values().next().value;
            } else if (statuses.has('pending')) {
                group.status = 'mixed'; // Jika ada yg pending, anggap mixed
            } else {
                group.status = 'mixed'; // Default
            }
        }
    }

    /**
     * Menampilkan pesanan yang sudah dikelompokkan ke tabel
     */
    function renderOrders() {
        ordersTableBody.innerHTML = ''; // Kosongkan tabel
        const filter = statusFilter.value;
        const newRowElements = []; // Tampung elemen baru

        // Urutkan grup berdasarkan tanggal (sudah terurut dari 'loadOrders')
        const sortedGroups = Object.values(groupedOrders);
        
        if (sortedGroups.length === 0) {
            ordersNoData.style.display = 'block';
            return;
        }

        sortedGroups.forEach(group => {
            // Logika filter
            const status = group.status;
            if (filter !== 'semua') {
                if (filter === 'pending' && (status !== 'pending' && status !== 'mixed')) {
                    return; // Lewati jika filter 'pending' tapi status bukan 'pending'/'mixed'
                } else if (filter !== 'pending' && filter !== status) {
                    return; // Lewati jika status tidak cocok
                }
            }

            const tr = document.createElement('tr');
            tr.dataset.groupKey = group.key; // Simpan key di DOM
            
            const notesDisplay = (group.notes.length > 50) ? group.notes.substring(0, 50) + '...' : group.notes;
            const readableDate = new Date(group.datetime).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const isSelected = selectedOrders.has(group.key);

            tr.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="order-checkbox" data-group-key="${group.key}" ${isSelected ? 'checked' : ''}>
                </td>
                <td>${readableDate}</td>
                <td>${group.customer}</td>
                <td>${group.items.length} item(s)</td>
                <td>${formatRupiah(group.total_amount)}</td>
                <td><span class="status-tag status-${group.status}">${group.status}</span></td>
                <td>${notesDisplay}</td>
            `;

            // Tambahkan event listener untuk checkbox
            const checkbox = tr.querySelector('.order-checkbox');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation(); // Mencegah event bubbling ke baris
                toggleOrderSelection(checkbox);
            });

            // Tambahkan event listener untuk memilih baris
            tr.addEventListener('click', (e) => {
                // Jangan toggle selection jika klik berasal dari checkbox
                if (e.target.type !== 'checkbox') {
                    // Hapus .selected dari semua baris lain jika Shift tidak ditekan
                    if (!e.shiftKey) {
                        tr.parentElement.querySelectorAll('tr.selected').forEach(row => {
                            if (row !== tr) row.classList.remove('selected');
                        });
                    }
                    tr.classList.toggle('selected');
                    
                    // Toggle checkbox saat baris diklik
                    checkbox.checked = !checkbox.checked;
                    toggleOrderSelection(checkbox);
                }
            });

            newRowElements.push(tr);
        });

        // Tambahkan semua baris baru ke tabel
        ordersTableBody.append(...newRowElements);
    }

    /**
     * Helper untuk mendapatkan key dari baris yang dipilih
     */
    function getSelectedRowKeys(tableBody) {
        return [...tableBody.querySelectorAll('tr.selected')].map(tr => tr.dataset.groupKey);
    }
    
    /**
     * Helper untuk mendapatkan ID produk dari baris yang dipilih
     */
    function getSelectedProductIds(tableBody) {
         return [...tableBody.querySelectorAll('tr.selected')].map(tr => tr.dataset.productId);
    }

    /**
     * Memperbarui statistik dashboard
     */
    function updateDashboardStats() {
        let totalSales = 0;
        let totalSold = 0;
        let pendingCount = 0;
        let confirmedCount = 0;

        for (const order of orders) {
            const status = order.status || 'pending';
            if (status === 'confirmed') {
                totalSales += order.total || 0;
                totalSold += order.quantity || 0;
                confirmedCount += 1;
            } else if (status === 'pending') {
                pendingCount += 1;
            }
        }
        
        statTotalSales.textContent = formatRupiah(totalSales);
        statTotalSold.textContent = `${totalSold} pcs`;
        statPendingOrders.textContent = `${pendingCount} item`;
        statConfirmedOrders.textContent = `${confirmedCount} item`;
    }

    // === ORDER ACTIONS ===
    
    /**
     * Mengupdate status pesanan (Konfirmasi / Batal)
     */
    async function updateOrderStatus(newStatus) {
        if (selectedOrders.size === 0) {
            alert(`Pilih satu atau lebih pesanan untuk di-${newStatus}.`);
            return;
        }

        const actionText = (newStatus === 'confirmed') ? 'mengkonfirmasi' : 'membatalkan';
        if (!confirm(`Anda yakin ingin ${actionText} ${selectedOrders.size} grup pesanan ini?`)) {
            return;
        }
        
        showLoading(`Sedang ${actionText} pesanan...`);
        
        // Kumpulkan semua ID item dari grup yang dipilih
        let allItemIds = [];
        selectedOrders.forEach(key => {
            if (groupedOrders[key]) {
                allItemIds.push(...groupedOrders[key].order_ids);
            }
        });

        if (allItemIds.length === 0) {
            hideLoading();
            alert('Gagal mendapatkan ID item pesanan.');
            return;
        }
        
        try {
            // Update status pesanan
            const { data, error } = await supabase
                .from('sales')
                .update({ 
                    status: newStatus,
                    ...(newStatus === 'confirmed' && { confirmed_at: new Date().toISOString() })
                })
                .in('id', allItemIds)
                .select();

            if (error) throw error;
            
            updateStatus(`✅ Berhasil: ${data.length} item telah di-${newStatus}.`);
            await loadOrders(); // Muat ulang data
            clearAllSelections(); // Bersihkan pilihan setelah update
            
        } catch (error) {
            console.error(`Gagal ${actionText} pesanan:`, error);
            updateStatus(`❌ Gagal ${actionText} pesanan: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    /**
     * Menampilkan detail pesanan di modal
     */
    function viewOrderDetails() {
        if (selectedOrders.size !== 1) {
            alert('Pilih HANYA SATU pesanan untuk dilihat detailnya.');
            return;
        }
        
        const groupKey = Array.from(selectedOrders)[0];
        const group = groupedOrders[groupKey];
        
        if (!group) {
            alert('Data pesanan tidak ditemukan.');
            return;
        }

        let details = `
        👤 CUSTOMER: ${group.customer}
        🕒 WAKTU PESAN: ${new Date(group.datetime).toLocaleString('id-ID')}
        ✅ STATUS GRUP: ${group.status.toUpperCase()}
        🔢 JUMLAH ITEM: ${group.items.length}

        📦 ITEM PESANAN:
        --------------------------------\n`;

        group.items.forEach((item, index) => {
            details += `
        ${index + 1}. ${item.product_name} (${item.product_code})
           Status Item: ${item.status}
           Qty: ${item.quantity} x ${formatRupiah(item.price)}
           Subtotal: ${formatRupiah(item.total)}
        \n`;
        });
        
        details += `
        --------------------------------
        💵 TOTAL: ${formatRupiah(group.total_amount)}
        
        📝 CATATAN:
        ${group.notes || 'Tidak ada catatan'}
        `;

        modalTitle.textContent = 'Detail Group Pesanan';
        modalBody.textContent = details;
        modalOverlay.classList.add('active');
    }

    /**
     * Menampilkan struk untuk di-print di modal
     */
    function printOrder() {
        if (selectedOrders.size !== 1) {
            alert('Pilih HANYA SATU pesanan untuk di-print.');
            return;
        }
        
        const groupKey = Array.from(selectedOrders)[0];
        const group = groupedOrders[groupKey];
        
        if (!group) {
            alert('Data pesanan tidak ditemukan.');
            return;
        }

        // Helper untuk formatting struk
        const pad = (str, len, char = ' ') => String(str).padEnd(len, char);
        const rpad = (str, len, char = ' ') => String(str).padStart(len, char);

        let details = "      WARUNG BIEEM - STRUK PESANAN      \n";
        details += "========================================\n";
        details += `CUSTOMER: ${group.customer}\n`;
        details += `WAKTU   : ${new Date(group.datetime).toLocaleString('id-ID')}\n`;
        details += `STATUS  : ${group.status.toUpperCase()}\n`;
        details += "----------------------------------------\n\n";
        details += "ITEM PESANAN:\n";

        group.items.forEach(item => {
            const name = item.product_name.substring(0, 20);
            const qtyPrice = `${item.quantity}x ${rpad(formatRupiah(item.price), 10)}`;
            const total = rpad(formatRupiah(item.total), 12);
            
            details += `${pad(name, 20)}\n`;
            details += `  ${pad(qtyPrice, 18)} ${rpad(total, 18)}\n`;
        });
        
        details += "\n----------------------------------------\n";
        details += `TOTAL      : ${rpad(formatRupiah(group.total_amount), 25)}\n`;
        details += "----------------------------------------\n\n";
        
        if (group.notes) {
            details += `CATATAN:\n${group.notes}\n\n`;
        }
        
        details += "    Terima kasih atas pesanan Anda!     \n";
        details += "========================================\n";

        modalTitle.textContent = 'Struk Pesanan (Siap Print)';
        modalBody.textContent = details;
        modalOverlay.classList.add('active');
        
        // Opsional: Tambahkan tombol print
        const printBtn = document.createElement('button');
        printBtn.textContent = '🖨️ Print';
        printBtn.className = 'btn btn-neutral';
        printBtn.style.marginRight = '10px';
        printBtn.onclick = () => {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Struk Warung Bieem</title>
                        <style>
                            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; }
                            pre { white-space: pre-wrap; }
                        </style>
                    </head>
                    <body>
                        <pre>${details}</pre>
                        <script>
                            window.onload = function() { window.print(); }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        };
        
        modalContent.querySelector('#close-modal-btn').insertAdjacentElement('beforebegin', printBtn);
    }

    // === DATA LOADING & PROCESSING (PRODUCTS) ===

    /**
     * Memuat semua produk dari Supabase
     */
    async function loadProducts() {
        productsLoading.style.display = 'block';
        productsNoData.style.display = 'none';
        productsTableBody.innerHTML = '';
        updateStatus('Memuat data produk...');
        
        try {
            // Ambil semua produk
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;
            
            products = data || [];
            renderProducts();
            
            const timestamp = new Date().toLocaleTimeString('id-ID');
            updateStatus(`✅ Data produk terupdate ${timestamp} - ${products.length} produk`);
            
        } catch (error) {
            console.error('Error memuat produk:', error);
            updateStatus(`❌ Error memuat produk: ${error.message}`, true);
        } finally {
            productsLoading.style.display = 'none';
            
            // Tampilkan pesan "tidak ada data" jika diperlukan
            if (products.length === 0) {
                productsNoData.style.display = 'block';
            }
        }
    }

    /**
     * Menampilkan produk ke tabel
     */
    function renderProducts() {
        productsTableBody.innerHTML = '';
        
        if (products.length === 0) {
            productsNoData.style.display = 'block';
            return;
        }

        products.forEach(product => {
            const tr = document.createElement('tr');
            tr.dataset.productId = product.id; // Simpan ID
            
            // Simpan data produk di elemen untuk 'edit'
            tr.dataset.product = JSON.stringify(product); 

            tr.innerHTML = `
                <td>${product.id}</td>
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>${formatRupiah(product.price)}</td>
            `;

            // Event listener untuk memilih + mengisi form (untuk edit)
            tr.addEventListener('click', (e) => {
                // Hapus .selected dari semua baris lain
                tr.parentElement.querySelectorAll('tr.selected').forEach(row => {
                    if (row !== tr) row.classList.remove('selected');
                });
                tr.classList.toggle('selected');
                
                // Jika dipilih, isi form
                if (tr.classList.contains('selected')) {
                    fillProductForm(product);
                } else {
                    clearProductForm(); // Jika di-unselect, bersihkan form
                }
            });

            productsTableBody.appendChild(tr);
        });
    }

    // === PRODUCT ACTIONS ===

    function fillProductForm(product) {
        productIdInput.value = product.id;
        productNameInput.value = product.name;
        productPriceInput.value = product.price;
        productCodeInput.value = product.code;
        saveProductBtn.textContent = '💾 Update Produk';
        saveProductBtn.classList.remove('btn-success');
        saveProductBtn.classList.add('btn-info');
    }

    function clearProductForm() {
        productForm.reset();
        productIdInput.value = ''; // Pastikan ID hidden juga kosong
        saveProductBtn.textContent = '➕ Tambah Produk';
        saveProductBtn.classList.remove('btn-info');
        saveProductBtn.classList.add('btn-success');
        // Hapus seleksi di tabel
        productsTableBody.querySelectorAll('tr.selected').forEach(row => {
            row.classList.remove('selected');
        });
    }

    /**
     * Menangani submit form produk (Tambah / Update)
     */
    async function handleSaveProduct(e) {
        e.preventDefault();
        
        const id = productIdInput.value;
        const productData = {
            name: productNameInput.value.trim(),
            price: parseFloat(productPriceInput.value),
            code: productCodeInput.value.trim(),
        };

        if (!productData.name || !productData.price || !productData.code) {
            alert('Semua field harus diisi!');
            return;
        }

        if (isNaN(productData.price) || productData.price <= 0) {
            alert('Harga harus berupa angka yang valid!');
            return;
        }

        showLoading('Menyimpan produk...');
        
        try {
            let result;
            if (id) {
                // === UPDATE ===
                const { data, error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', id)
                    .select();
                if (error) throw error;
                result = data[0];
                updateStatus(`✅ Produk '${result.name}' berhasil di-update.`);
            } else {
                // === CREATE ===
                const { data, error } = await supabase
                    .from('products')
                    .insert([productData])
                    .select();
                if (error) throw error;
                result = data[0];
                updateStatus(`✅ Produk '${result.name}' berhasil ditambahkan.`);
            }
            
            clearProductForm();
            await loadProducts(); // Muat ulang daftar produk
            
        } catch (error) {
            console.error('Gagal menyimpan produk:', error);
            updateStatus(`❌ Gagal menyimpan produk: ${error.message}`, true);
            alert(`Gagal menyimpan produk: ${error.message}\n\n(Pastikan RLS (Row Level Security) di Supabase mengizinkan operasi 'insert' atau 'update' untuk tabel 'products'.)`);
        } finally {
            hideLoading();
        }
    }

    /**
     * Menghapus produk yang dipilih
     */
    async function deleteSelectedProducts() {
        const selectedIds = getSelectedProductIds(productsTableBody);
        
        if (selectedIds.length === 0) {
            alert('Pilih satu atau lebih produk untuk dihapus.');
            return;
        }

        if (!confirm(`Anda yakin ingin menghapus ${selectedIds.length} produk yang dipilih?`)) {
            return;
        }
        
        showLoading('Menghapus produk...');

        try {
            const { data, error } = await supabase
                .from('products')
                .delete()
                .in('id', selectedIds);
            
            if (error) throw error;
            
            updateStatus(`✅ Berhasil menghapus ${selectedIds.length} produk.`);
            await loadProducts(); // Muat ulang
            clearProductForm();
            
        } catch (error) {
            console.error('Gagal menghapus produk:', error);
            updateStatus(`❌ Gagal menghapus produk: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    /**
     * Membuat kode produk otomatis (Mirip admin.py)
     */
    function generateProductCode() {
        let maxNum = 0;
        let prefix = 'P'; // Default
        
        // Coba tentukan prefix dari produk terakhir (misal: MK/MN)
        if (products.length > 0) {
            const lastCode = products[products.length - 1].code;
            if (lastCode.startsWith('MK')) prefix = 'MK';
            else if (lastCode.startsWith('MN')) prefix = 'MN';
        }

        products.forEach(product => {
            if (product.code.startsWith(prefix)) {
                try {
                    const num = parseInt(product.code.substring(prefix.length), 10);
                    if (num > maxNum) maxNum = num;
                } catch (e) { /* abaikan */ }
            }
        });
        
        const newCode = `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;
        productCodeInput.value = newCode;
    }

    // === AUTO-REFRESH LOGIC ===
    function toggleAutoRefresh() {
        autoRefresh = autoRefreshToggle.checked;
        if (autoRefresh) {
            startAutoRefresh();
            updateStatus('Auto-refresh diaktifkan.');
        } else {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
            updateStatus('Auto-refresh dimatikan.');
        }
    }

    function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer); // Hapus timer lama
        if (autoRefresh) {
            autoRefreshTimer = setInterval(refreshCurrentTabData, REFRESH_INTERVAL);
        }
    }

    function refreshCurrentTabData() {
        const activePageId = document.querySelector('.page.active').id;
        if (activePageId === 'orders-page') {
            loadOrders();
        } else if (activePageId === 'products-page') {
            loadProducts();
        }
    }

    // === EVENT LISTENERS ===
    // Pesanan
    statusFilter.addEventListener('change', renderOrders);
    refreshOrdersBtn.addEventListener('click', loadOrders);
    confirmOrderBtn.addEventListener('click', () => updateOrderStatus('confirmed'));
    cancelOrderBtn.addEventListener('click', () => updateOrderStatus('cancelled'));
    viewOrderBtn.addEventListener('click', viewOrderDetails);
    printOrderBtn.addEventListener('click', printOrder);
    selectAllBtn.addEventListener('click', selectAllOrders);
    clearSelectionBtn.addEventListener('click', clearAllSelections);
    selectAllCheckbox.addEventListener('change', toggleSelectAll);

    // Produk
    productForm.addEventListener('submit', handleSaveProduct);
    clearFormBtn.addEventListener('click', clearProductForm);
    generateCodeBtn.addEventListener('click', generateProductCode);
    refreshProductsBtn.addEventListener('click', loadProducts);
    deleteProductBtn.addEventListener('click', deleteSelectedProducts);

    // Modal
    closeModalBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        // Hapus tombol print jika ada
        const printBtn = modalContent.querySelector('.btn-neutral');
        if (printBtn && printBtn.textContent.includes('Print')) {
            printBtn.remove();
        }
    });
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
            // Hapus tombol print jika ada
            const printBtn = modalContent.querySelector('.btn-neutral');
            if (printBtn && printBtn.textContent.includes('Print')) {
                printBtn.remove();
            }
        }
    });

    // Global
    autoRefreshToggle.addEventListener('change', toggleAutoRefresh);

    // Tutup mobile nav saat klik di luar
    document.addEventListener('click', (e) => {
        if (!mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
            mobileNav.classList.remove('active');
        }
    });

    // === INITIALIZATION ===
    updateStatus('Menghubungkan ke Supabase...');
    showPage('orders-page'); // Tampilkan halaman pesanan saat pertama kali muat
    loadOrders(); // Muat data pesanan awal
    loadProducts(); // Muat data produk di background
    startAutoRefresh(); // Mulai auto-refresh
    updateSelectedInfo(); // Inisialisasi info pilihan
});