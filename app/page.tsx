"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, TrendingUp, AlertTriangle, 
  PlusCircle, FileDown, FileUp, Printer, 
  Trash2, X, Check, Search, Calendar,
  BarChart3, Settings, ChevronRight
} from "lucide-react";

// --- Types ---
type Item = {
  id: string;
  code: string;
  name: string;
  reorderLevel: number;
  defaultUnitPrice: number;
};

type Transaction = {
  id: string;
  itemId: string;
  date: string;
  type: "IN" | "OUT";
  quantity: number;
  unitPrice: number;
  description: string;
  referenceNo?: string;
  authorizedBy: string;
  createdAt: number;
};

// --- Seed Data ---
const SEED_ITEMS: Item[] = [
  { id: "1", code: "01", name: "01 - ජංගම විදුලි බුබුළු", reorderLevel: 10, defaultUnitPrice: 205.60 },
  { id: "2", code: "02", name: "02 - මුදල් සහතික", reorderLevel: 20, defaultUnitPrice: 105.50 },
];

const SEED_TRANSACTIONS: Transaction[] = [
  { id: "t1", itemId: "1", date: new Date().toISOString().split("T")[0], type: "IN", quantity: 50, unitPrice: 205.60, description: "Opening Balance", authorizedBy: "System", createdAt: Date.now() - 10000 },
  { id: "t2", itemId: "2", date: new Date().toISOString().split("T")[0], type: "IN", quantity: 69, unitPrice: 105.50, description: "Opening Balance", authorizedBy: "System", createdAt: Date.now() },
];

