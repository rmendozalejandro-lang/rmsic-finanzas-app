const VERSION = 7
const SIZE = 17 + VERSION * 4
const DATA_CODEWORDS = 156
const DATA_PER_BLOCK = 78
const ECC_PER_BLOCK = 20
const MAX_BYTE_LENGTH = 154
const ALIGNMENT_POSITIONS = [6, 22, 38]

type MatrixCell = boolean | null

function gfMultiply(x: number, y: number) {
  let result = 0
  let a = x
  let b = y

  while (b > 0) {
    if (b & 1) result ^= a
    b >>>= 1
    a <<= 1
    if (a & 0x100) a ^= 0x11d
  }

  return result
}

function multiplyPolynomials(a: number[], b: number[]) {
  const result = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^= gfMultiply(a[i], b[j])
    }
  }
  return result
}

function reedSolomonGenerator(degree: number) {
  let generator = [1]
  let root = 1
  for (let i = 0; i < degree; i += 1) {
    generator = multiplyPolynomials(generator, [1, root])
    root = gfMultiply(root, 2)
  }
  return generator
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree)
  const remainder = new Array(degree).fill(0)

  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.shift()
    remainder.push(0)
    for (let i = 0; i < degree; i += 1) {
      remainder[i] ^= gfMultiply(generator[i + 1], factor)
    }
  }

  return remainder
}

function bchRemainder(data: number, polynomial: number) {
  let value = data
  const polynomialDegree = Math.floor(Math.log2(polynomial))
  while (value > 0 && Math.floor(Math.log2(value)) >= polynomialDegree) {
    value ^= polynomial << (Math.floor(Math.log2(value)) - polynomialDegree)
  }
  return value
}

function formatBits(mask: number) {
  // Error correction L = 01.
  const data = (1 << 3) | mask
  return ((data << 10) | bchRemainder(data << 10, 0x537)) ^ 0x5412
}

function versionBits() {
  return (VERSION << 12) | bchRemainder(VERSION << 12, 0x1f25)
}

function encodeData(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text))
  if (bytes.length > MAX_BYTE_LENGTH) {
    throw new Error(`La URL de verificación excede ${MAX_BYTE_LENGTH} bytes.`)
  }

  const bits: number[] = []
  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1)
  }

  // Byte mode.
  pushBits(0b0100, 4)
  pushBits(bytes.length, 8)
  bytes.forEach((byte) => pushBits(byte, 8))

  const capacity = DATA_CODEWORDS * 8
  for (let i = 0; i < Math.min(4, capacity - bits.length); i += 1) bits.push(0)
  while (bits.length % 8) bits.push(0)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] || 0)
    data.push(byte)
  }

  let pad = 0xec
  while (data.length < DATA_CODEWORDS) {
    data.push(pad)
    pad = pad === 0xec ? 0x11 : 0xec
  }

  const blocks = [data.slice(0, DATA_PER_BLOCK), data.slice(DATA_PER_BLOCK)]
  const ecc = blocks.map((block) => reedSolomonRemainder(block, ECC_PER_BLOCK))
  const codewords: number[] = []

  for (let i = 0; i < DATA_PER_BLOCK; i += 1) {
    for (const block of blocks) codewords.push(block[i])
  }
  for (let i = 0; i < ECC_PER_BLOCK; i += 1) {
    for (const block of ecc) codewords.push(block[i])
  }

  const result: number[] = []
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i -= 1) result.push((byte >>> i) & 1)
  }
  return result
}

function createFunctionMatrix() {
  const matrix: MatrixCell[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  const functional: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false))

  const set = (row: number, col: number, value: boolean) => {
    if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return
    matrix[row][col] = value
    functional[row][col] = true
  }

  const finder = (row: number, col: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const rr = row + dr
        const cc = col + dc
        if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) continue
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const value = inside && (
          dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
        )
        set(rr, cc, value)
      }
    }
  }

  finder(0, 0)
  finder(0, SIZE - 7)
  finder(SIZE - 7, 0)

  // Alignment patterns must be placed before timing patterns because two of
  // them intersect row/column 6 in version 7.
  for (const row of ALIGNMENT_POSITIONS) {
    for (const col of ALIGNMENT_POSITIONS) {
      if (functional[row][col]) continue
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          set(row + dr, col + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
        }
      }
    }
  }

  for (let i = 8; i < SIZE - 8; i += 1) {
    if (!functional[6][i]) set(6, i, i % 2 === 0)
    if (!functional[i][6]) set(i, 6, i % 2 === 0)
  }

  set(SIZE - 8, 8, true)

  // Reserve format information.
  for (let i = 0; i < 9; i += 1) {
    if (i === 6) continue
    if (!functional[8][i]) set(8, i, false)
    if (!functional[i][8]) set(i, 8, false)
  }
  for (let i = 0; i < 8; i += 1) {
    if (!functional[8][SIZE - 1 - i]) set(8, SIZE - 1 - i, false)
    if (!functional[SIZE - 1 - i][8]) set(SIZE - 1 - i, 8, false)
  }

  // Reserve version information.
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      set(i, SIZE - 11 + j, false)
      set(SIZE - 11 + j, i, false)
    }
  }

  return { matrix, functional }
}

