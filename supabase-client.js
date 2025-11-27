// Supabase Configuration
const SUPABASE_CONFIG = {
    // Ganti dengan URL dan Key project Supabase Anda jika berbeda
    url: 'https://whngeaxjrrfgbldnelpq.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s' 
};

// Init Supabase client
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

class SupabaseClient {
    
    // Helper untuk mendapatkan tanggal hari ini (YYYY-MM-DD) sesuai zona waktu lokal
    getTodayDateStr() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return (new Date(now - offset)).toISOString().slice(0, 10);
    }

    // ==========================================
    // 1. MODULE PRODUK & ORDER (BASIC)
    // ==========================================

    async getProducts() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('code');

            if (error) throw error;
            return { success: true, products: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async createOrder(orderData) {
        try {
            const { data, error } = await supabase
                .from('sales')
                .insert([orderData])
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Mengambil detail pesanan berdasarkan list ID (untuk History Customer)
    async getOrdersByIds(idList) {
        if (!idList || idList.length === 0) return { success: true, orders: [] };
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .in('id', idList)
                .order('sale_date', { ascending: false });

            if (error) throw error;
            return { success: true, orders: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update status massal (misal: Customer membatalkan pesanannya sendiri)
    async updateOrderStatusByIds(idList, status) {
        if (!idList || idList.length === 0) return { success: true, data: [] };
        try {
            const { data, error } = await supabase
                .from('sales')
                .update({ status })
                .in('id', idList)
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // 2. MODULE UPLOAD BUKTI BAYAR
    // ==========================================

    async uploadProofImage(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            
            const { error } = await supabase.storage
                .from('payment-proofs')
                .upload(fileName, file);

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(fileName);

            return { success: true, url: publicUrlData.publicUrl };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateOrderProof(idList, proofUrl) {
        try {
            const { data, error } = await supabase
                .from('sales')
                .update({ payment_proof_url: proofUrl })
                .in('id', idList)
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // 3. MODULE MANAJEMEN ANTRIAN (LOGIC)
    // ==========================================

    // Private: Hitung nomor antrian berikutnya hari ini
    async _calculateNextQueueNumber() {
        try {
            const todayStr = this.getTodayDateStr();
            
            // Cari nomor antrian terbesar hari ini
            const { data, error } = await supabase
                .from('sales')
                .select('queue_number')
                .gte('sale_date', `${todayStr}T00:00:00`)
                .lte('sale_date', `${todayStr}T23:59:59`)
                .not('queue_number', 'is', null)
                .order('queue_number', { ascending: false })
                .limit(1);

            if (error) throw error;

            let nextQueue = 1;
            if (data && data.length > 0 && data[0].queue_number) {
                nextQueue = data[0].queue_number + 1;
            }
            return { success: true, queue_number: nextQueue };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Admin: Assign nomor antrian (Konfirmasi Pesanan)
    async assignQueueNumber(orderIds) {
        try {
            const queueResult = await this._calculateNextQueueNumber();
            if (!queueResult.success) throw new Error(queueResult.error);
            
            const nextQueue = queueResult.queue_number;

            const { data, error } = await supabase
                .from('sales')
                .update({ 
                    queue_number: nextQueue, 
                    status: 'confirmed',
                    confirmed_at: new Date().toISOString()
                })
                .in('id', orderIds)
                .select();

            if (error) throw error;
            return { success: true, data, queue_number: nextQueue };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Customer & Admin: Ambil Status Antrian Saat Ini
    async getQueueStatus() {
        try {
            const todayStr = this.getTodayDateStr();

            // 1. Cari siapa yang sedang diproses (status: processing) hari ini
            let { data: currentQueueData, error: currentError } = await supabase
                .from('sales')
                .select('queue_number')
                .eq('status', 'processing')
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true })
                .limit(1);

            if (currentError) throw currentError;

            // Fallback: Jika tidak ada yang processing hari ini, cari yang global (jaga-jaga antrian lewat tengah malam)
            if (!currentQueueData || currentQueueData.length === 0) {
                 const { data: globalProcessing } = await supabase
                    .from('sales')
                    .select('queue_number')
                    .eq('status', 'processing')
                    .order('sale_date', { ascending: false })
                    .limit(1);
                
                if (globalProcessing && globalProcessing.length > 0) {
                    currentQueueData = globalProcessing;
                }
            }

            // 2. Ambil semua antrian aktif (Confirmed & Processing) hari ini untuk ditampilkan di list
            let { data: queueList, error: listError } = await supabase
                .from('sales')
                .select('queue_number, customer_name, status, product_name, sale_date')
                .in('status', ['confirmed', 'processing'])
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true });

            if (listError) throw listError;

            // Grouping agar 1 customer dengan banyak item tidak muncul berkali-kali di list antrian
            const groupedQueue = {};
            if (queueList && queueList.length > 0) {
                queueList.forEach(order => {
                    if (!order.queue_number) return; 
                    
                    if (!groupedQueue[order.queue_number]) {
                        groupedQueue[order.queue_number] = {
                            queue_number: order.queue_number,
                            customer_name: order.customer_name,
                            status: order.status,
                            items: []
                        };
                    }
                    // Jika salah satu item sedang diproses, anggap satu grup sedang diproses
                    if (order.status === 'processing') {
                        groupedQueue[order.queue_number].status = 'processing';
                    }
                    groupedQueue[order.queue_number].items.push(order.product_name);
                });
            }
            
            const currentQueueNum = (currentQueueData && currentQueueData.length > 0) ? currentQueueData[0].queue_number : 0;

            return { 
                success: true, 
                data: { 
                    current_queue: currentQueueNum, 
                    queue_list: Object.values(groupedQueue).sort((a,b) => a.queue_number - b.queue_number)
                } 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Admin: Panggil Antrian (Ubah status ke Processing)
    async moveToProcessing(queueNumber) {
        try {
            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'processing' })
                .eq('queue_number', queueNumber)
                .neq('status', 'cancelled') // Jangan update yang sudah batal
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Admin: Selesaikan Antrian (Ubah status ke Completed)
    async clearQueue(queueNumber) {
        try {
            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'completed' })
                .eq('queue_number', queueNumber)
                .neq('status', 'cancelled')
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Admin: Reset Antrian (Batalkan semua yang pending/processing hari ini)
    async resetQueue() {
        try {
            const todayStr = this.getTodayDateStr();
            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'cancelled' })
                .in('status', ['pending', 'processing', 'confirmed'])
                .gte('sale_date', `${todayStr}T00:00:00`);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // 4. MODULE ACTIVITY LOGS (ADMIN)
    // ==========================================
    async getActivityLogs(limit = 50) {
        try {
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .order('changed_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // 5. MODULE REALTIME SUBSCRIPTION (CUSTOMER)
    // ==========================================
    
    // Fungsi ini mendengarkan perubahan di tabel 'sales' secara live
    // Digunakan oleh script.js untuk update notifikasi & antrian otomatis
    subscribeToSales(callback) {
        return supabase
            .channel('public:sales')
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public', table: 'sales' }, 
                (payload) => {
                    // Panggil fungsi callback di script.js setiap ada perubahan data
                    callback(payload);
                }
            )
            .subscribe();
    }
}

// Export instance agar bisa langsung dipakai di file HTML/JS lain
const supabaseClient = new SupabaseClient();