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
}

// Global instance
const supabaseClient = new SupabaseClient();