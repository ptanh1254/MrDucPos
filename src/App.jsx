import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Users, ChefHat, Map, FileText, 
  LogOut, Plus, Trash2, Edit, X, Coffee, 
  DollarSign, Printer, Bell, Search, Eye,
  CheckCircle, ShoppingCart, BarChart3, PieChart, 
  RefreshCw, Settings, Save, Lock, Filter, 
  Heart, UploadCloud, Image as ImageIcon, Banknote, CreditCard, 
  AlertTriangle, AlertCircle, Check, ChevronLeft, ChevronRight, MapPin
} from 'lucide-react';
import io from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import './globalStyles.css';

const getApiUrl = () => {
  try {
    if (import.meta?.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch (e) {}
  // Fallback: sử dụng localhost cho development, production URL cho build
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  return 'https://pos-server-render.onrender.com'; // Update tới Render URL của bạn
};

const API_URL = getApiUrl();
let socket;

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2575/2575-preview.mp3';

const calculateTotalAmount = (orders) => {
  if (!orders || orders.length === 0) return 0;
  if (orders.length === 1 && orders[0].finalTotal) return orders[0].finalTotal;
  if (!Array.isArray(orders)) return orders.finalTotal || 0;
  return orders.reduce((acc, o) => acc + (o.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0), 0);
};

const mergeOrderItems = (orders) => {
  const ordersList = Array.isArray(orders) ? orders : [orders];
  const rawItems = ordersList.flatMap(o => o.items || []);
  const merged = {};
  
  rawItems.forEach(item => {
    const key = `${item._id}-${item.price}`;
    if (merged[key]) {
      merged[key].quantity += item.quantity;
    } else {
      merged[key] = { ...item };
    }
  });
  
  return Object.values(merged);
};

const normalizeImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const handleImageError = (e) => {
  e.target.style.display = 'none';
};

const showNotification = {
  success: (msg, opts = {}) => toast.success(msg, { duration: 2500, ...opts }),
  error: (msg, opts = {}) => toast.error(msg, { duration: 3500, ...opts }),
  info: (msg, opts = {}) => toast(msg, { duration: 2500, ...opts }),
  warning: (msg, opts = {}) => toast(msg, { duration: 3000, ...opts }),
  loading: (msg, opts = {}) => toast.loading(msg, opts)
};

const printReceipt = (data, settings) => {
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) {
        showNotification.error("❌ Vui lòng cho phép popup để in hóa đơn");
        return;
    }

    const ordersList = Array.isArray(data) ? data : [data];
    const finalItems = mergeOrderItems(ordersList);
    const totalAmount = calculateTotalAmount(ordersList);

    const itemsHtml = finalItems.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
            <span><b>${item.quantity}</b>x ${item.name}</span>
            <span>${new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)}</span>
        </div>
    `).join('');

    const tableName = ordersList[0]?.tableName || 'Mang về';
    const dateStr = ordersList[0]?.createdAt ? new Date(ordersList[0].createdAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');

    const customLines = [];
    if (settings.receiptLine1) customLines.push(settings.receiptLine1);
    if (settings.receiptLine2) customLines.push(settings.receiptLine2);
    if (settings.receiptLine3) customLines.push(settings.receiptLine3);
    const customLinesHtml = customLines.map(line => `<div class="footer">${line}</div>`).join('');

    const htmlContent = `
        <html>
        <head>
            <title>In Hóa Đơn</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 10px; width: 280px; margin: 0 auto; color: #000; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
                .info { font-size: 12px; margin-bottom: 5px; }
                .items { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 5px; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; font-style: italic; }
                @media print { @page { margin: 0; } body { padding: 5px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">${settings.restaurantName || 'NHÀ HÀNG'}</div>
                <div class="info">${settings.address || ''}</div>
                <div class="info">Hotline: ${settings.phone || ''}</div>
                <div class="info">----------------</div>
                <div class="info" style="text-align: left;">Bàn: ${tableName}</div>
                <div class="info" style="text-align: left;">Ngày: ${dateStr}</div>
            </div>
            <div class="items">${itemsHtml}</div>
            <div class="total">
                <span>TỔNG CỘNG:</span>
                <span>${new Intl.NumberFormat('vi-VN').format(totalAmount)} đ</span>
            </div>
            <div class="footer">${settings.receiptFooter || 'Cảm ơn quý khách!'}</div>
            ${customLinesHtml}
            ${settings.wifiPass ? `<div class="footer">Wifi: ${settings.wifiPass}</div>` : ''}
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

// Component đăng nhập
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
          showNotification.success(`👋 Xin chào ${data.user.name}!`);
          onLogin(data.user);
      } else {
          showNotification.error('❌ ' + (data.message || data.error || 'Đăng nhập thất bại'));
      }
    } catch (err) { 
      showNotification.error('❌ ' + (err.message || 'Không thể kết nối đến máy chủ')); 
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#e8ded2] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-rose-200 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-stone-200 rounded-full blur-3xl opacity-50"></div>
      <div className="glass-panel bg-[#f0f0ec]/80 backdrop-blur-xl p-5 rounded-[2rem] shadow-xl w-full max-w-sm relative z-10 border border-white">
        <div className="text-center mb-8">
          <div className="bg-stone-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg "><Coffee className="text-rose-100 w-10 h-10" /></div>
          <h2 className="text-2xl font-bold text-stone-700">Xin Chào!</h2>
          <p className="text-stone-500 text-sm mt-1">Đăng nhập hệ thống POS</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <input className="w-full p-4 bg-[#f0f0ec] border border-rose-100 rounded-2xl text-stone-700 placeholder-stone-400 focus:ring-2 focus:ring-rose-300 outline-none transition shadow-sm" value={username} onChange={e => setUsername(e.target.value)} placeholder="Tên đăng nhập" autoFocus />
          <input type="password" className="w-full p-4 bg-[#f0f0ec] border border-rose-100 rounded-2xl text-stone-700 placeholder-stone-400 focus:ring-2 focus:ring-rose-300 outline-none transition shadow-sm" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu" />
          <button disabled={loading} className="w-full bg-stone-800 text-rose-50 font-bold py-4 rounded-2xl hover:bg-stone-700 shadow-lg hover:shadow-stone-200 transition-all transform active:scale-95 disabled:opacity-50 mt-4">{loading ? 'Đang vào...' : 'Đăng Nhập Ngay'}</button>
        </form>
      </div>
    </div>
  );
};

