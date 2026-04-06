import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR', locale = 'hr-HR') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export function formatNumber(n: number, locale = 'hr-HR') {
  return new Intl.NumberFormat(locale).format(n)
}

export function getMarginColor(margin: number): string {
  if (margin >= 70) return 'text-green-400'
  if (margin >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

export function getStockStatus(current: number, par: number): 'ok' | 'low' | 'critical' {
  if (current >= par) return 'ok'
  if (current >= par * 0.5) return 'low'
  return 'critical'
}
