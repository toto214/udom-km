/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  BarChart3, 
  Settings, 
  Search, 
  Bell, 
  User, 
  Plus, 
  Edit2,
  X,
  RefreshCcw,
  TrendingUp,
  PackageCheck,
  Users,
  ShoppingCart,
  ChevronLeft,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Import Types
import { Product, Customer, Order, StockHistory } from './types';

// Import Components
import { SidebarItem } from './components/SidebarItem';
import { StatCard } from './components/StatCard';
import { ProductCard } from './components/ProductCard';
import { OrdersTable } from './components/OrdersTable';
import { ReceiptModal } from './components/ReceiptModal';
import { AddCustomerModal, EditCustomerModal } from './components/CustomerModals';
import { AddProductModal, EditProductModal, StockModal } from './components/ProductModals';
import { CustomDialog } from './components/CustomDialog';

export default function App() {
  const [activeTab, setActiveTab ] = useState('inventory');
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]); 
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>({ id: null, name: 'เงินสด (Walk-in)', phone: '-' });
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [posView, setPosView] = useState<'products' | 'cart'>('products');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'unpaid'>('all');
  
  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert' | 'error' | 'success';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const showAlertDialog = (title: string, message: string, type: 'alert' | 'error' | 'success' = 'alert') => {
    setCustomDialog({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setCustomDialog({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm
    });
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setIsDbConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        if (data.length > 0) {
           const walkIn = data.find((c: any) => c.name.includes('Walk-in')) || data[0];
           if (selectedCustomer.id === null) {
              setSelectedCustomer(walkIn);
           }
        }
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map((o: any) => {
          let items = [];
          if (o.items) {
            try {
              items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            } catch (e) {
              console.error('Failed to parse order items:', e);
            }
          }
          
          return {
            id: o.id,
            customer: { id: null, name: o.customer_name, phone: o.customer_phone, moo: o.customer_moo },
            total: Number(o.total),
            status: o.status,
            date: new Date(o.date).toLocaleString('th-TH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            items: (items || []).map((it: any) => ({
              product: { name: it.product?.name || it.name, price: it.product?.price || it.price },
              quantity: it.quantity
            }))
          };
        });
        setAllOrders(formatted);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchOrders();
  }, [retryCount]);

  useEffect(() => {
    if (activeTab === 'sales' || activeTab === 'reports') {
      fetchOrders();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toString().includes(searchQuery) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockProducts = products.filter(p => p.stock < 5);

  const handleUpdateStock = async (id: number, amount: number, reason: string = 'ปรับยอดทั่วไป', user: string = 'Admin') => {
    try {
      const response = await fetch(`/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason, user })
      });

      if (response.ok) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + amount) } : p));
        
        // Show success alert dialog
        showAlertDialog(
          'ปรับปรุงสต๊อกสำเร็จ',
          `จำนวนที่ปรับ: ${amount > 0 ? '+' : ''}${amount} ชิ้น\nคงเหลือ: ${Math.max(0, (products.find(p => p.id === id)?.stock || 0) + amount)} ชิ้น`,
          'success'
        );

        const newEntry: StockHistory = {
          id: Math.random().toString(36).substring(7),
          productId: id,
          change: amount,
          reason,
          user,
          timestamp: new Date().toLocaleString('th-TH')
        };
        setStockHistory(prev => [newEntry, ...prev]);
        if (selectedProductForStock?.id === id) {
          setSelectedProductForStock(prev => prev ? { ...prev, stock: Math.max(0, prev.stock + amount) } : null);
        }
      }
    } catch (error) {
      console.error('Stock update failed:', error);
    }
  };

  const handleAddProduct = async (newProduct: Omit<Product, 'id'>) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      if (response.ok) {
        fetchProducts();
        setIsAddModalOpen(false);
      }
    } catch (error) {
       console.error('Failed to add product:', error);
    }
  };

  const handleEditProduct = async (updatedProduct: Product) => {
    try {
      const response = await fetch(`/api/products/${updatedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });
      if (response.ok) {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        setSelectedProductForEdit(null);
      }
    } catch (error) {
       console.error('Update failed:', error);
    }
  };

  const handleDeleteProduct = (id: number) => {
    const prodName = products.find(p => p.id === id)?.name || '';
    showConfirmDialog(
      'ยืนยันการลบสินค้า',
      `คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${prodName}"?`,
      async () => {
        try {
          const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            setProducts(prev => prev.filter(p => p.id !== id));
            setSelectedProductForEdit(null);
            showAlertDialog('สำเร็จ', 'ลบสินค้าเรียบร้อยแล้ว', 'success');
          } else {
            showAlertDialog('ผิดพลาด', 'ไม่สามารถลบสินค้าได้', 'error');
          }
        } catch (error) {
          console.error('Delete failed:', error);
          showAlertDialog('ผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
      }
    );
  };

  const handleAddCustomer = async (newCustomer: Omit<Customer, 'id'>) => {
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      if (response.ok) {
        const result = await response.json();
        const customerWithId = { ...newCustomer, id: result.id };
        setCustomers(prev => [...prev, customerWithId]);
        setSelectedCustomer(customerWithId);
        setCustomerSearchQuery(customerWithId.name);
        setIsAddCustomerModalOpen(false);
        setIsCustomerDropdownOpen(false);
      }
    } catch (error) {
       console.error('Failed to add customer:', error);
    }
  };

  const handleEditCustomer = async (updatedCustomer: Customer) => {
    try {
      const response = await fetch(`/api/customers/${updatedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCustomer)
      });
      if (response.ok) {
        setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
        if (selectedCustomer.id === updatedCustomer.id) {
          setSelectedCustomer(updatedCustomer);
          setCustomerSearchQuery(updatedCustomer.name);
        }
        setIsEditCustomerModalOpen(false);
      }
    } catch (error) {
       console.error('Edit failed:', error);
    }
  };

  const handleDeleteCustomer = (id: number) => {
    const custName = customers.find(c => c.id === id)?.name || '';
    showConfirmDialog(
      'ยืนยันการลบลูกค้า',
      `คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้า "${custName}"?\nข้อมูลประวัติการสั่งซื้อของลูกค้าคนนี้อาจได้รับผลกระทบ`,
      async () => {
        try {
          const response = await fetch(`/api/customers/${id}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            setCustomers(prev => prev.filter(c => c.id !== id));
            if (selectedCustomer.id === id) {
              const walkIn = customers.find((c: any) => c.name.includes('Walk-in')) || customers[0];
              setSelectedCustomer(walkIn);
              setCustomerSearchQuery('');
            }
            setIsEditCustomerModalOpen(false);
            setCustomerToEdit(null);
            showAlertDialog('สำเร็จ', 'ลบข้อมูลลูกค้าเรียบร้อยแล้ว', 'success');
          } else {
            showAlertDialog('ผิดพลาด', 'ไม่สามารถลบข้อมูลลูกค้าได้', 'error');
          }
        } catch (error) {
          console.error('Delete customer failed:', error);
          showAlertDialog('ผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
      }
    );
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, Math.min(item.quantity + delta, item.product.stock));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleCheckout = async (status: 'Paid' | 'Unpaid' = 'Paid') => {
    if (cart.length === 0) return;
    const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          total,
          items: cart.map(it => ({ product: { id: it.product.id, name: it.product.name, price: it.product.price }, quantity: it.quantity })),
          status
        })
      });
      if (response.ok) {
        const result = await response.json();
        const orderId = result.orderId;
        fetchOrders();
        fetchProducts();
        
        const newOrder: Order = {
          id: orderId.toString(),
          customer: selectedCustomer,
          items: cart.map(it => ({ product: { name: it.product.name, price: it.product.price }, quantity: it.quantity })),
          total,
          status,
          date: new Date().toLocaleString('th-TH')
        };

        if (status === 'Paid') {
          setLastOrder(newOrder);
          setShowReceipt(true);
        }
        
        setCart([]);
        setCustomerSearchQuery('');
        const walkIn = customers.find((c: any) => c.name.includes('Walk-in')) || customers[0];
        setSelectedCustomer(walkIn);
        setPosView('products');
      }
    } catch (error) {
       console.error('Checkout failed:', error);
    }
  };

  const handlePayOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' })
      });
      if (response.ok) {
        fetchOrders();
        const order = allOrders.find(o => o.id.toString() === orderId.toString());
        if (order) {
          setLastOrder({ ...order, status: 'Paid' });
          setShowReceipt(true);
        }
      }
    } catch (error) {
       console.error('Failed to pay order:', error);
    }
  };

  const handleCancelOrder = (orderId: string) => {
    showConfirmDialog(
      'ยืนยันการยกเลิกบิล',
      `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกบิล #${orderId}? ระบบจะคืนสินค้าเข้าคลังโดยอัตโนมัติ`,
      async () => {
        try {
          const response = await fetch(`/api/orders/${orderId}/cancel`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: 'Admin' })
          });

          if (response.ok) {
            showAlertDialog('สำเร็จ', 'ยกเลิกบิลสำเร็จและคืนสต๊อกสินค้าเรียบร้อยแล้ว', 'success');
            fetchOrders();
            fetchProducts(); // Refresh stocks in frontend
          } else {
            const err = await response.json();
            showAlertDialog('เกิดข้อผิดพลาด', `ผิดพลาด: ${err.error}`, 'error');
          }
        } catch (error) {
          console.error('Failed to cancel order:', error);
          showAlertDialog('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
      }
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-primary text-white flex flex-col transition-all duration-300 shrink-0 relative overflow-hidden no-print",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className={cn("p-6 flex items-center", isSidebarCollapsed ? "justify-center" : "justify-between")}>
          {!isSidebarCollapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-2xl font-bold tracking-tight">Udom_App</h1>
              <p className="text-xs text-secondary mt-1 uppercase tracking-widest font-medium">ระบบจัดการร้านค้า</p>
            </motion.div>
          )}
          {isSidebarCollapsed && (
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-black text-xl">U</div>
          )}
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="ภาพรวม" active={activeTab === 'dashboard'} isCollapsed={isSidebarCollapsed} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<Package size={20} />} label="คลังสินค้า" active={activeTab === 'inventory'} isCollapsed={isSidebarCollapsed} onClick={() => setActiveTab('inventory')} />
          <SidebarItem icon={<BarChart3 size={20} />} label="รายงาน" active={activeTab === 'reports'} isCollapsed={isSidebarCollapsed} onClick={() => setActiveTab('reports')} />
          <SidebarItem icon={<ShoppingCart size={20} />} label="การขาย" active={activeTab === 'pos' || activeTab === 'sales'} isCollapsed={isSidebarCollapsed} onClick={() => setActiveTab('pos')} />
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <SidebarItem icon={<Settings size={20} />} label="ตั้งค่า" active={false} isCollapsed={isSidebarCollapsed} onClick={() => {}} />
        </div>

        <div className="mt-auto px-4 pb-8 no-print">
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-xl transition-all",
            isDbConnected === true ? "bg-emerald-500/10 text-emerald-400" : 
            isDbConnected === false ? "bg-rose-500/10 text-rose-400" : "bg-slate-500/10 text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isDbConnected === true ? "bg-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : isDbConnected === false ? "bg-rose-500 animate-pulse" : "bg-slate-400")} />
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-tighter">Database Status</span>
                <span className="text-[11px] font-medium opacity-80 leading-none">
                  {isDbConnected === true ? "Connected" : isDbConnected === false ? "Disconnected" : "Connecting..."}
                </span>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute bottom-24 -right-1 translate-x-1/2 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:bg-accent/90 transition-colors z-20 hidden lg:flex"
        >
          <motion.div animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}>
            <ChevronLeft size={16} />
          </motion.div>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden no-print">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อสินค้า หมวดหมู่ หรือรหัส..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all font-medium"
            />
          </div>

          <div className="flex items-center space-x-6">
            <button className="relative text-slate-500 hover:text-primary transition-colors">
              <Bell size={22} />
              {lowStockProducts.length > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div className="flex items-center space-x-3 cursor-pointer group">
              <div className="text-right">
                <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors">ผู้จัดการร้าน</p>
                <p className="text-xs text-secondary">admin@udomapp.com</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-accent transition-all">
                <User className="text-slate-500" size={24} />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            {(activeTab === 'pos' || activeTab === 'sales') && (
              <motion.div
                key="pos-sales-unified"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col gap-6 pb-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 bg-slate-50 py-2 z-10">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-primary">
                      {activeTab === 'pos' ? 'การขายสินค้า' : 'ประวัติการขาย'}
                    </h2>
                    <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                      <button onClick={() => setActiveTab('pos')} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'pos' ? "bg-accent text-white" : "text-secondary hover:bg-slate-50")}>ขายสินค้า (POS)</button>
                      <button onClick={() => setActiveTab('sales')} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'sales' ? "bg-accent text-white" : "text-secondary hover:bg-slate-50")}>ประวัติ / ค้างชำระ</button>
                    </div>
                  </div>
                </div>

                {activeTab === 'pos' ? (
                  <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 lg:overflow-hidden">
                    <div className={cn("flex-1 flex flex-col gap-4 min-h-0", posView === 'cart' && "hidden lg:flex")}>
                      <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {filteredProducts.map(product => (
                            <button 
                              key={product.id}
                              disabled={product.stock <= 0}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left flex gap-4 group",
                                product.stock <= 0 && "opacity-50 grayscale cursor-not-allowed"
                              )}
                            >
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                                <img src={product.image || undefined} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 flex flex-col justify-between py-0.5">
                                <div>
                                  <h4 className="text-xs sm:text-sm font-bold text-primary line-clamp-1">{product.name}</h4>
                                  <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">{product.category}</p>
                                </div>
                                <div className="flex items-end justify-between">
                                  <span className="text-sm font-black text-accent">฿{product.price.toLocaleString()}</span>
                                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase", product.stock < 5 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>เหลือ {product.stock}</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={cn("w-full lg:w-96 bg-white border border-slate-200 rounded-3xl shadow-xl flex flex-col overflow-hidden shrink-0", posView === 'products' ? "hidden lg:flex" : "flex h-full")}>
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-primary flex items-center gap-2 mb-4">
                          <User size={18} className="text-accent" /> ข้อมูลการขาย
                        </h3>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block">เลือกลูกค้า</label>
                          <div className="relative">
                            <div className="relative flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input 
                                  type="text"
                                  placeholder="ค้นหาชื่อ หรือ เบอร์โทร..."
                                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all font-medium"
                                  value={customerSearchQuery}
                                  onChange={(e) => {
                                    setCustomerSearchQuery(e.target.value);
                                    setIsCustomerDropdownOpen(true);
                                  }}
                                  onFocus={() => setIsCustomerDropdownOpen(true)}
                                />
                              </div>
                              {selectedCustomer.id !== null && (
                                <button 
                                  onClick={() => { setCustomerToEdit(selectedCustomer); setIsEditCustomerModalOpen(true); }}
                                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                            </div>

                            <AnimatePresence>
                              {isCustomerDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)} />
                                  <motion.div 
                                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                    className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto"
                                  >
                                    {(() => {
                                      const filtered = customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone.includes(customerSearchQuery));
                                      if (filtered.length === 0 && customerSearchQuery.trim() !== '') {
                                        return (
                                          <button onClick={() => { setIsAddCustomerModalOpen(true); setIsCustomerDropdownOpen(false); }} className="w-full text-center px-4 py-4 hover:bg-slate-50 flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent"><Plus size={20} /></div>
                                            <span className="text-sm font-bold text-primary">ไม่พบลูกค้านี้</span>
                                            <span className="text-[10px] text-accent font-bold uppercase underline">คลิกเพื่อเพิ่มลูกค้าใหม่</span>
                                          </button>
                                        );
                                      }
                                      return filtered.map(customer => (
                                        <div key={customer.id} className="relative group/curr">
                                          <button
                                            onClick={() => { setSelectedCustomer(customer); setCustomerSearchQuery(customer.name === 'เงินสด (Walk-in)' ? '' : customer.name); setIsCustomerDropdownOpen(false); }}
                                            className={cn("w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-0.5 border-b border-slate-50 last:border-0", selectedCustomer.id === customer.id && "bg-accent/5")}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-bold text-primary">{customer.name}</span>
                                              {selectedCustomer.id === customer.id && <span className="w-2 h-2 bg-accent rounded-full"></span>}
                                            </div>
                                            <span className="text-[10px] text-secondary">{customer.phone}</span>
                                          </button>
                                          {customer.id !== null && (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setCustomerToEdit(customer); setIsEditCustomerModalOpen(true); setIsCustomerDropdownOpen(false); }}
                                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover/curr:opacity-100 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-accent transition-all"
                                            >
                                              <Eye size={14} />
                                            </button>
                                          )}
                                        </div>
                                      ));
                                    })()}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-secondary uppercase tracking-widest">รายการสินค้า</span>
                          <button onClick={() => setCart([])} className="text-[10px] text-red-500 font-bold">ล้างบิล</button>
                        </div>
                        {cart.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                            <ShoppingCart size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-medium">ยังไม่มีสินค้าในบิล</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {cart.map(item => (
                              <div key={item.product.id} className="flex gap-3 items-center">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0"><img src={item.product.image || undefined} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" /></div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-[11px] font-bold text-primary truncate">{item.product.name}</h5>
                                  <p className="text-[10px] text-accent font-black">฿{(item.product.price * item.quantity).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                                  <button onClick={() => updateCartQuantity(item.product.id, -1)} className="w-5 h-5 flex items-center justify-center"><X size={10} className="rotate-45" /></button>
                                  <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                  <button onClick={() => updateCartQuantity(item.product.id, 1)} className="w-5 h-5 flex items-center justify-center"><Plus size={10} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-bold text-primary">ยอดชำระสุทธิ</span>
                          <span className="text-2xl font-black text-accent">฿{cart.reduce((s, i) => s + (i.product.price * i.quantity), 0).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <button onClick={() => handleCheckout('Unpaid')} disabled={cart.length === 0} className="bg-white border border-slate-200 text-primary py-4 rounded-2xl font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50">บันทึกค้างชำระ</button>
                          <button onClick={() => handleCheckout('Paid')} disabled={cart.length === 0} className="bg-accent hover:bg-accent/90 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">ชำระเงิน <ShoppingCart size={18} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-primary">รายการขายและประวัติ</h3>
                      <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                        <button onClick={() => setOrderFilter('all')} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", orderFilter === 'all' ? "bg-primary text-white" : "text-secondary hover:bg-slate-50")}>ทั้งหมด</button>
                        <button onClick={() => setOrderFilter('unpaid')} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", orderFilter === 'unpaid' ? "bg-red-500 text-white" : "text-secondary hover:bg-slate-50")}>ค้างชำระ</button>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                      <OrdersTable 
                        orders={orderFilter === 'all' ? allOrders : allOrders.filter(o => o.status === 'Unpaid')} 
                        onShowReceipt={(order) => { setLastOrder(order); setShowReceipt(true); }} 
                        onPay={(id) => handlePayOrder(id)} 
                        onCancel={(id) => handleCancelOrder(id)}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="ยอดขายรวมวันนี้" value="฿0" icon={<TrendingUp className="text-accent" />} trend="-" />
                  <StatCard label="สินค้าในสต็อก" value={products.reduce((acc, p) => acc + p.stock, 0).toString()} icon={<PackageCheck className="text-emerald-500" />} trend="ปกติ" />
                  <StatCard label="ลูกค้าใหม่" value="18" icon={<Users className="text-orange-500" />} trend="+5" />
                  <StatCard label="ค้างชำระ" value={allOrders.filter(o => o.status === 'Unpaid').length.toString()} icon={<RefreshCcw className="text-red-500" />} trend="ปัจจุบัน" />
                </section>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {products.slice(0, 4).map(p => (
                    <ProductCard key={p.id} product={p} onManageStock={() => setSelectedProductForStock(p)} onEdit={() => setSelectedProductForEdit(p)} onDelete={() => handleDeleteProduct(p.id)} />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-2xl font-bold text-primary">การจัดการคลังสินค้า</h2><p className="text-sm text-secondary">รายการสินค้าทั้งหมดในระบบ</p></div>
                  <button onClick={() => setIsAddModalOpen(true)} className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md"><Plus size={18} /> เพิ่มสินค้าใหม่</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map(p => (
                    <ProductCard key={p.id} product={p} onManageStock={() => setSelectedProductForStock(p)} onEdit={() => setSelectedProductForEdit(p)} onDelete={() => handleDeleteProduct(p.id)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <StockModal 
        isOpen={!!selectedProductForStock} 
        onClose={() => setSelectedProductForStock(null)} 
        product={selectedProductForStock} 
        history={stockHistory.filter(h => h.productId === selectedProductForStock?.id)} 
        onUpdateStock={(amount, reason, user) => selectedProductForStock && handleUpdateStock(selectedProductForStock.id, amount, reason, user)} 
      />
      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={handleAddProduct} 
      />
      <EditProductModal 
        isOpen={!!selectedProductForEdit} 
        product={selectedProductForEdit} 
        onClose={() => setSelectedProductForEdit(null)} 
        onEdit={handleEditProduct} 
        onDelete={() => selectedProductForEdit && handleDeleteProduct(selectedProductForEdit.id)} 
      />
      <ReceiptModal 
        isOpen={showReceipt} 
        onClose={() => setShowReceipt(false)} 
        order={lastOrder} 
      />
      <AddCustomerModal 
        isOpen={isAddCustomerModalOpen} 
        onClose={() => setIsAddCustomerModalOpen(false)} 
        onAdd={handleAddCustomer} 
        initialName={customerSearchQuery} 
      />
      <EditCustomerModal 
        isOpen={isEditCustomerModalOpen} 
        customer={customerToEdit} 
        onClose={() => setIsEditCustomerModalOpen(false)} 
        onSave={handleEditCustomer} 
        onDelete={() => customerToEdit && customerToEdit.id && handleDeleteCustomer(customerToEdit.id)}
      />

      <CustomDialog
        isOpen={customDialog.isOpen}
        title={customDialog.title}
        message={customDialog.message}
        type={customDialog.type}
        onClose={() => setCustomDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={customDialog.onConfirm}
      />
    </div>
  );
}
