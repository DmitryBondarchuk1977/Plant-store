const nfMoney = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

/** Денежное значение в белорусских рублях: "12,5 Br". */
export const byn = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : nfMoney.format(n) + ' Br'

export const num = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n)
