'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Car, CarInsert } from '@/lib/types'

const emptyForm = (): CarInsert => ({
  house: null, lot: null, date: null, maker: null, model: null,
  grade: null, year: null, mileage: null, displ: null, power: null,
  trans: null, cond: null, color: null, start_price: null,
  sold_price: null, result: null, notes: null,
})

// ── 共通セレクト ──
const Sel = ({ id, value, onChange, children, className = '' }: {
  id?: string; value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string
}) => (
  <select
    id={id}
    value={value}
    onChange={e => onChange(e.target.value)}
    className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white ${className}`}
  >
    {children}
  </select>
)

const Input = ({ value, onChange, type = 'text', placeholder = '', className = '' }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string
}) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 ${className}`}
  />
)

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 mb-3">
    <label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
)

const SecLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4 mb-2 px-2 py-1 bg-gray-100 border-l-4 border-gray-300 rounded-r">{children}</div>
)

export default function Home() {
  const router = useRouter()
  const [cars, setCars]           = useState<Car[]>([])
  const [filtered, setFiltered]   = useState<Car[]>([])
  const [loading, setLoading]     = useState(true)
  const [dbStatus, setDbStatus]   = useState<'ok'|'err'|'loading'>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [formMsg, setFormMsg]     = useState<{text: string; type: 'ok'|'err'} | null>(null)

  // フォーム
  const [form, setForm]           = useState<CarInsert>(emptyForm())

  // 検索
  const [q, setQ]                 = useState('')
  const [sMaker, setSMaker]       = useState('')
  const [sResult, setSResult]     = useState('')
  const [sColor, setSColor]       = useState('')
  const [sHouse, setSHouse]       = useState('')
  const [sYearFrom, setSYearFrom] = useState('')
  const [sYearTo, setSYearTo]     = useState('')
  const [sPriceFrom, setSPriceFrom] = useState('')
  const [sPriceTo, setSPriceTo]   = useState('')

  // 編集モーダル
  const [editCar, setEditCar]     = useState<Car | null>(null)
  const [editForm, setEditForm]   = useState<CarInsert>(emptyForm())
  const [updating, setUpdating]   = useState(false)
  const [editMsg, setEditMsg]     = useState<{text: string; type: 'ok'|'err'} | null>(null)

  // マスタデータ
  const [houses, setHouses]     = useState<string[]>([])
  const [makers, setMakers]     = useState<string[]>([])
  const [modelMap, setModelMap] = useState<Record<string, string[]>>({})
  const [colors, setColors]     = useState<string[]>([])
  const [trans, setTrans]       = useState<string[]>([])
  const [conds, setConds]       = useState<string[]>([])

  // モバイルタブ
  const [mobileTab, setMobileTab] = useState<'list' | 'form'>('list')

  // ── ログアウト ──
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── マスタ読み込み ──
  const loadMaster = useCallback(async () => {
    const { data } = await supabase.from('master_data').select('*').order('id')
    if (!data) return
    type Row = { category: string; value: string; parent: string | null }
    const rows = data as Row[]
    setHouses(rows.filter(d => d.category === 'house').map(d => d.value))
    setMakers(rows.filter(d => d.category === 'maker').map(d => d.value))
    const mm: Record<string, string[]> = {}
    rows.filter(d => d.category === 'model').forEach(d => {
      if (!d.parent) return
      if (!mm[d.parent]) mm[d.parent] = []
      mm[d.parent].push(d.value)
    })
    setModelMap(mm)
    setColors(rows.filter(d => d.category === 'color').map(d => d.value))
    setTrans(rows.filter(d => d.category === 'trans').map(d => d.value))
    setConds(rows.filter(d => d.category === 'cond').map(d => d.value))
  }, [])

  useEffect(() => { loadMaster() }, [loadMaster])

  // ── DB読み込み ──
  const loadCars = useCallback(async () => {
    setLoading(true)
    setDbStatus('loading')
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setDbStatus('err')
      setLoading(false)
      return
    }
    setCars(data || [])
    setFiltered(data || [])
    setDbStatus('ok')
    setLoading(false)
  }, [])

  useEffect(() => { loadCars() }, [loadCars])

  // ── リアルタイム購読 ──
  useEffect(() => {
    const channel = supabase
      .channel('cars-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, () => {
        loadCars()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadCars])

  // ── 検索 ──
  const runSearch = useCallback(() => {
    const qq = q.toLowerCase()
    const yFrom = parseInt(sYearFrom) || 0
    const yTo   = parseInt(sYearTo)   || 9999
    const pFrom = parseFloat(sPriceFrom) || 0
    const pTo   = parseFloat(sPriceTo)   || Infinity
    setFiltered(cars.filter(c => {
      if (qq && !`${c.maker} ${c.model} ${c.grade} ${c.lot} ${c.house} ${c.notes}`.toLowerCase().includes(qq)) return false
      if (sMaker  && c.maker  !== sMaker)  return false
      if (sResult && c.result !== sResult) return false
      if (sColor  && c.color  !== sColor)  return false
      if (sHouse  && c.house  !== sHouse)  return false
      if (c.year  && (c.year < yFrom || c.year > yTo)) return false
      if (c.sold_price && (c.sold_price < pFrom || c.sold_price > pTo)) return false
      return true
    }))
  }, [cars, q, sMaker, sResult, sColor, sHouse, sYearFrom, sYearTo, sPriceFrom, sPriceTo])

  // ── 登録 ──
  const submitCar = async () => {
    if (!form.house || !form.lot || !form.maker || !form.model) {
      setFormMsg({ text: '会場・ロット番号・メーカー・モデルは必須です', type: 'err' })
      setTimeout(() => setFormMsg(null), 3000)
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('cars').insert(form)
    setSubmitting(false)
    if (error) {
      setFormMsg({ text: '登録失敗: ' + error.message, type: 'err' })
      return
    }
    setFormMsg({ text: `「${form.maker} ${form.model}」を登録しました`, type: 'ok' })
    setTimeout(() => setFormMsg(null), 3000)
    setForm(emptyForm())
    await loadCars()
  }

  // ── 削除 ──
  const deleteCar = async (id: number) => {
    if (!confirm('この車両データを削除しますか？')) return
    await supabase.from('cars').delete().eq('id', id)
    await loadCars()
  }

  // ── 編集モーダルを開く ──
  const openEdit = (car: Car) => {
    setEditCar(car)
    setEditForm({
      house: car.house, lot: car.lot, date: car.date, maker: car.maker,
      model: car.model, grade: car.grade, year: car.year, mileage: car.mileage,
      displ: car.displ, power: car.power, trans: car.trans, cond: car.cond,
      color: car.color, start_price: car.start_price, sold_price: car.sold_price,
      result: car.result, notes: car.notes,
    })
    setEditMsg(null)
  }

  // ── 更新 ──
  const updateCar = async () => {
    if (!editCar) return
    setUpdating(true)
    const { data, error } = await supabase.from('cars').update(editForm).eq('id', editCar.id).select()
    setUpdating(false)
    if (error) {
      setEditMsg({ text: '更新失敗: ' + error.message, type: 'err' })
      return
    }
    if (!data || data.length === 0) {
      setEditMsg({ text: '更新できませんでした（権限がない可能性があります）', type: 'err' })
      return
    }
    setEditCar(null)
    await loadCars()
  }

  // ── 統計 ──
  const sold    = filtered.filter(c => c.result === 'sold')
  const notsold = filtered.filter(c => c.result === 'notsold')
  const avgSold = sold.length ? Math.round(sold.reduce((s, c) => s + (c.sold_price || 0), 0) / sold.length) : null

  // ── CSV出力 ──
  const exportCSV = () => {
    const headers = ['ID','会場','ロット','日付','メーカー','モデル','グレード','年式','走行距離','排気量','出力','ミッション','コンディション','色','開始価格','落札価格','結果','備考']
    const rows = filtered.map(c => [
      c.id, c.house, c.lot, c.date, c.maker, c.model, c.grade,
      c.year, c.mileage, c.displ, c.power, c.trans, c.cond, c.color,
      c.start_price, c.sold_price,
      c.result === 'sold' ? '落札' : c.result === 'notsold' ? '未落札' : c.result === 'pending' ? '出品待ち' : '',
      c.notes
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `car-auction-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const fStr = (v: string | null) => v || ''
  const fNum = (v: number | null) => v?.toString() || ''

  const resultLabel = (r: string | null) => r === 'sold' ? '落札' : r === 'notsold' ? '未落札' : r === 'pending' ? '待ち' : ''
  const resultColor = (r: string | null) => r === 'sold' ? 'bg-green-100 text-green-700' : r === 'notsold' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="bg-[#1a2332] text-white h-14 flex items-center justify-between px-3 md:px-6 border-b-4 border-red-600 shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h1 className="text-sm md:text-base font-bold tracking-wide whitespace-nowrap">🚗 車両オークション管理</h1>
          <span className="hidden md:inline text-xs text-white/40 font-mono">Car Auction Management System</span>
          <Link href="/master" className="hidden md:inline text-[11px] px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white/60 hover:text-white hover:bg-white/20 transition-colors">
            マスタ管理
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full ${dbStatus === 'ok' ? 'bg-green-900 text-green-400' : dbStatus === 'err' ? 'bg-red-900 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
            {dbStatus === 'ok' ? '● DB接続済み' : dbStatus === 'err' ? '● 接続失敗' : '● 接続中...'}
          </span>
          <span className="hidden md:inline text-xs font-mono text-white/50">
            登録台数: <span className="text-red-400 font-bold">{cars.length}</span> 台
          </span>
          <button
            onClick={handleLogout}
            className="text-[11px] px-3 py-1 rounded bg-white/10 border border-white/30 text-white font-medium hover:bg-red-600 hover:border-red-600 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* ── モバイルタブバー ── */}
      <div className="md:hidden bg-white border-b border-gray-200 flex shrink-0">
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === 'list' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
        >
          一覧
        </button>
        <button
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === 'form' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
        >
          登録
        </button>
        <Link
          href="/master"
          className="flex-1 py-2.5 text-sm font-medium text-gray-500 text-center"
        >
          マスタ
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── 左: 登録フォーム ── */}
        <aside className={`bg-white border-r border-gray-200 overflow-y-auto p-5 shrink-0 md:block md:w-80 ${mobileTab === 'form' ? 'block w-full' : 'hidden'}`}>
          <div className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4 pb-2 border-b-2 border-red-600">車両登録</div>

          <SecLabel>オークション情報</SecLabel>
          <Field label="会場" required>
            <Sel value={fStr(form.house)} onChange={v => setForm(f => ({ ...f, house: v || null }))}>
              <option value="">選択してください</option>
              {houses.map(h => <option key={h}>{h}</option>)}
            </Sel>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="ロット番号" required>
              <Input value={fStr(form.lot)} onChange={v => setForm(f => ({ ...f, lot: v || null }))} placeholder="例: 39" />
            </Field>
            <Field label="オークション日">
              <Input type="date" value={fStr(form.date)} onChange={v => setForm(f => ({ ...f, date: v || null }))} />
            </Field>
          </div>

          <SecLabel>車両情報</SecLabel>
          <div className="grid grid-cols-2 gap-2">
            <Field label="メーカー" required>
              <Sel value={fStr(form.maker)} onChange={v => setForm(f => ({ ...f, maker: v || null, model: null }))}>
                <option value="">選択</option>
                {makers.map(m => <option key={m}>{m}</option>)}
              </Sel>
            </Field>
            <Field label="モデル" required>
              <Sel value={fStr(form.model)} onChange={v => setForm(f => ({ ...f, model: v || null }))}>
                <option value="">{form.maker ? '選択' : 'メーカー先に'}</option>
                {(modelMap[form.maker || ''] || []).map(m => <option key={m}>{m}</option>)}
              </Sel>
            </Field>
          </div>
          <Field label="グレード / タイプ">
            <Input value={fStr(form.grade)} onChange={v => setForm(f => ({ ...f, grade: v || null }))} placeholder="例: MS リミテッド" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="年式">
              <Input type="number" value={fNum(form.year)} onChange={v => setForm(f => ({ ...f, year: parseInt(v) || null }))} placeholder="例: 2005" />
            </Field>
            <Field label="走行距離 (km)">
              <Input type="number" value={fNum(form.mileage)} onChange={v => setForm(f => ({ ...f, mileage: parseInt(v) || null }))} placeholder="例: 40000" />
            </Field>
            <Field label="排気量 (cc)">
              <Input type="number" value={fNum(form.displ)} onChange={v => setForm(f => ({ ...f, displ: parseInt(v) || null }))} placeholder="例: 3000" />
            </Field>
            <Field label="出力 (PS)">
              <Input type="number" value={fNum(form.power)} onChange={v => setForm(f => ({ ...f, power: parseInt(v) || null }))} placeholder="例: 220" />
            </Field>
            <Field label="ミッション">
              <Sel value={fStr(form.trans)} onChange={v => setForm(f => ({ ...f, trans: v || null }))}>
                <option value="">選択</option>
                {trans.map(t => <option key={t}>{t}</option>)}
              </Sel>
            </Field>
            <Field label="コンディション">
              <Sel value={fStr(form.cond)} onChange={v => setForm(f => ({ ...f, cond: v || null }))}>
                <option value="">選択</option>
                {conds.map(c => <option key={c}>{c}</option>)}
              </Sel>
            </Field>
          </div>
          <Field label="色">
            <Sel value={fStr(form.color)} onChange={v => setForm(f => ({ ...f, color: v || null }))}>
              <option value="">選択</option>
              {colors.map(c => <option key={c}>{c}</option>)}
            </Sel>
          </Field>

          <SecLabel>価格情報</SecLabel>
          <div className="grid grid-cols-2 gap-2">
            <Field label="開始価格 (USD)">
              <Input type="number" value={fNum(form.start_price)} onChange={v => setForm(f => ({ ...f, start_price: parseFloat(v) || null }))} placeholder="例: 3800" />
            </Field>
            <Field label="落札価格 (USD)">
              <Input type="number" value={fNum(form.sold_price)} onChange={v => setForm(f => ({ ...f, sold_price: parseFloat(v) || null }))} placeholder="未落札は空欄" />
            </Field>
          </div>
          <Field label="結果">
            <Sel value={fStr(form.result)} onChange={v => setForm(f => ({ ...f, result: (v || null) as Car['result'] }))}>
              <option value="">選択</option>
              <option value="sold">落札 (SOLD)</option>
              <option value="notsold">未落札 (NOT SOLD)</option>
              <option value="pending">出品待ち</option>
            </Sel>
          </Field>

          <SecLabel>備考</SecLabel>
          <Field label="装備・メモ">
            <textarea
              value={fStr(form.notes)}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
              placeholder="装備品、特記事項など"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-y min-h-[56px]"
            />
          </Field>

          <button
            onClick={submitCar}
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-2.5 rounded-md text-sm mt-2 transition-colors"
          >
            {submitting ? '登録中...' : '＋ 登録する'}
          </button>
          <button
            onClick={() => setForm(emptyForm())}
            className="w-full mt-2 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            クリア
          </button>
          {formMsg && (
            <div className={`mt-2 text-xs p-2 rounded border ${formMsg.type === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {formMsg.text}
            </div>
          )}
        </aside>

        {/* ── 右: 検索・一覧 ── */}
        <main className={`flex-1 flex-col overflow-hidden md:flex ${mobileTab === 'list' ? 'flex' : 'hidden'}`}>

          {/* 検索バー */}
          <div className="bg-white border-b border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  placeholder="メーカー・モデル・ロット番号で検索..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <button onClick={runSearch} className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-md text-sm transition-colors">検索</button>
              <button onClick={loadCars} className="border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded-md text-sm text-gray-600 transition-colors" title="DBから再取得">↻ 更新</button>
              <button onClick={exportCSV} className="bg-[#1a2332] hover:bg-[#2c3e50] text-white px-3 py-2 rounded-md text-sm transition-colors">CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                [sMaker, setSMaker, '全メーカー', makers],
                [sResult, setSResult, '全結果', [['sold','落札'],['notsold','未落札'],['pending','出品待ち']]],
                [sColor, setSColor, '全カラー', colors],
                [sHouse, setSHouse, '全会場', houses],
              ].map(([val, set, placeholder, opts], i) => (
                <select key={i} value={val as string} onChange={e => (set as (v:string)=>void)(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                  <option value="">{placeholder as string}</option>
                  {(opts as (string | string[])[]).map((o) =>
                    Array.isArray(o)
                      ? <option key={o[0]} value={o[0]}>{o[1]}</option>
                      : <option key={o as string}>{o as string}</option>
                  )}
                </select>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['年式', sYearFrom, setSYearFrom, sYearTo, setSYearTo],
                ['落札価格 (USD)', sPriceFrom, setSPriceFrom, sPriceTo, setSPriceTo],
              ].map(([label, from, setFrom, to, setTo]) => (
                <div key={label as string}>
                  <div className="text-[11px] text-gray-500 font-medium mb-1">{label as string}</div>
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={from as string} onChange={e => (setFrom as (v:string)=>void)(e.target.value)}
                      placeholder="から" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-400" />
                    <span className="text-gray-400 text-xs">〜</span>
                    <input type="number" value={to as string} onChange={e => (setTo as (v:string)=>void)(e.target.value)}
                      placeholder="まで" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 統計バー */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
            {[
              ['検索結果', filtered.length],
              ['落札', sold.length],
              ['未落札', notsold.length],
              ['平均落札価格', avgSold ? `$${avgSold.toLocaleString()}` : '—'],
            ].map(([label, val]) => (
              <div key={label as string} className="px-4 py-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label as string}</div>
                <div className="text-lg font-bold font-mono text-gray-900">{val as string}</div>
              </div>
            ))}
          </div>

          {/* テーブル */}
          <div className="flex-1 overflow-auto px-5 pb-5">
            <div className="text-[11px] text-gray-400 font-mono py-2">{filtered.length} 件 / 全 {cars.length} 件</div>
            {loading ? (
              <div className="text-center text-gray-400 py-16">読み込み中...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <div className="text-4xl mb-3">🔍</div>
                <p>該当する車両が見つかりません</p>
              </div>
            ) : (
              <table className="w-full min-w-[700px] text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1a2332] text-white/80 text-xs">
                    {['ロット','日付','車両','年式','走行距離','色','開始価格','落札価格','結果',''].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} className={`border-b border-gray-200 hover:bg-red-50/30 transition-colors ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{c.lot}</span>
                        <div className="text-[11px] text-gray-500 mt-0.5">{c.house}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{c.date || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-gray-900">{c.maker} {c.model}</div>
                        {c.grade && <div className="text-[11px] text-gray-400">{c.grade}</div>}
                      </td>
                      <td className="px-3 py-2 font-mono text-sm">{c.year || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.mileage != null ? c.mileage.toLocaleString() + ' km' : '—'}</td>
                      <td className="px-3 py-2 text-xs">{c.color || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{c.start_price != null ? '$' + c.start_price.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 font-mono font-bold text-red-600">{c.sold_price != null ? '$' + c.sold_price.toLocaleString() : <span className="text-gray-300 font-normal">—</span>}</td>
                      <td className="px-3 py-2">
                        {c.result && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${resultColor(c.result)}`}>{resultLabel(c.result)}</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button onClick={() => openEdit(c)} className="text-xs border border-gray-300 rounded px-2 py-1 text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition-colors mr-1">編集</button>
                        <button onClick={() => deleteCar(c.id)} className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors">削除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* ── 編集モーダル ── */}
      {editCar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setEditCar(null)}>
          <div className="bg-white rounded-xl w-[560px] max-w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">車両データを編集</h2>
              <button onClick={() => setEditCar(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-5">
              <SecLabel>オークション情報</SecLabel>
              <div className="grid grid-cols-2 gap-2">
                <Field label="会場">
                  <Sel value={fStr(editForm.house)} onChange={v => setEditForm(f => ({ ...f, house: v || null }))}>
                    <option value="">選択</option>
                    {houses.map(h => <option key={h}>{h}</option>)}
                  </Sel>
                </Field>
                <Field label="ロット番号">
                  <Input value={fStr(editForm.lot)} onChange={v => setEditForm(f => ({ ...f, lot: v || null }))} />
                </Field>
                <Field label="オークション日">
                  <Input type="date" value={fStr(editForm.date)} onChange={v => setEditForm(f => ({ ...f, date: v || null }))} />
                </Field>
                <Field label="メーカー">
                  <Sel value={fStr(editForm.maker)} onChange={v => setEditForm(f => ({ ...f, maker: v || null, model: null }))}>
                    <option value="">選択</option>
                    {makers.map(m => <option key={m}>{m}</option>)}
                  </Sel>
                </Field>
                <Field label="モデル">
                  <Sel value={fStr(editForm.model)} onChange={v => setEditForm(f => ({ ...f, model: v || null }))}>
                    <option value="">選択</option>
                    {(modelMap[editForm.maker || ''] || []).map(m => <option key={m}>{m}</option>)}
                  </Sel>
                </Field>
                <Field label="グレード">
                  <Input value={fStr(editForm.grade)} onChange={v => setEditForm(f => ({ ...f, grade: v || null }))} />
                </Field>
              </div>
              <SecLabel>車両情報</SecLabel>
              <div className="grid grid-cols-2 gap-2">
                {([['年式','year','number'],['走行距離(km)','mileage','number'],['排気量(cc)','displ','number'],['出力(PS)','power','number']] as [string,keyof CarInsert,string][]).map(([label, key, type]) => (
                  <Field key={key} label={label}>
                    <Input type={type} value={fNum(editForm[key] as number | null)} onChange={v => setEditForm(f => ({ ...f, [key]: parseInt(v) || null }))} />
                  </Field>
                ))}
                <Field label="ミッション">
                  <Sel value={fStr(editForm.trans)} onChange={v => setEditForm(f => ({ ...f, trans: v || null }))}>
                    <option value="">選択</option>
                    {trans.map(t => <option key={t}>{t}</option>)}
                  </Sel>
                </Field>
                <Field label="コンディション">
                  <Sel value={fStr(editForm.cond)} onChange={v => setEditForm(f => ({ ...f, cond: v || null }))}>
                    <option value="">選択</option>
                    {conds.map(c => <option key={c}>{c}</option>)}
                  </Sel>
                </Field>
              </div>
              <Field label="色">
                <Sel value={fStr(editForm.color)} onChange={v => setEditForm(f => ({ ...f, color: v || null }))}>
                  <option value="">選択</option>
                  {colors.map(c => <option key={c}>{c}</option>)}
                </Sel>
              </Field>
              <SecLabel>価格情報</SecLabel>
              <div className="grid grid-cols-2 gap-2">
                <Field label="開始価格 (USD)">
                  <Input type="number" value={fNum(editForm.start_price)} onChange={v => setEditForm(f => ({ ...f, start_price: parseFloat(v) || null }))} />
                </Field>
                <Field label="落札価格 (USD)">
                  <Input type="number" value={fNum(editForm.sold_price)} onChange={v => setEditForm(f => ({ ...f, sold_price: parseFloat(v) || null }))} />
                </Field>
              </div>
              <Field label="結果">
                <Sel value={fStr(editForm.result)} onChange={v => setEditForm(f => ({ ...f, result: (v || null) as Car['result'] }))}>
                  <option value="">選択</option>
                  <option value="sold">落札 (SOLD)</option>
                  <option value="notsold">未落札 (NOT SOLD)</option>
                  <option value="pending">出品待ち</option>
                </Sel>
              </Field>
              <SecLabel>備考</SecLabel>
              <Field label="装備・メモ">
                <textarea value={fStr(editForm.notes)} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-y min-h-[56px]" />
              </Field>
              {editMsg && (
                <div className={`text-xs p-2 rounded border mb-2 ${editMsg.type === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  {editMsg.text}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={() => setEditCar(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors">キャンセル</button>
              <button onClick={updateCar} disabled={updating} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-md transition-colors">
                {updating ? '更新中...' : '更新する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
