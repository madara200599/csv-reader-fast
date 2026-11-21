// csv-reader-fast v3: same semantics as csv-reader 1.0.0, no per-field array
// returns (ended/added travel in shared locals), dedicated fast path for a
// fresh unquoted field.
const COMMA = 0;
const LB = 1;
const END = 2;
const CR = 3;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (n !== 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;
  let ended = END; // how the last field read ended
  let added = 0; // characters unquoted() kept after its prefix

  // Reads unquoted characters from pos with `prefix` already in the value.
  // Returns the value; sets `ended` and `added`.
  function unquoted(prefix) {
    added = 0;
    let value = prefix;
    let first = true;
    let cur = pos;
    for (;;) {
      const iC = text.indexOf(',', cur);
      const iN = text.indexOf('\n', cur);
      const iR = text.indexOf('\r', cur);
      let m = -1;
      let kind = END;
      if (iC !== -1) {
        m = iC;
        kind = COMMA;
      }
      if (iN !== -1 && (m === -1 || iN < m)) {
        m = iN;
        kind = LB;
      }
      if (iR !== -1 && (m === -1 || iR < m)) {
        m = iR;
        kind = CR;
      }
      if (kind === END) {
        if (cur < n) {
          if (first) value = prefix === '' ? text.slice(cur, n) : prefix + text.slice(cur, n);
          else value += text.slice(cur, n);
          added += n - cur;
        }
        pos = n;
        ended = END;
        return value;
      }
      if (kind === CR) {
        if (text.charCodeAt(m + 1) === 10) {
          if (first) value = prefix === '' ? text.slice(cur, m) : prefix + text.slice(cur, m);
          else value += text.slice(cur, m);
          added += m - cur;
          pos = m + 2;
          line += 1;
          ended = LB;
          return value;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (first) {
          value = prefix === '' ? text.slice(cur, m) : prefix + text.slice(cur, m);
          first = false;
        } else {
          value += text.slice(cur, m);
        }
        added += m - cur;
        cur = m + 1;
        continue;
      }
      if (first) value = prefix === '' ? text.slice(cur, m) : prefix + text.slice(cur, m);
      else value += text.slice(cur, m);
      added += m - cur;
      if (kind === COMMA) {
        pos = m + 1;
        ended = COMMA;
        return value;
      }
      pos = m + 1;
      line += 1;
      ended = LB;
      return value;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Returns the value;
  // sets `ended`.
  function quoted() {
    const open = pos;
    const openLine = line;
    let p = pos + 1;
    let doubled = false;
    let q;
    for (;;) {
      q = text.indexOf('"', p);
      if (q === -1) {
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return unquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        doubled = true;
        p = q + 2;
        continue;
      }
      break;
    }
    let value;
    const iR = text.indexOf('\r', open + 1);
    const iN = text.indexOf('\n', open + 1);
    const hasBreak = (iR !== -1 && iR < q) || (iN !== -1 && iN < q);
    if (!doubled && !hasBreak) {
      value = text.slice(open + 1, q);
    } else {
      const parts = [];
      let cur = open + 1;
      let i = open + 1;
      while (i < q) {
        const c = text.charCodeAt(i);
        if (c === 34) {
          parts.push(text.slice(cur, i + 1));
          i += 2;
          cur = i;
          continue;
        }
        if (c === 13) {
          parts.push(text.slice(cur, i));
          parts.push('\n');
          line += 1;
          i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
          cur = i;
          continue;
        }
        if (c === 10) line += 1;
        i += 1;
      }
      parts.push(text.slice(cur, q));
      value = parts.join('');
    }
    pos = q + 1;
    if (pos >= n) {
      ended = END;
      return value;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      ended = COMMA;
      return value;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      ended = LB;
      return value;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      ended = LB;
      return value;
    }
    added = 0;
    const junk = unquoted(value);
    if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  for (;;) {
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
    do {
      if (text.charCodeAt(pos) === 34) {
        fields.push(quoted());
        lastQuoted = true;
      } else {
        fields.push(unquoted(''));
        lastQuoted = false;
      }
    } while (ended === COMMA);

    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
