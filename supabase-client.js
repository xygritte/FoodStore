// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://whngeaxjrrfgbldnelpq.supabase.co', // GANTI
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s' // GANTI
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
                .in('id', idList) // <-- Filter penting
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
            // Anda bisa tambahkan 'cancelled_at' jika tabel Anda mendukung
            // if (status === 'cancelled') {
            //     updates.cancelled_at = new Date().toISOString();
            // }

            const { data, error } = await supabase
                .from('sales')
                .update(updates)
                .in('id', idList) // <-- Menggunakan .in() untuk update massal
                .select();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating multiple order statuses:', error);
            return { success: false, error: error.message };
        }
    }
    // ... method lainnya ...
    
    // === TAMBAHAN BARU UNTUK UPLOAD BUKTI ===
    
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

    // 2. Update URL bukti pembayaran ke tabel sales (update massal berdasarkan ID)
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
}



// Global instance
const supabaseClient = new SupabaseClient();