// Component xác nhận
const ConfirmDialog = ({ isOpen, title, message, type = 'confirm', maxQty, onConfirm, onCancel }) => {
    const [inputValue, setInputValue] = useState('1');
    
    useEffect(() => { 
        if (isOpen) setInputValue('1'); 
    }, [isOpen]);

    const handleInputChange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = ''; 
        setInputValue(val);
    };

    const handleBlur = () => {
        let val = parseInt(inputValue);
        if (!val || val < 1) setInputValue(1);
        else if (val > maxQty) setInputValue(maxQty);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-stone-900/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#f0f0ec] w-full max-w-sm rounded-[1.5rem] shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-white/20">
                <div className="bg-rose-50 p-6 text-center border-b border-rose-100">
                    <div className="w-14 h-14 bg-[#f0f0ec] rounded-full flex items-center justify-center mx-auto mb-3 shadow-md shadow-rose-100 text-rose-500">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="font-bold text-xl text-stone-800">{title}</h3> 
                    <p className="text-stone-500 text-sm mt-2 leading-relaxed">{message}</p>
                </div> 
                
                <div className="p-6">
                    {type === 'input' && (
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-stone-400 uppercase mb-3 text-center tracking-wider">
                                Số lượng trả lại (Tối đa: {maxQty})
                            </label>
                            <div className="flex items-center justify-center gap-4">
                                <button onClick={() => setInputValue(p => Math.max(1, (parseInt(p) || 0) - 1))} className="w-12 h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 transition font-bold text-xl text-stone-600 shadow-sm">-</button>
                                <input 
                                    type="number" 
                                    className="w-24 text-center font-bold text-3xl py-2 border-b-2 border-rose-200 outline-none focus:border-rose-500 text-stone-800 bg-transparent"
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    min="1"
                                    max={maxQty}
                                    autoFocus
                                />
                                <button onClick={() => setInputValue(p => Math.min(maxQty, (parseInt(p) || 0) + 1))} className="w-12 h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 transition font-bold text-xl text-stone-600 shadow-sm">+</button>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-3.5 rounded-xl bg-stone-100 text-stone-600 font-bold hover:bg-stone-200 active:scale-95 transition">Hủy bỏ</button>
                        <button 
                            onClick={() => {
                                if (type === 'input') {
                                    const qty = parseInt(inputValue);
                                    if (qty > 0 && qty <= maxQty) onConfirm(qty);
                                    else showNotification.error(`⚠️ Số lượng phải từ 1 đến ${maxQty}`);
                                } else {
                                    onConfirm();
                                }
                            }} 
                            className="flex-1 py-3.5 rounded-xl bg-stone-800 text-white font-bold shadow-lg shadow-stone-300 hover:bg-stone-700 active:scale-95 transition flex justify-center items-center gap-2"
                        >
                            <CheckCircle size={18} /> Xác nhận
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Component thanh toán
const PaymentModal = ({ table, orders, settings, onConfirm, onClose, handleRequestDelete }) => {
    const [method, setMethod] = useState('Tiền mặt');
    const totalAmount = useMemo(() => calculateTotalAmount(orders), [orders]);
    const [receivedAmount, setReceivedAmount] = useState(totalAmount.toString());
    
    useEffect(() => {
        setReceivedAmount(totalAmount.toString());
    }, [totalAmount]);
    
    const mergedDisplayItems = useMemo(() => {
        const merged = {};
        orders.forEach(order => {
            order.items.forEach((item, itemIdx) => {
                const key = `${item._id}-${item.price}`;
                if (!merged[key]) {
                    merged[key] = { ...item, originalOrders: [] };
                }
                merged[key].originalOrders.push({ order, item, itemIdx, qty: item.quantity });
            });
        });

        const result = [];
        Object.values(merged).forEach(group => {
            const totalQty = group.originalOrders.reduce((sum, o) => sum + o.qty, 0);
            result.push({ ...group, quantity: totalQty });
        });
        return result;
    }, [orders]);

    const receivedNum = parseFloat(receivedAmount) || 0;
    const changeAmount = Math.max(0, receivedNum - totalAmount);

    const handlePrint = () => printReceipt(orders, settings);

    const handlePayOnly = () => {
        if (method === 'Tiền mặt' && receivedNum < totalAmount) {
            showNotification.error("💰 Số tiền khách đưa chưa đủ!");
            return;
        }
        onConfirm(method);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#f0f0ec] w-80% max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] lg:max-h-[95vh]">
                
                {/* Header */}
                <div className="bg-[#55352a] p-6 text-white relative flex-shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-[#f0f0ec]/10 rounded-lg transition"><X size={20}/></button>
                    <h3 className="font-bold text-2xl mb-4">Thanh Toán</h3>
                    <div>
                        <div className="text-gray-400 text-sm mb-1">Bàn: {table.name}</div>
                        <div className="text-4xl font-bold text-white">{formatCurrency(totalAmount)}</div>
                    </div>
                </div>

                {/* Body - Responsive Layout */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0">

                    {/* Middle Column - Payment Form */}
                    <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[#55352a] flex flex-col bg-[#e8ded2] flex-shrink-0">
                        {/* Content - Scrollable */}
                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                            {/* Payment Method */}
                            <div>
                                <label className="block text-xs font-bold text-gray-900 mb-2 uppercase">Phương thức</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Tiền mặt', 'Chuyển khoản'].map(m => (
                                        <button 
                                            key={m} 
                                            onClick={() => setMethod(m)} 
                                            className={`p-3 rounded-lg border-2 transition-all font-bold text-xs flex items-center justify-center gap-2 ${
                                                method === m 
                                                    ? 'border-[#55352a] bg-[#55352a]/10 text-[#55352a]' 
                                                    : 'border-[#55352a] bg-gray-50 text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            {m === 'Tiền mặt' ? <Banknote size={16}/> : <CreditCard size={16}/>}
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cash Input */}
                            {method === 'Tiền mặt' && (
                                <div className="space-y-3 animate-in slide-in-from-bottom duration-300">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-900 mb-1">Khách đưa</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                autoFocus 
                                                className="w-full px-3 py-2 text-lg font-bold bg-[#f0f0ec] rounded-lg border-2 border-[#55352a] focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900"  
                                                value={receivedAmount} 
                                                onChange={e => setReceivedAmount(e.target.value)} 
                                                placeholder="0"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">đ</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border-2 border-[#55352a]">
                                        <span className="font-bold text-gray-900 text-sm">Tiền thừa:</span>
                                        <span className="text-lg font-bold text-[#55352a]">{formatCurrency(changeAmount)}</span>
                                    </div>

                                    {/* Quick Amount Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[totalAmount,50000, 100000, 200000, 500000].filter(v => v >= totalAmount).slice(0, 4).map(v => (
                                            <button 
                                                key={v} 
                                                onClick={() => setReceivedAmount(v.toString())} 
                                                className="px-2 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-200 transition"
                                            >
                                                {new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(v)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-[#55352a] bg-gray-50 flex gap-2 flex-shrink-0">
                            <button 
                                onClick={handlePrint} 
                                className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-bold text-xs flex items-center justify-center gap-2 min-w-max"
                                title="In Hóa Đơn"
                            >
                                <Printer size={16}/> In
                            </button>
                            <button 
                                onClick={handlePayOnly} 
                                className="flex-1 bg-[#147a2a] text-white rounded-lg font-bold hover:bg-[#184221] transition active:scale-95 flex items-center justify-center gap-2 py-3 text-sm h-12"
                            >
                                <CheckCircle size={16}/> Thanh Toán
                            </button>
                        </div>
                    </div>

                    {/* Right Column - Receipt Preview */}
                    <div className="hidden lg:flex flex-1 flex-col bg-[#e8ded2] overflow-hidden">
                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="w-full bg-[#f0f0ec] shadow-sm p-4 font-mono text-xs text-black rounded-lg overflow-y-auto custom-scrollbar space-y-3">
                                <div className="text-center border-b border-gray-300 pb-3">
                                    <div className="font-bold text-sm mb-1 uppercase">{settings.restaurantName || 'NHÀ HÀNG'}</div>
                                    <div className="text-xs text-gray-600 mb-1">{settings.address}</div>
                                    <div className="text-xs text-gray-600">Hotline: {settings.phone}</div>
                                </div>
                                
                                <div className="text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Bàn: <span className="font-bold">{table.name}</span></span>
                                        <span>{new Date().toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>

                                <div>
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-300">
                                                <th className="pb-2 font-bold">SL</th>
                                                <th className="pb-2 font-bold">Món</th>
                                                <th className="pb-2 font-bold text-right">Tiền</th>
                                                <th className="pb-2 font-bold text-center">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mergedDisplayItems.map((item, idx) => {
                                                const originalOrder = orders.find(o => o.items.some(i => i.name === item.name && i.price === item.price));
                                                const originalItemIdx = originalOrder?.items.findIndex(i => i.name === item.name && i.price === item.price);
                                                
                                                return (
                                                    <tr key={idx} className="border-b border-[#55352a] hover:bg-gray-50">
                                                        <td className="py-2 font-bold">{item.quantity}</td>
                                                        <td className="py-2">{item.name}</td>
                                                        <td className="py-2 text-right">{new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)}</td>
                                                        <td className="py-2 text-center">
                                                            <button
                                                                onClick={() => {
                                                                    if (originalOrder && originalItemIdx !== -1) {
                                                                        handleRequestDelete(originalOrder, originalOrder.items[originalItemIdx], originalItemIdx);
                                                                    }
                                                                }}
                                                                className="text-red-500 hover:text-red-700 font-bold hover:underline"
                                                                title="Trả lại món"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="border-t border-gray-300 pt-3 space-y-2">
                                    <div className="flex justify-between font-bold text-sm">
                                        <span>TỔNG CỘNG:</span>
                                        <span>{formatCurrency(totalAmount)}</span>
                                    </div>
                                    <div className="text-center text-xs text-gray-600 italic">
                                        {settings.receiptFooter || 'Cảm ơn quý khách!'}
                                    </div>
                                    {settings.receiptLine1 && <div className="text-center text-xs">{settings.receiptLine1}</div>}
                                    {settings.receiptLine2 && <div className="text-center text-xs">{settings.receiptLine2}</div>}
                                    {settings.receiptLine3 && <div className="text-center text-xs">{settings.receiptLine3}</div>}
                                    {settings.wifiPass && <div className="text-center text-xs text-gray-600">Wifi: {settings.wifiPass}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Component báo cáo
const ReportsView = ({ reports, settings }) => {
    const [revenueData, setRevenueData] = useState({ 
        dailyRevenue: 0, dailyOrders: 0, 
        monthlyRevenue: 0, monthlyOrders: 0, 
        totalRevenue: 0, totalOrders: 0 
    });
    const [selectedPeriod, setSelectedPeriod] = useState('today');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [historyPage, setHistoryPage] = useState(1);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        // Tính toán revenue từ reports prop
        if (!reports || reports.length === 0) {
            setRevenueData({
                dailyRevenue: 0,
                dailyOrders: 0,
                monthlyRevenue: 0,
                monthlyOrders: 0,
                totalRevenue: 0,
                totalOrders: 0
            });
            return;
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Filter reports - chỉ lấy những orders đã thanh toán (status === 'paid')
        const paidReports = reports.filter(r => r.status === 'paid');

        // Tính daily revenue & orders
        const dailyOrders = paidReports.filter(r => {
            const reportDate = new Date(r.paidAt);
            return reportDate >= today && reportDate < new Date(today.getTime() + 86400000);
        });
        const dailyRevenue = dailyOrders.reduce((sum, order) => sum + (order.finalTotal || 0), 0);

        // Tính monthly revenue & orders
        const monthlyOrders = paidReports.filter(r => {
            const reportDate = new Date(r.paidAt);
            return reportDate >= firstDayOfMonth && reportDate < new Date(now.getFullYear(), now.getMonth() + 1, 1);
        });
        const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.finalTotal || 0), 0);

        // Tính total revenue & orders
        const totalRevenue = paidReports.reduce((sum, order) => sum + (order.finalTotal || 0), 0);
        const totalOrders = paidReports.length;

        setRevenueData({
            dailyRevenue,
            dailyOrders: dailyOrders.length,
            monthlyRevenue,
            monthlyOrders: monthlyOrders.length,
            totalRevenue,
            totalOrders
        });
    }, [reports]);

    const displayRevenue = selectedPeriod === 'today' ? revenueData.dailyRevenue : 
                          selectedPeriod === 'thisMonth' ? revenueData.monthlyRevenue : 
                          revenueData.totalRevenue;
    const displayOrders = selectedPeriod === 'today' ? revenueData.dailyOrders : 
                         selectedPeriod === 'thisMonth' ? revenueData.monthlyOrders : 
                         revenueData.totalOrders;

    const topItems = useMemo(() => {
        const items = {};
        reports.forEach(order => {
            if(Array.isArray(order.items)) {
                order.items.forEach(i => {
                    items[i.name] = (items[i.name] || 0) + i.quantity;
                });
            }
        });
        return Object.entries(items).sort(([, a], [, b]) => b - a).slice(0, 5);
    }, [reports]);

    const paymentMethods = useMemo(() => {
        const methods = { 'Tiền mặt': 0, 'Chuyển khoản': 0 };
        reports.forEach(r => {
            const m = r.paymentMethod || 'Tiền mặt';
            methods[m] = (methods[m] || 0) + 1;
        });
        return methods;
    }, [reports]);

    // Lịch sử giao dịch theo ngày
    const transactionsByDate = useMemo(() => {
        if (!reports || reports.length === 0) return [];
        
        const filtered = reports.filter(r => {
            // Chuyển paidAt thành local date (YYYY-MM-DD)
            const date = new Date(r.paidAt);
            const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                .toLocaleDateString('en-CA'); // Format: YYYY-MM-DD
            
            return localDate === selectedDate;
        }).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
        
        console.log(`Transactions for ${selectedDate}: ${filtered.length} found out of ${reports.length} total`);
        
        return filtered;
    }, [reports, selectedDate]);

    const paginatedTransactions = useMemo(() => {
        const start = (historyPage - 1) * ITEMS_PER_PAGE;
        return transactionsByDate.slice(start, start + ITEMS_PER_PAGE);
    }, [transactionsByDate, historyPage]);

    const maxPage = Math.ceil(transactionsByDate.length / ITEMS_PER_PAGE);

    const maxVal = Math.max(...Object.values(paymentMethods), 1);

    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#e8ded2] custom-scrollbar">
            {/* Header */}
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h2 className="text-4xl font-bold text-[#55352a] mb-2">Báo Cáo Kinh Doanh</h2>
                    <p className="text-gray-500 text-sm font-medium">{new Date().toLocaleDateString('vi-VN')}</p>
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="p-3 hover:bg-orange-50 rounded-lg transition duration-200"
                    title="Làm mới"
                >
                    <RefreshCw size={20} className="text-[#55352a]" />
                </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-1 mb-8 border-b border-[#55352a]">
                {[
                    { id: 'today', label: 'Hôm Nay' },
                    { id: 'thisMonth', label: 'Tháng Này' },
                    { id: 'allTime', label: 'Tổng Cộng' },
                    { id: 'history', label: 'Lịch Sử' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setSelectedPeriod(tab.id)} 
                        className={`px-6 py-3 font-semibold transition text-sm border-b-2 ${
                            selectedPeriod === tab.id 
                                ? 'text-[#55352a] border-[#55352a]' 
                                : 'text-gray-500 border-transparent hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <>
                {selectedPeriod !== 'history' ? (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                {/* Doanh Thu */}
                                <div className="bg-[#55352a] text-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">Doanh Thu</span>
                                        <DollarSign size={20} className="opacity-70" />
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-bold mb-2">{formatCurrency(displayRevenue)}</h3>
                                    <p className="text-xs opacity-80">{selectedPeriod === 'today' ? 'Hôm nay' : selectedPeriod === 'thisMonth' ? 'Tháng này' : 'Tổng cộng'}</p>
                                </div>

                                {/* Số Đơn Hàng */}
                                <div className="bg-[#55352a] text-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">Số Đơn</span>
                                        <FileText size={20} className="opacity-70" />
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-bold mb-2">{displayOrders}</h3>
                                    <p className="text-xs opacity-80">{selectedPeriod === 'today' ? 'Hôm nay' : selectedPeriod === 'thisMonth' ? 'Tháng này' : 'Tổng cộng'}</p>
                                </div>

                                {/* Giá Trị TB */}
                                <div className="bg-[#55352a] text-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">Giá TB</span>
                                        <PieChart size={20} className="opacity-70" />
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-bold mb-2">{displayOrders > 0 ? formatCurrency(displayRevenue / displayOrders) : '₫0'}</h3>
                                    <p className="text-xs opacity-80">Mỗi đơn hàng</p>
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                {/* Top Món */}
                                <div className="bg-[#f0f0ec] border border-[#55352a] rounded-lg p-5 hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                            <Heart className="text-[#55352a]" size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">Món Bán Nhiều</h3>
                                            <p className="text-xs text-gray-500">{topItems.length} món hàng</p>
                                        </div>
                                    </div>
                                    <div className="space-y-5">
                                        {topItems.map(([name, qty], idx) => (
                                            <div key={name} className="group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-gray-700 text-sm">#{idx+1}</span>
                                                        <span className="font-semibold text-gray-800 text-sm">{name}</span>
                                                    </div>
                                                    <span className="text-xs font-bold bg-orange-100 text-[#55352a] px-3 py-1 rounded">{qty}</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                                                    <div 
                                                        className="h-full bg-[#55352a] transition-all duration-500" 
                                                        style={{ width: `${(qty / (topItems[0][1] || 1)) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                        {topItems.length === 0 && <p className="text-gray-400 text-center py-8 text-sm">Chưa có dữ liệu</p>}
                                    </div>
                                </div>

                                {/* Payment Methods */}
                                <div className="bg-[#f0f0ec] border border-[#55352a] rounded-lg p-5 hover:shadow-md transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                            <CreditCard className="text-[#55352a]" size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">Phương Thức Thanh Toán</h3>
                                            <p className="text-xs text-gray-500">Phân bố</p>
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-center gap-12 h-48 py-4">
                                        {Object.entries(paymentMethods).map(([method, count]) => (
                                            <div key={method} className="flex flex-col items-center gap-3 flex-1">
                                                <div className="relative w-full flex flex-col items-center">
                                                    <div className="absolute -top-5 font-bold text-gray-700 text-sm">{count}</div>
                                                    <div className="w-16 rounded-t transition-all duration-300 hover:bg-[#a55a42] shadow-sm bg-[#55352a]" style={{ height: `${(count / maxVal) * 100}%`, minHeight: '20px' }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-gray-700 text-center">{method}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                    
                    {selectedPeriod === 'history' && (
                        <>
                            {/* Lịch sử giao dịch */}
                            <div className="bg-[#f0f0ec] border border-[#55352a] rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-300">
                                {/* Header */}
                                <div className="p-6 md:p-5 border-b border-[#55352a] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                            <FileText size={20} className="text-[#55352a]" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl text-gray-900">Lịch Sử Giao Dịch</h3>
                                            <p className="text-sm text-gray-500">{transactionsByDate.length} giao dịch</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const prevDate = new Date(selectedDate);
                                                prevDate.setDate(prevDate.getDate() - 1);
                                                setSelectedDate(prevDate.toISOString().split('T')[0]);
                                                setHistoryPage(1);
                                            }}
                                            className="p-2.5 hover:bg-orange-100 rounded-lg text-[#55352a] transition duration-200"
                                            title="Ngày trước"
                                        >
                                            <ChevronLeft size={20}/>
                                        </button>
                                        <input 
                                            type="date" 
                                            value={selectedDate} 
                                            onChange={(e) => {
                                                setSelectedDate(e.target.value);
                                                setHistoryPage(1);
                                            }}
                                            className="px-4 py-2.5 bg-gray-50 rounded-lg border border-[#55352a] text-gray-700 font-semibold focus:ring-2 focus:ring-gray-900 outline-none transition"
                                        />
                                        <button
                                            onClick={() => {
                                                const nextDate = new Date(selectedDate);
                                                nextDate.setDate(nextDate.getDate() + 1);
                                                setSelectedDate(nextDate.toISOString().split('T')[0]);
                                                setHistoryPage(1);
                                            }}
                                            className="p-2.5 hover:bg-orange-100 rounded-lg text-[#55352a] transition duration-200"
                                            title="Ngày sau"
                                        >
                                            <ChevronRight size={20}/>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Table */}
                                <div className="overflow-x-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 border-b border-[#55352a]">
                                            <tr>
                                                <th className="px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider">Thời Gian</th>
                                                <th className="px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider">Nhân Viên</th>
                                                <th className="px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider">Bàn</th>
                                                <th className="px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider">Thanh Toán</th>
                                                <th className="px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider text-right">Tổng Tiền</th>
                                                <th className="px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider text-center">Hành Động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {paginatedTransactions.map(h=>(
                                                <tr key={h._id} className="hover:bg-orange-50 transition-colors duration-150">
                                                    <td className="px-6 py-4 font-medium text-gray-700">{new Date(h.paidAt).toLocaleString('vi-VN', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
                                                    <td className="px-6 py-4 font-semibold text-[#55352a]">{h.staffName || '-'}</td>
                                                    <td className="px-6 py-4 font-bold text-gray-800">{h.tableName}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold px-3 py-1.5 rounded bg-orange-100 text-[#55352a]">
                                                            {h.paymentMethod}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-gray-800">{formatCurrency(h.finalTotal)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => { setSelectedInvoice(h); setShowInvoiceModal(true); }} 
                                                                className="p-2 hover:bg-orange-100 rounded-lg text-[#55352a] transition duration-200" 
                                                                title="Xem chi tiết"
                                                            >
                                                                <Eye size={18}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => printReceipt(h, settings)} 
                                                                className="p-2 hover:bg-orange-100 rounded-lg text-[#55352a] transition duration-200" 
                                                                title="In hóa đơn"
                                                            >
                                                                <Printer size={18}/>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {transactionsByDate.length === 0 && (
                                                <tr><td colSpan="6" className="p-12 text-center text-gray-400 font-medium">Không có giao dịch nào vào ngày này</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Pagination */}
                                {maxPage > 1 && (
                                    <div className="px-6 py-4 border-t border-[#55352a] bg-gray-50 flex items-center justify-between">
                                        <p className="text-sm font-semibold text-gray-600">Trang <span className="text-[#55352a] font-bold">{historyPage}</span> / <span className="text-gray-600">{maxPage}</span></p>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setHistoryPage(p => Math.max(1, p-1))} 
                                                disabled={historyPage === 1}
                                                className="p-2 hover:bg-orange-100 rounded-lg text-[#55352a] disabled:opacity-40 disabled:cursor-not-allowed transition duration-200"
                                            >
                                                <ChevronLeft size={20}/>
                                            </button>
                                            <button 
                                                onClick={() => setHistoryPage(p => Math.min(maxPage, p+1))} 
                                                disabled={historyPage === maxPage}
                                                className="p-2 hover:bg-orange-100 rounded-lg text-[#55352a] disabled:opacity-40 disabled:cursor-not-allowed transition duration-200"
                                            >
                                                <ChevronRight size={20}/>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    

                    {/* Modal chi tiết hóa đơn */}
                    {showInvoiceModal && selectedInvoice && (
                        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                            <div className="bg-[#f0f0ec] rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto custom-scrollbar shadow-lg">
                                {/* Modal Header */}
                                <div className="sticky top-0 bg-[#55352a] text-white p-6 border-b border-[#55352a] flex justify-between items-center">
                                    <h3 className="font-bold text-lg">Chi Tiết Hóa Đơn</h3>
                                    <button onClick={() => setShowInvoiceModal(false)} className="p-2 hover:bg-[#a55a42] rounded-lg text-white transition duration-200"><X size={20}/></button>
                                </div>
                                
                                <div className="p-6 space-y-6">
                                    {/* Info Section */}
                                    <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Bàn</p>
                                                <p className="font-bold text-lg text-gray-900">{selectedInvoice.tableName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Thời gian</p>
                                                <p className="font-semibold text-sm text-gray-700">{new Date(selectedInvoice.paidAt).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</p>
                                            </div>
                                        </div>
                                        <div className="border-t border-[#55352a] pt-4 flex justify-between items-start">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Nhân viên</p>
                                                <p className="font-semibold text-gray-700">{selectedInvoice.staffName || '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Thanh toán</p>
                                                <span className="font-bold px-3 py-1.5 rounded inline-block text-sm bg-gray-200 text-gray-700">{selectedInvoice.paymentMethod}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Section */}
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase font-bold tracking-wide mb-4">Chi tiết</p>
                                        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                                            {selectedInvoice.items?.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start pb-3 border-b border-[#55352a] last:border-b-0 last:pb-0">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-gray-800">{item.name}</p>
                                                        <p className="text-xs text-gray-500">{item.quantity}x @ {formatCurrency(item.price)}</p>
                                                    </div>
                                                    <p className="font-bold text-gray-800 text-right">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Total Section */}
                                    <div className="bg-[#55352a] text-white rounded-lg p-5">
                                        <p className="text-sm text-white/80 uppercase font-semibold mb-1">Tổng cộng</p>
                                        <h4 className="text-3xl font-bold">{formatCurrency(selectedInvoice.finalTotal)}</h4>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2"> 
                                        <button 
                                            onClick={() => setShowInvoiceModal(false)} 
                                            className="flex-1 p-3 bg-orange-100 text-[#55352a] rounded-lg font-bold hover:bg-orange-200 transition duration-200 active:scale-95"
                                        >
                                            Đóng
                                        </button>
                                        <button 
                                            onClick={() => { printReceipt(selectedInvoice, settings); setShowInvoiceModal(false); }} 
                                            className="flex-1 p-3 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#a55a42] transition duration-200 active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Printer size={18}/> In
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
            </>
        </div>
    );
};

// Component upload ảnh đơn giản - ĐÃ SỬA LỖI
const ImageUploader = ({ value, onChange }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file ảnh');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Ảnh quá lớn, tối đa 5MB');
            return;
        }
        
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            console.log('Uploading to:', `${API_URL}/api/upload`);
            const res = await fetch(`${API_URL}/api/upload`, { 
                method: 'POST', 
                body: formData 
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP ${res.status}`);
            }
            
            const data = await res.json();
            console.log('Upload response:', data);
            
            if (data.success && data.url) {
                onChange(data.url);
                toast.success("✅ Upload ảnh thành công");
            } else if (data.url) {
                // Fallback cho old API format
                onChange(data.url);
                toast.success("✅ Upload ảnh thành công");
            } else {
                throw new Error(data.error || 'Không nhận được link ảnh');
            }
        } catch (e) { 
            console.error('Upload error:', e);
            toast.error(`❌ Upload thất bại: ${e.message}`); 
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div 
            className={`relative w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${dragging ? 'border-rose-500 bg-rose-50' : 'border-stone-300 bg-stone-50 hover:bg-[#f0f0ec]'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current.click()}
        >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} />
            {uploading ? <div className="flex flex-col items-center text-rose-500 animate-pulse"><RefreshCw className="animate-spin mb-2"/> <span className="text-xs font-bold">Đang tải ảnh lên...</span></div> : value ? <div className="w-full h-full relative group"><img src={value} className="w-full h-full object-contain rounded-lg p-2" onError={(e) => {e.target.src = 'https://via.placeholder.com/150?text=No+Image';}} /><div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center rounded-lg text-white font-bold backdrop-blur-sm transition">Thay ảnh khác</div></div> : <div className="text-center text-stone-400"><UploadCloud size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm font-bold">Kéo thả ảnh vào đây</p><p className="text-xs opacity-70">hoặc bấm để chọn</p></div>}
        </div>
    );
};

// Component quản lý - MINIMALIST DESIGN
const ManagementView = ({ type, data, categories, onSave, onDelete, onRefresh }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    const openModal = (item = null) => {
        setEditingItem(item);
        setFormData(item || (type === 'menu' ? { status: 'active', categoryName: categories?.[0]?.name } : type === 'tables' ? { zone: 'Dưới Lầu', capacity: 4 } : {}));
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        await onSave(formData, editingItem?._id); 
        setIsModalOpen(false); 
        onRefresh(); 
    };

    const filteredData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data.filter(item => {
            const matchSearch = (item.name || item.username || '').toLowerCase().includes(searchTerm.toLowerCase());
            let matchCategory = true;
            if (type === 'menu' && filterCategory !== 'All') matchCategory = item.categoryName === filterCategory;
            if (type === 'tables' && filterCategory !== 'All') matchCategory = (item.zone || 'Khác') === filterCategory;
            return matchSearch && matchCategory;
        });
    }, [data, searchTerm, filterCategory, type]);

    const uniqueZones = useMemo(() => {
        if (type !== 'tables' || !Array.isArray(data)) return [];
        return ['All', ...new Set(data.map(t => t.zone || 'Khác'))].sort();
    }, [data, type]);

    const getTypeLabel = () => {
        const labels = { menu: 'Quản Lý Thực Đơn', tables: 'Quản Lý Bàn', staff: 'Quản Lý Nhân Viên', categories: 'Quản Lý Danh Mục' };
        return labels[type] || 'Quản Lý';
    };

    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#e8ded2] custom-scrollbar">
            {/* Header */}
            <div className="mb-8 sticky top-0 bg-[#e8ded2] backdrop-blur-sm z-10 py-2">
                <h2 className="text-4xl font-bold text-[#55352a] mb-2">{getTypeLabel()}</h2>
                <p className="text-gray-500 text-base mb-6">Quản lý dữ liệu • <span className="font-bold text-gray-700">{data.length}</span> mục</p>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"/>
                        <input 
                            className="w-full  pl-12 pr-4 py-3 rounded-lg border border-[#55352a] focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none text-gray-900 text-sm" 
                            placeholder="Tìm kiếm..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {type === 'menu' && (
                        <select 
                            className="px-4 py-3 rounded-lg border border-[#55352a] focus:ring-2 focus:ring-rose-300 outline-none bg-[#f0f0ec] text-gray-900 text-sm font-medium" 
                            value={filterCategory} 
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="All">Tất cả danh mục</option>
                            {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                        </select>
                    )}
                    
                    {type === 'tables' && (
                        <select 
                            className="px-4 py-3 rounded-lg border border-[#55352a] focus:ring-2 focus:ring-rose-300 outline-none bg-[#f0f0ec] text-gray-900 text-sm font-medium" 
                            value={filterCategory} 
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="All">Tất cả khu vực</option>
                            {uniqueZones.map(z => z !== 'All' && <option key={z} value={z}>{z}</option>)}
                        </select>
                    )}
                    
                    <button 
                        onClick={() => openModal()} 
                        className="bg-[#55352a] text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#55352a] transition active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={20}/> Thêm Mới
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredData.map(item => (
                    <div key={item._id} className="bg-[#f0f0ec] p-4 rounded-lg border border-[#55352a] flex items-center justify-between hover:shadow-md transition group">
                        <div className="flex items-center gap-4 overflow-hidden flex-1">
                            {type === 'menu' && (
                                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-[#55352a] flex items-center justify-center">
                                    {item.image ? (
                                        <img 
                                            src={item.image} 
                                            className="w-full h-full object-cover" 
                                            alt={item.name}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div className="w-full h-full flex items-center justify-center" style={{ display: item.image ? 'none' : 'flex' }}>
                                        <ImageIcon className="text-gray-400 w-6 h-6"/>
                                    </div>
                                </div>
                            )}
                            
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-900 truncate text-lg">{item.name}</h3>
                                <div className="text-sm text-gray-500 mt-1">
                                    {type === 'menu' && (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900">{formatCurrency(item.price)}</span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600">{item.categoryName}</span>
                                        </div>
                                    )}
                                    {type === 'tables' && <span>{item.capacity} ghế • Khu {item.zone}</span>}
                                    {type === 'staff' && <span>{item.username} • {item.role === 'admin' ? '👤 Quản lý' : '👥 Nhân viên'}</span>}
                                    {type === 'categories' && <span>Thứ tự: {item.order}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => openModal(item)} 
                                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                                title="Sửa"
                            >
                                <Edit size={18}/>
                            </button>
                            <button 
                                onClick={() => { 
                                    if (window.confirm(`Bạn có chắc muốn xóa "${item.name}"?`)) {
                                        onDelete(item._id);
                                        onRefresh();
                                    }
                                }} 
                                className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"
                                title="Xóa"
                            >
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>
                ))}
                
                {filteredData.length === 0 && (
                    <div className="text-center text-gray-400 py-16">
                        <p className="text-lg">Không tìm thấy dữ liệu</p>
                        <p className="text-sm mt-1">Hãy thêm mục mới bằng nút "Thêm Mới" ở trên</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
                    <div className="bg-[#f0f0ec] rounded-t-2xl md:rounded-2xl w-full md:w-96 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto custom-scrollbar flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-[#f0f0ec] border-b border-[#55352a] p-6 flex items-center justify-between">
                            <h3 className="font-bold text-2xl text-gray-900">{editingItem ? 'Sửa' : 'Thêm Mới'}</h3>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Tên</label>
                                    <input 
                                        required 
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                        placeholder="Nhập tên..." 
                                        value={formData.name || ''} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                    />
                                </div>

                                {type === 'menu' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Giá tiền</label>
                                            <input 
                                                required 
                                                type="number" 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                placeholder="0" 
                                                value={formData.price || ''} 
                                                onChange={e => setFormData({...formData, price: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Danh mục</label>
                                            <select 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                value={formData.categoryName || ''} 
                                                onChange={e => setFormData({...formData, categoryName: e.target.value})}
                                            >
                                                <option value="">-- Chọn danh mục --</option>
                                                {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <ImageUploader value={formData.image} onChange={(url) => setFormData({...formData, image: url})} />
                                    </>
                                )}

                                {type === 'tables' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Số ghế</label>
                                            <input 
                                                required 
                                                type="number" 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                placeholder="4" 
                                                value={formData.capacity || ''} 
                                                onChange={e => setFormData({...formData, capacity: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Khu vực</label>
                                            <input 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                placeholder="Tầng 1, Sân Thượng, ..." 
                                                list="zones" 
                                                value={formData.zone || ''} 
                                                onChange={e => setFormData({...formData, zone: e.target.value})} 
                                            />
                                            <datalist id="zones">
                                                <option value="Tầng 1"/><option value="Tầng 2"/><option value="Sân Thượng"/><option value="Phòng Lạnh"/>
                                            </datalist>
                                        </div>
                                    </>
                                )}

                                {type === 'categories' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Thứ tự hiển thị</label>
                                        <input 
                                            type="number" 
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                            placeholder="1" 
                                            value={formData.order || ''} 
                                            onChange={e => setFormData({...formData, order: e.target.value})} 
                                        />
                                    </div>
                                )}

                                {type === 'staff' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Tên đăng nhập</label>
                                            <input 
                                                required 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                placeholder="username" 
                                                value={formData.username || ''} 
                                                onChange={e => setFormData({...formData, username: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu</label>
                                            <input 
                                                type="password" 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                placeholder={editingItem ? "Để trống nếu không đổi" : "Nhập mật khẩu"} 
                                                value={formData.password || ''} 
                                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Vai trò</label>
                                            <select 
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg text-gray-900 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none" 
                                                value={formData.role || 'staff'} 
                                                onChange={e => setFormData({...formData, role: e.target.value})}
                                            >
                                                <option value="staff">Nhân viên</option>
                                                <option value="admin">Quản lý</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-[#f0f0ec] border-t border-[#55352a] p-4 flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-bold hover:bg-gray-200 transition active:scale-95"
                            >
                                Hủy
                            </button>
                            <button 
                                type="submit" 
                                onClick={handleSubmit}
                                className="flex-1 px-4 py-2.5 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#55352a] transition active:scale-95"
                            >
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Component cài đặt - MINIMALIST DESIGN
const SettingsView = ({ settings, onSave }) => {
    const [formData, setFormData] = useState(settings || {});
    const [activeTab, setActiveTab] = useState('general');
    
    useEffect(() => { setFormData(settings || {}) }, [settings]);
    
    const handleSave = async () => { 
        await onSave(formData); 
        showNotification.success('✅ Cài đặt đã được lưu');
    };
    
    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full bg-[#e8ded2] overflow-y-auto custom-scrollbar">
            <div className="mb-8">
                <h2 className="text-4xl font-bold text-[#55352a]">Cài Đặt Hệ Thống</h2>
                <p className="text-gray-500 text-base mt-1">Quản lý cấu hình của nhà hàng</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-8 border-b border-[#55352a]">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors ${
                        activeTab === 'general' 
                            ? 'border-[#55352a] text-[#55352a]' 
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Thông Tin Chung
                </button>
                <button 
                    onClick={() => setActiveTab('attendance')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors ${
                        activeTab === 'attendance' 
                            ? 'border-[#55352a] text-[#55352a]' 
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Điểm Danh
                </button>
                <button 
                    onClick={() => setActiveTab('receipt')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors ${
                        activeTab === 'receipt' 
                            ? 'border-[#55352a] text-[#55352a]' 
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Hóa Đơn
                </button>
            </div>

            <div className="bg-[#e8ded2] max-w-2xl">
                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Tên Cửa Hàng</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900" 
                                value={formData.restaurantName || ''} 
                                onChange={e => setFormData({...formData, restaurantName: e.target.value})} 
                                placeholder="Nhập tên cửa hàng"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Địa Chỉ</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900" 
                                value={formData.address || ''} 
                                onChange={e => setFormData({...formData, address: e.target.value})} 
                                placeholder="Nhập địa chỉ"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Hotline</label>
                                <input 
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900" 
                                    value={formData.phone || ''} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                    placeholder="0123456789"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Mật khẩu WiFi</label>
                                <input 
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900" 
                                    value={formData.wifiPass || ''} 
                                    onChange={e => setFormData({...formData, wifiPass: e.target.value})} 
                                    placeholder="Nhập mật khẩu"
                                />
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-6">
                            <button 
                                onClick={handleSave} 
                                className="px-8 py-3 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#55352a] transition active:scale-95"
                            >
                                <Save size={18} className="inline mr-2"/> Lưu Cài Đặt
                            </button>
                        </div>
                    </div>
                )}

                {/* Schedule Tab */}
                {activeTab === 'schedule' && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 border border-[#55352a] rounded-lg p-4">
                            <p className="text-sm text-gray-700"><strong>ℹ️ Thông tin:</strong> Quản lý lịch làm việc của nhân viên. Admin có thể thêm nhân viên vào những ngày cụ thể.</p>
                        </div>

                        {/* Save Button */}
                        <div className="pt-6">
                            <button 
                                onClick={handleSave} 
                                className="px-8 py-3 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#55352a] transition active:scale-95"
                            >
                                <Save size={18} className="inline mr-2"/> Lưu Cài Đặt
                            </button>
                        </div>
                    </div>
                )}

                {/* Attendance Tab */}
                {activeTab === 'attendance' && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 border border-[#55352a] rounded-lg p-4">
                            <p className="text-sm text-gray-700"><strong>ℹ️ Thông tin:</strong> Cài đặt giờ làm việc chuẩn</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Giờ Vào Tiêu Chuẩn</label>
                            <input 
                                type="time" 
                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900" 
                                value={formData.standardStartTime || '09:00'} 
                                onChange={e => setFormData({...formData, standardStartTime: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Giờ Ra Tiêu Chuẩn</label>
                            <input 
                                type="time" 
                                className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none text-gray-900" 
                                value={formData.standardEndTime || '18:00'} 
                                onChange={e => setFormData({...formData, standardEndTime: e.target.value})}
                            />
                        </div>

                        {/* Save Button */}
                        <div className="pt-6">
                            <button 
                                onClick={handleSave} 
                                className="px-8 py-3 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#55352a] transition active:scale-95"
                            >
                                <Save size={18} className="inline mr-2"/> Lưu Cài Đặt
                            </button>
                        </div>
                    </div>
                )}

                {/* Receipt Tab */}
                {activeTab === 'receipt' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Form Left */}
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800"><strong>ℹ️ Thông tin:</strong> Tùy chỉnh nội dung in trên hóa đơn</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Lời Chào Cuối Hóa Đơn</label>
                                <textarea 
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none text-gray-900 resize-none" 
                                    rows="2"
                                    value={formData.receiptFooter || ''} 
                                    onChange={e => setFormData({...formData, receiptFooter: e.target.value})}
                                    placeholder="Cảm ơn quý khách!"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Dòng Thêm 1 (Tùy Chọn)</label>
                                <input 
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none text-gray-900" 
                                    value={formData.receiptLine1 || ''} 
                                    onChange={e => setFormData({...formData, receiptLine1: e.target.value})}
                                    placeholder="VD: Hẹn gặp lại bạn"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Dòng Thêm 2 (Tùy Chọn)</label>
                                <input 
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none text-gray-900" 
                                    value={formData.receiptLine2 || ''} 
                                    onChange={e => setFormData({...formData, receiptLine2: e.target.value})}
                                    placeholder="VD: Địa chỉ website hoặc số điện thoại"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Dòng Thêm 3 (Tùy Chọn)</label>
                                <input 
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-[#55352a] rounded-lg focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none text-gray-900" 
                                    value={formData.receiptLine3 || ''} 
                                    onChange={e => setFormData({...formData, receiptLine3: e.target.value})}
                                    placeholder="VD: Điều khoản ưu đãi"
                                />
                            </div>

                            {/* Save Button */}
                            <div className="pt-6">
                                <button 
                                    onClick={handleSave} 
                                    className="px-8 py-3 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#55352a] transition active:scale-95"
                                >
                                    <Save size={18} className="inline mr-2"/> Lưu Cài Đặt
                                </button>
                            </div>
                        </div>

                        {/* Preview Right */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-5 bg-[#f0f0ec] border border-[#55352a] rounded-lg overflow-y-auto max-h-96">
                                <div className="bg-gray-50 border-b border-[#55352a] p-4">
                                    <p className="text-sm font-bold text-gray-900">Preview Hóa Đơn</p>
                                </div>
                                
                                {/* Receipt Preview - Thermal Paper Size */}
                                <div className="p-4 flex justify-center">
                                    <div className="w-full bg-[#f0f0ec] font-mono text-xs text-gray-800 space-y-0.5">
                                        {/* Header */}
                                        <div className="text-center border-b border-gray-300 pb-2 mb-2">
                                            <p className="font-bold text-sm uppercase">{formData.restaurantName || 'NHÀ HÀNG'}</p>
                                            <p className="text-xs">{formData.address || 'Địa chỉ'}</p>
                                            {formData.phone && <p className="text-xs">Tel: {formData.phone}</p>}
                                        </div>

                                        {/* Order Details Placeholder */}
                                        <div className="border-b border-gray-300 pb-2 mb-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Bàn: 01</span>
                                                <span>{new Date().toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="border-b border-dashed border-gray-300 my-1"></div>
                                            <p className="text-xs mb-1">1x Cà Phê Đen</p>
                                            <p className="text-xs mb-1">1x Nước Cam</p>
                                            <div className="border-b border-dashed border-gray-300 my-1"></div>
                                        </div>

                                        {/* Total */}
                                        <div className="border-b border-gray-300 pb-2 mb-2">
                                            <div className="flex justify-between font-bold">
                                                <span>TỔNG CỘNG:</span>
                                                <span>80,000đ</span>
                                            </div>
                                        </div>

                                        {/* Footer - Custom Lines */}
                                        <div className="text-center border-t border-gray-300 pt-2 space-y-0.5">
                                            <p className="text-xs italic">{formData.receiptFooter || 'Cảm ơn quý khách!'}</p>
                                            {formData.receiptLine1 && <p className="text-xs">{formData.receiptLine1}</p>}
                                            {formData.receiptLine2 && <p className="text-xs">{formData.receiptLine2}</p>}
                                            {formData.receiptLine3 && <p className="text-xs">{formData.receiptLine3}</p>}
                                            {formData.wifiPass && <p className="text-xs">Wifi: {formData.wifiPass}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Component hiển thị bếp
const KitchenDisplay = ({ orders, updateOrderStatus }) => {
    const [hiddenOrders, setHiddenOrders] = useState(new Set());
    const [filterStatus, setFilterStatus] = useState('all');
    
    const activeOrders = useMemo(() => {
        let filtered = orders
            .filter(o => o.status !== 'paid' && !hiddenOrders.has(o._id)) 
            .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        if (filterStatus === 'cooking') {
            filtered = filtered.filter(o => o.items.some(i => (i.status || 'new') === 'cooking'));
        } else if (filterStatus === 'pending') {
            filtered = filtered.filter(o => o.items.some(i => (i.status || 'new') === 'new'));
        } else if (filterStatus === 'ready') {
            filtered = filtered.filter(o => o.items.every(i => (i.status || 'new') === 'served'));
        }
        return filtered;
    }, [orders, hiddenOrders, filterStatus]);

    const updateItemStatus = async (orderId, itemIdx, status) => {
        try {
            await fetch(`${API_URL}/api/orders/${orderId}/items/${itemIdx}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status })
            });
        } catch (e) {
            showNotification.error('❌ Lỗi cập nhật món');
        }
    };

    const hideOrder = (orderId) => {
        setHiddenOrders(prev => new Set([...prev, orderId]));
        showNotification.success('✅ Đơn hàng đã ẩn');
    };

    const getAllItemsServed = (order) => {
        return order.items.every(item => (item.status || 'new') === 'served');
    };

    const countByStatus = () => {
        let pending = 0, cooking = 0, ready = 0;
        orders.filter(o => o.status !== 'paid' && !hiddenOrders.has(o._id)).forEach(o => {
            if (o.items.some(i => (i.status || 'new') === 'new')) pending++;
            if (o.items.some(i => (i.status || 'new') === 'cooking')) cooking++;
            if (getAllItemsServed(o)) ready++;
        });
        return { pending, cooking, ready };
    };

    const counts = countByStatus();

    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#e8ded2] custom-scrollbar">
            {/* Header with Icon */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div>
                    <h2 className={`text-4xl font-bold text-[#55352a] mb-2`}>Bếp trung tâm</h2>
                    <p className={`text-gray-500 text-base font-medium`}>Cập nhật thời gian thực • {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
                </div>
            </div>

            {/* Status Filter Cards */}
            <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                    { id: 'all', label: 'Tất Cả', count: orders.filter(o => o.status !== 'paid' && !hiddenOrders.has(o._id)).length, icon: '📋' },
                    { id: 'pending', label: 'Chưa Nấu', count: counts.pending, icon: '📝' },
                    { id: 'cooking', label: 'Đang Nấu', count: counts.cooking, icon: '🍳' },
                    { id: 'ready', label: 'Xong', count: counts.ready, icon: '✓' }
                ].map(status => (
                    <button
                        key={status.id}
                        onClick={() => setFilterStatus(status.id)}
                        className={`p-4 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                            filterStatus === status.id
                                ? `bg-[#55352a] text-white border-transparent shadow-md`
                                : 'bg-[#f0f0ec] border-[#55352a] text-gray-900 hover:shadow-sm hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold">{status.icon}</div>
                        <p className="text-3xl font-bold mt-2">{status.count}</p>
                        <p className="text-xs font-semibold mt-1.5 uppercase tracking-wider">{status.label}</p>
                    </button>
                ))}
            </div>

            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {activeOrders.map(o => {
                    const allServed = getAllItemsServed(o);
                    const pendingItems = o.items.filter(i => (i.status || 'new') === 'new').length;
                    const cookingItems = o.items.filter(i => (i.status || 'new') === 'cooking').length;
                    const servedItems = o.items.filter(i => (i.status || 'new') === 'served').length;
                    const totalItems = o.items.length;
                    
                    return (
                        <div 
                            key={o._id} 
                            className={`rounded-2xl shadow-md border-2 flex flex-col justify-between h-full animate-in slide-in-from-bottom duration-300 transition-all overflow-hidden group hover:shadow-lg ${
                                allServed 
                                    ? 'bg-gray-50 border-gray-300' 
                                    : 'bg-[#f0f0ec] border-[#55352a]'
                            }`}
                        >
                            {/* Header with Table Info */}
                            <div className={`p-5 bg-[#f0f0ec] border-b-2 border-[#55352a]`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className={`text-4xl font-bold text-[#55352a]`}>{o.tableName}</p>
                                        <p className={`text-xs font-semibold mt-1 text-gray-500`}>
                                            ⏰ {new Date(o.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {pendingItems > 0 && <span className="inline-block bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">📝 {pendingItems}</span>}
                                        {cookingItems > 0 && <span className="inline-block bg-[#55352a]/20 text-[#55352a] px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">🍳 {cookingItems}</span>}
                                        {servedItems > 0 && <span className="inline-block bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">✓ {servedItems}</span>}
                                    </div>
                                </div>
                                {/* Progress Bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                        className="bg-[#55352a] h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${(servedItems / totalItems) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-80">
                                {o.items.map((i, idx) => {
                                    const itemStatus = i.status || 'new';
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`p-3.5 rounded-xl border-2 transition-all transform hover:scale-105 ${
                                                itemStatus === 'new' 
                                                    ? 'bg-[#f0f0ec] border-gray-300 shadow-sm' 
                                                    : itemStatus === 'cooking' 
                                                    ? 'bg-gray-50 border-[#55352a] shadow-sm'
                                                    : 'bg-gray-100 border-gray-300 shadow-sm'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 text-base">{i.name}</p>
                                                    <p className="text-xs font-semibold text-gray-600 mt-1">Số lượng: <span className="text-[#55352a]">{i.quantity}</span></p>
                                                    {i.note && (
                                                        <p className="text-xs font-semibold text-blue-600 mt-2 p-2 bg-blue-50 rounded">📝 {i.note}</p>
                                                    )}
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ml-3 flex-shrink-0 ${
                                                    itemStatus === 'new' 
                                                        ? 'bg-gray-200 text-gray-700' 
                                                        : itemStatus === 'cooking' 
                                                        ? 'bg-[#55352a] text-white'
                                                        : 'bg-gray-300 text-gray-700'
                                                }`}>
                                                    {itemStatus === 'new' ? '⭕ Chưa nấu' : itemStatus === 'cooking' ? '🔥 Đang nấu' : '✓ Xong'}
                                                </span>
                                            </div>
                                            
                                            {/* Action Buttons */}
                                            <div className="flex gap-2 mt-3">
                                                {itemStatus === 'new' && (
                                                    <button 
                                                        onClick={() => updateItemStatus(o._id, idx, 'cooking')} 
                                                        className="flex-1 py-2.5 px-2 bg-[#55352a] text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-md"
                                                    >
                                                        🍳 Nấu
                                                    </button>
                                                )}
                                                {itemStatus === 'cooking' && (
                                                    <button 
                                                        onClick={() => updateItemStatus(o._id, idx, 'served')} 
                                                        className="flex-1 py-2.5 px-2 bg-gray-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-md"
                                                    >
                                                        ✓ Xong
                                                    </button>
                                                )}
                                                {itemStatus === 'served' && (
                                                    <div className="flex-1 py-2.5 px-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold text-center shadow-sm border-2 border-gray-300">✓ Xong Rồi</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Note Section */}
                            {o.note && (
                                <div className="p-4 bg-gray-100 border-t-2 border-gray-300 flex gap-3">
                                    <AlertCircle size={18} className="text-gray-600 flex-shrink-0 mt-0.5 font-bold" />
                                    <p className="text-sm font-bold text-gray-700">{o.note}</p>
                                </div>
                            )}

                            {/* Footer Action */}
                            {allServed && (
                                <button 
                                    onClick={() => hideOrder(o._id)} 
                                    className="w-full py-3 px-4 bg-gray-400 hover:bg-gray-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Check size={18} /> Ẩn Đơn Hàng
                                </button>
                            )}
                        </div>
                    );
                })}
                
                {activeOrders.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-24">
                        <div className="text-7xl mb-4 opacity-50">🎉</div>
                        <p className={`text-amber-700 font-bold text-lg`}>Bếp đang rảnh rỗi...</p>
                        <p className={`text-amber-700/60 text-sm mt-2`}>Chờ đơn hàng tiếp theo</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Component đặt món - ĐÃ SỬA LỖI ẢNH
const OrderEntry = ({ menu, categories, activeTable, onConfirmOrder, onClose, onLoadingChange, orders = [] }) => {
    const [cart, setCart] = useState([]);
    const [filterCat, setFilterCat] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [showCartMobile, setShowCartMobile] = useState(false);
    const [note, setNote] = useState('');
    const [itemNotes, setItemNotes] = useState({}); // {itemId: 'note text'}
    const [editingItemNote, setEditingItemNote] = useState(null); // itemId đang edit
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('order');
    
    // Tạo sessionId duy nhất cho bàn + user
    const sessionId = `table_${activeTable._id}`;

    useEffect(() => {
        fetchCart();
    }, [sessionId]);

    const fetchCart = async () => {
        try {
            const res = await fetch(`${API_URL}/api/cart/${sessionId}`);
            const data = await res.json();
            setCart(data.items || []);
        } catch (e) {
            console.error('Fetch cart error:', e);
        }
    };

    const addToCart = async (item) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/cart/${sessionId}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: { _id: item._id, name: item.name, price: item.price, quantity: 1 } })
            });
            const data = await res.json();
            if (data.success) {
                setCart(data.data.items || []);
                showNotification.success('✅ Thêm vào giỏ thành công');
            }
        } catch (e) {
            console.error('Add to cart error:', e);
            showNotification.error('❌ Lỗi khi thêm vào giỏ');
        } finally {
            setLoading(false);
        }
    };

    const updateCartItem = async (itemId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/cart/${sessionId}/update/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity })
            });
            const data = await res.json();
            if (data.success) {
                setCart(data.data.items || []);
            }
        } catch (e) {
            console.error('Update cart error:', e);
            showNotification.error('❌ Lỗi khi cập nhật giỏ');
        } finally {
            setLoading(false);
        }
    };

    const removeFromCart = async (itemId) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/cart/${sessionId}/remove/${itemId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setCart(data.data.items || []);
                showNotification.success('✅ Xóa thành công');
            }
        } catch (e) {
            console.error('Remove from cart error:', e);
            showNotification.error('❌ Lỗi khi xóa khỏi giỏ');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmOrder = async (cartItems, noteText) => {
        setLoading(true);
        if (onLoadingChange) onLoadingChange(true);
        
        // Thêm item notes vào từng item
        const itemsWithNotes = cartItems.map(item => ({
            ...item,
            note: itemNotes[item._id] || ''
        }));
        
        try {
            // Xóa giỏ hàng từ server
            await fetch(`${API_URL}/api/cart/${sessionId}/clear`, { method: 'DELETE' });
            setCart([]);
            setItemNotes({});
        } catch (e) {
            console.error('Clear cart error:', e);
        }
        
        try {
            await onConfirmOrder(itemsWithNotes, noteText);
        } finally {
            setLoading(false);
            if (onLoadingChange) onLoadingChange(false);
        }
    };

    const filteredMenu = menu
        .filter(m => (filterCat === 'All' || m.categoryName === filterCat) && m.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    const totalItems = cart.reduce((a,b)=>a+b.quantity,0);

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className={`bg-[#f0f0ec] w-full md:w-full md:max-w-6xl h-full md:h-[95vh] md:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-200 relative`}>
                
                {/* Desktop Header with Tabs */}
                <div className="hidden md:flex flex-col bg-[#55352a] text-white z-20 w-full">
                    {/* Top Row: Title + Close */}
                    <div className="flex justify-between items-center p-5 pb-3">
                        <div>
                            <h3 className="text-3xl font-bold text-white">{activeTab === 'order' ? 'Chọn Món Ăn' : 'Lịch Sử Đơn Hàng'}</h3>
                            <p className="text-gray-400 text-sm mt-1">{activeTable.name}</p>
                        </div>
                        <button onClick={onClose} className="p-3 bg-[#e8ded2] hover:bg-gray-100 rounded-full transition text-gray-600"><X size={28}/></button>
                    </div>
                    {/* Tabs Row */}
                    <div className="flex gap-1 px-8 pb-0 border-t border-white/20">
                        <button 
                            onClick={() => setActiveTab('order')}
                            className={`px-6 py-3 font-semibold transition text-sm border-b-2 ${activeTab === 'order' ? 'text-white border-white' : 'text-white/60 border-transparent hover:text-white'}`}
                        >
                            🍽️ Gọi Món
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-3 font-semibold transition text-sm border-b-2 ${activeTab === 'history' ? 'text-white border-white' : 'text-white/60 border-transparent hover:text-white'}`}
                        >
                            📋 Lịch Sử
                        </button>
                    </div>
                </div>

                {/* Mobile Header with Tabs */}
                <div className="md:hidden flex flex-col bg-[#55352a] text-white z-20">
                    <div className="flex justify-between items-center p-4 border-b border-white/20">
                        <h3 className="font-bold text-lg">{activeTable.name}</h3>
                        <button onClick={onClose} className="p-2 hover:bg-[#f0f0ec]/20 rounded-full transition"><X size={24}/></button>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-0 px-4">
                        <button 
                            onClick={() => setActiveTab('order')}
                            className={`flex-1 py-3 px-2 text-sm font-bold border-b-2 transition ${activeTab === 'order' ? 'border-white text-white' : 'border-transparent text-white/60'}`}
                        >
                            Gọi Món
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-3 px-2 text-sm font-bold border-b-2 transition ${activeTab === 'history' ? 'border-white text-white' : 'border-transparent text-white/60'}`}
                        >
                            Lịch Sử
                        </button>
                    </div>
                </div>

                {/* Content Wrapper - Menu/History + Cart Layout */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* Menu Section - Hidden when viewing history on mobile */}
                {activeTab === 'order' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Desktop Category & Search */}
                    <div className="hidden md:block px-8 pt-4 pb-3 border-b-2 border-r-2 border-[#55352a] bg-[#e8ded2]">
                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar scroll-smooth mb-4" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: '-ms-autohiding-scrollbar' }}>
                            <button 
                                onClick={()=>setFilterCat('All')} 
                                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition shrink-0 ${
                                    filterCat==='All' 
                                        ? `bg-[#55352a] text-white shadow-md` 
                                        : `bg-[#f0f0ec] text-gray-700 border border-[#55352a] hover:border-gray-300`
                                }`}
                            >
                                Tất cả
                            </button>
                            {sortedCategories.map(c => (
                                <button 
                                    key={c._id} 
                                    onClick={()=>setFilterCat(c.name)} 
                                    className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition shrink-0 ${
                                        filterCat===c.name 
                                            ? `bg-[#55352a] text-white shadow-md` 
                                            : `bg-[#f0f0ec] text-gray-700 border border-[#55352a] hover:border-gray-300`
                                    }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 text-amber-700/50 w-5 h-5"/>
                            <input 
                                className="w-full pl-12 p-3 rounded-xl bg-[#f0f0ec] border-2 border-[#55352a] text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none transition" 
                                placeholder="Tìm kiếm món ăn..." 
                                value={searchTerm} 
                                onChange={e=>setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Category & Search */}
                    <div className="md:hidden px-4 pt-4 pb-3 border-b-2 border-[#55352a] bg-[#e8ded2]">
                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar scroll-smooth mb-4" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: '-ms-autohiding-scrollbar' }}>
                            <button 

                                onClick={()=>setFilterCat('All')} 
                                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition shrink-0 ${
                                    filterCat==='All' 
                                        ? `bg-[#55352a] text-white shadow-md` 
                                        : `bg-[#f0f0ec] text-gray-700 border border-[#55352a] hover:border-gray-300`
                                }`}
                            >
                                Tất cả
                            </button>
                            {sortedCategories.map(c => (
                                <button 
                                    key={c._id} 
                                    onClick={()=>setFilterCat(c.name)} 
                                    className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition shrink-0 ${
                                        filterCat===c.name 
                                            ? `bg-[#55352a] text-white shadow-md` 
                                            : `bg-[#f0f0ec] text-gray-700 border border-[#55352a] hover:border-gray-300`
                                    }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 text-amber-700/50 w-5 h-5"/>
                            <input 
                                className="w-full pl-12 p-3 rounded-xl bg-[#f0f0ec] border-2 border-[#55352a] text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none transition" 
                                placeholder="Tìm kiếm món ăn..." 
                                value={searchTerm} 
                                onChange={e=>setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Menu Items Grid */}
                    <div className="flex-1 border-r-2 border-[#55352a] overflow-y-auto p-4 md:p-5 pb-24 md:pb-8 custom-scrollbar bg-[#e8ded2]">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                            {filteredMenu.map(i => (
                                    <button
                                    key={i._id}
                                    onClick={()=>addToCart(i)}
                                    disabled={loading}
                                    className={`group relative overflow-hidden rounded-2xl transition-all border-2 border-[#55352a] duration-300 transform hover:scale-105 active:scale-95 text-left flex flex-col h-full shadow-md hover:shadow-lg border-2 border-[#55352a] hover:border-[#1d40c9] disabled:opacity-50`}
                                >
                                    {/* Image Container */}
                                    <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
                                        {i.image ? (
                                            <img 
                                                src={normalizeImageUrl(i.image)} 
                                                alt={i.name} 
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                onError={handleImageError}
                                                loading="lazy"
                                            />) 
                                            : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
                                                <ImageIcon className="text-amber-400 w-12 h-12"/>
                                            </div>
                                        )}
                                        {/* Add Button Overlay */}
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-end p-3">
                                            <div className="bg-[#55352a] text-white rounded-full p-2.5 shadow-lg">
                                                <Plus size={20} strokeWidth={3}/>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 p-3 md:p-4 bg-[#f0f0ec] flex flex-col justify-between">
                                        <div className="font-bold text-gray-900 text-sm md:text-base leading-tight">{i.name}</div>
                                        <div className={`text-[#55352a] font-bold text-sm md:text-base mt-2 pt-2 border-t border-[#55352a]`}>{formatCurrency(i.price)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {filteredMenu.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="text-3xl mb-3">🍽️</div>
                                <p className={`text-gray-600 font-semibold`}>Không tìm thấy món nào</p>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* History Section */}
                {activeTab === 'history' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#e8ded2]">
                    {/* History Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-5 pb-24 md:pb-8 custom-scrollbar">
                        {(() => {
                            const tableOrders = orders.filter(o => o.tableId === activeTable._id);
                            const totalRevenue = tableOrders.reduce((sum, order) => 
                                sum + (order.items?.reduce((s, item) => s + (item.price * item.quantity), 0) || 0), 0
                            );

                            return (
                                <div className="space-y-4">
                                    {/* Orders List */}
                                    {tableOrders.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <FileText size={48} className="text-[#55352a] mb-3 opacity-30"/>
                                            <p className="text-gray-600 font-semibold">Bàn chưa có đơn hàng nào</p>
                                        </div>
                                    ) : (
                                        tableOrders.map((order, idx) => {
                                            const orderTotal = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
                                            return (
                                                <div key={order._id} className="bg-white border-2 border-[#55352a] rounded-lg overflow-hidden hover:shadow-md transition">
                                                    {/* Order Header */}
                                                    <div className="bg-[#f0f0ec] p-4 border-b border-[#55352a] flex justify-between items-start">
                                                        <div>
                                                            <p className="text-xs text-gray-500 font-bold mb-1">Đơn #{idx + 1}</p>
                                                            <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</p>
                                                        </div>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                            order.status === 'paid' 
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {order.status === 'paid' ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
                                                        </span>
                                                    </div>

                                                    {/* Items */}
                                                    <div className="p-4 space-y-2">
                                                        {order.items?.map((item, i) => (
                                                            <div key={i} className="flex justify-between text-sm">
                                                                <div>
                                                                    <span className="font-semibold text-gray-900">{item.quantity}x {item.name}</span>
                                                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                                        <span className={`px-2 py-0.5 rounded text-white font-bold ${
                                                                            item.status === 'served' ? 'bg-green-500' :
                                                                            item.status === 'cooking' ? 'bg-orange-500' :
                                                                            'bg-gray-500'
                                                                        }`}>
                                                                            {item.status === 'served' ? '✓ Phục vụ' : item.status === 'cooking' ? '🍳 Nấu' : '📝 Đã nhận'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className="font-semibold text-[#55352a]">{formatCurrency(item.price * item.quantity)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Total */}
                                                    <div className="bg-gray-50 p-4 border-t border-[#55352a] flex justify-between items-center">
                                                        <span className="font-bold text-gray-900">TỔNG CỘNG</span>
                                                        <span className="text-lg font-bold text-[#55352a]">{formatCurrency(orderTotal)}</span>
                                                    </div>

                                                    {/* Note if any */}
                                                    {order.note && (
                                                        <div className="bg-blue-50 p-4 border-t border-blue-200">
                                                            <p className="text-xs text-blue-600 font-semibold mb-1">Ghi chú</p>
                                                            <p className="text-sm text-blue-900">{order.note}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
                )}

                {/* Cart Sidebar - INSIDE Content Wrapper */}
                <div className={`fixed md:static inset-0 bg-black/50 z-40 md:z-auto md:bg-transparent md:w-96 md:border-l-2 md:border-[#55352a] transition-all duration-300 ${showCartMobile ? 'opacity-100 visible' : 'opacity-0 invisible md:opacity-100 md:visible'}`}>
                    <div className={`absolute md:static bottom-0 left-0 w-full md:w-full bg-[#e8ded2] h-[80vh] md:h-full rounded-t-3xl md:rounded-none p-6 md:p-5 flex flex-col shadow-2xl md:shadow-none transform transition-transform duration-300 ${showCartMobile ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
                        
                        {/* Close bar mobile */}
                        <div className="flex justify-between items-center md:hidden mb-4">
                            <div className="w-12 h-1 rounded-full"></div>
                            <button 
                                onClick={() => setShowCartMobile(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition text-gray-600"
                            >
                                <X size={24}/>
                            </button>
                        </div>

                        {/* Cart Header */}
                        <div className="mb-4 flex items-center justify-between pb-3 border-b-2 border-[#55352a] ">
                            <h3 className={`font-bold text-xl text-gray-900`}>Giỏ Hàng</h3>
                            <span className={`bg-[#55352a] text-white px-3 py-1 rounded-full text-sm font-bold`}>{totalItems} món</span>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar mb-4">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-center">
                                    <ShoppingCart size={40} className="text-[#55352a] mb-2"/>
                                    <p className={`text-gray-600 text-sm`}>Chưa chọn món nào</p>
                                </div>
                            ) : (
                                cart.map((i,idx)=>(
                                    <div key={i._id} className="space-y-2">
                                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-[#55352a] hover:shadow-md transition">
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-gray-900 truncate text-sm`}>{i.name}</div>
                                                <div className={`text-gray-600 text-xs`}>{formatCurrency(i.price)}</div>
                                                {itemNotes[i._id] && (
                                                    <div className="text-xs text-blue-600 font-semibold mt-1 truncate">📝 {itemNotes[i._id]}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditingItemNote(editingItemNote === i._id ? null : i._id)}
                                                    className="p-2 hover:bg-blue-100 rounded-lg transition text-blue-600 text-sm font-bold"
                                                    title="Ghi chú"
                                                >
                                                    📝Ghi chú
                                                </button>
                                                <div className="flex items-center gap-2 bg-[#f0f0ec] rounded-lg p-1.5 border border-[#55352a]">
                                                    <button 
                                                        onClick={()=>updateCartItem(i._id, i.quantity - 1)}
                                                        disabled={loading}
                                                        className={`w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition hover:bg-gray-100 text-gray-700 disabled:opacity-50`}
                                                    >
                                                        −
                                                    </button>
                                                    <span className="font-bold w-5 text-center text-gray-900">{i.quantity}</span>
                                                    <button 
                                                        onClick={()=>updateCartItem(i._id, i.quantity + 1)}
                                                        disabled={loading}
                                                        className="w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition hover:bg-gray-100 text-gray-700 disabled:opacity-50"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Item Note Input */}
                                        {editingItemNote === i._id && (
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nhập ghi chú cho món này (vd: không cay, ít muối...)"
                                                    value={itemNotes[i._id] || ''}
                                                    onChange={(e) => setItemNotes({...itemNotes, [i._id]: e.target.value})}
                                                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-400 outline-none"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setEditingItemNote(null)}
                                                        className="flex-1 px-2 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 transition"
                                                    >
                                                        Đóng
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!itemNotes[i._id]) {
                                                                setItemNotes({...itemNotes, [i._id]: undefined});
                                                            }
                                                            setEditingItemNote(null);
                                                        }}
                                                        className="flex-1 px-2 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition"
                                                    >
                                                        Lưu
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Note */}
                        <div className="mb-4 pb-4 border-b-2 border-[#55352a]">
                            <label className={`text-xs font-bold text-gray-900 uppercase mb-2 block`}>Ghi chú cho bếp</label>
                            <textarea 
                                className={`w-full p-3 bg-[#f0f0ec] border-2 border-[#55352a] rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#55352a]/20 focus:border-[#55352a] outline-none resize-none transition`}
                                rows="2" 
                                placeholder="Vd: Ít cay, không hành..." 
                                value={note} 
                                onChange={(e) => setNote(e.target.value)}
                            ></textarea>
                        </div>

                        {/* Total & Submit */}
                        <div>
                            <div className="flex justify-between font-bold text-lg mb-4 pb-4 border-b-2 border-[#55352a]">
                                <span className={`text-gray-900`}>Tổng cộng</span>
                                <span className="text-[#55352a]">{formatCurrency(cart.reduce((a,b)=>a+b.price*b.quantity,0))}</span>
                            </div>
                            <button 
                                onClick={()=>handleConfirmOrder(cart, note)} 
                                disabled={!cart.length || loading} 
                                className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-[#55352a] hover:bg-[#a55a42]`}
                            >
                                <CheckCircle size={20}/> {loading ? 'ĐANG XỬ LÝ...' : 'GỬI BẾP'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Close Content Wrapper */}
                </div>

                {/* Mobile Cart Trigger */}
                {!showCartMobile && totalItems > 0 && (
                    <div className="md:hidden fixed bottom-4 left-4 right-4 z-30">
                        <button 
                            onClick={()=>setShowCartMobile(true)} 
                            className={`w-full bg-[#55352a] text-white p-4 rounded-2xl shadow-xl flex justify-between items-center animate-in slide-in-from-bottom duration-300 font-bold hover:bg-[#a55a42]`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-[#f0f0ec] text-rose-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{totalItems}</div>
                                <span>Xem giỏ hàng</span>
                            </div>
                            <span className="text-white/80">{formatCurrency(cart.reduce((a,b)=>a+b.price*b.quantity,0))}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Component điểm danh hôm nay - MINIMALIST DESIGN
const AttendanceView = ({ staff }) => {
    const [todayAttendance, setTodayAttendance] = useState([]);
    const [checkedInStaff, setCheckedInStaff] = useState(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTodayAttendance();
        const interval = setInterval(fetchTodayAttendance, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchTodayAttendance = async () => {
        try {
            const res = await fetch(`${API_URL}/api/attendance/today`);
            const data = await res.json();
            setTodayAttendance(data);
            setCheckedInStaff(new Set(data.map(a => a.staffId._id || a.staffId)));
        } catch(e) {
            console.error('Fetch attendance error:', e);
        }
    };

    const handleCheckIn = async (staffId) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/attendance/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId })
            });
            const data = await res.json();
            if (data.success) {
                showNotification.success('✅ Điểm danh thành công');
                fetchTodayAttendance();
            } else {
                showNotification.error('❌ ' + (data.message || 'Lỗi điểm danh'));
            }
        } catch(e) {
            showNotification.error('❌ ' + (e.message || 'Lỗi kết nối'));
        }
        setLoading(false);
    };

    const handleCheckOut = async (staffId) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/attendance/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId })
            });
            const data = await res.json();
            if (data.success) {
                showNotification.success('✅ Kết thúc ca làm việc');
                fetchTodayAttendance();
            } else {
                showNotification.error('❌ ' + (data.message || 'Lỗi'));
            }
        } catch(e) {
            showNotification.error('❌ ' + (e.message || 'Lỗi kết nối'));
        }
        setLoading(false);
    };

    const presentCount = todayAttendance.filter(a => a.checkInTime).length;

    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#e8ded2] custom-scrollbar">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-4xl font-bold text-[#55352a]">Điểm Danh Nhân Viên</h2>
                <p className="text-gray-500 text-base mt-1">Hôm nay: <span className="font-bold text-gray-700">{new Date().toLocaleDateString('vi-VN')}</span></p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-[#f0f0ec] border border-[#55352a] p-6 rounded-lg">
                    <p className="text-gray-500 text-sm font-bold uppercase mb-2">Nhân Viên Hôm Nay</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-4xl font-bold text-gray-900">{staff.length}</h3>
                        <p className="text-gray-400 text-sm mb-1">người</p>
                    </div>
                </div>
                
                <div className="bg-[#f0f0ec] border border-[#55352a] p-6 rounded-lg">
                    <p className="text-[#55352a] text-sm font-bold uppercase mb-2">✓ Đã Điểm Danh</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-4xl font-bold text-[#55352a]">{presentCount}</h3>
                        <p className="text-[#55352a]/60 text-sm mb-1">({staff.length > 0 ? Math.round(presentCount/staff.length*100) : 0}%)</p>
                    </div>
                </div>
            </div>

            {staff.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-gray-400 text-lg font-medium mb-2">Không có nhân viên trong hệ thống</p>
                    <p className="text-gray-500 text-sm">Vui lòng thêm nhân viên trong Quản Lý → Nhân Viên</p>
                </div>
            ) : (
                <>
                {/* Staff List */}
                <div className="space-y-3">
                    {staff.map(s => {
                        const attendance = todayAttendance.find(a => (a.staffId._id || a.staffId) === s._id);
                        const isCheckedIn = !!attendance?.checkInTime;
                        const isCheckedOut = !!attendance?.checkOutTime;
                        
                        return (
                            <div key={s._id} className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg flex items-center justify-between hover:shadow-md transition group">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-900 text-lg">{s.name}</h3>
                                    <p className="text-gray-500 text-sm">{s.username} • {s.role === 'admin' ? '👤 Quản lý' : '👥 Nhân viên'}</p>
                                    {isCheckedIn && (
                                        <div className="mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded inline-block">
                                            ✓ {new Date(attendance.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            {isCheckedOut && ` • Kết thúc: ${new Date(attendance.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="ml-4 shrink-0">
                                    {!isCheckedIn ? (
                                        <button 
                                            onClick={() => handleCheckIn(s._id)}
                                            disabled={loading}
                                            className="px-5 py-2.5 bg-[#55352a] text-white rounded-lg font-bold hover:bg-[#a55a42] active:scale-95 transition disabled:opacity-50 text-sm"
                                        >
                                            Điểm Danh
                                        </button>
                                    ) : !isCheckedOut ? (
                                        <button 
                                            onClick={() => handleCheckOut(s._id)}
                                            disabled={loading}
                                            className="px-5 py-2.5 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 active:scale-95 transition disabled:opacity-50 text-sm"
                                        >
                                            Kết Thúc Ca
                                        </button>
                                    ) : (
                                        <div className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-center text-sm">
                                            ✓ Hoàn Tất
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </div>
    );
};

// Component lịch sử điểm danh theo tháng - MINIMALIST DESIGN
const AttendanceHistoryView = ({ staff }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [monthlyAttendance, setMonthlyAttendance] = useState([]);
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchMonthlyData();
    }, [selectedMonth]);

    const fetchMonthlyData = async () => {
        setLoading(true);
        try {
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth() + 1;
            
            const [attendRes, statsRes] = await Promise.all([
                fetch(`${API_URL}/api/attendance/month?year=${year}&month=${month}`),
                fetch(`${API_URL}/api/attendance/stats/monthly?year=${year}&month=${month}`)
            ]);
            
            const attendData = await attendRes.json();
            const statsData = await statsRes.json();
            
            setMonthlyAttendance(attendData);
            setMonthlyStats(statsData.stats || []);
        } catch(e) {
            console.error('Fetch monthly attendance error:', e);
            showNotification.error('❌ Lỗi tải dữ liệu');
        }
        setLoading(false);
    };

    const changeMonth = (offset) => {
        const newDate = new Date(selectedMonth);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedMonth(newDate);
    };

    const monthStr = selectedMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#f0f0ec] custom-scrollbar">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h2 className="text-4xl font-bold text-gray-900">Lịch Sử Điểm Danh</h2>
                    <p className="text-gray-500 text-base mt-1">Xem chi tiết theo tháng</p>
                </div>
                
                {/* Month Navigation */}
                <div className="flex items-center gap-2 bg-[#f0f0ec] border border-[#55352a] rounded-lg p-1">
                    <button 
                        onClick={() => changeMonth(-1)} 
                        className="p-2 hover:bg-gray-100 rounded transition"
                    >
                        <ChevronLeft size={20} className="text-gray-600"/>
                    </button>
                    <span className="font-bold text-gray-900 min-w-[140px] text-center text-sm">{monthStr}</span>
                    <button 
                        onClick={() => changeMonth(1)} 
                        className="p-2 hover:bg-gray-100 rounded transition"
                    >
                        <ChevronRight size={20} className="text-gray-600"/>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-2">Tổng NV</p>
                    <h3 className="text-3xl font-bold text-gray-900">{monthlyStats.length}</h3>
                </div>
                
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-[#55352a] text-xs font-bold uppercase mb-2">✓ Có Mặt</p>
                    <h3 className="text-3xl font-bold text-[#55352a]">
                        {monthlyStats.length > 0 
                            ? monthlyStats.reduce((sum, s) => sum + parseInt(s.present), 0)
                            : 0}
                    </h3>
                </div>
                
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-gray-600 text-xs font-bold uppercase mb-2">⏱ Giờ Làm</p>
                    <h3 className="text-3xl font-bold text-gray-700">
                        {monthlyStats.length > 0 
                            ? Math.round(monthlyStats.reduce((sum, s) => sum + parseFloat(s.totalHours), 0))
                            : 0}h
                    </h3>
                </div>
            </div>

            {/* Summary Table */}
            <div className="bg-[#f0f0ec] border border-[#55352a] rounded-lg overflow-hidden mb-8">
                <div className="bg-gray-50 border-b border-[#55352a] p-4">
                    <h3 className="font-bold text-gray-900">Tổng Hợp Nhân Viên</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-[#55352a]">
                                <th className="px-4 py-3 text-left font-bold text-gray-700">Nhân Viên</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Có Mặt</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-700">Giờ Làm</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-700">Tỉ Lệ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {monthlyStats.length > 0 ? (
                                monthlyStats.map((stat, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 font-bold text-gray-900">{stat.name}</td>
                                        <td className="px-4 py-3 text-center font-bold text-[#55352a]">{stat.present}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-700">{stat.totalHours}h</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{stat.attendanceRate}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Table */}
            <div className="bg-[#f0f0ec] border border-[#55352a] rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-[#55352a] p-4">
                    <h3 className="font-bold text-gray-900">Chi Tiết - {monthStr}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-[#55352a]">
                                <th className="px-4 py-3 text-left font-bold text-gray-700">Nhân Viên</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-700">Ngày</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Giờ Vào</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Giờ Ra</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Giờ Làm</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Trạng Thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {monthlyAttendance.length > 0 ? (
                                monthlyAttendance.map((att, idx) => {
                                    const hoursWorked = att.checkInTime && att.checkOutTime 
                                        ? ((new Date(att.checkOutTime) - new Date(att.checkInTime)) / (1000 * 60 * 60)).toFixed(1)
                                        : '-';
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 font-bold text-gray-900">{att.staffName}</td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">{new Date(att.date).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-4 py-3 text-center text-gray-600 text-sm">
                                                {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-600 text-sm">
                                                {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-900">{hoursWorked}h</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                                                    att.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                    att.status === 'late' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {att.status === 'present' ? '✓ Có mặt' :
                                                     att.status === 'late' ? '⚠ Muộn' : '✗ Vắng'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-gray-400">Không có dữ liệu điểm danh cho tháng này</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Component thống kê điểm danh theo ngày - MINIMALIST DESIGN
const AttendanceDailyView = ({ staff }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyAttendance, setDailyAttendance] = useState([]);
    const [dailyStats, setDailyStats] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDailyData();
    }, [selectedDate]);

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/attendance/month?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const allAttendance = await res.json();
            
            const filtered = allAttendance.filter(att => {
                const attDate = new Date(att.date).toISOString().split('T')[0];
                return attDate === selectedDate;
            });
            
            setDailyAttendance(filtered);
            
            const stats = {
                total: filtered.length,
                present: filtered.filter(a => a.status === 'present').length,
                late: filtered.filter(a => a.status === 'late').length,
                absent: filtered.filter(a => a.status === 'absent').length,
                totalHours: filtered.reduce((sum, a) => {
                    if (a.checkInTime && a.checkOutTime) {
                        return sum + ((new Date(a.checkOutTime) - new Date(a.checkInTime)) / (1000 * 60 * 60));
                    }
                    return sum;
                }, 0)
            };
            
            setDailyStats(stats);
        } catch(e) {
            console.error('Fetch daily attendance error:', e);
            showNotification.error('❌ Lỗi tải dữ liệu - ' + e.message);
            setDailyAttendance([]);
            setDailyStats({});
        }
        setLoading(false);
    };

    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dateStr = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#f0f0ec] custom-scrollbar">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-bold text-gray-900">Thống Kê Ngày</h2>
                    <p className="text-gray-500 text-base mt-1">Xem chi tiết điểm danh theo ngày</p>
                </div>
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2.5 rounded-lg border border-[#55352a] focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none font-medium text-gray-900 bg-[#f0f0ec]"
                />
            </div>

            {/* Selected Date */}
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-[#55352a]">
                <p className="text-sm text-gray-500 font-bold uppercase mb-1">Ngày được chọn</p>
                <p className="text-lg font-bold text-gray-900">{dateStr}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-2">Tổng NV</p>
                    <h3 className="text-3xl font-bold text-gray-900">{dailyStats.total || 0}</h3>
                </div>
                
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-[#55352a] text-xs font-bold uppercase mb-2">✓ Có Mặt</p>
                    <h3 className="text-3xl font-bold text-[#55352a]">{dailyStats.present || 0}</h3>
                </div>
                
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-gray-600 text-xs font-bold uppercase mb-2">⏱ Giờ Làm</p>
                    <h3 className="text-3xl font-bold text-gray-700">{Math.round(dailyStats.totalHours || 0)}h</h3>
                </div>
                
                <div className="bg-[#f0f0ec] border border-[#55352a] p-4 rounded-lg">
                    <p className="text-gray-600 text-xs font-bold uppercase mb-2">TB/NV</p>
                    <h3 className="text-3xl font-bold text-gray-700">{dailyStats.total > 0 ? (dailyStats.totalHours / dailyStats.total).toFixed(1) : 0}h</h3>
                </div>
            </div>

            {/* Details Table */}
            <div className="bg-[#f0f0ec] border border-[#55352a] rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-[#55352a] p-4">
                    <h3 className="font-bold text-gray-900">Chi Tiết Nhân Viên - {dateStr}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-[#55352a]">
                                <th className="px-4 py-3 text-left font-bold text-gray-700">Nhân Viên</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Giờ Vào</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Giờ Ra</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700">Giờ Làm</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {dailyAttendance.length > 0 ? (
                                dailyAttendance.map((att, idx) => {
                                    const hoursWorked = att.checkInTime && att.checkOutTime 
                                        ? ((new Date(att.checkOutTime) - new Date(att.checkInTime)) / (1000 * 60 * 60)).toFixed(1)
                                        : '-';
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 font-bold text-gray-900">{att.staffName}</td>
                                            <td className="px-4 py-3 text-center text-gray-600 text-sm">
                                                {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-600 text-sm">
                                                {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-900">{hoursWorked}h</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-gray-400">Không có dữ liệu điểm danh cho ngày này</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Component wrapper cho điểm danh - MINIMALIST TABS
const AttendanceViewWrapper = ({ staff }) => {
    const [attendanceTab, setAttendanceTab] = useState('today');

    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex gap-1 p-4 md:p-5 border-b border-[#55352a] bg-[#e8ded2] flex-wrap">
                <button 
                    onClick={() => setAttendanceTab('today')}
                    className={`px-6 py-2.5 rounded-lg font-bold transition-all ${
                        attendanceTab === 'today' 
                            ? 'bg-[#55352a] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Hôm Nay
                </button>
                <button 
                    onClick={() => setAttendanceTab('daily')}
                    className={`px-6 py-2.5 rounded-lg font-bold transition-all ${
                        attendanceTab === 'daily' 
                            ? 'bg-[#55352a] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Thống Kê Ngày
                </button>
                <button 
                    onClick={() => setAttendanceTab('history')}
                    className={`px-6 py-2.5 rounded-lg font-bold transition-all ${
                        attendanceTab === 'history' 
                            ? 'bg-[#55352a] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Lịch Sử Tháng
                </button>
            </div>
            <div className="flex-1 overflow-hidden">
                {attendanceTab === 'today' && <AttendanceView staff={staff}/>}
                {attendanceTab === 'daily' && <AttendanceDailyView staff={staff}/>}
                {attendanceTab === 'history' && <AttendanceHistoryView staff={staff}/>}
            </div>
        </div>
    );
};

// Component chính
const RestaurantApp = () => {
    const [user, setUser] = useState(() => {
        try {
            // Dùng sessionStorage thay vì localStorage (tự clear khi đóng tab)
            const savedUser = sessionStorage.getItem('pos_user');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) {
            console.warn('Không thể restore user:', e);
            return null;
        }
    });
    const [page, setPage] = useState(() => {
        try {
            const savedUser = sessionStorage.getItem('pos_user');
            if (savedUser) {
                const userData = JSON.parse(savedUser);
                return userData.role === 'admin' ? 'dashboard' : 'map';
            }
        } catch (e) {}
        return 'dashboard';
    });
    const [sessionConflict, setSessionConflict] = useState(false);
    
    const [tables, setTables] = useState([]);
    const [menu, setMenu] = useState([]);
    const [categories, setCategories] = useState([]);
    const [orders, setOrders] = useState([]);
    const [staff, setStaff] = useState([]);
    const [settings, setSettings] = useState({});
    const [reports, setReports] = useState([]);
    
    const [selectedTable, setSelectedTable] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false); 
    const [showDeleteItemsModal, setShowDeleteItemsModal] = useState(false); 
    const [dateRange, setDateRange] = useState({ from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] });
    const [activeZone, setActiveZone] = useState('All');
    const [tableStatusFilter, setTableStatusFilter] = useState('all');

    const [confirmDialog, setConfirmDialog] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        type: 'confirm',
        maxQty: 1,
        onConfirm: () => {}, 
        onCancel: () => {} 
    });

    const showConfirmDialog = (title, message, onConfirm, onCancel = () => {}) => {
        setConfirmDialog({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        maxQty: 1,
        onConfirm: () => {
            onConfirm();
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
            onCancel();
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
        });
    };

    // Lưu user vào sessionStorage (tự clear khi đóng tab/trình duyệt)
    useEffect(() => {
        if (user) {
            sessionStorage.setItem('pos_user', JSON.stringify(user));
        } else {
            sessionStorage.removeItem('pos_user');
        }
    }, [user]);

    const handleLogout = () => {
        sessionStorage.removeItem('pos_user');
        setUser(null);
        setPage('dashboard');
        setSessionConflict(false);
        showNotification.success('✅ Đã đăng xuất');
    };

    useEffect(() => {
        if (!user) return;
        socket = io(API_URL);
        
        // Emit user login event
        socket.emit('user_login', {
            staffId: user.id,
            userAgent: navigator.userAgent
        });

        // Listen for session conflicts
        socket.on('session_conflict', (data) => {
            setSessionConflict(true);
            showNotification.error('⚠️ ' + data.message);
            setTimeout(() => {
                handleLogout();
            }, 2000);
        });

        socket.on('session_registered', (data) => {
            if (data.success) {
                console.log('✅ Session registered');
            }
        });

        socket.on('session_error', (data) => {
            showNotification.error('❌ ' + data.message);
        });

        const fetchData = async () => {
        try {
            const res = await fetch(`${API_URL}/api/init`);
            const data = await res.json();
            setTables(data.tables);
            setMenu(data.menu);
            setCategories(data.categories);
            setOrders(data.activeOrders);
            setSettings(data.settings);
        } catch (e) { showNotification.error("❌ Lỗi tải dữ liệu"); }
        };

        const fetchTables = async () => {
            try {
                const res = await fetch(`${API_URL}/api/init`);
                const data = await res.json();
                setTables(data.tables);
                setMenu(data.menu);
                setCategories(data.categories);
            } catch (e) { showNotification.error("❌ Lỗi tải bàn"); }
        };

        const fetchMenu = async () => {
            try {
                const res = await fetch(`${API_URL}/api/init`);
                const data = await res.json();
                setMenu(data.menu);
                setCategories(data.categories);
                setTables(data.tables);
            } catch (e) { showNotification.error("❌ Lỗi tải menu"); }
        };

        const fetchCategories = async () => {
            try {
                const res = await fetch(`${API_URL}/api/init`);
                const data = await res.json();
                setCategories(data.categories);
                setMenu(data.menu);
                setTables(data.tables);
            } catch (e) { showNotification.error("❌ Lỗi tải danh mục"); }
        };

        fetchData();

        socket.on('orders_updated', (newOrders) => {
            setOrders(prevOrders => {
                let shouldPlaySound = false;
                
                if (prevOrders.length < newOrders.length) {
                    shouldPlaySound = true;
                } else if (prevOrders.length === newOrders.length) {
                    for (let i = 0; i < newOrders.length; i++) {
                        const prevOrder = prevOrders[i];
                        const newOrder = newOrders[i];
                        if (prevOrder && newOrder) {
                            const prevItemCount = prevOrder.items?.length || 0;
                            const newItemCount = newOrder.items?.length || 0;
                            if (newItemCount > prevItemCount) {
                                shouldPlaySound = true;
                                break;
                            }
                        }
                    }
                }
                
                if (shouldPlaySound) {
                    if (page === 'dashboard' || page === 'map') {
                        try {
                            const audio = new Audio(NOTIFICATION_SOUND);
                            audio.volume = 0.8;
                            audio.play().catch(err => console.warn('Không thể phát âm thanh:', err));
                        } catch(e) {
                            console.warn('Lỗi tạo audio:', e);
                        }
                    }
                    // Gọi notification sau khi state update hoàn tất
                    setTimeout(() => showNotification.success('🍳 Có đơn hàng mới!'), 0);
                }
                return newOrders;
            });
        });

        socket.on('menu_updated', setMenu);
        socket.on('categories_updated', setCategories);
        socket.on('tables_updated', setTables);
        socket.on('settings_updated', setSettings);

        return () => socket.disconnect();
    }, [user, page]);

    const uniqueZones = useMemo(() => ['All', ...new Set(tables.map(t => t.zone || 'Khác'))].sort(), [tables]);
    const filteredTables = useMemo(() => {
        let result = activeZone === 'All' ? tables : tables.filter(t => (t.zone || 'Khác') === activeZone);
        if (tableStatusFilter === 'occupied') {
            result = result.filter(t => orders.some(o => o.tableId === t._id && o.status !== 'paid'));
        } else if (tableStatusFilter === 'empty') {
            result = result.filter(t => !orders.some(o => o.tableId === t._id && o.status !== 'paid'));
        }
        return result;
    }, [tables, activeZone, tableStatusFilter, orders]);

    const handleSave = async (endpoint, item, id) => {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/api/${endpoint}/${id}` : `${API_URL}/api/${endpoint}`;
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
            const data = await res.json();
            
            const isSuccess = res.ok && (data.success === true || data._id);
            
            if (!isSuccess) {
                showNotification.error('❌ ' + (data.message || data.error || 'Lỗi khi lưu'));
                return;
            }
            if (endpoint === 'staff') fetchStaff();
            else if (endpoint === 'menu') fetchMenu();
            else if (endpoint === 'tables') fetchTables();
            else if (endpoint === 'categories') fetchCategories();
            showNotification.success('✅ Dữ liệu đã được lưu');
        } catch(e) { 
            showNotification.error('❌ ' + (e.message || 'Lỗi khi lưu')); 
        }
    };

    const handleDelete = async (endpoint, id) => {
        try {
            const res = await fetch(`${API_URL}/api/${endpoint}/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) {
                showNotification.error('❌ ' + (data.message || data.error || 'Lỗi khi xóa'));
                return;
            }
            if (endpoint === 'staff') fetchStaff();
            else if (endpoint === 'menu') fetchMenu();
            else if (endpoint === 'tables') fetchTables();
            else if (endpoint === 'categories') fetchCategories();
            showNotification.success('✅ Dữ liệu đã được xóa');
        } catch(e) { 
            showNotification.error('❌ ' + (e.message || 'Lỗi khi xóa')); 
        }
    };

    const executeDeleteItem = async (orderId, itemToRemove, itemIndex, qtyToDelete) => {
        const currentOrder = orders.find(o => o._id === orderId);
        if (!currentOrder) {
            showNotification.error("❌ Đơn hàng không còn tồn tại hoặc đã bị hủy.");
            setOrders(prev => prev.filter(o => o._id !== orderId));
            return;
        }

        // Xóa chính xác bằng index, không dùng _id vì có thể nhiều item cùng loại
        let updatedItems = [...currentOrder.items];
        const targetItem = updatedItems[itemIndex];
        
        if (!targetItem) {
            showNotification.error("❌ Không tìm thấy món ăn trong đơn hàng. Vui lòng tải lại.");
            return; 
        }

        if (targetItem.quantity > qtyToDelete) {
            updatedItems[itemIndex] = { ...targetItem, quantity: targetItem.quantity - qtyToDelete };
        } else {
            updatedItems = updatedItems.filter((_, idx) => idx !== itemIndex);
        }

        try {
            if (updatedItems.length === 0) {
                setOrders(prev => prev.filter(o => o._id !== orderId));
                const res = await fetch(`${API_URL}/api/orders/${orderId}`, { method: 'DELETE' });
                
                if (!res.ok && res.status !== 404) {
                    showNotification.error("Lỗi đồng bộ server (Không xóa được đơn).");
                    socket.emit('request_refresh'); 
                } else {
                    showNotification.success("Đã hủy đơn hàng (Bàn trống).");
                    const remainingOrders = orders.filter(o => o.tableId === selectedTable?._id && o._id !== orderId);
                    if (remainingOrders.length === 0) {
                        setShowPaymentModal(false);
                        setSelectedTable(null);
                    }
                }
            } 
            else {
                setOrders(prev => prev.map(o => o._id === orderId ? { ...o, items: updatedItems } : o));
                const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: updatedItems, status: currentOrder.status })
                });
                const data = await res.json();

                if (res.ok && data.success) showNotification.success(`Đã trả ${qtyToDelete} x ${itemToRemove.name}`);
                else showNotification.error('❌ ' + (data.message || data.error || "Không thể cập nhật server"));
            }
        } catch (e) {
            console.error("Delete Error:", e);
            showNotification.error("Lỗi kết nối hệ thống.");
        }
    };

    const handleRequestDelete = (order, item, itemIdx) => {
        if (order.status === 'paid') {
            showNotification.error("Không thể sửa đơn đã thanh toán!");
            return;
        }
        // Check item status, không phải order status
        const isServed = item.status === 'served';
        
        if (item.quantity > 1) {
            setConfirmDialog({
                isOpen: true,
                type: 'input',
                title: 'Trả lại món',
                message: `Món "${item.name}" đang có SL: ${item.quantity}.`,
                maxQty: item.quantity,
                onConfirm: (qty) => {
                    executeDeleteItem(order._id, item, itemIdx, qty);
                    setConfirmDialog(p => ({ ...p, isOpen: false }));
                },
                onCancel: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
            });
        } else {
            setConfirmDialog({
                isOpen: true,
                type: 'confirm',
                title: isServed ? '⚠️ Cảnh báo trả món' : 'Xác nhận xóa',
                message: isServed 
                    ? `Món "${item.name}" ĐÃ PHỤC VỤ. Bạn có chắc khách muốn trả lại không?` 
                    : `Xóa món "${item.name}" khỏi hóa đơn?`,
                onConfirm: () => {
                    executeDeleteItem(order._id, item, itemIdx, 1);
                    setConfirmDialog(p => ({ ...p, isOpen: false }));
                },
                onCancel: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
            });
        }
    };

    const fetchStaff = async () => { 
        try {
        const res = await fetch(`${API_URL}/api/staff`);
        const data = await res.json();
        setStaff(data);
        } catch (e) {
        showNotification.error('❌ Lỗi tải danh sách nhân viên');
        }
    };

    const fetchTables = async () => {
        try {
            const res = await fetch(`${API_URL}/api/init`);
            const data = await res.json();
            setTables(data.tables);
            setMenu(data.menu);
            setCategories(data.categories);
        } catch (e) { showNotification.error("❌ Lỗi tải bàn"); }
    };

    const fetchMenu = async () => {
        try {
            const res = await fetch(`${API_URL}/api/init`);
            const data = await res.json();
            setMenu(data.menu);
            setCategories(data.categories);
            setTables(data.tables);
        } catch (e) { showNotification.error("❌ Lỗi tải menu"); }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/api/init`);
            const data = await res.json();
            setCategories(data.categories);
            setMenu(data.menu);
            setTables(data.tables);
        } catch (e) { showNotification.error("❌ Lỗi tải danh mục"); }
    };
    
    const fetchReports = async () => { 
        try {
            // Fetch dữ liệu lịch sử 90 ngày gần nhất
            const toDate = new Date().toISOString().split('T')[0];
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 90);
            const fromDateStr = fromDate.toISOString().split('T')[0];
            
            const res = await fetch(`${API_URL}/api/reports?from=${fromDateStr}&to=${toDate}`);
            const data = await res.json();
            setReports(data);
        } catch (e) {
            console.error('Fetch reports error:', e);
            showNotification.error('❌ Lỗi tải báo cáo');
        }
    };

    useEffect(() => { 
        if (page === 'manage-staff' || page === 'attendance') fetchStaff(); 
    }, [page]);
    
    useEffect(() => { 
        if (page === 'reports') fetchReports(); 
    }, [page, dateRange]);

    const handlePlaceOrder = async (cart, note) => {
        if (!selectedTable) return;
        try {
            const res = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    tableId: selectedTable._id, 
                    tableName: selectedTable.name, 
                    staffName: user.name, 
                    items: cart,
                    note: note 
                })
            });
            const data = await res.json();
            
            if (res.ok && data._id) {
                setShowOrderModal(false);
                setSelectedTable(null);
                showNotification.success('✅ Gửi bếp thành công!', { duration: 2000 });
                
                const audio = new Audio(NOTIFICATION_SOUND);
                audio.volume = 0.7;
                audio.play().catch(() => {});
            } else {
                showNotification.error('❌ ' + (data.message || data.error || 'Lỗi gửi đơn'));
            }
        } catch (e) { 
            console.error('Error:', e);
            showNotification.error('❌ Lỗi kết nối'); 
        }
    };

    const initiatePayment = (tableId) => {
        const table = tables.find(t => t._id === tableId);
        if (table) { setSelectedTable(table); setShowPaymentModal(true); }
    };

    const initiateDeleteItems = (tableId) => {
        const table = tables.find(t => t._id === tableId);
        if (table) { setSelectedTable(table); setShowDeleteItemsModal(true); }
    };

    const handlePaymentConfirm = async (paymentMethod) => {
        if (!selectedTable) return;
        const tableOrders = orders.filter(o => o.tableId === selectedTable._id && o.status !== 'paid');
        const orderIds = tableOrders.map(o => o._id);

        if (orderIds.length === 0) {
            showNotification.error("⚠️ Không có đơn hàng để thanh toán");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/pay`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ orderIds, paymentMethod })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                showNotification.error('❌ ' + (data.message || data.error || 'Thanh toán thất bại'));
                return;
            }
            setOrders(prevOrders => prevOrders.filter(o => !orderIds.includes(o._id)));
            setShowPaymentModal(false); 
            setSelectedTable(null);
            showNotification.success(`✅ Đã thanh toán bàn ${selectedTable.name}`);
        } catch (e) { 
            showNotification.error('❌ ' + (e.message || 'Thanh toán thất bại')); 
        }
    };

    const updateOrderStatus = async (orderId, itemIdx, status) => {
        const currentOrder = orders.find(o => o._id === orderId);
        if (!currentOrder) return;
        
        const updatedItems = [...currentOrder.items];
        updatedItems[itemIdx] = { ...updatedItems[itemIdx], status };
        
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, items: updatedItems } : o));
        
        try {
            const res = await fetch(`${API_URL}/api/orders/${orderId}/items/${itemIdx}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                showNotification.error('❌ Lỗi cập nhật trạng thái món');
            }
        } catch (e) {
            showNotification.error('❌ Lỗi kết nối server');
        }
    };

    if (!user) return (
        <>
            <Toaster position="top-right" reverseOrder={false} />
            <Login onLogin={u => { setUser(u); setPage(u.role === 'admin' ? 'dashboard' : 'map'); }} />
        </>
    );

    // Session conflict modal
    if (sessionConflict) return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-[#f0f0ec] w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                    <AlertTriangle size={32} className="text-red-600" />
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-[#55352a] mb-2">Phiên Đã Kết Thúc</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Tài khoản này đã được đăng nhập ở nơi khác. Phiên hiện tại sẽ bị đóng để bảo vệ tài khoản.
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full bg-[#55352a] text-white font-bold py-3 rounded-xl hover:bg-[#a55a42] transition active:scale-95"
                >
                    Quay Lại Đăng Nhập
                </button>
            </div>
        </div>
    );

    const NavItem = ({ id, icon: Icon, label, onClick }) => {
        const active = page === id;
        return (
            <button 
                onClick={onClick} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                    active 
                        ? 'bg-[#55352a] text-white' 
                        : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
                <Icon size={20} strokeWidth={2} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-[#55352a] font-sans text-gray-700 gap-4 md:p-4">
            <Toaster position="top-right" />
            <ConfirmDialog 
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
                maxQty={confirmDialog.maxQty}
                onConfirm={confirmDialog.onConfirm}
                onCancel={confirmDialog.onCancel}
            />
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 0px; background: transparent; }
                .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .paper-rip { mask-image: radial-gradient(circle at bottom, transparent 6px, black 6px); mask-size: 100% 100%; mask-position: bottom; mask-repeat: no-repeat; padding-bottom: 20px; }
            `}</style>
            
            <aside className="hidden md:flex w-64 bg-[#e8ded2] flex-col border-r border-[#55352a] z-20 rounded-[2.5rem] shadow-sm">
                {/* Logo */}
                <div className="h-20 flex items-center justify-center border-b border-[#55352a] px-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#55352a] p-2 rounded-lg"><Coffee className="text-white w-5 h-5" /></div>
                        <span className="font-bold text-lg text-gray-900">MrDuc POS</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                    {/* Kinh Doanh Section */}
                    <div className="text-xs font-bold text-gray-400 uppercase px-4 py-3 mb-2">Kinh Doanh</div>
                    <NavItem id="map" icon={Map} label="Sơ Đồ Bàn" onClick={() => setPage('map')} />
                    {user.role === 'admin' && <NavItem id="dashboard" icon={ChefHat} label="Bếp Trung Tâm" onClick={() => setPage('dashboard')} />}
                    {user.role === 'admin' && <NavItem id="reports" icon={BarChart3} label="Báo Cáo" onClick={() => setPage('reports')} />}
                    
                    {/* Quản Lý Section */}
                    {user.role === 'admin' && (
                        <>
                            <div className="text-xs font-bold text-gray-400 uppercase px-4 py-3 mt-4 mb-2">Quản Lý</div>
                            <NavItem id="manage-menu" icon={Coffee} label="Thực Đơn" onClick={() => setPage('manage-menu')} />
                            <NavItem id="manage-categories" icon={Filter} label="Danh Mục" onClick={() => setPage('manage-categories')} />
                            <NavItem id="manage-tables" icon={Users} label="Bàn Ghế" onClick={() => setPage('manage-tables')} />
                            <NavItem id="manage-staff" icon={Lock} label="Nhân Sự" onClick={() => setPage('manage-staff')} />
                            <NavItem id="attendance" icon={CheckCircle} label="Điểm Danh" onClick={() => setPage('attendance')} />
                            <NavItem id="settings" icon={Settings} label="Cài Đặt" onClick={() => setPage('settings')} />
                        </>
                    )}
                </nav>

                {/* User Profile */}
                <div className="border-t border-[#55352a] p-4 space-y-3">
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <div className="w-10 h-10 rounded-lg bg-[#55352a] flex items-center justify-center font-bold text-white text-sm">{user.name.charAt(0)}</div>
                        <div className="flex-1 overflow-hidden">
                            <div className="font-semibold text-sm text-gray-900 truncate">{user.name}</div>
                            <div className="text-xs text-gray-500 uppercase">{user.role}</div>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 py-2.5 transition text-sm font-medium rounded-lg"
                    >
                        <LogOut size={18}/> Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#f0f0ec] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 px-6 py-2 flex justify-between items-center rounded-t-[2rem] border-t border-rose-50">
                <NavItem id="map" icon={Map} label="Bàn" onClick={() => setPage('map')} />
                {user.role === 'admin' ? <NavItem id="dashboard" icon={ChefHat} label="Bếp" onClick={() => setPage('dashboard')} /> : <div className="w-12"/> }
                <div className="relative -top-6">
                    {user.role === 'admin' && <button onClick={() => setPage('manage-menu')} className="bg-stone-800 p-4 rounded-full text-rose-50 shadow-xl shadow-stone-300 border-4 border-[#fff1f2]"><Coffee size={24} /></button>}
                </div>
                {user.role === 'admin' && <NavItem id="reports" icon={BarChart3} label="BC" onClick={() => setPage('reports')} />}
                {user.role === 'admin' && <NavItem id="settings" icon={Settings} label="Cài đặt" onClick={() => setPage('settings')} />}
                {user.role !== 'admin' && <NavItem id="logout" icon={LogOut} label="Thoát" onClick={handleLogout} />}
            </div>

            <main className="flex-1 overflow-hidden  relative flex flex-col md:py-4 md:pr-4">
                <div className="flex-1 bg-black  md:rounded-[2.5rem] shadow-sm border border-white md:border-rose-50 overflow-hidden relative ">
                    {page === 'dashboard' && user?.role === 'admin' && <KitchenDisplay orders={orders} updateOrderStatus={updateOrderStatus} />}
                    {page === 'dashboard' && user?.role !== 'admin' && (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-rose-400 text-xl font-bold">Bạn không có quyền truy cập trang này</p>
                        </div>
                    )}
                    {page === 'map' && (
                    <div className="p-4 md:p-5 pb-24 md:pb-8 h-full overflow-y-auto bg-[#e8ded2] custom-scrollbar">
                        {/* Header with Stats */}
                        <div className="mb-8">
                            <div className="flex items-end justify-between mb-6">
                                <div>
                                    <h2 className={`text-4xl font-bold text-[#55352a] mb-2`}>Sơ Đồ Bàn</h2>
                                    <p className={`text-gray-500 text-base font-medium`}>Quản lý trạng thái bàn • Chạm để gọi thêm món</p>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
                                <button 
                                    onClick={() => setTableStatusFilter('all')}
                                    className={`p-4 md:p-6 rounded-xl border-2 transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${
                                        tableStatusFilter === 'all' 
                                            ? `bg-[#55352a] text-white border-[#55352a] shadow-lg` 
                                            : `bg-[#f0f0ec] border-[#55352a] text-gray-900 hover:shadow-lg hover:border-gray-300`
                                    }`}>
                                    <p className={`text-xs md:text-sm font-bold uppercase mb-2 ${tableStatusFilter === 'all' ? 'text-white' : 'text-gray-500'}`}>Tổng bàn</p>
                                    <p className={`text-2xl md:text-3xl font-bold ${tableStatusFilter === 'all' ? 'text-white' : 'text-gray-900'}`}>{filteredTables.length}</p>
                                </button>
                                <button 
                                    onClick={() => setTableStatusFilter('occupied')}
                                    className={`p-4 md:p-6 rounded-xl border-2 transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${
                                        tableStatusFilter === 'occupied'
                                            ? `bg-[#55352a] text-white border-[#55352a] shadow-lg`
                                            : `bg-[#f0f0ec] border-[#55352a] text-gray-900 hover:shadow-lg hover:border-gray-300`
                                    }`}>
                                    <p className={`text-xs md:text-sm font-bold uppercase mb-2 ${tableStatusFilter === 'occupied' ? 'text-white' : 'text-gray-500'}`}>Đang phục vụ</p>
                                    <p className={`text-2xl md:text-3xl font-bold ${tableStatusFilter === 'occupied' ? 'text-white' : 'text-gray-900'}`}>{orders.filter(o => o.tableId && o.status !== 'paid').length}</p>
                                </button>
                                <button 
                                    onClick={() => setTableStatusFilter('empty')}
                                    className={`p-4 md:p-6 rounded-xl border-2 transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${
                                        tableStatusFilter === 'empty'
                                            ? `bg-[#55352a] text-white border-[#55352a] shadow-lg`
                                            : `bg-[#f0f0ec] border-[#55352a] text-gray-900 hover:shadow-lg hover:border-gray-300`
                                    }`}>
                                    <p className={`text-xs md:text-sm font-bold uppercase mb-2 ${tableStatusFilter === 'empty' ? 'text-white' : 'text-gray-500'}`}>Còn trống</p>
                                    <p className={`text-2xl md:text-3xl font-bold ${tableStatusFilter === 'empty' ? 'text-white' : 'text-gray-900'}`}>{filteredTables.filter(t => !orders.find(o => o.tableId === t._id && o.status !== 'paid')).length}</p>
                                </button>
                            </div>
                        </div>

                        {/* Zone Filter */}
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin size={20} className={`text-[#55352a]`}/>
                                <p className={`text-sm text-gray-700 font-bold uppercase tracking-wider`}>Lọc theo khu vực</p>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: '-ms-autohiding-scrollbar' }}>
                                {uniqueZones.map(zone => (
                                    <button 
                                        key={zone} 
                                        onClick={() => setActiveZone(zone)} 
                                        className={`px-5 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-all shrink-0 border-2 ${
                                            activeZone === zone 
                                                ? `bg-[#55352a] text-white border-[#55352a] shadow-lg hover:shadow-xl` 
                                                : `bg-[#f0f0ec] text-gray-900 border-[#55352a] hover:border-gray-300 hover:shadow-md`
                                        }`}
                                    >
                                        {zone === 'All' ? 'Tất cả khu' : zone}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                            {filteredTables.map(t => {
                                const activeOrder = orders.find(o => o.tableId === t._id && o.status !== 'paid');
                                const isOccupied = !!activeOrder;
                                const isCompleted = activeOrder && activeOrder.items && activeOrder.items.length > 0 && activeOrder.items.every(item => item.status === 'served');
                                
                                return (
                                    <div
                                        key={t._id} 
                                        onClick={() => { setSelectedTable(t); setShowOrderModal(true); }} 
                                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden border-2 shadow-sm hover:shadow-md active:scale-95 cursor-pointer ${
                                            isCompleted
                                                ? `bg-green-500 text-white border-green-500 hover:scale-105`
                                                : isOccupied
                                                    ? `bg-[#55352a] text-white border-[#55352a] hover:scale-105`
                                                    : `bg-[#f0f0ec] border-[#55352a] text-gray-900 hover:border-gray-400 hover:scale-105`
                                        }`}
                                    >
                                        {/* Table Name - Primary */}
                                        <div className={`text-3xl md:text-4xl font-black transition-all`}>
                                            {t.name}
                                        </div>
                                        
                                        {/* Capacity - Secondary */}
                                        <div className={`text-xs font-semibold mt-1 ${
                                            isOccupied || isCompleted
                                                ? 'text-white/80' 
                                                : 'text-gray-500'
                                        }`}>
                                            {t.capacity} chỗ
                                        </div>

                                        {/* Status Badge - Top Right Corner */}
                                        {isOccupied && (
                                            <div className="absolute top-2 right-2">
                                                {isCompleted ? (
                                                    <div className="bg-emerald-300 text-emerald-900 text-xs font-bold px-2 py-0.5 rounded-full">✓</div>
                                                ) : (
                                                    <div className="bg-white text-[#55352a] text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">●</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Button - Bottom */}
                                        {isOccupied && user.role === 'admin' && (
                                            <div className="absolute bottom-2 w-full px-2">
                                                {isCompleted ? (
                                                    <button 
                                                        onClick={(e)=>{
                                                            e.stopPropagation(); 
                                                            initiatePayment(t._id);
                                                        }} 
                                                        className="w-full py-1.5 px-2 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 bg-white text-green-600 hover:bg-green-50"
                                                    >
                                                        💳 THANH TOÁN
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={(e)=>{
                                                            e.stopPropagation(); 
                                                            initiateDeleteItems(t._id);
                                                        }} 
                                                        className="w-full py-1.5 px-2 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 bg-red-500 text-white hover:bg-red-600"
                                                    >
                                                        🗑️ XOÁ
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Empty State */}
                        {filteredTables.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24">
                                <div className="text-7xl mb-4 opacity-50">🪑</div>
                                <p className={`text-gray-700 font-bold text-lg`}>Không có bàn nào trong khu vực này</p>
                                <p className={`text-gray-500 text-sm mt-2`}>Vui lòng chọn khu vực khác</p>
                            </div>
                        )}
                    </div>
                    )}
                    {page === 'reports' && <ReportsView reports={reports} settings={settings}/>}
                    {page === 'attendance' && <AttendanceViewWrapper staff={staff}/>}
                    {page === 'settings' && <SettingsView settings={settings} onSave={async (d) => { 
                    try {
                        const res = await fetch(`${API_URL}/api/settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) });
                        const data = await res.json();
                        if (!res.ok || !data.success) {
                        showNotification.error('❌ ' + (data.message || data.error || 'Lỗi cập nhật cài đặt'));
                        } else {
                        setSettings(d);
                        showNotification.success('✅ Cài đặt đã được lưu');
                        }
                    } catch(e) {
                        showNotification.error('❌ ' + (e.message || 'Lỗi cập nhật cài đặt'));
                    }
                    }} />}
                    {['menu', 'tables', 'staff', 'categories'].map(type => (
                        page === `manage-${type}` && <ManagementView key={type} type={type} data={type==='menu'?menu:type==='tables'?tables:type==='categories'?categories:staff} categories={categories} onSave={(i, id) => handleSave(type, i, id)} onDelete={(id) => handleDelete(type, id)} onRefresh={()=>{ type==='staff'?fetchStaff():type==='menu'?fetchMenu():type==='tables'?fetchTables():type==='categories'&&fetchCategories() }} />
                    ))}
                </div>
            </main>

            {showOrderModal && selectedTable && (
                <OrderEntry 
                    key={selectedTable._id + '-' + Date.now()} 
                    menu={menu} 
                    categories={categories} 
                    activeTable={selectedTable} 
                    onConfirmOrder={handlePlaceOrder} 
                    onLoadingChange={(isLoading) => {}} 
                    onClose={() => { setShowOrderModal(false); setSelectedTable(null); }}
                    orders={orders}
                />
            )}
            
            {showDeleteItemsModal && selectedTable && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#f0f0ec] w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="bg-[#55352a] p-6 text-white flex-shrink-0">
                            <button 
                                onClick={() => { setShowDeleteItemsModal(false); setSelectedTable(null); }} 
                                className="absolute top-4 right-4 p-2 hover:bg-red-700 rounded-lg transition"
                            >
                                <X size={20}/>
                            </button>
                            <h3 className="font-bold text-2xl mb-2">Xóa Món</h3>
                            <div className="text-red-100 text-sm">Bàn: {selectedTable.name}</div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="space-y-3">
                                {orders
                                    .filter(o => o.tableId === selectedTable._id && o.status !== 'paid')
                                    .flatMap(order => 
                                        order.items.map((item, idx) => ({
                                            ...item,
                                            orderId: order._id,
                                            orderIndex: idx
                                        }))
                                    )
                                    .map((item, idx) => {
                                        const statusColors = {
                                            'new': 'bg-gray-200 text-gray-700',
                                            'cooking': 'bg-orange-200 text-orange-700',
                                            'served': 'bg-green-200 text-green-700'
                                        };
                                        const statusLabels = {
                                            'new': '🆕 Mới',
                                            'cooking': '👨‍🍳 Đang Nấu',
                                            'served': '✓ Hoàn Thành'
                                        };
                                        const status = item.status || 'new';
                                        const isServed = status === 'served';
                                        
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-red-200 hover:shadow-md transition">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="font-bold text-gray-900">{item.name}</div>
                                                        <span className={`text-xs font-bold px-2.5 py-1 rounded ${statusColors[status]}`}>
                                                            {statusLabels[status]}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-600">{item.quantity}x • {formatCurrency(item.price)}</div>
                                                    {item.note && <div className="text-xs text-blue-600 mt-2">📝 {item.note}</div>}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        handleRequestDelete(
                                                            orders.find(o => o._id === item.orderId),
                                                            item,
                                                            item.orderIndex
                                                        );
                                                        setShowDeleteItemsModal(false);
                                                        setSelectedTable(null);
                                                    }}
                                                    disabled={isServed}
                                                    className={`p-3 rounded-lg transition active:scale-95 ml-4 flex-shrink-0 ${
                                                        isServed 
                                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' 
                                                            : 'bg-red-500 text-white hover:bg-red-600'
                                                    }`}
                                                    title={isServed ? 'Không thể xóa món đã hoàn thành' : 'Xóa món'}
                                                >
                                                    <Trash2 size={18}/>
                                                </button>
                                            </div>
                                        );
                                    })}
                                
                                {orders.filter(o => o.tableId === selectedTable._id && o.status !== 'paid').flatMap(o => o.items).length === 0 && (
                                    <div className="text-center py-12 text-gray-400">
                                        <Trash2 size={48} className="mx-auto mb-3 opacity-50"/>
                                        <p className="font-semibold">Không có món nào để xóa</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-red-200 bg-gray-50 flex gap-3 flex-shrink-0">
                            <button 
                                onClick={() => { setShowDeleteItemsModal(false); setSelectedTable(null); }} 
                                className="flex-1 py-3 rounded-lg bg-gray-300 text-gray-700 font-bold hover:bg-gray-400 transition active:scale-95"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPaymentModal && selectedTable && (
                <PaymentModal 
                    table={selectedTable} 
                    orders={orders.filter(o => o.tableId === selectedTable._id && o.status !== 'paid')} 
                    settings={settings} 
                    onConfirm={handlePaymentConfirm}
                    onClose={() => { setShowPaymentModal(false); setSelectedTable(null); }}
                    handleRequestDelete={handleRequestDelete}
                />
            )}
        </div>
    );
};

export default RestaurantApp;