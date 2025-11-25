// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://whngeaxjrrfgbldnelpq.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s' 
};

// Supabase client
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

class SupabaseClient {
    
    // === HELPER: Tanggal Hari Ini (Local Time) ===
    // Digunakan untuk memastikan antrian & reset berlaku per hari ini saja
    getTodayDateStr() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 10);
        return localISOTime;
    }

    // === 1. PRODUK & ORDER BASIC ===
    
    // Ambil semua produk
    async getProducts() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('code');
            
            if (error) throw error;
            return { success: true, products: data };
        } catch (error) {
            console.error('Error fetching products:', error);
            return { success: false, error: error.message };
        }
    }

    // Buat pesanan baru (Status awal: Pending)
    async createOrder(orderData) {
        try {
            const { data, error } = await supabase
                .from('sales')
                .insert([orderData])
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Error creating order:', error);
            return { success: false, error: error.message };
        }
    }

    // Ambil pesanan berdasarkan ID (untuk History/Receipt)
    async getOrdersByIds(idList) {
        if (!idList || idList.length === 0) {
            return { success: true, orders: [] };
        }
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .in('id', idList) 
                .order('sale_date', { ascending: false });
            
            if (error) throw error;
            return { success: true, orders: data };
        } catch (error) {
            console.error('Error fetching orders by IDs:', error);
            return { success: false, error: error.message };
        }
    }

    // Update status banyak pesanan sekaligus (misal: Cancelled)
    async updateOrderStatusByIds(idList, status) {
        if (!idList || idList.length === 0) {
            return { success: true, data: [] };
        }
        try {
            const updates = { status };
            const { data, error } = await supabase
                .from('sales')
                .update(updates)
                .in('id', idList)
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating multiple order statuses:', error);
            return { success: false, error: error.message };
        }
    }

    // === 2. UPLOAD & BUKTI PEMBAYARAN ===
    
    // Upload file gambar ke Storage Supabase
    async uploadProofImage(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, file);

            if (error) throw error;

            // Dapatkan Public URL agar bisa dilihat Admin
            const { data: publicUrlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(filePath);

            return { success: true, url: publicUrlData.publicUrl };
        } catch (error) {
            console.error('Error uploading proof:', error);
            return { success: false, error: error.message };
        }
    }

    // Simpan URL bukti pembayaran ke tabel sales
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
            console.error('Error updating order proof:', error);
            return { success: false, error: error.message };
        }
    }

    // === 3. MANAJEMEN ANTRIAN (ALUR BARU) ===

    // A. Generate Nomor Antrian Baru (Reset Harian)
    async getNextQueueNumber() {
        try {
            const todayStr = this.getTodayDateStr();

            // Cari nomor antrian tertinggi HARI INI
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
            console.error('Error getting next queue number:', error);
            return { success: false, error: error.message };
        }
    }

    // B. Ambil Status Antrian untuk Display (HANYA Confirmed & Processing)
    // Pending TIDAK akan muncul di sini.
    async getQueueStatus() {
        try {
            const todayStr = this.getTodayDateStr();

            // 1. Ambil Antrian yang Sedang Diproses (Status: processing)
            const { data: currentQueueData, error: currentError } = await supabase
                .from('sales')
                .select('queue_number')
                .eq('status', 'processing')
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true })
                .limit(1);

            if (currentError) throw currentError;

            // 2. Ambil Daftar Antrian Aktif (Confirmed & Processing)
            // Filter: Hanya hari ini & Status Confirmed/Processing
            const { data: queueList, error: listError } = await supabase
                .from('sales')
                .select('queue_number, customer_name, status, product_name')
                .in('status', ['confirmed', 'processing']) 
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true });
            
            if (listError) throw listError;
            
            // 3. Grouping data (karena 1 nomor antrian bisa punya banyak item sales)
            const groupedQueue = {};
            
            if (queueList) {
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
                    // Jika ada satu item statusnya processing, grup dianggap processing
                    if (order.status === 'processing') {
                        groupedQueue[order.queue_number].status = 'processing';
                    }
                    groupedQueue[order.queue_number].items.push(order.product_name);
                });
            }
            
            const currentQueueNum = (currentQueueData && currentQueueData.length > 0) 
                ? currentQueueData[0].queue_number 
                : 0;

            return { 
                success: true, 
                data: {
                    current_queue: currentQueueNum,
                    queue_list: Object.values(groupedQueue).sort((a,b) => a.queue_number - b.queue_number)
                }
            };

        } catch (error) {
            console.error('Error getting queue status:', error);
            return { success: false, error: error.message };
        }
    }

    // C. Pindah ke Processing (Confirmed -> Processing)
    // Dipanggil saat Admin klik "Panggil" / "Next"
    async moveToProcessing(queueNumber) {
        try {
            const todayStr = this.getTodayDateStr();

            // Update status SEMUA ITEM dengan nomor antrian tersebut menjadi 'processing'
            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'processing' })
                .eq('queue_number', queueNumber)
                .gte('sale_date', `${todayStr}T00:00:00`)
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error moving queue to processing:', error);
            return { success: false, error: error.message };
        }
    }

    // D. Selesaikan Antrian (Processing -> Completed)
    // Antrian hilang dari layar display
    async clearQueue(queueNumber) {
        try {
            const todayStr = this.getTodayDateStr();

            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'completed' })
                .eq('queue_number', queueNumber)
                .gte('sale_date', `${todayStr}T00:00:00`)
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error clearing queue:', error);
            return { success: false, error: error.message };
        }
    }

    // E. Reset Semua Antrian (Darurat/Tutup Toko)
    async resetQueue() {
        try {
            const todayStr = this.getTodayDateStr();
            
            // Batalkan semua yang masih Pending, Confirmed, atau Processing hari ini
            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'cancelled' })
                .in('status', ['pending', 'processing', 'confirmed'])
                .gte('sale_date', `${todayStr}T00:00:00`);
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error resetting queue:', error);
            return { success: false, error: error.message };
        }
    }
}

// Global instance
const supabaseClient = new SupabaseClient();