export default function InventoryLedger() {
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Filters
  type FilterType = "ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "AS_OF_DATE";
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Modals state
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);

  // Form states
  const [newItem, setNewItem] = useState<Partial<Item>>({ code: "", name: "", reorderLevel: 10, defaultUnitPrice: 0 });
  const [newTx, setNewTx] = useState<Partial<Transaction>>({ 
    itemId: "",
    date: new Date().toISOString().split("T")[0], 
    type: "IN", 
    quantity: 1, 
    description: "", 
    referenceNo: "", 
    authorizedBy: "" 
  });

  // Load data on mount
  useEffect(() => {
    setIsMounted(true);
    const savedItems = localStorage.getItem("inventory_items");
    const savedTxs = localStorage.getItem("inventory_transactions");

    if (!savedItems || !savedTxs) {
      setItems(SEED_ITEMS);
      setTransactions(SEED_TRANSACTIONS);
      setSelectedItemId(SEED_ITEMS[0].id);
      localStorage.setItem("inventory_items", JSON.stringify(SEED_ITEMS));
      localStorage.setItem("inventory_transactions", JSON.stringify(SEED_TRANSACTIONS));
    } else {
      const parsedItems = JSON.parse(savedItems);
      setItems(parsedItems);
      setTransactions(JSON.parse(savedTxs));
      if (parsedItems.length > 0) {
        setSelectedItemId(parsedItems[0].id);
      }
    }
  }, []);

  // Save data on change
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("inventory_items", JSON.stringify(items));
      localStorage.setItem("inventory_transactions", JSON.stringify(transactions));
    }
  }, [items, transactions, isMounted]);

  // Derived calculations for metrics
  const { totalInventoryValue, activeItemsCount, lowStockItems } = useMemo(() => {
    let totalValue = 0;
    let activeItemsCount = 0;
    const lowStockItems: Item[] = [];

    items.forEach((item) => {
      const itemTxs = transactions
        .filter((t) => t.itemId === item.id && (filterType !== "AS_OF_DATE" || t.date <= asOfDate))
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

      let balance = 0;
      let lastPrice = item.defaultUnitPrice;
      itemTxs.forEach((t) => {
        balance += t.type === "IN" ? t.quantity : -t.quantity;
        lastPrice = t.unitPrice; // Valuation based on the latest unit price
      });

      if (balance > 0) {
        totalValue += balance * lastPrice;
        activeItemsCount++;
      }
      
      if (balance <= item.reorderLevel) {
        lowStockItems.push(item);
      }
    });

    return { totalInventoryValue: totalValue, activeItemsCount, lowStockItems };
  }, [items, transactions, filterType, asOfDate]);

  // Compute all ledgers (used for Print all and UI)
  const allLedgers = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const startOfWeekDate = new Date(todayDate);
    startOfWeekDate.setDate(todayDate.getDate() - todayDate.getDay());
    const startOfWeek = startOfWeekDate.toISOString().split("T")[0];
    const startOfMonth = today.substring(0, 8) + "01";

    return items.map(item => {
      const allTxs = transactions
        .filter((t) => t.itemId === item.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

      let balance = 0;
      const enriched = allTxs.map((t) => {
        balance += t.type === "IN" ? t.quantity : -t.quantity;
        return { ...t, balance, valuation: balance * t.unitPrice };
      });

      const filtered = enriched.filter((t) => {
        if (filterType === "ALL") return true;
        if (filterType === "TODAY") return t.date === today;
        if (filterType === "THIS_WEEK") return t.date >= startOfWeek && t.date <= today;
        if (filterType === "THIS_MONTH") return t.date >= startOfMonth && t.date <= today;
        if (filterType === "AS_OF_DATE") return t.date <= asOfDate;
        return true;
      });

      return { item, rows: filtered, finalBalance: balance };
    });
  }, [items, transactions, filterType, asOfDate]);

  // Computed global log for ALL items
  const globalLogRows = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const startOfWeekDate = new Date(todayDate);
    startOfWeekDate.setDate(todayDate.getDate() - todayDate.getDay());
    const startOfWeek = startOfWeekDate.toISOString().split("T")[0];
    const startOfMonth = today.substring(0, 8) + "01";

    const filtered = transactions.filter((t) => {
      if (filterType === "ALL") return true;
      if (filterType === "TODAY") return t.date === today;
      if (filterType === "THIS_WEEK") return t.date >= startOfWeek && t.date <= today;
      if (filterType === "THIS_MONTH") return t.date >= startOfMonth && t.date <= today;
      if (filterType === "AS_OF_DATE") return t.date <= asOfDate;
      return true;
    });

    return filtered
      .map(t => {
        const item = items.find(i => i.id === t.itemId);
        return { ...t, itemCode: item?.code, itemName: item?.name };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [transactions, items, filterType, asOfDate]);

  // Derived selected item data
  const selectedItem = items.find((i) => i.id === selectedItemId);
  const ledgerRows = allLedgers.find(l => l.item.id === selectedItemId)?.rows || [];

  // Form handling functions
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.code || !newItem.name) return;
    const item: Item = {
      id: Date.now().toString(),
      code: newItem.code,
      name: newItem.name,
      reorderLevel: Number(newItem.reorderLevel),
      defaultUnitPrice: Number(newItem.defaultUnitPrice) || 0,
    };
    setItems([...items, item]);
    setSelectedItemId(item.id);
    setIsAddItemModalOpen(false);
    setNewItem({ code: "", name: "", reorderLevel: 10, defaultUnitPrice: 0 });
  };

  const handleAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    const targetItemId = newTx.itemId || selectedItemId;
    if (!targetItemId) return;

    if (newTx.type === "OUT") {
      const currentStock = transactions
        .filter((t) => t.itemId === targetItemId)
        .reduce((acc, t) => acc + (t.type === "IN" ? t.quantity : -t.quantity), 0);
      
      if ((newTx.quantity || 0) > currentStock) {
        alert("Error: Stock OUT quantity exceeds current on-hand stock!");
        return;
      }
    }

    const tx: Transaction = {
      id: Date.now().toString(),
      itemId: targetItemId,
      date: newTx.date!,
      type: newTx.type as "IN" | "OUT",
      quantity: Number(newTx.quantity),
      unitPrice: Number(newTx.unitPrice),
      description: newTx.description || "",
      referenceNo: newTx.referenceNo,
      authorizedBy: newTx.authorizedBy || "",
      createdAt: Date.now(),
    };
    
    setTransactions([...transactions, tx]);
    
    // Automatically switch to the item tab that was just modified
    if (selectedItemId !== targetItemId) {
      setSelectedItemId(targetItemId);
    }
    
    setIsAddTxModalOpen(false);
    setNewTx({ ...newTx, quantity: 1, description: "", referenceNo: "" });
  };

  const openTxModal = (type: "IN" | "OUT") => {
    const targetItem = (selectedItemId && selectedItemId !== "ALL_LOG") ? selectedItemId : (items.length > 0 ? items[0].id : "");
    const defaultPrice = (selectedItemId && selectedItemId !== "ALL_LOG") ? selectedItem?.defaultUnitPrice : (items.length > 0 ? items[0].defaultUnitPrice : 0);

    setNewTx({
      itemId: targetItem,
      date: new Date().toISOString().split("T")[0],
      type,
      quantity: 1,
      unitPrice: defaultPrice || 0,
      description: "",
      referenceNo: "",
      authorizedBy: "",
    });
    setIsAddTxModalOpen(true);
  };

  const deleteTx = (id: string) => {
    if (confirm("Are you sure you want to delete this record? This may affect running balances.")) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const formatCurrency = (val: number) => `Rs. ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportJSON = () => {
    const data = JSON.stringify({ items, transactions }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.items && data.transactions) {
          setItems(data.items);
          setTransactions(data.transactions);
          alert("Backup restored successfully!");
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const previewStock = useMemo(() => {
    const targetItemId = newTx.itemId || selectedItemId;
    if (!targetItemId) return 0;
    const currentStock = transactions
        .filter((t) => t.itemId === targetItemId)
        .reduce((acc, t) => acc + (t.type === "IN" ? t.quantity : -t.quantity), 0);
    const q = Number(newTx.quantity) || 0;
    return newTx.type === "IN" ? currentStock + q : currentStock - q;
  }, [transactions, selectedItemId, newTx.itemId, newTx.type, newTx.quantity]);

  if (!isMounted) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading Workspace...</div>;

  return (
    <>
    {/* --- Interactive UI (Hidden when printing) --- */}
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans pb-12 selection:bg-indigo-100 selection:text-indigo-900 print:hidden">
      {/* Dynamic Header & Top Metrics */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 backdrop-blur-xl bg-white/80 transition-all">
        <div className="px-6 py-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-500 p-3 rounded-xl shadow-lg shadow-indigo-200">
              <BarChart3 className="text-white" size={28} strokeWidth={2.5}/>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Ledger</h1>
              <p className="text-slate-500 font-medium text-sm mt-0.5">Double-Entry Stock Register • Fully Offline</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 min-w-[240px] hover:shadow-md transition-shadow">
              <div className="bg-emerald-100 p-2.5 rounded-full">
                <TrendingUp className="text-emerald-600" size={20}/>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Value</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{formatCurrency(totalInventoryValue)}</div>
              </div>
            </div>
            <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 min-w-[180px] hover:shadow-md transition-shadow">
              <div className="bg-blue-100 p-2.5 rounded-full">
                <Package className="text-blue-600" size={20}/>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Items</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{activeItemsCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="mx-6 mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-4 rounded-2xl shadow-sm flex items-start gap-4">
            <div className="bg-orange-500 p-2 rounded-full shadow-sm">
              <AlertTriangle className="text-white shrink-0" size={20} />
            </div>
            <div>
              <h3 className="text-orange-900 font-bold text-lg">Low Stock Warning</h3>
              <p className="text-orange-800 font-medium mt-1">
                The following items have fallen below their safe reorder levels: <span className="font-bold">{lowStockItems.map(i => i.name).join(", ")}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="px-6 mt-8 space-y-8">
        
        {/* Advanced Action Bar */}
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-white p-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          
          {/* Primary Actions */}
          <div className="flex flex-wrap gap-3 w-full lg:w-auto p-1">
            <button onClick={() => setIsAddItemModalOpen(true)} className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-slate-200">
              <PlusCircle size={18} /> New Item
            </button>
            <div className="w-px h-10 bg-slate-200 mx-1 hidden sm:block"></div>
            <button onClick={() => openTxModal("IN")} disabled={items.length === 0} className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-emerald-200">
              <FileDown size={18} /> Stock IN <span className="font-normal opacity-90">(ලැබීම)</span>
            </button>
            <button onClick={() => openTxModal("OUT")} disabled={items.length === 0} className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-rose-200">
              <FileUp size={18} /> Stock OUT <span className="font-normal opacity-90">(නිකුත්)</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto justify-end p-1">
             {/* Beautiful Time Filter Pill */}
             <div className="flex items-center bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shadow-inner">
                {(["ALL", "TODAY", "THIS_WEEK", "THIS_MONTH", "AS_OF_DATE"] as FilterType[]).map(ft => (
                  <button key={ft} onClick={() => setFilterType(ft)} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${filterType === ft ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-900/5 scale-100" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95"}`}>
                    {ft.replace(/_/g, " ")}
                  </button>
                ))}
             </div>
             
             {filterType === "AS_OF_DATE" && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow" />
                </div>
             )}

            <div className="flex gap-2 lg:ml-2 lg:pl-6 lg:border-l border-slate-200">
              <button onClick={exportJSON} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all hover:shadow-sm">
                <FileDown size={18} className="text-blue-500"/> Backup
              </button>
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all hover:shadow-sm cursor-pointer">
                <FileUp size={18} className="text-emerald-500"/> Restore
                <input type="file" accept=".json" onChange={importJSON} className="hidden" />
              </label>
              <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all hover:shadow-sm shadow-indigo-100 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200">
                <Printer size={18} className="text-indigo-600"/> Print Full Report
              </button>
            </div>
          </div>
        </div>

        {/* Item Selector Tabs (Mac-like segmented style) */}
        <div className="flex gap-3 overflow-x-auto pb-4 pt-2 snap-x scrollbar-hide">
          <button
            onClick={() => setSelectedItemId("ALL_LOG")}
            className={`snap-center flex-shrink-0 flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 ${selectedItemId === "ALL_LOG" ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10 translate-y-[-2px]" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60 shadow-sm"}`}
          >
            <div className={`w-2 h-2 rounded-full ${selectedItemId === "ALL_LOG" ? 'bg-indigo-400' : 'bg-slate-300'}`}></div>
            Global Activity Log
          </button>

          {items.map(item => {
            const isSelected = selectedItemId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`snap-center flex-shrink-0 flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 ${isSelected ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10 translate-y-[-2px]" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60 shadow-sm"}`}
              >
                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-400' : 'bg-slate-300'}`}></div>
                {item.name}
              </button>
            )
          })}
        </div>

        {/* Elegant Ledger View */}
        {selectedItemId === "ALL_LOG" ? (
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-5">
                  <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 hidden sm:block">
                    <Calendar size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Global Activity Log</h2>
                    <p className="text-sm font-semibold text-slate-500 mt-1">Chronological log of all inventory movements across all items.</p>
                  </div>
                </div>
             </div>
             
             <div className="overflow-x-auto pb-4">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500">
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">Date</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">Item</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">Description / Ref</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-center">Type</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-center">Qty</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-right">Unit Price</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">Auth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {globalLogRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Search size={48} className="mb-4 text-slate-300 opacity-50" />
                          <p className="text-lg font-semibold">No activity found</p>
                          <p className="text-sm mt-1">Try adjusting your time filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    globalLogRows.map((row) => (
                      <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-4 px-6 text-slate-600 font-semibold">{row.date}</td>
                        <td className="py-4 px-6">
                           <div className="font-bold text-slate-800">{row.itemName}</div>
                           <div className="text-xs text-slate-500">{row.itemCode}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-800">{row.description}</div>
                          {row.referenceNo && <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1"><ChevronRight size={12}/> Ref: {row.referenceNo}</div>}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {row.type === "IN" ? (
                            <span className="inline-flex items-center justify-center min-w-[4rem] px-3 py-1.5 rounded-lg text-sm font-black bg-emerald-100 text-emerald-700 shadow-sm">
                              IN (+{row.quantity})
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center min-w-[4rem] px-3 py-1.5 rounded-lg text-sm font-black bg-rose-100 text-rose-700 shadow-sm">
                              OUT (-{row.quantity})
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center font-black text-lg text-slate-900">{row.quantity}</td>
                        <td className="py-4 px-6 text-right font-mono font-medium text-slate-500">{formatCurrency(row.unitPrice)}</td>
                        <td className="py-4 px-6 text-slate-600 font-semibold">{row.authorizedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedItem ? (
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header of Ledger */}
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-5">
                <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 hidden sm:block">
                  <Package size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedItem.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm text-sm font-semibold text-slate-600">
                      Code: <span className="text-indigo-600">{selectedItem.code}</span>
                    </span>
                    <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm text-sm font-semibold text-slate-600">
                      Reorder Level: <span className="text-rose-500">{selectedItem.reorderLevel}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm min-w-[200px]">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Valuation</div>
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 mt-1">
                  {ledgerRows.length > 0 ? formatCurrency(ledgerRows[ledgerRows.length-1].valuation) : "Rs. 0.00"}
                </div>
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500">
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">දිනය (Date)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">විස්තරය (Description / Ref)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-center">තොග ලැබීම (IN)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-center">තොග නිකුත් (OUT)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-right">ඒකක වටිනාකම (Price)</th>
                    <th className="py-5 px-6 font-black uppercase tracking-wider text-xs text-center bg-slate-100/50 border-x border-slate-100">ශේෂය (Balance)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-right text-indigo-900/60">තොගයේ වටිනාකම (Total)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs">නිලධාරී අත්සන (Auth)</th>
                    <th className="py-5 px-6 font-bold uppercase tracking-wider text-xs text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Search size={48} className="mb-4 text-slate-300 opacity-50" />
                          <p className="text-lg font-semibold">No records found</p>
                          <p className="text-sm mt-1">Try adjusting your time filters or add a new transaction.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((row) => (
                      <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-4 px-6 text-slate-600 font-semibold">{row.date}</td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-800">{row.description}</div>
                          {row.referenceNo && <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1"><ChevronRight size={12}/> Ref: {row.referenceNo}</div>}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {row.type === "IN" && (
                            <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-lg text-sm font-black bg-emerald-100 text-emerald-700 shadow-sm">
                              +{row.quantity}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {row.type === "OUT" && (
                            <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-lg text-sm font-black bg-rose-100 text-rose-700 shadow-sm">
                              -{row.quantity}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-medium text-slate-500">{formatCurrency(row.unitPrice)}</td>
                        <td className="py-4 px-6 text-center bg-slate-50/50 border-x border-slate-100/50 group-hover:bg-white transition-colors">
                          <span className="text-xl font-black text-slate-900">{row.balance}</span>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-slate-800 bg-indigo-50/10 group-hover:bg-transparent">{formatCurrency(row.valuation)}</td>
                        <td className="py-4 px-6 text-slate-600 font-semibold">{row.authorizedBy}</td>
                        <td className="py-4 px-6 text-center">
                          <button onClick={() => deleteTx(row.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-all hover:scale-110 active:scale-95" title="Delete record">
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-24 text-center flex flex-col items-center justify-center">
            <div className="bg-slate-50 p-8 rounded-full mb-6 ring-8 ring-slate-50/50">
               <Package size={64} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-slate-700 tracking-tight">No Inventory Items Yet</h2>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">Create a new item to get started tracking your stock and managing the ledger securely.</p>
            <button onClick={() => setIsAddItemModalOpen(true)} className="mt-8 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
              <PlusCircle size={20} /> Add Your First Item
            </button>
          </div>
        )}
      </main>

      {/* --- Beautiful Modals --- */}
      
      {/* Add Item Modal */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/20">
            <div className="px-8 py-6 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><Package size={20}/></div>
                Create New Item
              </h3>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X size={20} strokeWidth={3}/></button>
            </div>
            <form onSubmit={handleAddItem} className="p-8 space-y-6">
              <div className="flex gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Item Code</label>
                  <input required autoFocus value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-semibold" placeholder="e.g. 03" />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Reorder Level</label>
                  <input required type="number" min="0" value={newItem.reorderLevel} onChange={e => setNewItem({...newItem, reorderLevel: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-semibold" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Item Name (Sinhala/English)</label>
                <input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-semibold" placeholder="e.g. 03 - කඩදාසි" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Default Unit Price (Rs.)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rs.</span>
                  <input required type="number" step="0.01" min="0" value={newItem.defaultUnitPrice} onChange={e => setNewItem({...newItem, defaultUnitPrice: Number(e.target.value)})} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-semibold font-mono" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddItemModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/20">
            <div className={`px-8 py-6 flex justify-between items-center border-b border-slate-100 bg-gradient-to-r ${newTx.type === "IN" ? "from-emerald-50 to-white" : "from-rose-50 to-white"}`}>
              <h3 className={`font-extrabold text-xl flex items-center gap-3 ${newTx.type === "IN" ? "text-emerald-900" : "text-rose-900"}`}>
                <div className={`p-2 rounded-xl text-white ${newTx.type === "IN" ? "bg-emerald-500" : "bg-rose-500"}`}>
                   {newTx.type === "IN" ? <FileDown size={20}/> : <FileUp size={20}/>} 
                </div>
                Add Stock {newTx.type === "IN" ? "IN (ලැබීම)" : "OUT (නිකුත් කිරීම)"}
              </h3>
              <button onClick={() => setIsAddTxModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X size={20} strokeWidth={3}/></button>
            </div>
            
            <form onSubmit={handleAddTx} className="p-8 space-y-6">
              <div className="flex gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Item</label>
                  <select required value={newTx.itemId || selectedItemId || ""} onChange={e => {
                     const selected = items.find(i => i.id === e.target.value);
                     setNewTx({...newTx, itemId: e.target.value, unitPrice: selected?.defaultUnitPrice || newTx.unitPrice});
                  }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold cursor-pointer">
                    {items.map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                  <input required type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
                  <select required value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value as "IN" | "OUT"})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold cursor-pointer">
                    <option value="IN">Stock IN</option>
                    <option value="OUT">Stock OUT</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Quantity</label>
                  <input required type="number" min="1" value={newTx.quantity} onChange={e => setNewTx({...newTx, quantity: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-lg" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Unit Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rs.</span>
                    <input required type="number" step="0.01" min="0" value={newTx.unitPrice} onChange={e => setNewTx({...newTx, unitPrice: Number(e.target.value)})} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-lg font-mono" />
                  </div>
                </div>
              </div>
              
              {/* Live Preview Card */}
              <div className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-colors ${previewStock < 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                <span className="font-bold text-slate-500">Predicted New Balance</span>
                <span className={`text-3xl font-black ${previewStock < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{previewStock} <span className="text-lg font-semibold text-slate-400">units</span></span>
              </div>
              {previewStock < 0 && <div className="text-sm font-bold text-rose-600 flex items-center gap-2 mt-[-12px]"><AlertTriangle size={16}/> Cannot proceed. Stock goes below zero!</div>}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description / Voucher Note</label>
                <input required value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold" placeholder="e.g. Received from Supplier A" />
              </div>

              <div className="flex gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Reference No (Optional)</label>
                  <input value={newTx.referenceNo} onChange={e => setNewTx({...newTx, referenceNo: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Officer / Authorized By</label>
                  <input required value={newTx.authorizedBy} onChange={e => setNewTx({...newTx, authorizedBy: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddTxModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={previewStock < 0} className={`px-8 py-3 font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${newTx.type === "IN" ? "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white" : "bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-500/30 text-white"}`}>
                  <Check size={20} strokeWidth={3}/> Confirm Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* --- Print-Only Comprehensive Report --- */}
    <div className="hidden print:block w-full bg-white text-black p-2 font-sans">
      <div className="text-center mb-4 border-b border-black pb-2">
        <h1 className="text-xl font-black uppercase tracking-widest text-black">Ledger</h1>
        <p className="text-sm mt-1 font-bold text-gray-700">Double-Entry Stock Register Report</p>
        <p className="text-xs mt-1 text-gray-600">Generated on: {new Date().toLocaleString()} | Filter Applied: {filterType.replace(/_/g, " ")} {filterType === "AS_OF_DATE" ? `(${asOfDate})` : ""}</p>
      </div>

      {allLedgers.map(({ item, rows }) => (
        <div key={item.id} className="mb-6 break-inside-avoid">
          <div className="flex justify-between items-end mb-2 border-b border-gray-400 pb-1">
            <div>
              <h2 className="text-sm font-bold text-black">{item.code} - {item.name}</h2>
              <p className="text-xs text-gray-700">Reorder Level: {item.reorderLevel} | Default Price: {formatCurrency(item.defaultUnitPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-600 uppercase">Final Balance</p>
              <p className="text-sm font-black text-black">{rows.length > 0 ? rows[rows.length-1].balance : 0} Units</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-200 text-black">
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px]">Date</th>
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px]">Description / Ref</th>
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px] text-center">IN</th>
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px] text-center">OUT</th>
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px] text-right">Unit Price</th>
                <th className="py-1 px-1.5 border border-gray-400 font-black uppercase text-[10px] text-center">Balance</th>
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px] text-right">Value</th>
                <th className="py-1 px-1.5 border border-gray-400 font-bold uppercase text-[10px]">Auth</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="py-2 text-center text-gray-500 font-medium border border-gray-400 text-[10px]">No records found for this period.</td></tr>
              ) : (
                rows.map(row => (
                  <tr key={row.id}>
                    <td className="py-1 px-1.5 border border-gray-400 text-gray-800">{row.date}</td>
                    <td className="py-1 px-1.5 border border-gray-400">
                      <div className="font-bold text-black">{row.description}</div>
                      {row.referenceNo && <div className="text-[10px] text-gray-600">Ref: {row.referenceNo}</div>}
                    </td>
                    <td className="py-1 px-1.5 border border-gray-400 text-center font-bold text-gray-800">{row.type === "IN" ? `+${row.quantity}` : ""}</td>
                    <td className="py-1 px-1.5 border border-gray-400 text-center font-bold text-gray-800">{row.type === "OUT" ? `-${row.quantity}` : ""}</td>
                    <td className="py-1 px-1.5 border border-gray-400 text-right font-mono text-gray-700">{formatCurrency(row.unitPrice)}</td>
                    <td className="py-1 px-1.5 border border-gray-400 text-center font-black text-black bg-gray-50">{row.balance}</td>
                    <td className="py-1 px-1.5 border border-gray-400 text-right font-mono font-bold text-black">{formatCurrency(row.valuation)}</td>
                    <td className="py-1 px-1.5 border border-gray-400 text-gray-800">{row.authorizedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
    </>
  );
}