function maskBit(mask: number, row: number, col: number) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0
    case 1: return row % 2 === 0
    case 2: return col % 3 === 0
    case 3: return (row + col) % 3 === 0
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0
    case 5: return ((row * col) % 2 + (row * col) % 3) === 0
    case 6: return (((row * col) % 2 + (row * col) % 3) % 2) === 0
    case 7: return (((row + col) % 2 + (row * col) % 3) % 2) === 0
    default: return false
  }
}

function placeData(bits: number[], mask: number) {
  const { matrix, functional } = createFunctionMatrix()
  let bitIndex = 0
  let upward = true

  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1

    for (let step = 0; step < SIZE; step += 1) {
      const row = upward ? SIZE - 1 - step : step
      for (let offset = 0; offset < 2; offset += 1) {
        const currentCol = col - offset
        if (functional[row][currentCol]) continue

        let bit = bitIndex < bits.length ? bits[bitIndex] : 0
        bitIndex += 1
        if (maskBit(mask, row, currentCol)) bit ^= 1
        matrix[row][currentCol] = bit === 1
      }
    }
    upward = !upward
  }

  const format = formatBits(mask)
  const getFormatBit = (index: number) => ((format >>> index) & 1) === 1

  for (let i = 0; i <= 5; i += 1) matrix[i][8] = getFormatBit(i)
  matrix[7][8] = getFormatBit(6)
  matrix[8][8] = getFormatBit(7)
  matrix[8][7] = getFormatBit(8)
  for (let i = 9; i < 15; i += 1) matrix[8][14 - i] = getFormatBit(i)

  for (let i = 0; i < 8; i += 1) matrix[8][SIZE - 1 - i] = getFormatBit(i)
  for (let i = 8; i < 15; i += 1) matrix[SIZE - 15 + i][8] = getFormatBit(i)
  matrix[SIZE - 8][8] = true

  const version = versionBits()
  for (let i = 0; i < 18; i += 1) {
    const bit = ((version >>> i) & 1) === 1
    const a = Math.floor(i / 3)
    const b = (i % 3) + SIZE - 11
    matrix[a][b] = bit
    matrix[b][a] = bit
  }

  return matrix.map((row) => row.map(Boolean))
}

function penalty(matrix: boolean[][]) {
  let score = 0

  for (let row = 0; row < SIZE; row += 1) {
    let run = 1
    for (let col = 1; col < SIZE; col += 1) {
      if (matrix[row][col] === matrix[row][col - 1]) {
        run += 1
        if (run === 5) score += 3
        else if (run > 5) score += 1
      } else run = 1
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let run = 1
    for (let row = 1; row < SIZE; row += 1) {
      if (matrix[row][col] === matrix[row - 1][col]) {
        run += 1
        if (run === 5) score += 3
        else if (run > 5) score += 1
      } else run = 1
    }
  }

  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let col = 0; col < SIZE - 1; col += 1) {
      const value = matrix[row][col]
      if (
        matrix[row][col + 1] === value &&
        matrix[row + 1][col] === value &&
        matrix[row + 1][col + 1] === value
      ) score += 3
    }
  }

  const pattern = [true, false, true, true, true, false, true]
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col <= SIZE - 7; col += 1) {
      if (!pattern.every((value, index) => matrix[row][col + index] === value)) continue
      let before = true
      let after = true
      for (let i = 1; i <= 4; i += 1) {
        if (col - i >= 0 && matrix[row][col - i]) before = false
        if (col + 6 + i < SIZE && matrix[row][col + 6 + i]) after = false
      }
      if (before || after) score += 40
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    for (let row = 0; row <= SIZE - 7; row += 1) {
      if (!pattern.every((value, index) => matrix[row + index][col] === value)) continue
      let before = true
      let after = true
      for (let i = 1; i <= 4; i += 1) {
        if (row - i >= 0 && matrix[row - i][col]) before = false
        if (row + 6 + i < SIZE && matrix[row + 6 + i][col]) after = false
      }
      if (before || after) score += 40
    }
  }

  let dark = 0
  matrix.forEach((row) => row.forEach((value) => { if (value) dark += 1 }))
  score += Math.floor(Math.abs((dark * 100) / (SIZE * SIZE) - 50) / 5) * 10

  return score
}

export function createVerificationQrMatrix(text: string) {
  const bits = encodeData(text)
  let bestMatrix: boolean[][] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = placeData(bits, mask)
    const currentScore = penalty(matrix)
    if (currentScore < bestScore) {
      bestScore = currentScore
      bestMatrix = matrix
    }
  }

  if (!bestMatrix) throw new Error('No se pudo generar el QR de verificación.')
  return bestMatrix
}

export function qrMatrixToSvgPath(matrix: boolean[][], quietZone = 4) {
  const modules = matrix.length
  const path: string[] = []
  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (dark) path.push(`M${colIndex + quietZone} ${rowIndex + quietZone}h1v1h-1z`)
    })
  })
  return {
    path: path.join(''),
    viewBoxSize: modules + quietZone * 2,
  }
}
