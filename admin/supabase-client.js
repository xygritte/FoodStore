// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://whngeaxjrrfgbldnelpq.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s' 
};

// Supabase client
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// Helper functions
class SupabaseClient {
    
    // === HELPER: DAPATKAN TANGGAL HARI INI (YYYY-MM-DD) ===
    // Penting agar antrian reset setiap pagi
    getTodayDateStr() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000; // Offset zona waktu lokal
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 10);
        return localISOTime;
    }

    // === PRODUK & ORDER BASIC ===
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

    // === UPLOAD BUKTI ===
    async uploadProofImage(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, file);

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(filePath);

            return { success: true, url: publicUrlData.publicUrl };
        } catch (error) {
            console.error('Error uploading proof:', error);
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
            console.error('Error updating order proof:', error);
            return { success: false, error: error.message };
        }
    }

    // === FITUR ANTRIAN (DIPERBAIKI) ===

    // 1. Get Next Queue Number (RESET HARIAN)
    async getNextQueueNumber() {
        try {
            const todayStr = this.getTodayDateStr();

            // Cari nomor antrian tertinggi HARI INI saja
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
            // Jika hari ini sudah ada antrian, lanjutkan. Jika belum, mulai dari 1.
            if (data && data.length > 0 && data[0].queue_number) {
                nextQueue = data[0].queue_number + 1;
            }
            
            return { success: true, queue_number: nextQueue };
        } catch (error) {
            console.error('Error getting next queue number:', error);
            return { success: false, error: error.message };
        }
    }

    // 2. Get Queue Status (HARI INI SAJA)
    async getQueueStatus() {
        try {
            const todayStr = this.getTodayDateStr();

            // A. Dapatkan antrian yang sedang diproses (Status 'processing') HARI INI
            const { data: currentQueueData, error: currentError } = await supabase
                .from('sales')
                .select('queue_number')
                .eq('status', 'processing')
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true })
                .limit(1);

            if (currentError) throw currentError;

            // B. Dapatkan daftar antrian aktif (Pending & Processing) HARI INI
            const { data: queueList, error: listError } = await supabase
                .from('sales')
                .select('queue_number, customer_name, status, product_name')
                .in('status', ['pending', 'processing'])
                .gte('sale_date', `${todayStr}T00:00:00`)
                .order('queue_number', { ascending: true });
            
            if (listError) throw listError;
            
            // C. Grouping data
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

    // 3. Clear Queue (Tandai Selesai SEMUA ITEM di antrian itu)
    async clearQueue(queueNumber) {
        try {
            const todayStr = this.getTodayDateStr();

            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'completed' })
                .eq('queue_number', queueNumber)
                .gte('sale_date', `${todayStr}T00:00:00`) // Hanya update hari ini
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error clearing queue:', error);
            return { success: false, error: error.message };
        }
    }

    // 4. Move to Processing (BARU: Untuk Admin Next Queue)
    async moveToProcessing(queueNumber) {
        try {
            const todayStr = this.getTodayDateStr();

            // Ubah SEMUA item di nomor antrian ini jadi 'processing'
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

    // 5. Reset Queue (HARI INI SAJA)
    async resetQueue() {
        try {
            const todayStr = this.getTodayDateStr();
            
            // Cancel semua yang masih pending/processing HARI INI
            const { data, error } = await supabase
                .from('sales')
                .update({ 
                    status: 'cancelled',
                })
                .in('status', ['pending', 'processing'])
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