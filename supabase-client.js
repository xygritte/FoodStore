// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_REF.supabase.co', // GANTI
    key: 'YOUR_ANON_KEY' // GANTI
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
}

// Global instance
const supabaseClient = new SupabaseClient();