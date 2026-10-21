/**
 * Minimal Excel (.xlsx) writer — no dependency. Several sheets, bold header row (frozen, with
 * filters), column widths, DH money / percent / date formats and bold total rows. Strings are
 * written inline; the zip is stored (no compression), which Excel, Numbers and Sheets all open.
 */

export type CellType = 'text' | 'money' | 'int' | 'percent' | 'date'
/** A plain value (formatted by its column) or a number with its own format. */
export type Cell = string | number | null | undefined | { value: number; type: CellType }

export interface SheetColumn {
  header: string
  type?: CellType
  /** Width in characters */
  width?: number
}

export interface Sheet {
  name: string
  /** Optional lines above the table (title, period…); the first one is bold and large. */
  intro?: string[]
  columns: SheetColumn[]
  rows: Cell[][]
  /** Bold row under the table */
  total?: Cell[]
  /** Two-column label / value sheet (Summary) instead of a table */
  keyValue?: boolean
}

// Style ids (see stylesXml): 0 normal, 1 header, 2 money, 3 int, 4 percent, 5 date, 6 title,
// 7 bold text, 8 bold money, 9 bold int, 10 bold percent, 11 muted
const S = { header: 1, money: 2, int: 3, percent: 4, date: 5, title: 6, boldText: 7, boldMoney: 8, boldInt: 9, boldPercent: 10, muted: 11 }

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function colName(i: number) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** "YYYY-MM-DD" → Excel date serial */
function dateSerial(day: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  if (!m) return null
  return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000
}

function cellXml(ref: string, cell: Cell, columnType: CellType, bold: boolean) {
  const typed = typeof cell === 'object' && cell !== null
  const value = typed ? cell.value : cell
  const type = typed ? cell.type : columnType
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const style =
      type === 'money' ? (bold ? S.boldMoney : S.money) : type === 'percent' ? (bold ? S.boldPercent : S.percent) : type === 'int' ? (bold ? S.boldInt : S.int) : bold ? S.boldInt : 0
    const v = type === 'percent' ? value / 100 : value
    return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${v}</v></c>`
  }
  const text = String(value)
  if (type === 'date') {
    const serial = dateSerial(text)
    if (serial !== null) return `<c r="${ref}" s="${S.date}"><v>${serial}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"${bold ? ` s="${S.boldText}"` : ''}><is><t xml:space="preserve">${esc(text)}</t></is></c>`
}

function sheetXml(sheet: Sheet) {
  const rows: string[] = []
  let r = 1
  const intro = sheet.intro ?? []
  intro.forEach((line, i) => {
    rows.push(`<row r="${r}"><c r="A${r}" t="inlineStr" s="${i === 0 ? S.title : S.muted}"><is><t xml:space="preserve">${esc(line)}</t></is></c></row>`)
    r++
  })
  if (intro.length) r++ // blank line

  const headerRow = r
  if (!sheet.keyValue) {
    rows.push(
      `<row r="${r}">${sheet.columns.map((c, i) => `<c r="${colName(i)}${r}" t="inlineStr" s="${S.header}"><is><t>${esc(c.header)}</t></is></c>`).join('')}</row>`
    )
    r++
  }
  const firstData = r
  for (const row of sheet.rows) {
    // Key/value: a row whose value is empty is a section heading (bold)
    const heading = Boolean(sheet.keyValue) && (row[1] === null || row[1] === undefined || row[1] === '')
    rows.push(`<row r="${r}">${row.map((v, i) => cellXml(`${colName(i)}${r}`, v, sheet.columns[i]?.type ?? 'text', heading)).join('')}</row>`)
    r++
  }
  if (sheet.total) {
    rows.push(`<row r="${r}">${sheet.total.map((v, i) => cellXml(`${colName(i)}${r}`, v, sheet.columns[i]?.type ?? 'text', true)).join('')}</row>`)
    r++
  }

  const cols = sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join('')
  const lastCol = colName(Math.max(0, sheet.columns.length - 1))
  const freeze = sheet.keyValue
    ? ''
    : `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
  const filter = !sheet.keyValue && sheet.rows.length ? `<autoFilter ref="A${headerRow}:${lastCol}${firstData + sheet.rows.length - 1}"/>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}<cols>${cols}</cols><sheetData>${rows.join('')}</sheetData>${filter}</worksheet>`
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;DH&quot;;[Red]-#,##0.00 &quot;DH&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="3" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
</cellXfs>
</styleSheet>`

// ---- zip (stored) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(files: { name: string; data: string }[]) {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.data)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // UTF-8 names
    lv.setUint16(8, 0, true) // stored
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    parts.push(local, data)

    const cen = new Uint8Array(46 + name.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cen.set(name, 46)
    central.push(cen)
    offset += local.length + data.length
  }
  const size = central.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, size, true)
  ev.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Excel sheet names: max 31 chars, no []:*?/\ */
const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet'

export function buildXlsx(sheets: Sheet[]) {
  const names = sheets.map((s) => sheetName(s.name))
  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: 'xl/styles.xml', data: stylesXml },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ]
  return zip(files)
}

export function downloadXlsx(filename: string, sheets: Sheet[]) {
  const url = URL.createObjectURL(buildXlsx(sheets))
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
