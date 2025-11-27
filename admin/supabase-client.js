// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://whngeaxjrrfgbldnelpq.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s' 
};

// Supabase client
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

class SupabaseClient {
    
    getTodayDateStr() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return (new Date(now - offset)).toISOString().slice(0, 10);
    }

    // === 1. PRODUK & ORDER BASIC ===
    async getProducts() {
        try {
            const { data, error } = await supabase.from('products').select('*').order('code');
            if (error) throw error;
            return { success: true, products: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async createOrder(orderData) {
        try {
            const { data, error } = await supabase.from('sales').insert([orderData]).select();
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getOrdersByIds(idList) {
        if (!idList || idList.length === 0) return { success: true, orders: [] };
        try {
            const { data, error } = await supabase.from('sales').select('*').in('id', idList).order('sale_date', { ascending: false });
            if (error) throw error;
            return { success: true, orders: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateOrderStatusByIds(idList, status) {
        if (!idList || idList.length === 0) return { success: true, data: [] };
        try {
            const { data, error } = await supabase.from('sales').update({ status }).in('id', idList).select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // === 2. UPLOAD & BUKTI PEMBAYARAN ===
    async uploadProofImage(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const { error } = await supabase.storage.from('payment-proofs').upload(fileName, file);
            if (error) throw error;
            const { data: publicUrlData } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
            return { success: true, url: publicUrlData.publicUrl };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateOrderProof(idList, proofUrl) {
        try {
            const { data, error } = await supabase.from('sales').update({ payment_proof_url: proofUrl }).in('id', idList).select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // === 3. MANAJEMEN ANTRIAN ===
    async _calculateNextQueueNumber() {
        try {
            const todayStr = this.getTodayDateStr();
            const { data, error } = await supabase.from('sales').select('queue_number').gte('sale_date', `${todayStr}T00:00:00`).lte('sale_date', `${todayStr}T23:59:59`).not('queue_number', 'is', null).order('queue_number', { ascending: false }).limit(1);
            if (error) throw error;
            let nextQueue = 1;
            if (data && data.length > 0 && data[0].queue_number) nextQueue = data[0].queue_number + 1;
            return { success: true, queue_number: nextQueue };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async assignQueueNumber(orderIds) {
        try {
            const queueResult = await this._calculateNextQueueNumber();
            if (!queueResult.success) throw new Error(queueResult.error);
            const nextQueue = queueResult.queue_number;
            const { data, error } = await supabase.from('sales').update({ queue_number: nextQueue, status: 'confirmed', confirmed_at: new Date().toISOString() }).in('id', orderIds).select();
            if (error) throw error;
            return { success: true, data, queue_number: nextQueue };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getQueueStatus() {
        try {
            const todayStr = this.getTodayDateStr();
            let { data: currentQueueData, error: currentError } = await supabase.from('sales').select('queue_number').eq('status', 'processing').gte('sale_date', `${todayStr}T00:00:00`).order('queue_number', { ascending: true }).limit(1);
            if (currentError) throw currentError;

            if (!currentQueueData || currentQueueData.length === 0) {
                 const { data: globalProcessing } = await supabase.from('sales').select('queue_number').eq('status', 'processing').order('sale_date', { ascending: false }).limit(1);
                if (globalProcessing && globalProcessing.length > 0) currentQueueData = globalProcessing;
            }

            let { data: queueList, error: listError } = await supabase.from('sales').select('queue_number, customer_name, status, product_name, sale_date').in('status', ['confirmed', 'processing']).gte('sale_date', `${todayStr}T00:00:00`).order('queue_number', { ascending: true });
            if (listError) throw listError;

            if (!queueList || queueList.length === 0) {
                const { data: fallbackList, error: fallbackError } = await supabase.from('sales').select('queue_number, customer_name, status, product_name, sale_date').in('status', ['confirmed', 'processing']).not('queue_number', 'is', null).order('queue_number', { ascending: true });
                if (!fallbackError) queueList = fallbackList;
            }
            
            const groupedQueue = {};
            if (queueList && queueList.length > 0) {
                queueList.forEach(order => {
                    if (!order.queue_number) return; 
                    if (!groupedQueue[order.queue_number]) {
                        groupedQueue[order.queue_number] = { queue_number: order.queue_number, customer_name: order.customer_name, status: order.status, items: [] };
                    }
                    if (order.status === 'processing') groupedQueue[order.queue_number].status = 'processing';
                    groupedQueue[order.queue_number].items.push(order.product_name);
                });
            }
            
            const currentQueueNum = (currentQueueData && currentQueueData.length > 0) ? currentQueueData[0].queue_number : 0;
            return { success: true, data: { current_queue: currentQueueNum, queue_list: Object.values(groupedQueue).sort((a,b) => a.queue_number - b.queue_number) } };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async moveToProcessing(queueNumber) {
        try {
            const { data, error } = await supabase.from('sales').update({ status: 'processing' }).eq('queue_number', queueNumber).neq('status', 'cancelled').select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async clearQueue(queueNumber) {
        try {
            const { data, error } = await supabase.from('sales').update({ status: 'completed' }).eq('queue_number', queueNumber).neq('status', 'cancelled').select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async resetQueue() {
        try {
            const todayStr = this.getTodayDateStr();
            const { data, error } = await supabase.from('sales').update({ status: 'cancelled' }).in('status', ['pending', 'processing', 'confirmed']).gte('sale_date', `${todayStr}T00:00:00`);
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // === 4. ACTIVITY LOGS (BARU) ===
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
}

const supabaseClient = new SupabaseClient();