import tkinter as tk
from tkinter import ttk, messagebox
import requests
import json
from datetime import datetime
import threading

class SupabaseAdmin:
    def __init__(self, root):
        self.root = root
        self.root.title("Admin Warung Bieem - Supabase")
        self.root.geometry("1000x700")
        
        # Panggil setup konstanta dan gaya
        self.setup_constants_and_styles()
        
        self.root.configure(bg=self.styles['bg_light'])
        
        # Auto-refresh configuration
        self.auto_refresh = True
        
        # Data
        self.orders = []
        self.products = []
        self.grouped_orders = {}
        
        # Setup GUI
        self.setup_gui()
        self.load_data()
        
        # Start auto-refresh
        self.start_auto_refresh()
        
    def setup_constants_and_styles(self):
        """Sentralisasi semua konstanta dan info styling."""
        # Supabase Configuration
        self.SUPABASE_URL = "https://whngeaxjrrfgbldnelpq.supabase.co"
        self.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmdlYXhqcnJmZ2JsZG5lbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMyODIsImV4cCI6MjA3ODY3OTI4Mn0.40PLSwX4X2BxRCy-LXOubqbZR3gvB5JqFOyHUV5TS9s"
        
        # API Headers
        self.headers = {
            "apikey": self.SUPABASE_KEY,
            "Authorization": f"Bearer {self.SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        # Table Names
        self.SALES_TABLE = "sales"
        self.PRODUCTS_TABLE = "products"
        
        # Configs
        self.REFRESH_INTERVAL = 5000  # 5 detik
        
        # Styling
        self.styles = {
            'primary_color': '#ff9800',
            'primary_text': 'white',
            'secondary_color': '#fff3e0',
            'secondary_text': '#e65100',
            'status_bg': '#ffecb3',
            'success_color': '#4caf50',
            'danger_color': '#f44336',
            'info_color': '#2196f3',
            'bg_light': '#ffffff',
            'font_bold': ("Arial", 9, "bold"),
            'font_normal': ("Arial", 9),
            'font_title': ("Arial", 18, "bold")
        }

    def run_in_thread(self, target_func, *args):
        """Menjalankan fungsi di thread baru agar GUI tidak freeze."""
        thread = threading.Thread(target=target_func, args=args, daemon=True)
        thread.start()

    def schedule_gui_update(self, func, *args):
        """Menjadwalkan update GUI dari thread lain agar thread-safe."""
        self.root.after(0, func, *args)

    # ==================================================================
    # === GUI SETUP METHODS
    # ==================================================================

    def setup_gui(self):
        """Setup GUI components"""
        # Header
        header_frame = tk.Frame(self.root, bg=self.styles['primary_color'], height=80)
        header_frame.pack(fill=tk.X, side=tk.TOP)
        header_frame.pack_propagate(False)
        
        title_label = tk.Label(header_frame, text="🏪 ADMIN WARUNG BIEEM", 
                            font=self.styles['font_title'], bg=self.styles['primary_color'], 
                            fg=self.styles['primary_text'])
        title_label.pack(pady=20)
        
        # Main frame
        main_frame = ttk.Frame(self.root, padding="3")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Notebook (Tabs)
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        self.notebook.bind("<<NotebookTabChanged>>", self.on_tab_change)
        
        # Tab 1: Orders Management
        self.orders_frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.orders_frame, text="📋 Kelola Pesanan")
        
        # Tab 2: Products Management
        self.products_frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(self.products_frame, text="📦 Kelola Produk")
        
        self.setup_orders_tab()
        self.setup_products_tab()
        
        # Status bar
        self.status_var = tk.StringVar()
        self.status_var.set("Ready - Terhubung ke Supabase")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN, 
                            background=self.styles['status_bg'], 
                            foreground=self.styles['secondary_text'])
        status_bar.pack(fill=tk.X, pady=(5, 0))

    def setup_orders_tab(self):
        """Setup orders management tab"""
        
        # Konten Dashboard dipindahkan ke sini (paling atas)
        stats_frame = tk.LabelFrame(self.orders_frame, text="Statistik Penjualan", 
                                    bg=self.styles['secondary_color'], fg=self.styles['secondary_text'], 
                                    font=("Arial", 10, "bold"), padx=15, pady=15)
        stats_frame.pack(fill=tk.X, pady=(0, 10))

        # StringVars for stats
        self.total_sales_var = tk.StringVar(value="Rp 0")
        self.total_sold_var = tk.StringVar(value="0 pcs")
        self.pending_orders_var = tk.StringVar(value="0 pesanan")
        self.confirmed_orders_var = tk.StringVar(value="0 pesanan")

        # GUI Labels
        lbl_font = ("Arial", 12)
        val_font = ("Arial", 14, "bold")
        lbl_config = {'bg': self.styles['secondary_color']}

        tk.Label(stats_frame, text="Total Penjualan (Confirmed):", font=lbl_font, **lbl_config).grid(row=0, column=0, sticky="w", pady=5)
        tk.Label(stats_frame, textvariable=self.total_sales_var, font=val_font, **lbl_config, fg=self.styles['success_color']).grid(row=0, column=1, sticky="w", padx=10)
        
        tk.Label(stats_frame, text="Total Produk Terjual (Confirmed):", font=lbl_font, **lbl_config).grid(row=1, column=0, sticky="w", pady=5)
        tk.Label(stats_frame, textvariable=self.total_sold_var, font=val_font, **lbl_config).grid(row=1, column=1, sticky="w", padx=10)
        
        tk.Label(stats_frame, text="Pesanan Pending:", font=lbl_font, **lbl_config).grid(row=2, column=0, sticky="w", pady=5)
        tk.Label(stats_frame, textvariable=self.pending_orders_var, font=val_font, **lbl_config, fg=self.styles['secondary_text']).grid(row=2, column=1, sticky="w", padx=10)

        tk.Label(stats_frame, text="Pesanan Dikonfirmasi:", font=lbl_font, **lbl_config).grid(row=3, column=0, sticky="w", pady=5)
        tk.Label(stats_frame, textvariable=self.confirmed_orders_var, font=val_font, **lbl_config, fg=self.styles['success_color']).grid(row=3, column=1, sticky="w", padx=10)
        # AKHIR DARI KONTEN DASHBOARD

        # Konten asli setup_orders_tab berlanjut di bawahnya
        filter_frame = tk.LabelFrame(self.orders_frame, text="Filter Pesanan", 
                                bg=self.styles['secondary_color'], fg=self.styles['secondary_text'], 
                                font=("Arial", 10, "bold"), padx=10, pady=10)
        filter_frame.pack(fill=tk.X, pady=(0, 10))
        
        tk.Label(filter_frame, text="Status:", bg=self.styles['secondary_color'], 
                fg=self.styles['secondary_text'], 
                font=self.styles['font_bold']).grid(row=0, column=0, padx=(0, 5))
        
        self.status_filter = ttk.Combobox(filter_frame, values=["Semua", "pending", "confirmed", "cancelled"],
                                        state="readonly", width=15)
        self.status_filter.set("Semua")
        self.status_filter.grid(row=0, column=1, padx=(0, 10))
        self.status_filter.bind('<<ComboboxSelected>>', self.filter_orders)
        
        refresh_btn = tk.Button(filter_frame, text="🔄 Refresh", command=self.load_orders,
                            bg=self.styles['primary_color'], fg=self.styles['primary_text'], 
                            font=self.styles['font_bold'], relief="flat", padx=10)
        refresh_btn.grid(row=0, column=2, padx=5)
        
        self.auto_refresh_var = tk.BooleanVar(value=True)
        auto_refresh_btn = tk.Checkbutton(filter_frame, text="🔄 Auto-Refresh (5s)", 
                                        variable=self.auto_refresh_var,
                                        command=self.toggle_auto_refresh,
                                        bg=self.styles['secondary_color'], fg=self.styles['secondary_text'], 
                                        font=self.styles['font_normal'], selectcolor="#ffcc80")
        auto_refresh_btn.grid(row=0, column=3, padx=10)
        
        # Orders Treeview
        tree_container = ttk.Frame(self.orders_frame)
        tree_container.pack(fill=tk.BOTH, expand=True)
        
        # --- PERUBAHAN DI SINI ---
        # 1. Tambahkan 'group_key' di awal 'columns'
        columns = ("group_key", "order_group", "datetime", "customer", "items_count", "total", "status", "notes")
        # 2. Buat tuple baru 'display_cols' HANYA untuk kolom yang ingin Anda TAMPILKAN
        display_cols = ("order_group", "datetime", "customer", "items_count", "total", "status", "notes")
        
        self.orders_tree = ttk.Treeview(tree_container, columns=columns, show="headings", 
                                      height=15, selectmode="extended",
                                      displaycolumns=display_cols) # <-- 3. Gunakan displaycolumns
        
        # 4. Loop melalui 'display_cols', BUKAN 'columns'
        for col in display_cols:
            self.orders_tree.heading(col, text=col.replace("_", " ").title())
        # --- AKHIR PERUBAHAN ---
        
        self.orders_tree.column("order_group", width=120)
        self.orders_tree.column("datetime", width=150)
        self.orders_tree.column("customer", width=150)
        self.orders_tree.column("items_count", width=80)
        self.orders_tree.column("total", width=120)
        self.orders_tree.column("status", width=100)
        self.orders_tree.column("notes", width=200)
        
        scrollbar = ttk.Scrollbar(tree_container, orient=tk.VERTICAL, command=self.orders_tree.yview)
        self.orders_tree.configure(yscrollcommand=scrollbar.set)
        self.orders_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.orders_tree.tag_configure('pending', background='#fff3cd')
        self.orders_tree.tag_configure('confirmed', background='#d4edda')
        self.orders_tree.tag_configure('cancelled', background='#f8d7da')
        self.orders_tree.tag_configure('mixed', background='#e3f2fd')
        
        # Action buttons
        action_frame = tk.Frame(self.orders_frame, bg=self.styles['bg_light'])
        action_frame.pack(fill=tk.X, pady=10)
        
        btn_config = {'fg': self.styles['primary_text'], 'font': self.styles['font_bold'], 
                      'relief': "flat", 'padx': 15, 'pady': 5}
        
        confirm_btn = tk.Button(action_frame, text="✅ Konfirmasi Pilihan", 
                            command=self.confirm_order, bg=self.styles['success_color'], **btn_config)
        confirm_btn.pack(side=tk.LEFT, padx=5)
        
        cancel_btn = tk.Button(action_frame, text="❌ Batalkan Pilihan", 
                            command=self.cancel_order, bg=self.styles['danger_color'], **btn_config)
        cancel_btn.pack(side=tk.LEFT, padx=5)
        
        details_btn = tk.Button(action_frame, text="👁️ Lihat Detail", 
                            command=self.view_order_details, bg=self.styles['info_color'], **btn_config)
        details_btn.pack(side=tk.LEFT, padx=5)
        
        # --- TAMBAHAN BARU ---
        print_btn = tk.Button(action_frame, text="🖨️ Print", 
                            command=self.print_selected_order, bg="#78909c", **btn_config) # Warna abu-abu netral
        print_btn.pack(side=tk.LEFT, padx=5)
        # --- AKHIR TAMBAHAN ---
        
    def setup_products_tab(self):
        """Setup products management tab"""
        form_frame = tk.LabelFrame(self.products_frame, text="Tambah Produk Baru", 
                                 bg=self.styles['secondary_color'], fg=self.styles['secondary_text'], 
                                 font=("Arial", 10, "bold"), padx=10, pady=10)
        form_frame.pack(fill=tk.X, pady=(0, 10))
        
        form_lbl_config = {'bg': self.styles['secondary_color'], 'fg': self.styles['secondary_text'], 
                           'font': self.styles['font_normal']}
        
        tk.Label(form_frame, text="Nama Produk:", **form_lbl_config).grid(row=0, column=0, sticky="w", pady=5)
        self.product_name = ttk.Entry(form_frame, width=30, font=self.styles['font_normal'])
        self.product_name.grid(row=0, column=1, pady=5, padx=5, sticky="w")
        
        tk.Label(form_frame, text="Harga:", **form_lbl_config).grid(row=1, column=0, sticky="w", pady=5)
        self.product_price = ttk.Entry(form_frame, width=20, font=self.styles['font_normal'])
        self.product_price.grid(row=1, column=1, pady=5, padx=5, sticky="w")
        
        tk.Label(form_frame, text="Kode:", **form_lbl_config).grid(row=2, column=0, sticky="w", pady=5)
        code_frame = tk.Frame(form_frame, bg=self.styles['secondary_color'])
        code_frame.grid(row=2, column=1, pady=5, padx=5, sticky="w")
        
        self.product_code = ttk.Entry(code_frame, width=15, font=self.styles['font_normal'])
        self.product_code.pack(side=tk.LEFT)
        
        generate_btn = tk.Button(code_frame, text="Generate", 
                                command=self.generate_product_code, bg=self.styles['primary_color'], 
                                fg=self.styles['primary_text'], font=("Arial", 8, "bold"), 
                                relief="flat", padx=8)
        generate_btn.pack(side=tk.LEFT, padx=5)
        
        add_btn = tk.Button(form_frame, text="➕ Tambah Produk", 
                           command=self.add_product, bg=self.styles['primary_color'], 
                           fg=self.styles['primary_text'], font=self.styles['font_bold'], 
                           relief="flat", padx=15, pady=8)
        add_btn.grid(row=3, column=0, columnspan=2, pady=10)
        
        # Products Treeview
        tree_container = ttk.Frame(self.products_frame)
        tree_container.pack(fill=tk.BOTH, expand=True)
        
        columns = ("id", "code", "name", "price")
        
        self.products_tree = ttk.Treeview(tree_container, columns=columns, show="headings", 
                                          height=15, selectmode="extended")

        self.products_tree.heading("id", text="ID")
        self.products_tree.heading("code", text="Kode")
        self.products_tree.heading("name", text="Nama Produk")
        self.products_tree.heading("price", text="Harga")
        
        self.products_tree.column("id", width=50)
        self.products_tree.column("code", width=100)
        self.products_tree.column("name", width=250)
        self.products_tree.column("price", width=100)
        
        scrollbar = ttk.Scrollbar(tree_container, orient=tk.VERTICAL, command=self.products_tree.yview)
        self.products_tree.configure(yscrollcommand=scrollbar.set)
        self.products_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Product actions
        action_frame = tk.Frame(self.products_frame, bg=self.styles['bg_light'])
        action_frame.pack(fill=tk.X, pady=10)
        
        btn_config = {'fg': self.styles['primary_text'], 'font': self.styles['font_bold'], 
                      'relief': "flat", 'padx': 15, 'pady': 5}

        refresh_btn = tk.Button(action_frame, text="🔄 Refresh", 
                               command=self.load_products, bg=self.styles['primary_color'], **btn_config)
        refresh_btn.pack(side=tk.LEFT, padx=5)
        
        delete_btn = tk.Button(action_frame, text="🗑️ Hapus Pilihan", 
                              command=self.delete_product, bg=self.styles['danger_color'], **btn_config)
        delete_btn.pack(side=tk.LEFT, padx=5)
        
        rls_btn = tk.Button(action_frame, text="🔓 Enable RLS (Dev)", 
                           command=self.disable_rls_temporarily, bg="#ff5722", **btn_config)
        rls_btn.pack(side=tk.LEFT, padx=5)

    # ==================================================================
    # === AUTO-REFRESH METHODS
    # ==================================================================

    def start_auto_refresh(self):
        """Start automatic data refresh"""
        if self.auto_refresh:
            self.root.after(self.REFRESH_INTERVAL, self.auto_refresh_data)

    def auto_refresh_data(self):
        """Automatically refresh data"""
        if self.auto_refresh:
            try:
                current_tab = self.notebook.index(self.notebook.select())
                
                if current_tab == 0:  # Orders tab
                    self.load_orders() 
                elif current_tab == 1:  # Products tab  
                    self.load_products()
                
                self.root.after(self.REFRESH_INTERVAL, self.auto_refresh_data)
                
            except Exception as e:
                print(f"Auto-refresh error: {e}")
                self.root.after(self.REFRESH_INTERVAL, self.auto_refresh_data)

    def toggle_auto_refresh(self):
        """Toggle auto-refresh on/off"""
        self.auto_refresh = self.auto_refresh_var.get()
        if self.auto_refresh:
            self.status_var.set("Auto-refresh diaktifkan (5 detik)")
            self.start_auto_refresh()
        else:
            self.status_var.set("Auto-refresh dimatikan")
            
    def on_tab_change(self, event):
        """Refresh data when switching tabs"""
        if self.auto_refresh:
            try:
                current_tab = self.notebook.index(self.notebook.select())
                if current_tab == 0:
                    self.load_orders()
                elif current_tab == 1:
                    self.load_products()
            except Exception as e:
                print(f"Tab change error: {e}")
    
    # ==================================================================
    # === SUPABASE API METHODS
    # ==================================================================

    def supabase_request(self, method, endpoint, data=None, params=None):
        """Make request to Supabase API"""
        try:
            url = f"{self.SUPABASE_URL}/rest/v1/{endpoint}"
            
            if method == "GET" and params:
                query_params = "&".join([f"{k}={v}" for k, v in params.items()])
                url = f"{url}?{query_params}"
            
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                timeout=10
            )
            
            if response.status_code >= 400:
                error_msg = f"Supabase error {response.status_code}: {response.text}"
                print(f"API Error: {error_msg}")
                raise Exception(error_msg)
            
            if method == "GET" and response.text:
                return response.json()
            elif method in ["POST", "PATCH"] and response.text:
                return response.json()
            elif method == "DELETE":
                return response.status_code in [200, 204] or response.text == "[]"
            else:
                return True
                
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            self.schedule_gui_update(self.status_var.set, error_msg)
            print(error_msg)
            return None

    def disable_rls_temporarily(self):
        """Tombol ini memanggil logic RLS di thread terpisah."""
        self.run_in_thread(self._disable_rls_logic)

    def _disable_rls_logic(self):
        """Temporary solution for RLS - disable for products table"""
        try:
            sql_data = {"query": "ALTER TABLE products DISABLE ROW LEVEL SECURITY;"}
            
            response = requests.post(
                f"{self.SUPABASE_URL}/rest/v1/rpc/exec_sql",
                headers=self.headers,
                json=sql_data
            )
            
            if response.status_code == 200:
                self.schedule_gui_update(messagebox.showinfo, "Sukses", "RLS temporarily disabled for products table!")
                self.schedule_gui_update(self.status_var.set, "RLS disabled - bisa tambah produk sekarang")
            else:
                self.schedule_gui_update(messagebox.showinfo, "Cara Fix RLS", 
                    "Untuk menonaktifkan RLS:\n"
                    "1. Buka Supabase Dashboard\n"
                    "2. Pilih project Anda\n"
                    "3. Pergi ke Authentication > Policies\n"
                    "4. Cari tabel 'products'\n"
                    "5. Nonaktifkan RLS atau buat policy baru\n\n"
                    "Atau gunakan Service Role Key untuk bypass RLS")
                
        except Exception as e:
            self.schedule_gui_update(messagebox.showerror, "Error", f"Gagal disable RLS: {str(e)}")

    def add_product_with_service_key(self):
        """Alternative method using service role key if available"""
        service_key = "your_service_role_key_here"
        
        if service_key == "your_service_role_key_here":
            messagebox.showwarning("Info", "Service role key belum diatur. Gunakan tombol 'Enable RLS' untuk instruksi.")
            return
        
        service_headers = self.headers.copy()
        service_headers['apikey'] = service_key
        service_headers['Authorization'] = f"Bearer {service_key}"
        
        name = self.product_name.get().strip()
        price_text = self.product_price.get().strip()
        code = self.product_code.get().strip()
        
        if not name or not price_text or not code:
            messagebox.showerror("Error", "Semua field harus diisi!")
            return
        
        try:
            price = float(price_text)
        except ValueError:
            messagebox.showerror("Error", "Harga harus berupa angka!")
            return
        
        product_data = {"code": code, "name": name, "price": price}
        
        self.run_in_thread(self._add_product_service_logic, product_data, service_headers, name)

    def _add_product_service_logic(self, product_data, service_headers, name):
        """Logika thread untuk menambah produk dengan service key"""
        try:
            response = requests.post(
                f"{self.SUPABASE_URL}/rest/v1/{self.PRODUCTS_TABLE}",
                headers=service_headers,
                json=product_data
            )
            
            if response.status_code == 201:
                self.schedule_gui_update(messagebox.showinfo, "Sukses", f"Produk '{name}' berhasil ditambahkan!")
                self.schedule_gui_update(self.product_name.delete, 0, tk.END)
                self.schedule_gui_update(self.product_price.delete, 0, tk.END)
                self.schedule_gui_update(self.product_code.delete, 0, tk.END)
                self.load_products()
            else:
                self.schedule_gui_update(messagebox.showerror, "Error", f"Gagal menambah produk: {response.text}")
                
        except Exception as e:
            self.schedule_gui_update(messagebox.showerror, "Error", f"Error: {str(e)}")

    # ==================================================================
    # === DATA LOADING & PROCESSING
    # ==================================================================
    
    def load_data(self):
        """Load initial data in threads"""
        self.load_orders()
        self.load_products()
    
    def load_orders(self):
        """Trigger loading orders in a separate thread"""
        self.run_in_thread(self._load_orders_logic)

    def _load_orders_logic(self):
        """Actual logic for loading orders (runs in thread)"""
        try:
            self.schedule_gui_update(self.status_var.set, "Memuat data pesanan...")
            
            params = {"select": "*", "order": "sale_date.desc"}
            orders = self.supabase_request("GET", self.SALES_TABLE, params=params)
            
            if orders is not None:
                self.orders = orders
                self.group_orders() # Data processing
                
                self.schedule_gui_update(self.filter_orders) 
                self.schedule_gui_update(self.update_dashboard_stats)
                
                timestamp = datetime.now().strftime("%H:%M:%S")
                status_msg = f"✅ Data terupdate {timestamp} - {len(orders)} pesanan"
                self.schedule_gui_update(self.status_var.set, status_msg)
            else:
                self.schedule_gui_update(self.status_var.set, "❌ Gagal memuat pesanan")
                
        except Exception as e:
            error_msg = f"❌ Error memuat pesanan: {str(e)}"
            self.schedule_gui_update(self.status_var.set, error_msg)

    def load_products(self):
        """Trigger loading products in a separate thread"""
        self.run_in_thread(self._load_products_logic)

    def _load_products_logic(self):
        """Actual logic for loading products (runs in thread)"""
        try:
            self.schedule_gui_update(self.status_var.set, "Memuat data produk...")
            
            params = {"select": "*", "order": "code.asc"}
            products = self.supabase_request("GET", self.PRODUCTS_TABLE, params=params)
            
            if products is not None:
                self.products = products
                self.schedule_gui_update(self.display_products)
                
                timestamp = datetime.now().strftime("%H:%M:%S")
                status_msg = f"✅ Data terupdate {timestamp} - {len(products)} produk"
                self.schedule_gui_update(self.status_var.set, status_msg)
            else:
                self.schedule_gui_update(self.status_var.set, "❌ Gagal memuat produk")
                
        except Exception as e:
            error_msg = f"❌ Error memuat produk: {str(e)}"
            self.schedule_gui_update(self.status_var.set, error_msg)

    def group_orders(self):
        """Group orders by customer and timestamp (runs in thread)"""
        self.grouped_orders = {}
        
        for order in self.orders:
            customer = order.get('customer_name', 'Unknown')
            sale_date = order['sale_date'][:16]  
            group_key = f"{customer}_{sale_date}"
            
            if group_key not in self.grouped_orders:
                self.grouped_orders[group_key] = {
                    'customer': customer,
                    'datetime': order['sale_date'],
                    'items': [],
                    'total_amount': 0,
                    'status': 'mixed',
                    'notes': order.get('notes', ''),
                    'order_ids': []
                }
            
            self.grouped_orders[group_key]['items'].append(order)
            self.grouped_orders[group_key]['total_amount'] += order.get('total', 0)
            self.grouped_orders[group_key]['order_ids'].append(order['id'])
            
            statuses = {item.get('status', 'pending') for item in self.grouped_orders[group_key]['items']}
            if len(statuses) == 1:
                self.grouped_orders[group_key]['status'] = statuses.pop()
            else:
                self.grouped_orders[group_key]['status'] = 'mixed'
    
    def filter_orders(self, event=None):
        """Filter orders by status (Must run in main thread)"""
        
        # --- 1. SIMPAN PILIHAN SAAT INI ---
        # Kita simpan 'group_key' dari setiap item yang sedang dipilih
        selected_group_keys = set()
        for item_id in self.orders_tree.selection():
            try:
                # Ambil group_key (values[0]) dari item yang dipilih
                selected_group_keys.add(self.orders_tree.item(item_id)['values'][0])
            except Exception:
                pass # Abaikan jika ada error saat membaca item (misal, item sudah tidak ada)
        
        
        status_filter = self.status_filter.get().lower()
        
        # Hapus semua item dari tree
        self.orders_tree.delete(*self.orders_tree.get_children())
        
        # --- 2. SIAPKAN LIST UNTUK PILIHAN BARU ---
        # Kita akan kumpulkan ID item baru yang sesuai dengan pilihan lama
        new_item_ids_to_select = []
        
        for group_key, order_data in self.grouped_orders.items():
            status = order_data.get('status', 'pending')
            
            if status_filter == "semua" or status_filter == status or (status_filter == "pending" and status == "mixed"):
                customer_name = order_data.get('customer', 'Customer')
                items_count = len(order_data['items'])
                total = f"Rp {order_data['total_amount']:,.0f}".replace(",", ".")
                notes = order_data.get('notes', '')
                notes_display = notes[:50] + "..." if len(notes) > 50 else notes
                
                group_display = f"Order-{items_count}items"
                
                # --- 3. TANGKAP 'item_id' YANG BARU DIBUAT ---
                # self.orders_tree.insert() mengembalikan ID dari item yang baru dibuat
                item_id = self.orders_tree.insert(
                    "", "end",
                    values=(
                        group_key,  # values[0]
                        group_display,
                        order_data['datetime'],
                        customer_name,
                        items_count,
                        total,
                        status,
                        notes_display
                    ),
                    tags=(status,)
                )
                
                # --- 4. PERIKSA APAKAH ITEM INI HARUS DIPILIH KEMBALI ---
                if group_key in selected_group_keys:
                    new_item_ids_to_select.append(item_id)
        
        # --- 5. TERAPKAN KEMBALI PILIHAN ---
        # Setelah loop selesai dan tabel terisi, kita pilih kembali semua item
        if new_item_ids_to_select:
            self.orders_tree.selection_set(new_item_ids_to_select)
    
    def display_products(self):
        """Display products in treeview (Must run in main thread)"""
        self.products_tree.delete(*self.products_tree.get_children())
        
        for product in self.products:
            price = f"Rp {product['price']:,.0f}".replace(",", ".")
            self.products_tree.insert(
                "", "end",
                values=(
                    product['id'],
                    product['code'],
                    product['name'],
                    price
                )
            )

    def update_dashboard_stats(self):
        """Menghitung dan memperbarui statistik dashboard dari self.orders (Harus berjalan di main thread)"""
        if not hasattr(self, 'total_sales_var'): 
            return
            
        total_sales = 0
        total_sold = 0
        pending_count = 0
        confirmed_count = 0
        
        for order in self.orders:
            status = order.get('status', 'pending')
            if status == 'confirmed':
                total_sales += order.get('total', 0)
                total_sold += order.get('quantity', 0)
                confirmed_count += 1 
            elif status == 'pending':
                pending_count += 1
        
        self.total_sales_var.set(f"Rp {total_sales:,.0f}".replace(",", "."))
        self.total_sold_var.set(f"{total_sold} pcs")
        self.pending_orders_var.set(f"{pending_count} pesanan item")
        self.confirmed_orders_var.set(f"{confirmed_count} pesanan item")

    # ==================================================================
    # === EVENT HANDLERS & ACTIONS
    # ==================================================================

    def generate_product_code(self):
        """Generate automatic product code (Runs in main thread)"""
        if not self.products:
            new_code = "P001"
        else:
            max_num = 0
            for product in self.products:
                code = product['code']
                if code.startswith('P') and code[1:].isdigit():
                    num = int(code[1:])
                    if num > max_num:
                        max_num = num
            new_code = f"P{max_num + 1:03d}"
        
        self.product_code.delete(0, tk.END)
        self.product_code.insert(0, new_code)
    
    def add_product(self):
        """Get data from GUI and trigger add product in thread"""
        name = self.product_name.get().strip()
        price_text = self.product_price.get().strip()
        code = self.product_code.get().strip()
        
        if not name or not price_text or not code:
            messagebox.showerror("Error", "Semua field harus diisi!")
            return
        
        try:
            price = float(price_text)
        except ValueError:
            messagebox.showerror("Error", "Harga harus berupa angka!")
            return
        
        product_data = {"code": code, "name": name, "price": price}
        self.run_in_thread(self._add_product_logic, product_data, name)

    def _add_product_logic(self, product_data, name):
        """Actual logic for adding product (runs in thread)"""
        result = self.supabase_request("POST", self.PRODUCTS_TABLE, product_data)
        
        if result:
            self.schedule_gui_update(messagebox.showinfo, "Sukses", f"Produk '{name}' berhasil ditambahkan!")
            self.schedule_gui_update(self.product_name.delete, 0, tk.END)
            self.schedule_gui_update(self.product_price.delete, 0, tk.END)
            self.schedule_gui_update(self.product_code.delete, 0, tk.END)
            
            if self.auto_refresh:
                self.root.after(1000, self.load_products)
                
            self.schedule_gui_update(self.status_var.set, f"Produk '{name}' ditambahkan")
        else:
            self.schedule_gui_update(messagebox.showerror, "Error", "Gagal menambah produk! Periksa RLS settings.")

    def delete_product(self):
        """Get selection from GUI and trigger delete in thread"""
        selection = self.products_tree.selection() 
        if not selection:
            messagebox.showwarning("Peringatan", "Pilih satu atau lebih produk yang akan dihapus!")
            return
        
        products_to_delete = [] 
        for item_id in selection:
            selected_item = self.products_tree.item(item_id)
            product_id = selected_item['values'][0]
            product_name = selected_item['values'][2]
            products_to_delete.append((product_id, product_name))
        
        if messagebox.askyesno("Konfirmasi", f"Anda yakin ingin menghapus {len(products_to_delete)} produk yang dipilih?"):
            self.run_in_thread(self._delete_product_logic, products_to_delete)

    def _delete_product_logic(self, products_list):
        """Actual logic for deleting product (runs in thread)"""
        success_count = 0
        failed_products = []
        
        for product_id, product_name in products_list: 
            result = self.supabase_request("DELETE", f"{self.PRODUCTS_TABLE}?id=eq.{product_id}")
            if result:
                success_count += 1
            else:
                failed_products.append(product_name)
        
        if success_count > 0:
            self.schedule_gui_update(messagebox.showinfo, "Sukses", 
                                     f"{success_count} produk berhasil dihapus!")
            
            if self.auto_refresh:
                self.root.after(1000, self.load_products)
            
            status_msg = f"{success_count} produk dihapus"
            if failed_products:
                 status_msg += f", Gagal hapus: {', '.join(failed_products)}"
            self.schedule_gui_update(self.status_var.set, status_msg)
        else:
            self.schedule_gui_update(messagebox.showerror, "Error", "Gagal menghapus semua produk yang dipilih!")

    def confirm_order(self):
        """Get selection from GUI and trigger confirm in thread"""
        selection = self.orders_tree.selection()
        if not selection:
            messagebox.showwarning("Peringatan", "Pilih satu atau lebih pesanan untuk dikonfirmasi!")
            return
        
        order_groups_to_update = set() 
        
        for item_id in selection:
            try:
                # --- PERUBAHAN DI SINI ---
                selected_item = self.orders_tree.item(item_id)
                # 1. Ambil 'group_key' langsung dari values[0] (kolom tersembunyi kita)
                group_key = selected_item['values'][0] 
                
                if group_key:
                    # 2. Tambahkan KEY (string) ke set, BUKAN dictionary
                    order_groups_to_update.add(group_key) 
                # --- AKHIR PERUBAHAN ---
            except Exception as e:
                print(f"Error memproses item: {item_id}, {e}")
                continue
        
        if not order_groups_to_update:
            messagebox.showerror("Error", "Group pesanan tidak ditemukan untuk item yang dipilih!")
            return
        
        self.run_in_thread(self._update_order_status_logic, list(order_groups_to_update), "confirmed")

    def cancel_order(self):
        """Get selection from GUI and trigger cancel in thread"""
        selection = self.orders_tree.selection()
        if not selection:
            messagebox.showwarning("Peringatan", "Pilih satu atau lebih pesanan untuk dibatalkan!")
            return

        order_groups_to_update = set()
        
        for item_id in selection:
            try:
                # --- PERUBAHAN DI SINI ---
                selected_item = self.orders_tree.item(item_id)
                # 1. Ambil 'group_key' langsung dari values[0]
                group_key = selected_item['values'][0]
                
                if group_key:
                     # 2. Tambahkan KEY (string) ke set
                    order_groups_to_update.add(group_key)
                # --- AKHIR PERUBAHAN ---
            except Exception as e:
                print(f"Error memproses item: {item_id}, {e}")
                continue

        if not order_groups_to_update:
            messagebox.showerror("Error", "Group pesanan tidak ditemukan untuk item yang dipilih!")
            return

        if messagebox.askyesno("Konfirmasi", f"Anda yakin ingin membatalkan {len(order_groups_to_update)} group pesanan yang dipilih?"):
            self.run_in_thread(self._update_order_status_logic, list(order_groups_to_update), "cancelled")

    def _update_order_status_logic(self, order_group_keys_list, new_status):
        """Actual logic for updating order status (runs in thread)"""
        update_data = {"status": new_status}
        if new_status == "confirmed":
            update_data["confirmed_at"] = datetime.now().isoformat()
            
        total_success_count = 0
        total_items = 0
        
        # --- PERUBAHAN DI SINI ---
        # 1. Loop melalui daftar KUNCI
        for group_key in order_group_keys_list: 
            # 2. Ambil data order group menggunakan kunci
            order_group = self.grouped_orders.get(group_key)
            if not order_group: 
                continue
            # --- AKHIR PERUBAHAN ---
            
            success_count_per_group = 0
            
            for order_id in order_group['order_ids']:
                total_items += 1
                result = self.supabase_request("PATCH", f"{self.SALES_TABLE}?id=eq.{order_id}", update_data)
                if result:
                    success_count_per_group += 1
            
            total_success_count += success_count_per_group
        
        if total_success_count > 0:
            action_text = "dikonfirmasi" if new_status == "confirmed" else "dibatalkan"
            self.schedule_gui_update(messagebox.showinfo, "Sukses", 
                                     f"{total_success_count} dari {total_items} item pesanan berhasil {action_text}!")
            
            if self.auto_refresh:
                self.root.after(1000, self.load_orders)
        else:
            self.schedule_gui_update(messagebox.showerror, "Error", "Gagal mengupdate status pesanan!")

    def view_order_details(self):
        """View order group details (Runs in main thread)"""
        selection = self.orders_tree.selection()
        if not selection:
            messagebox.showwarning("Peringatan", "Pilih satu pesanan untuk melihat detail!")
            return
        
        item_id_to_view = selection[0] 

        try:
            # --- PERUBAHAN DI SINI ---
            selected_item = self.orders_tree.item(item_id_to_view)
            group_key = selected_item['values'][0] # Ambil key dari kolom tersembunyi
            # --- AKHIR PERUBAHAN ---
        except Exception as e:
            messagebox.showerror("Error", f"Tidak dapat membaca item: {e}")
            return
        
        # Langsung gunakan key yang didapat
        order_data = self.grouped_orders.get(group_key)
        
        if not order_data:
            messagebox.showerror("Error", "Detail pesanan tidak ditemukan!")
            return
        
        details = f"""
        📋 DETAIL GROUP PESANAN

        👤 CUSTOMER: {order_data.get('customer', 'Customer')}
        🕒 WAKTU PESAN: {order_data['datetime']}
        ✅ STATUS: {order_data.get('status', 'pending').upper()}
        🔢 JUMLAH ITEM: {len(order_data['items'])}

        📦 ITEM PESANAN:
        """
        for i, item in enumerate(order_data['items'], 1):
            price_formatted = f"Rp {item.get('price', 0):,.0f}".replace(",", ".")
            total_formatted = f"Rp {item.get('total', 0):,.0f}".replace(",", ".")
            
            details += f"  {i}. {item.get('product_name', 'N/A')} ({item.get('product_code', 'N/A')})\n"
            details += f"     💰 Harga: {price_formatted}\n"
            details += f"     🔢 Quantity: {item.get('quantity', 0)}\n"
            details += f"     💵 Subtotal: {total_formatted}\n"
            details += f"     📊 Status: {item.get('status', 'pending')}\n\n"

        total_amount_formatted = f"Rp {order_data['total_amount']:,.0f}".replace(",", ".")
        details += f"💵 TOTAL: {total_amount_formatted}\n\n"
        details += f"📝 CATATAN: {order_data.get('notes', 'Tidak ada catatan')}"
        
        messagebox.showinfo("Detail Pesanan", details)


    def print_selected_order(self):
        """Menampilkan struk pesanan di jendela baru untuk di-print."""
        selection = self.orders_tree.selection()
        if not selection:
            messagebox.showwarning("Peringatan", "Pilih satu pesanan untuk di-print!")
            return
        
        item_id_to_view = selection[0] 

        try:
            selected_item = self.orders_tree.item(item_id_to_view)
            group_key = selected_item['values'][0]
        except Exception as e:
            messagebox.showerror("Error", f"Tidak dapat membaca item: {e}")
            return
        
        order_data = self.grouped_orders.get(group_key)
        
        if not order_data:
            messagebox.showerror("Error", "Detail pesanan tidak ditemukan!")
            return
        
        # --- Buat Teks Struk ---
        # Menggunakan font monospaced (semua karakter sama lebar) agar rapi
        receipt_font = ("Courier", 10)
        
        details = "      WARUNG BIEEM - STRUK PESANAN      \n"
        details += "=======================================\n"
        details += f"CUSTOMER: {order_data.get('customer', 'Customer')}\n"
        details += f"WAKTU   : {order_data['datetime']}\n"
        details += f"STATUS  : {order_data.get('status', 'pending').upper()}\n"
        details += "---------------------------------------\n\n"
        details += "ITEM PESANAN:\n"

        for item in order_data['items']:
            product_name = item.get('product_name', 'N/A')[:20] # Batasi nama produk
            quantity = item.get('quantity', 0)
            price = item.get('price', 0)
            total = item.get('total', 0)
            
            price_formatted = f"Rp {price:,.0f}".replace(",", ".")
            total_formatted = f"Rp {total:,.0f}".replace(",", ".")
            
            # Format rata kanan untuk angka
            details += f"{product_name} ({quantity}x)\n"
            # ljust = rata kiri, rjust = rata kanan
            details += f"  {price_formatted.ljust(15)} {total_formatted.rjust(18)}\n" 
        
        details += "\n---------------------------------------\n"
        
        total_amount_formatted = f"Rp {order_data['total_amount']:,.0f}".replace(",", ".")
        details += f"TOTAL      : {total_amount_formatted.rjust(25)}\n"
        details += "---------------------------------------\n\n"
        
        notes = order_data.get('notes', 'Tidak ada catatan')
        if notes and notes.strip():
            details += f"CATATAN:\n{notes}\n\n"
        
        details += "   Terima kasih atas pesanan Anda!   \n"
        details += "=======================================\n"

        
        # --- Tampilkan di Jendela Baru (Toplevel) ---
        print_window = tk.Toplevel(self.root)
        print_window.title(f"Struk - {order_data.get('customer', 'Customer')}")
        print_window.geometry("350x550")
        print_window.configure(bg="white")
        
        # Gunakan Text widget agar bisa di-copy-paste
        text_widget = tk.Text(print_window, font=receipt_font, wrap=tk.WORD, padx=10, pady=10,
                              bg="white", bd=0, highlightthickness=0)
        text_widget.pack(fill=tk.BOTH, expand=True)
        text_widget.insert(tk.END, details)
        text_widget.config(state=tk.DISABLED) # Agar tidak bisa diedit
        
        close_btn = ttk.Button(print_window, text="Tutup", command=print_window.destroy)
        close_btn.pack(pady=10)
        
        # Fokus ke jendela baru
        print_window.transient(self.root)
        print_window.grab_set()
        self.root.wait_window(print_window)

def main():
    root = tk.Tk()
    app = SupabaseAdmin(root)
    root.mainloop()

if __name__ == "__main__":
    main()