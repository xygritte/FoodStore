document.addEventListener('DOMContentLoaded', () => {

    // === GLOBAL STATE ===
    let orders = [];
    let products = [];
    let groupedOrders = {};
    let autoRefresh = true;
    let autoRefreshTimer = null;
    let selectedOrders = new Set();
    let isRefreshing = false;
    // State Antrian
    let currentQueue = 0;
    const REFRESH_INTERVAL = 5000;

    // === ELEMENT SELECTORS ===
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

    // Selectors Antrian Admin
    const adminCurrentQueueEl = document.getElementById('admin-current-queue');
    const nextQueueBtn = document.getElementById('next-queue-btn');
    const clearQueueBtn = document.getElementById('clear-current-queue-btn');
    const resetQueueBtn = document.getElementById('reset-queue-btn');
    const queueListAdminEl = document.getElementById('queue-list-admin');

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
    const modalContent = document.getElementById('modal-content'); 
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // === HELPER FUNCTIONS ===
    const showLoading = (msg = null) => {
        if (!isRefreshing) {
            loadingOverlay.classList.add('active');
        }
        if (msg) updateStatus(msg);
    };
    
    const hideLoading = () => {
        loadingOverlay.classList.remove('active');
        isRefreshing = false;
    };
    
    const updateStatus = (message, isError = false) => {
        statusBar.textContent = message;
        statusBar.style.color = isError ? 'var(--danger-color)' : 'var(--secondary-text)';
    };

    const formatRupiah = (value) => {
        value = parseInt(value, 10) || 0;
        return "Rp " + value.toLocaleString('id-ID');
    };

    const hasDataChanged = (newData, oldData, dataType) => {
        if (!oldData || oldData.length === 0) {
            return newData && newData.length > 0;
        }
        if (newData.length !== oldData.length) {
            return true;
        }
        if (dataType === 'orders') {
            const latestOldOrder = oldData[0]?.updated_at || oldData[0]?.sale_date;
            const latestNewOrder = newData[0]?.updated_at || newData[0]?.sale_date;
            if (latestNewOrder !== latestOldOrder) return true;
            
            const checkCount = Math.min(5, newData.length);
            for (let i = 0; i < checkCount; i++) {
                if (newData[i]?.status !== oldData[i]?.status) return true;
                if (newData[i]?.payment_proof_url !== oldData[i]?.payment_proof_url) return true;
                if (newData[i]?.queue_number !== oldData[i]?.queue_number) return true;
            }
        }
        return false;
    };

    // === NAVIGATION LOGIC ===
    const showPage = (pageId) => {
        pages.forEach(page => page.classList.remove('active'));
        tabButtons.forEach(btn => btn.classList.remove('active'));
        mobileTabButtons.forEach(btn => btn.classList.remove('active'));

        document.getElementById(pageId)?.classList.add('active');
        document.querySelector(`.tab-btn[data-page="${pageId}"]`)?.classList.add('active');
        document.querySelector(`.mobile-tab-btn[data-page="${pageId}"]`)?.classList.add('active');
        
        mobileNav.classList.remove('active');
        
        if (pageId === 'orders-page') {
            if (orders.length === 0) loadOrders();
            loadQueueData(); 
        } else if (pageId === 'products-page' && products.length === 0) {
            loadProducts();
        }
    };

    tabButtons.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
    mobileTabButtons.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
    mobileMenuBtn.addEventListener('click', () => mobileNav.classList.toggle('active'));

    // === CHECKLIST SELECTION FUNCTIONS ===
    const updateSelectedInfo = () => {
        selectedCount.textContent = selectedOrders.size;
        selectedInfo.style.display = selectedOrders.size > 0 ? 'inline-block' : 'none';
    };

    const toggleSelectAll = () => {
        const checkboxes = document.querySelectorAll('.order-checkbox');
        if (selectAllCheckbox.checked) {
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                selectedOrders.add(checkbox.dataset.groupKey);
            });
        } else {
            checkboxes.forEach(checkbox => checkbox.checked = false);
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
            selectAllCheckbox.checked = false;
        }
        updateSelectedInfo();
    };

    const clearAllSelections = () => {
        selectedOrders.clear();
        document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = false);
        selectAllCheckbox.checked = false;
        updateSelectedInfo();
    };

    const selectAllOrders = () => {
        selectAllCheckbox.checked = true;
        toggleSelectAll();
    };

    // === DATA LOADING & PROCESSING (ORDERS) ===
    async function loadOrders() {
        if (isRefreshing) return;
        
        isRefreshing = true;
        ordersLoading.style.display = 'block';
        ordersNoData.style.display = 'none';
        updateStatus('Memuat data pesanan...');
        
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .order('sale_date', { ascending: false });

            if (error) throw error;
            
            const newData = data || [];
            const dataChanged = hasDataChanged(newData, orders, 'orders');
            
            if (dataChanged) {
                orders = newData;
                groupOrders();
                
                requestAnimationFrame(() => {
                    renderOrders();
                    updateDashboardStats();
                });
                updateStatus(`✅ Data terupdate ${new Date().toLocaleTimeString('id-ID')} - ${orders.length} item`);
            } else {
                updateStatus(`✅ Data sudah terbaru ${new Date().toLocaleTimeString('id-ID')}`);
            }
            
        } catch (error) {
            console.error('Error memuat pesanan:', error);
            updateStatus(`❌ Error memuat pesanan: ${error.message}`, true);
        } finally {
            ordersLoading.style.display = 'none';
            isRefreshing = false;
            if (orders.length === 0) ordersNoData.style.display = 'block';
        }
    }

    function groupOrders() {
        groupedOrders = {};
        for (const order of orders) {
            const customer = order.customer_name || 'Unknown';
            const sale_date = order.sale_date.substring(0, 16); 
            // Group key
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
                    order_ids: [],
                    payment_proof: null,
                    queue_number: order.queue_number 
                };
            }
            
            groupedOrders[groupKey].items.push(order);
            groupedOrders[groupKey].total_amount += order.total || 0;
            groupedOrders[groupKey].order_ids.push(order.id);
            
            if (order.payment_proof_url) {
                groupedOrders[groupKey].payment_proof = order.payment_proof_url;
            }
        }

        for (const key in groupedOrders) {
            const group = groupedOrders[key];
            const statuses = new Set(group.items.map(item => item.status || 'pending'));
            
            if (statuses.size === 1) {
                group.status = statuses.values().next().value;
            } else if (statuses.has('pending')) {
                group.status = 'mixed';
            } else {
                group.status = 'mixed';
            }
        }
    }

    function renderOrders() {
        const filter = statusFilter.value;
        const fragment = document.createDocumentFragment();
        let hasVisibleData = false;

        const sortedGroups = Object.values(groupedOrders);
        
        if (sortedGroups.length === 0) {
            ordersNoData.style.display = 'block';
            ordersTableBody.innerHTML = '';
            return;
        }

        sortedGroups.forEach(group => {
            const status = group.status;
            if (filter !== 'semua') {
                if (filter === 'pending' && (status !== 'pending' && status !== 'mixed')) return;
                else if (filter !== 'pending' && filter !== status) return;
            }

            hasVisibleData = true;
            const tr = createOrderRow(group);
            fragment.appendChild(tr);
        });

        ordersTableBody.innerHTML = '';
        ordersTableBody.appendChild(fragment);
        ordersNoData.style.display = hasVisibleData ? 'none' : 'block';
    }

    function createOrderRow(group) {
        const tr = document.createElement('tr');
        tr.dataset.groupKey = group.key;

        const notesDisplay = (group.notes.length > 50) ? group.notes.substring(0, 50) + '...' : group.notes;
        const readableDate = new Date(group.datetime).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const isSelected = selectedOrders.has(group.key);
        const proofIcon = group.payment_proof 
            ? '<span title="Ada Bukti Pembayaran" style="cursor:help; margin-left:5px;">📸</span>' 
            : '';
        const customerHtml = `<a href="#" class="customer-link">${group.customer}</a>`;

        // Badge Antrian
        const queueDisplay = group.queue_number 
            ? `<span style="font-weight:bold; font-size:1.1em; color:var(--primary-color);">#${group.queue_number}</span>` 
            : '-';

        tr.innerHTML = `
            <td class="checkbox-col">
                <input type="checkbox" class="order-checkbox" data-group-key="${group.key}" ${isSelected ? 'checked' : ''}>
            </td>
            <td style="text-align:center;">${queueDisplay}</td> 
            <td>${readableDate}</td>
            <td>${customerHtml} ${proofIcon}</td>
            <td>${group.items.length} item(s)</td>
            <td>${formatRupiah(group.total_amount)}</td>
            <td><span class="status-tag status-${group.status}">${group.status}</span></td>
            <td>${notesDisplay}</td>
        `;

        const checkbox = tr.querySelector('.order-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleOrderSelection(checkbox);
        });

        const nameLink = tr.querySelector('.customer-link');
        if (nameLink) {
            nameLink.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation(); viewOrderDetails(group.key); 
            });
        }

        tr.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox' && !e.target.classList.contains('customer-link')) {
                if (!e.shiftKey) {
                    tr.parentElement.querySelectorAll('tr.selected').forEach(row => {
                        if (row !== tr) row.classList.remove('selected');
                    });
                }
                tr.classList.toggle('selected');
                checkbox.checked = !checkbox.checked;
                toggleOrderSelection(checkbox);
            }
        });

        return tr;
    }

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

    // === QUEUE MANAGEMENT (ANTRIAN) - DIPERBAIKI ===

    async function loadQueueData() {
        try {
            const result = await supabaseClient.getQueueStatus();
            if (result.success) {
                currentQueue = result.data.current_queue || 0;
                updateQueueDisplay();
                renderAdminQueueList(result.data.queue_list || []);
            }
        } catch (error) {
            console.error('Error loading queue data:', error);
        }
    }

    function updateQueueDisplay() {
        if (adminCurrentQueueEl) {
            adminCurrentQueueEl.textContent = currentQueue > 0 ? `#${currentQueue}` : '-';
        }
    }

    function renderAdminQueueList(queueList) {
        if (!queueListAdminEl) return;
        
        const activeQueues = queueList.filter(q => q.status === 'pending' || q.status === 'processing');

        if (activeQueues.length === 0) {
            queueListAdminEl.innerHTML = '<div style="padding:15px; text-align:center; color:#888;">Tidak ada antrian aktif.</div>';
            return;
        }

        queueListAdminEl.innerHTML = activeQueues.map(queue => `
            <div class="queue-admin-item ${queue.queue_number === currentQueue ? 'current' : ''}">
                <span class="queue-number" style="font-weight:bold; font-size:1.1em; color:var(--primary-color);">#${queue.queue_number}</span>
                <div class="queue-customer" style="flex:1; margin:0 10px;">
                    <strong>${queue.customer_name}</strong><br>
                    <small>${queue.items.join(', ').substring(0, 30)}${queue.items.length > 1 ? '...' : ''}</small>
                </div>
                <span class="status-tag status-${queue.status}" style="font-size:0.75em;">${queue.status}</span>
            </div>
        `).join('');
    }

    // Fungsi: Panggil Antrian Berikutnya (DIPERBAIKI)
    async function nextQueue() {
        showLoading('Memproses...');
        try {
            // Helper untuk dapat tanggal hari ini
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            const todayStr = (new Date(now - offset)).toISOString().slice(0, 10);

            // 1. Cari antrian pending terlama HARI INI
            const { data, error } = await supabase
                .from('sales')
                .select('queue_number')
                .eq('status', 'pending')
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const nextNum = data[0].queue_number;
                
                // 2. Update status SEMUA ITEM di antrian itu menjadi processing
                const result = await supabaseClient.moveToProcessing(nextNum);

                if (result.success) {
                    updateStatus(`⏩ Memanggil antrian #${nextNum}`);
                    await loadQueueData();
                    await loadOrders();
                } else {
                    throw new Error(result.error);
                }
            } else {
                alert('Tidak ada antrian pending hari ini.');
            }
        } catch (error) {
            console.error(error);
            updateStatus(`❌ Error: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    // Fungsi: Selesaikan Antrian Saat Ini
    async function clearCurrentQueue() {
        if (currentQueue === 0) {
            alert('Tidak ada antrian yang sedang dipanggil.');
            return;
        }
        
        if (!confirm(`Tandai antrian #${currentQueue} sebagai selesai (Completed)?`)) {
            return;
        }
        
        showLoading('Menyelesaikan...');
        try {
            const result = await supabaseClient.clearQueue(currentQueue);
            if (result.success) {
                updateStatus(`✅ Antrian #${currentQueue} selesai.`);
                await loadQueueData();
                await loadOrders(); 
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            updateStatus(`❌ Gagal menyelesaikan antrian: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    // Fungsi: Reset Semua Antrian (HARI INI)
    async function resetQueue() {
        if (!confirm('Reset semua antrian HARI INI? Status pending/processing akan dibatalkan.')) {
            return;
        }
        
        showLoading('Mereset antrian...');
        try {
            const result = await supabaseClient.resetQueue();
            if (result.success) {
                updateStatus('🔄 Antrian hari ini telah direset.');
                await loadQueueData();
                await loadOrders();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            updateStatus(`❌ Gagal reset antrian: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    // === ORDER ACTIONS ===
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
        
        let allItemIds = [];
        selectedOrders.forEach(key => {
            if (groupedOrders[key]) {
                allItemIds.push(...groupedOrders[key].order_ids);
            }
        });

        try {
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
            await loadOrders();
            await loadQueueData(); 
            clearAllSelections();
            
        } catch (error) {
            console.error(`Gagal ${actionText} pesanan:`, error);
            updateStatus(`❌ Gagal ${actionText} pesanan: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    function viewOrderDetails(specificGroupKey = null) {
        let groupKey = typeof specificGroupKey === 'string' ? specificGroupKey : Array.from(selectedOrders)[0];
        
        if (!groupKey || (selectedOrders.size !== 1 && !specificGroupKey)) {
            alert('Pilih HANYA SATU pesanan untuk dilihat detailnya.');
            return;
        }
        
        const group = groupedOrders[groupKey];
        if (!group) return;

        // Bersihkan gambar lama
        const existingImg = modalContent.querySelector('.proof-image-container');
        if (existingImg) existingImg.remove();

        const queueText = group.queue_number ? `NO. ANTRIAN: #${group.queue_number}\n` : '';

        let details = `
        👤 CUSTOMER: ${group.customer}
        ${queueText}🕒 WAKTU: ${new Date(group.datetime).toLocaleString('id-ID')}
        ✅ STATUS: ${group.status.toUpperCase()}
        
        📦 ITEM PESANAN:
        --------------------------------\n`;

        group.items.forEach((item, index) => {
            details += `
        ${index + 1}. ${item.product_name}
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

        if (!group.payment_proof) details += `\n(Belum ada bukti pembayaran)`;

        modalTitle.textContent = 'Detail Group Pesanan';
        modalBody.textContent = details;

        if (group.payment_proof) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'proof-image-container';
            imgContainer.style.marginTop = '15px';
            imgContainer.innerHTML = `
                <h4 style="margin-bottom:10px; color:var(--primary-color);">📸 Bukti Pembayaran</h4>
                <a href="${group.payment_proof}" target="_blank">
                    <img src="${group.payment_proof}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
                </a>
            `;
            modalBody.parentNode.insertBefore(imgContainer, modalBody.nextSibling);
        }

        modalOverlay.classList.add('active');
    }

    // === PRODUCT ACTIONS ===
    async function loadProducts() {
        productsLoading.style.display = 'block';
        productsNoData.style.display = 'none';
        try {
            const { data, error } = await supabase.from('products').select('*').order('code', { ascending: true });
            if (error) throw error;
            products = data || [];
            renderProducts();
        } catch (error) { console.error(error); } 
        finally { productsLoading.style.display = 'none'; }
    }

    function renderProducts() {
        const fragment = document.createDocumentFragment();
        if (products.length === 0) {
            productsNoData.style.display = 'block';
            productsTableBody.innerHTML = '';
            return;
        }
        products.forEach(product => {
            const tr = document.createElement('tr');
            tr.dataset.productId = product.id;
            tr.innerHTML = `<td>${product.id}</td><td>${product.code}</td><td>${product.name}</td><td>${formatRupiah(product.price)}</td>`;
            tr.addEventListener('click', () => {
                tr.classList.toggle('selected');
                if (tr.classList.contains('selected')) {
                    fillProductForm(product);
                    tr.parentElement.querySelectorAll('tr.selected').forEach(row => {if (row!==tr) row.classList.remove('selected')});
                } else clearProductForm();
            });
            fragment.appendChild(tr);
        });
        productsTableBody.innerHTML = '';
        productsTableBody.appendChild(fragment);
    }
    
    function fillProductForm(product) {
        productIdInput.value = product.id;
        productNameInput.value = product.name;
        productPriceInput.value = product.price;
        productCodeInput.value = product.code;
        saveProductBtn.textContent = '💾 Update Produk';
        saveProductBtn.classList.remove('btn-success'); saveProductBtn.classList.add('btn-info');
    }

    function clearProductForm() {
        productForm.reset();
        productIdInput.value = '';
        saveProductBtn.textContent = '➕ Tambah Produk';
        saveProductBtn.classList.remove('btn-info'); saveProductBtn.classList.add('btn-success');
    }

    async function handleSaveProduct(e) {
        e.preventDefault();
        const id = productIdInput.value;
        const productData = { name: productNameInput.value.trim(), price: parseFloat(productPriceInput.value), code: productCodeInput.value.trim() };
        showLoading('Menyimpan produk...');
        try {
            if (id) await supabase.from('products').update(productData).eq('id', id);
            else await supabase.from('products').insert([productData]);
            clearProductForm(); await loadProducts(); updateStatus('✅ Produk tersimpan');
        } catch (e) { updateStatus('❌ Gagal simpan', true); }
        finally { hideLoading(); }
    }

    async function deleteSelectedProducts() {
        const selectedIds = [...productsTableBody.querySelectorAll('tr.selected')].map(tr => tr.dataset.productId);
        if (selectedIds.length === 0) return alert('Pilih produk dihapus');
        if (!confirm('Hapus produk?')) return;
        showLoading('Menghapus...');
        try { await supabase.from('products').delete().in('id', selectedIds); await loadProducts(); }
        catch (e) { console.error(e); } finally { hideLoading(); }
    }
    
    function generateProductCode() {
         productCodeInput.value = 'P' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    }

    // === AUTO-REFRESH ===
    function toggleAutoRefresh() {
        autoRefresh = autoRefreshToggle.checked;
        if (autoRefresh) startAutoRefresh();
        else clearInterval(autoRefreshTimer);
    }

    function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(() => {
            if (!isRefreshing) {
                const activePage = document.querySelector('.page.active').id;
                if (activePage === 'orders-page') {
                    loadOrders();
                    loadQueueData(); 
                } else if (activePage === 'products-page') {
                    loadProducts();
                }
            }
        }, REFRESH_INTERVAL);
    }

    // === EVENT LISTENERS ===
    statusFilter.addEventListener('change', renderOrders);
    refreshOrdersBtn.addEventListener('click', () => { loadOrders(); loadQueueData(); });
    confirmOrderBtn.addEventListener('click', () => updateOrderStatus('confirmed'));
    cancelOrderBtn.addEventListener('click', () => updateOrderStatus('cancelled'));
    viewOrderBtn.addEventListener('click', () => viewOrderDetails());
    selectAllBtn.addEventListener('click', selectAllOrders);
    clearSelectionBtn.addEventListener('click', clearAllSelections);
    selectAllCheckbox.addEventListener('change', toggleSelectAll);

    // Queue Listeners
    if (nextQueueBtn) nextQueueBtn.addEventListener('click', nextQueue);
    if (clearQueueBtn) clearQueueBtn.addEventListener('click', clearCurrentQueue);
    if (resetQueueBtn) resetQueueBtn.addEventListener('click', resetQueue);

    // Product Listeners
    productForm.addEventListener('submit', handleSaveProduct);
    clearFormBtn.addEventListener('click', clearProductForm);
    generateCodeBtn.addEventListener('click', generateProductCode);
    refreshProductsBtn.addEventListener('click', loadProducts);
    deleteProductBtn.addEventListener('click', deleteSelectedProducts);

    closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });
    autoRefreshToggle.addEventListener('change', toggleAutoRefresh);

    // === INIT ===
    updateStatus('Menghubungkan ke Supabase...');
    showPage('orders-page');
    loadOrders();
    loadQueueData();
    loadProducts();
    startAutoRefresh();
});