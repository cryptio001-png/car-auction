'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Row = { id: number; category: string; value: string; parent: string | null }

const CATEGORIES = [
  { key: 'house', label: '会場' },
  { key: 'maker', label: 'メーカー' },
  { key: 'model', label: 'モデル' },
  { key: 'color', label: 'カラー' },
  { key: 'trans', label: 'ミッション' },
  { key: 'cond',  label: 'コンディション' },
]

export default function MasterPage() {
  const [items, setItems]             = useState<Row[]>([])
  const [activeTab, setActiveTab]     = useState('house')
  const [newValue, setNewValue]       = useState('')
  const [selectedMaker, setSelectedMaker] = useState('')
  const [loading, setLoading]         = useState(true)
  const [adding, setAdding]           = useState(false)

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('master_data').select('*').order('id')
    setItems((data as Row[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const addItem = async () => {
    const value = newValue.trim()
    if (!value) return
    if (activeTab === 'model' && !selectedMaker) return
    setAdding(true)
    const parent = activeTab === 'model' ? selectedMaker : null
    await supabase.from('master_data').insert({ category: activeTab, value, parent })
    setNewValue('')
    await loadItems()
    setAdding(false)
  }

  const deleteItem = async (id: number) => {
    if (!confirm('削除しますか？')) return
    await supabase.from('master_data').delete().eq('id', id)
    await loadItems()
  }

  const makers = items.filter(i => i.category === 'maker').map(i => i.value)
  const filteredItems = activeTab === 'model'
    ? items.filter(i => i.category === 'model' && (!selectedMaker || i.parent === selectedMaker))
    : items.filter(i => i.category === activeTab)

  const switchTab = (key: string) => {
    setActiveTab(key)
    setNewValue('')
    setSelectedMaker('')
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-[#1a2332] text-white h-14 flex items-center justify-between px-6 border-b-4 border-red-600">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold tracking-wide">⚙️ マスタ管理</h1>
          <span className="text-xs text-white/40 font-mono">Master Data Management</span>
        </div>
        <Link
          href="/"
          className="text-[11px] px-3 py-1 rounded bg-white/10 border border-white/30 text-white font-medium hover:bg-white/20 transition-colors"
        >
          ← メイン画面へ
        </Link>
      </header>

      <div className="max-w-2xl mx-auto p-6">

        {/* タブ */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => switchTab(cat.key)}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === cat.key
                  ? 'bg-red-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">

          {/* モデルタブ: メーカー選択 */}
          {activeTab === 'model' && (
            <div className="mb-4">
              <select
                value={selectedMaker}
                onChange={e => setSelectedMaker(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
              >
                <option value="">メーカーを選択してください</option>
                {makers.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* 追加フォーム */}
          {(activeTab !== 'model' || selectedMaker) && (
            <div className="flex gap-2 mb-5">
              <input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder={activeTab === 'model' ? `${selectedMaker} のモデルを追加...` : '新しい値を入力...'}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={addItem}
                disabled={adding}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold px-4 py-2 rounded-md text-sm transition-colors"
              >
                {adding ? '追加中...' : '追加'}
              </button>
            </div>
          )}

          {/* リスト */}
          {loading ? (
            <div className="text-center text-gray-400 py-8">読み込み中...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              {activeTab === 'model' && !selectedMaker ? 'メーカーを選択してください' : '項目がありません'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredItems.map(item => (
                <li key={item.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm text-gray-900">{item.value}</span>
                    {item.parent && (
                      <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.parent}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="text-[11px] text-gray-400 text-right mt-3">{filteredItems.length} 件</div>
          )}
        </div>
      </div>
    </div>
  )
}
