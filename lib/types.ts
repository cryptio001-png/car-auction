export type Car = {
  id: number
  house: string | null
  lot: string | null
  date: string | null
  maker: string | null
  model: string | null
  grade: string | null
  year: number | null
  mileage: number | null
  displ: number | null
  power: number | null
  trans: string | null
  cond: string | null
  color: string | null
  start_price: number | null
  sold_price: number | null
  result: 'sold' | 'notsold' | 'pending' | null
  notes: string | null
  created_at: string
}

export type CarInsert = Omit<Car, 'id' | 'created_at'>