// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader), written from its
// published reading policy alone: same answer {columns, rows, errors} for every
// {text, header}, much less CPU. The reference reads one character at a time and
// builds every field a character at a time; this reader never does. It works in
// bulk instead:
//
//   - a record whose line holds no quote and no stray CR is split in one native
//     split(',') (the common record: plain words, numbers, dates, codes);
//   - inside a record, a run of plain fields up to the next quote that opens a
//     field is split the same way; only quoted fields, quote junk and stray CRs
//     take the careful path;
//   - a quoted field jumps from quote to quote with indexOf, so a doubled ""
//     costs one slice, and its line breaks are counted and normalised only when
//     the field actually holds one;
//   - every other rule is the reference's, in the same order: BOM dropped, a
//     record ends at LF or CRLF, an empty line is no record, a CR outside quotes
//     not followed by LF is dropped (stray_cr), a quote that never closes is a
//     literal and the rest is re-read unquoted (unterminated_quote), what follows
//     a closing quote is appended as it stands (quote_junk), a quote inside an
//     unquoted field is literal, fields stay strings, rows are padded (short_row)
//     or cut (long_row) to the first record's width, and each error carries the
//     line its record starts on and its index in rows (null for the header).

/** How a field ended: the record goes on, the record ends, the text ends. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** The next of comma, CR, LF at or after lastIndex (unquoted fields only). */
const DELIM = /[,\r\n]/g;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes.
  let recordLine = 1;
  let recordRow = null;

  // Reads unquoted characters onto `value` up to the next comma or line break: a
  // CR not followed by LF is dropped (stray_cr). Returns the field, how it ended,
  // and `added`, the characters kept (not counting `value` as passed in).
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      DELIM.lastIndex = pos;
      const m = DELIM.exec(text);
      if (m === null) {
        if (pos < n) {
          value += text.slice(pos, n);
          added += n - pos;
        }
        pos = n;
        return { value, ended: END, added };
      }
      const d = m.index;
      const c = text.charCodeAt(d);
      if (d > pos) {
        value += text.slice(pos, d);
        added += d - pos;
      }
      if (c === 44) {
        pos = d + 1;
        return { value, ended: COMMA, added };
      }
      if (c === 10) {
        pos = d + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      if (text.charCodeAt(d + 1) === 10) {
        pos = d + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = d + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    let p = pos + 1;
    let closed = -1;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) {
        value += text.slice(p, q);
        value += '"';
        p = q + 2;
        continue;
      }
      closed = q;
      break;
    }
    if (closed === -1) {
      // The quote never closes: it is a literal character, and the text after it
      // is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    value += text.slice(p, closed);
    // Each CRLF or lone CR inside the quotes is one LF, and each line break in
    // there moves the line on by one. Only when the field holds a break at all.
    if (/[\r\n]/.test(value)) {
      const breaks = value.match(/\r\n|\r|\n/g);
      if (breaks !== null) line += breaks.length;
      value = value.replace(/\r\n?/g, '\n');
    }
    pos = closed + 1;
    if (pos >= n) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  // Finishes a record read into `fields`: the header, or a row padded or cut to
  // the first record's width.
  function finishRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    let ended = END;

    for (;;) {
      if (text.charCodeAt(pos) === 34) {
        const f = readQuoted();
        fields.push(f.value);
        lastQuoted = true;
        ended = f.ended;
        if (ended !== COMMA) break;
        continue;
      }
      // A run of plain fields: up to the next line break, or up to the next
      // quote that opens a field (one right after a comma, or at the run's
      // start). A quote elsewhere in the run is inside an unquoted field, so
      // it is literal and the run goes on past it.
      const eol = text.indexOf('\n', pos);
      const lineEnd = eol === -1 ? n : eol;
      let segEnd = lineEnd;
      if (eol !== -1 && lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) segEnd = lineEnd - 1;
      let runEnd = lineEnd;
      let q = text.indexOf('"', pos);
      while (q !== -1 && q < lineEnd) {
        if (q === pos || text.charCodeAt(q - 1) === 44) {
          runEnd = q;
          break;
        }
        q = text.indexOf('"', q + 1);
      }
      if (runEnd === lineEnd) {
        // The rest of the record is plain fields.
        const seg = text.slice(pos, segEnd);
        if (seg.indexOf('\r') === -1) {
          const parts = seg.split(',');
          fields.push(...parts);
          lastQuoted = false;
          pos = eol === -1 ? n : eol + 1;
          line += 1;
          ended = eol === -1 ? END : LINE_BREAK;
          break;
        }
        // A stray CR sits in the run: take one field the careful way.
        const f = readUnquoted('');
        fields.push(f.value);
        lastQuoted = false;
        ended = f.ended;
        if (ended !== COMMA) break;
        continue;
      }
      // The run stops at a quote that opens a field.
      const seg = text.slice(pos, runEnd);
      if (seg.indexOf('\r') === -1) {
        const parts = seg.split(',');
        parts.pop(); // the segment ends on a comma (or is empty): no field there
        fields.push(...parts);
        lastQuoted = false;
        pos = runEnd;
        continue;
      }
      const f = readUnquoted('');
      fields.push(f.value);
      lastQuoted = false;
      ended = f.ended;
      if (ended !== COMMA) break;
    }

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    finishRecord(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
