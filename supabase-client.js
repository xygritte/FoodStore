// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://whngeaxjrrfgbldnelpq.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s' 
};

// Supabase client
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// Helper functions
class SupabaseClient {
    // Get all products
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

    // Create new order
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

    // Get orders with filters
    async getOrders(filters = {}) {
        try {
            let query = supabase.from('sales').select('*');
            
            if (filters.status && filters.status !== 'all') {
                query = query.eq('status', filters.status);
            }
            
            if (filters.date) {
                query = query.gte('sale_date', `${filters.date}T00:00:00`)
                           .lte('sale_date', `${filters.date}T23:59:59`);
            }
            
            query = query.order('sale_date', { ascending: false });
            
            const { data, error } = await query;
            
            if (error) throw error;
            return { success: true, orders: data };
        } catch (error) {
            console.error('Error fetching orders:', error);
            return { success: false, error: error.message };
        }
    }

    // Get specific orders by their IDs
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

    // Update order status
    async updateOrderStatus(orderId, status) {
        try {
            const updates = { status };
            if (status === 'confirmed') {
                updates.confirmed_at = new Date().toISOString();
            }
            
            const { data, error } = await supabase
                .from('sales')
                .update(updates)
                .eq('id', orderId)
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating order:', error);
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

    // 1. Upload file ke Storage
    async uploadProofImage(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, file);

            if (error) throw error;

            // Dapatkan Public URL
            const { data: publicUrlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(filePath);

            return { success: true, url: publicUrlData.publicUrl };
        } catch (error) {
            console.error('Error uploading proof:', error);
            return { success: false, error: error.message };
        }
    }

    // 2. Update URL bukti pembayaran ke tabel sales
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

    // === FITUR ANTRIAN BARU ===

    // 3. Get Next Queue Number
    async getNextQueueNumber() {
        try {
            // Cari nomor antrian tertinggi yang pernah ada
            // Note: Idealnya direset harian, tapi untuk MVP kita ambil max global + 1
            const { data, error } = await supabase
                .from('sales')
                .select('queue_number')
                .not('queue_number', 'is', null) // Filter yang tidak null
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
            // Fallback jika error, return timestamp kecil atau random
            return { success: false, error: error.message };
        }
    }

    // 4. Get Queue Status (Current & List)
    async getQueueStatus() {
        try {
            // A. Dapatkan antrian yang sedang diproses (Status 'processing')
            // Ambil yang queue_number-nya paling kecil (yang duluan masuk)
            const { data: currentQueueData, error: currentError } = await supabase
                .from('sales')
                .select('queue_number')
                .eq('status', 'processing')
                .order('queue_number', { ascending: true })
                .limit(1);

            if (currentError) throw currentError;

            // B. Dapatkan daftar antrian aktif (Pending & Processing) untuk list
            const { data: queueList, error: listError } = await supabase
                .from('sales')
                .select('queue_number, customer_name, status, product_name')
                .in('status', ['pending', 'processing'])
                .order('queue_number', { ascending: true });
            
            if (listError) throw listError;
            
            // C. Grouping data berdasarkan queue_number (karena 1 queue = banyak item sales)
            const groupedQueue = {};
            
            if (queueList) {
                queueList.forEach(order => {
                    if (!order.queue_number) return; // Skip jika null
                    
                    if (!groupedQueue[order.queue_number]) {
                        groupedQueue[order.queue_number] = {
                            queue_number: order.queue_number,
                            customer_name: order.customer_name,
                            status: order.status,
                            items: []
                        };
                    }
                    // Jika ada satu item statusnya processing, anggap grup itu processing
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

    // 5. Clear Queue (Tandai Selesai)
    async clearQueue(queueNumber) {
        try {
            // Update semua item dengan nomor antrian tersebut menjadi 'completed'
            const { data, error } = await supabase
                .from('sales')
                .update({ status: 'completed' })
                .eq('queue_number', queueNumber)
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error clearing queue:', error);
            return { success: false, error: error.message };
        }
    }

    // 6. Reset Queue (Emergency/Closing)
    async resetQueue() {
        try {
            // Batalkan semua yang masih pending/processing dan hapus nomor antriannya
            // Atau cukup set status ke cancelled
            const { data, error } = await supabase
                .from('sales')
                .update({ 
                    status: 'cancelled',
                    // Opsional: queue_number: null 
                })
                .in('status', ['pending', 'processing']);
            
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