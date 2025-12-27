document.addEventListener('DOMContentLoaded', () => {

    // === GLOBAL STATE ===
    let orders = [];
    let groupedOrders = {};
    let autoRefresh = true;
    let autoRefreshTimer = null;
    let selectedOrders = new Set();
    let isRefreshing = false;
    let currentQueue = 0;
    const REFRESH_INTERVAL = 5000;

    // === ELEMENT SELECTORS ===
    // Navigation & Layout
    const tabButtons = document.querySelectorAll('.tab-btn');
    const mobileTabButtons = document.querySelectorAll('.mobile-tab-btn');
    const pages = document.querySelectorAll('.page');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusBar = document.getElementById('status-bar');
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');

    // Halaman Pesanan (Orders)
    const ordersPage = document.getElementById('orders-page');
    const ordersTableBody = document.getElementById('orders-table-body');
    const ordersLoading = document.getElementById('orders-loading');
    const ordersNoData = document.getElementById('orders-no-data');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-orders-input');
    const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
    
    // Order Actions
    const confirmOrderBtn = document.getElementById('confirm-order-btn');
    const cancelOrderBtn = document.getElementById('cancel-order-btn');
    const viewOrderBtn = document.getElementById('view-order-btn');
    const printOrderBtn = document.getElementById('print-order-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectedCount = document.getElementById('selected-count');
    const selectedInfo = document.getElementById('selected-info');

    // Queue Controls
    const adminCurrentQueueEl = document.getElementById('admin-current-queue');
    const clearQueueBtn = document.getElementById('clear-current-queue-btn');
    const resetQueueBtn = document.getElementById('reset-queue-btn');
    const queueListAdminEl = document.getElementById('queue-list-admin');

    // Stats
    const statTotalSales = document.getElementById('stat-total-sales');
    const statTotalSold = document.getElementById('stat-total-sold');
    const statPendingOrders = document.getElementById('stat-pending-orders');
    const statConfirmedOrders = document.getElementById('stat-confirmed-orders');

    // Products
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

    // Activity Logs (BARU)
    const logsPage = document.getElementById('logs-page');
    const logsTableBody = document.getElementById('logs-table-body');
    const logsLoading = document.getElementById('logs-loading');
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');

    // Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content'); 
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // === HELPER FUNCTIONS ===
    const showLoading = (msg = null) => {
        if (!isRefreshing) loadingOverlay.classList.add('active');
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

    const getTodayDateStr = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return (new Date(now - offset)).toISOString().slice(0, 10);
    };

    const hasDataChanged = (newData, oldData) => {
        if (!oldData || oldData.length === 0) return newData && newData.length > 0;
        if (newData.length !== oldData.length) return true;
        const latestOld = oldData[0]?.updated_at || oldData[0]?.sale_date;
        const latestNew = newData[0]?.updated_at || newData[0]?.sale_date;
        if (latestNew !== latestOld) return true;
        
        const checkCount = Math.min(5, newData.length);
        for (let i = 0; i < checkCount; i++) {
            if (newData[i]?.status !== oldData[i]?.status) return true;
            if (newData[i]?.queue_number !== oldData[i]?.queue_number) return true;
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
        
        // Logic load per halaman
        if (pageId === 'orders-page') {
            if (orders.length === 0) loadOrders();
            loadQueueData(); 
        } else if (pageId === 'products-page') {
            loadProducts();
        } else if (pageId === 'logs-page') {
            loadActivityLogs();
        }
    };

    tabButtons.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
    mobileTabButtons.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
    mobileMenuBtn.addEventListener('click', () => mobileNav.classList.toggle('active'));

    // === CHECKLIST / SELECTION LOGIC ===
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
        if (checkbox.checked) selectedOrders.add(groupKey);
        else {
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

    // === LOAD ORDERS ===
    async function loadOrders() {
        if (isRefreshing) return;
        isRefreshing = true;
        ordersLoading.style.display = 'block';
        ordersNoData.style.display = 'none';
        
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .order('sale_date', { ascending: false });

            if (error) throw error;
            
            const newData = data || [];
            
            if (hasDataChanged(newData, orders)) {
                orders = newData;
                groupOrders();
                renderOrders();
                updateDashboardStats();
                updateStatus(`✅ Data terupdate ${new Date().toLocaleTimeString('id-ID')}`);
            }
        } catch (error) {
            console.error('Error memuat pesanan:', error);
            updateStatus(`❌ Error: ${error.message}`, true);
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
            const statuses = new Set(group.items.map(item => item.status));
            
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
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const fragment = document.createDocumentFragment();
        let hasVisibleData = false;
        const sortedGroups = Object.values(groupedOrders);

        if (sortedGroups.length === 0) {
            ordersTableBody.innerHTML = '';
            ordersNoData.style.display = 'block';
            return;
        }

        sortedGroups.forEach(group => {
            // 1. Filter berdasarkan STATUS
            if (filter !== 'semua') {
                if (filter === 'pending' && (group.status !== 'pending' && group.status !== 'mixed')) return;
                else if (filter !== 'pending' && filter !== group.status) return;
            }

            // 2. Filter berdasarkan PENCARIAN
            if (searchTerm) {
                const customerName = group.customer.toLowerCase();
                const queueNum = group.queue_number ? String(group.queue_number) : '';
                const notes = group.notes ? group.notes.toLowerCase() : '';
                
                const match = customerName.includes(searchTerm) || 
                              queueNum.includes(searchTerm) || 
                              notes.includes(searchTerm);
                
                if (!match) return; 
            }

            hasVisibleData = true;
            fragment.appendChild(createOrderRow(group));
        });

        ordersTableBody.innerHTML = '';
        ordersTableBody.appendChild(fragment);
        ordersNoData.style.display = hasVisibleData ? 'none' : 'block';
    }

    function createOrderRow(group) {
        const tr = document.createElement('tr');
        tr.dataset.groupKey = group.key;

        const readableDate = new Date(group.datetime).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const isSelected = selectedOrders.has(group.key);
        const proofIcon = group.payment_proof 
            ? '<span title="Ada Bukti Pembayaran" style="cursor:help; margin-left:5px;">📸</span>' 
            : '';
        
        const queueDisplay = group.queue_number 
            ? `<span style="font-weight:bold; font-size:1.1em; color:var(--primary-color);">#${group.queue_number}</span>` 
            : '-';

        tr.innerHTML = `
            <td class="checkbox-col">
                <input type="checkbox" class="order-checkbox" data-group-key="${group.key}" ${isSelected ? 'checked' : ''}>
            </td>
            <td style="text-align:center;">${queueDisplay}</td> 
            <td>${readableDate}</td>
            <td><a href="#" class="customer-link">${group.customer}</a> ${proofIcon}</td>
            <td>${group.items.length} items</td>
            <td>${formatRupiah(group.total_amount)}</td>
            <td><span class="status-tag status-${group.status}">${group.status}</span></td>
            <td>${group.notes.substring(0, 30)}</td>
        `;

        const checkbox = tr.querySelector('.order-checkbox');
        checkbox.addEventListener('change', (e) => { e.stopPropagation(); toggleOrderSelection(checkbox); });

        tr.querySelector('.customer-link').addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); viewOrderDetails(group.key); 
        });

        tr.addEventListener('click', (e) => {
            if (e.target !== checkbox && !e.target.classList.contains('customer-link')) {
                tr.classList.toggle('selected');
                checkbox.checked = !checkbox.checked;
                toggleOrderSelection(checkbox);
            }
        });

        return tr;
    }

    function updateDashboardStats() {
        let totalSales = 0, totalSold = 0, pendingCount = 0, confirmedCount = 0;
        for (const order of orders) {
            if (order.status === 'completed') {
                totalSales += order.total || 0;
                totalSold += order.quantity || 0;
            } else if (order.status === 'pending') {
                pendingCount++;
            } else if (order.status === 'confirmed') {
                confirmedCount++;
            }
        }
        statTotalSales.textContent = formatRupiah(totalSales);
        statTotalSold.textContent = `${totalSold} pcs`;
        statPendingOrders.textContent = `${pendingCount} item`;
        statConfirmedOrders.textContent = `${confirmedCount} item`;
    }

    // === QUEUE MANAGEMENT (OTOMATIS) ===

    async function loadQueueData() {
        try {
            const result = await supabaseClient.getQueueStatus();
            if (result.success) {
                currentQueue = result.data.current_queue || 0;
                
                adminCurrentQueueEl.textContent = currentQueue > 0 ? `#${currentQueue}` : '-';
                adminCurrentQueueEl.style.color = currentQueue > 0 ? '#ff9800' : '#ccc';

                if (currentQueue === 0 && result.data.queue_list.length > 0) {
                    const hasWaiting = result.data.queue_list.some(q => q.status === 'confirmed');
                    if (hasWaiting) {
                        console.log('Auto-calling next queue...');
                        await callNextQueueAutomatically();
                    } else {
                        renderAdminQueueList(result.data.queue_list);
                    }
                } else {
                    renderAdminQueueList(result.data.queue_list || []);
                }
            } else {
                console.error('Failed to load queue data:', result.error);
            }
        } catch (error) {
            console.error('Error loading queue data:', error);
        }
    }

    async function callNextQueueAutomatically() {
        try {
            const todayStr = getTodayDateStr();

            let { data, error } = await supabase
                .from('sales')
                .select('queue_number')
                .eq('status', 'confirmed')
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true })
                .limit(1);

            if (!data || data.length === 0) {
                 const { data: fallbackData } = await supabase
                    .from('sales')
                    .select('queue_number')
                    .eq('status', 'confirmed')
                    .not('queue_number', 'is', null)
                    .order('queue_number', { ascending: true })
                    .limit(1);
                 
                 if (fallbackData && fallbackData.length > 0) {
                     data = fallbackData;
                 }
            }

            if (data && data.length > 0) {
                const nextNum = data[0].queue_number;
                const result = await supabaseClient.moveToProcessing(nextNum);

                if (result.success) {
                    updateStatus(`⏩ Memanggil otomatis antrian #${nextNum}`);
                    const qResult = await supabaseClient.getQueueStatus();
                    if(qResult.success) {
                        currentQueue = qResult.data.current_queue;
                        adminCurrentQueueEl.textContent = `#${currentQueue}`;
                        renderAdminQueueList(qResult.data.queue_list);
                    }
                    await loadOrders();
                } else {
                    throw new Error(result.error);
                }
            }
        } catch (error) {
            console.error('Error in auto call:', error);
        }
    }

    function renderAdminQueueList(queueList) {
        if (!queueListAdminEl) return;
        
        const activeQueues = queueList; 

        if (activeQueues.length === 0) {
            queueListAdminEl.innerHTML = '<div style="padding:15px; text-align:center; color:#888;">Tidak ada antrian menunggu.</div>';
            return;
        }

        queueListAdminEl.innerHTML = activeQueues.map(queue => {
            const isProcessing = queue.status === 'processing';
            const statusColor = isProcessing ? 'var(--primary-color)' : 'var(--info-color)';
            const statusText = isProcessing ? 'DIPANGGIL' : 'MENUNGGU';
            const bgColor = isProcessing ? '#f6ffe1ff' : '#fff';

            return `
            <div class="queue-admin-item" style="background: ${bgColor}; border-left: 4px solid ${statusColor};">
                <span class="queue-number" style="font-weight:bold; font-size:1.2em; color:${statusColor};">#${queue.queue_number}</span>
                <div class="queue-customer" style="flex:1; margin:0 10px;">
                    <strong>${queue.customer_name}</strong><br>
                    <small style="color:#666;">${queue.items.length} item</small>
                </div>
                <span class="status-tag" style="background:${statusColor};">${statusText}</span>
            </div>
            `;
        }).join('');
    }

    async function clearCurrentQueue() {
        if (currentQueue === 0) {
            alert('Tidak ada antrian yang sedang dipanggil.');
            return;
        }
        
        if (!confirm(`Selesaikan antrian #${currentQueue}?`)) return;
        
        showLoading('Menyelesaikan...');
        try {
            const result = await supabaseClient.clearQueue(currentQueue);
            if (result.success) {
                updateStatus(`✅ Antrian #${currentQueue} selesai.`);
                await callNextQueueAutomatically();
                await loadQueueData(); 
                await loadOrders(); 
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            updateStatus(`❌ Gagal: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    async function resetQueue() {
        if (!confirm('Reset semua antrian HARI INI?')) return;
        
        showLoading('Resetting...');
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
            updateStatus(`❌ Gagal: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    // === ORDER ACTIONS (CONFIRM / CANCEL) ===
    async function updateOrderStatus(newStatus) {
        if (selectedOrders.size === 0) return alert(`Pilih pesanan dulu.`);
        
        const actionText = (newStatus === 'confirmed') ? 'mengkonfirmasi (Masuk Antrian)' : 'membatalkan';
        if (!confirm(`Anda yakin ingin ${actionText} ${selectedOrders.size} pesanan ini?`)) return;
        
        showLoading('Updating...');
        
        try {
            let successCount = 0;
            const collectedQueueNumbers = [];

            if (newStatus === 'confirmed') {
                const groupKeys = Array.from(selectedOrders);
                for (const key of groupKeys) {
                    if (groupedOrders[key]) {
                        const orderIds = groupedOrders[key].order_ids;
                        const res = await supabaseClient.assignQueueNumber(orderIds);
                        if (res.success) {
                            successCount++;
                            collectedQueueNumbers.push(res.queue_number);
                        } else {
                            console.error('Failed to assign queue for group:', key, res.error);
                        }
                    }
                }
            } else {
                let allItemIds = [];
                selectedOrders.forEach(key => {
                    if (groupedOrders[key]) allItemIds.push(...groupedOrders[key].order_ids);
                });

                const { data, error } = await supabase
                    .from('sales')
                    .update({ status: newStatus })
                    .in('id', allItemIds)
                    .select();
                
                if (error) throw error;
                successCount = selectedOrders.size;
            }

            let msg = `✅ Berhasil memproses ${successCount} grup.`;
            if (newStatus === 'confirmed' && collectedQueueNumbers.length > 0) {
                msg = `✅ Order masuk Antrian #${collectedQueueNumbers.join(', #')}`;
            }

            updateStatus(msg);
            await loadOrders();
            await loadQueueData();
            clearAllSelections();
            
        } catch (error) {
            console.error(error);
            updateStatus(`❌ Gagal: ${error.message}`, true);
        } finally {
            hideLoading();
        }
    }

    // === MODAL DETAIL ===
    function viewOrderDetails(specificGroupKey = null) {
        let groupKey = typeof specificGroupKey === 'string' ? specificGroupKey : Array.from(selectedOrders)[0];
        if (!groupKey) return alert('Pilih satu pesanan.');
        
        const group = groupedOrders[groupKey];
        if (!group) return;

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
            details += `${index + 1}. ${item.product_name} (${item.quantity}x) - ${formatRupiah(item.total)}\n`;
        });
        
        details += `\n💵 TOTAL: ${formatRupiah(group.total_amount)}\n📝 CATATAN: ${group.notes || '-'}`;

        if (!group.payment_proof) details += `\n(Belum ada bukti pembayaran)`;

        modalTitle.textContent = 'Detail Pesanan';
        modalBody.textContent = details;

        if (group.payment_proof) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'proof-image-container';
            imgContainer.style.marginTop = '15px';
            imgContainer.innerHTML = `
                <h4 style="margin-bottom:10px;">📸 Bukti Pembayaran</h4>
                <a href="${group.payment_proof}" target="_blank">
                    <img src="${group.payment_proof}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
                </a>
            `;
            modalBody.parentNode.insertBefore(imgContainer, modalBody.nextSibling);
        }

        modalOverlay.classList.add('active');
    }

    // === PRODUCT MANAGEMENT ===
    let products = [];
    async function loadProducts() {
        productsLoading.style.display = 'block';
        productsNoData.style.display = 'none';
        try {
            const { data, error } = await supabase.from('products').select('*').order('code');
            if(error) throw error;
            products = data || [];
            renderProducts();
        } catch(e) { console.error(e); } 
        finally { productsLoading.style.display = 'none'; }
    }

    function renderProducts() {
        productsTableBody.innerHTML = '';
        if(products.length === 0) { productsNoData.style.display = 'block'; return; }
        
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.dataset.productId = p.id;
            tr.innerHTML = `<td>${p.id}</td><td>${p.code}</td><td>${p.name}</td><td>${formatRupiah(p.price)}</td>`;
            tr.onclick = () => {
                fillProductForm(p);
                productsTableBody.querySelectorAll('.selected').forEach(row => row.classList.remove('selected'));
                tr.classList.add('selected');
            };
            productsTableBody.appendChild(tr);
        });
    }

    function fillProductForm(p) {
        productIdInput.value = p.id; productNameInput.value = p.name;
        productPriceInput.value = p.price; productCodeInput.value = p.code;
        saveProductBtn.textContent = 'Update';
    }

    async function handleSaveProduct(e) {
        e.preventDefault();
        const p = { name: productNameInput.value, price: productPriceInput.value, code: productCodeInput.value };
        const id = productIdInput.value;
        try {
            if(id) await supabase.from('products').update(p).eq('id', id);
            else await supabase.from('products').insert([p]);
            loadProducts(); productForm.reset(); productIdInput.value=''; saveProductBtn.textContent='Tambah';
        } catch(e) { alert(e.message); }
    }

    async function deleteProduct() {
        const id = productIdInput.value;
        if(!id || !confirm('Hapus?')) return;
        await supabase.from('products').delete().eq('id', id);
        loadProducts(); productForm.reset();
    }

    // === ACTIVITY LOGS MANAGEMENT (BARU) ===
    async function loadActivityLogs() {
        if(!logsPage.classList.contains('active')) return;

        logsLoading.style.display = 'block';
        const result = await supabaseClient.getActivityLogs();
        logsLoading.style.display = 'none';

        if (result.success) {
            renderActivityLogs(result.data);
        } else {
            console.error(result.error);
        }
    }

    function renderActivityLogs(logs) {
        if (!logsTableBody) return;
        logsTableBody.innerHTML = '';

        if (!logs || logs.length === 0) {
            logsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada aktivitas.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');
            const date = new Date(log.changed_at).toLocaleString('id-ID');
            
            // Format pesan detail
            let detail = '';
            if (log.action_type === 'INSERT') {
                const name = log.new_data.name || log.new_data.customer_name || 'Item Baru';
                detail = `Menambahkan: <b>${name}</b>`;
            } else if (log.action_type === 'UPDATE') {
                if (log.table_name === 'sales' && log.new_data.status) {
                     detail = `Ubah status: ${log.old_data.status} ➔ <b>${log.new_data.status}</b>`;
                } else if (log.table_name === 'sales' && log.new_data.queue_number) {
                     detail = `Masuk Antrian: <b>#${log.new_data.queue_number}</b>`;
                } else {
                    detail = 'Mengupdate data';
                }
            } else if (log.action_type === 'DELETE') {
                const name = log.old_data.name || log.old_data.customer_name || 'Item';
                detail = `Menghapus: <b>${name}</b>`;
            }

            // Warna Badge
            let badgeColor = '#777';
            if(log.action_type === 'INSERT') badgeColor = 'var(--success-color)';
            if(log.action_type === 'UPDATE') badgeColor = 'var(--info-color)';
            if(log.action_type === 'DELETE') badgeColor = 'var(--danger-color)';

            tr.innerHTML = `
                <td>${date}</td>
                <td><span style="background:${badgeColor}; color:white; padding:3px 8px; border-radius:4px; font-size:0.8em;">${log.action_type}</span></td>
                <td>${log.table_name}</td>
                <td>${detail}</td>
            `;
            logsTableBody.appendChild(tr);
        });
    }

    // === AUTO REFRESH ===
    function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(() => {
            if (!isRefreshing) {
                // Cek halaman mana yang aktif
                if (ordersPage.classList.contains('active')) {
                    loadOrders();
                    loadQueueData();
                } else if (logsPage.classList.contains('active')) {
                    loadActivityLogs();
                }
            }
        }, REFRESH_INTERVAL);
    }

    // === EVENT LISTENERS ===
    if(searchInput) searchInput.addEventListener('input', renderOrders);
    
    statusFilter.addEventListener('change', renderOrders);
    refreshOrdersBtn.addEventListener('click', () => { loadOrders(); loadQueueData(); });
    
    confirmOrderBtn.addEventListener('click', () => updateOrderStatus('confirmed'));
    cancelOrderBtn.addEventListener('click', () => updateOrderStatus('cancelled'));
    viewOrderBtn.addEventListener('click', () => viewOrderDetails());
    
    selectAllBtn.addEventListener('click', () => { selectAllCheckbox.checked = true; toggleSelectAll(); });
    clearSelectionBtn.addEventListener('click', clearAllSelections);
    selectAllCheckbox.addEventListener('change', toggleSelectAll);

    // Queue Buttons
    if(clearQueueBtn) clearQueueBtn.addEventListener('click', clearCurrentQueue);
    if(resetQueueBtn) resetQueueBtn.addEventListener('click', resetQueue);

    // Products
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);
    if (clearFormBtn) clearFormBtn.addEventListener('click', () => { productForm.reset(); productIdInput.value=''; });
    if (refreshProductsBtn) refreshProductsBtn.addEventListener('click', loadProducts);
    if (deleteProductBtn) deleteProductBtn.addEventListener('click', deleteProduct);
    if (generateCodeBtn) generateCodeBtn.addEventListener('click', () => productCodeInput.value = 'P'+Math.floor(Math.random()*1000));

    // Logs (Baru)
    if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', loadActivityLogs);

    // UI
    closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
    autoRefreshToggle.addEventListener('change', () => { 
        autoRefresh = autoRefreshToggle.checked;
        if(autoRefresh) startAutoRefresh(); else clearInterval(autoRefreshTimer);
    });

    // === INIT ===
    updateStatus('Ready');
    loadOrders();
    loadQueueData();
    loadProducts();
    // loadActivityLogs dipanggil saat tab diklik
    startAutoRefresh();
});