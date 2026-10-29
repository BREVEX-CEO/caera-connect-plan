async () => {
 function before(){const normal=text=>text.toLowerCase().replace(/\s+/g," ").trim();
const readsBack=action=>action?.action==="sheet_inspect"||action?.action==="file_extract"||action?.action==="file_info"||(action?.action==="media"&&action?.op==="state");
const affectsPath=()=>false;
const pathless=row=>typeof row.action?.path!=="string";
const samePath=(row,path)=>row.action?.path===path;
const READS_FILE=new Set(["file_read","file_extract","sheet_inspect"]);
const contentOf=()=>"";
const textOf=value=>typeof value==="string"?value:"";

function checkGap(rows, check) {
  const path = check.path ?? null;
  // What could have changed the target last: the file itself, or anything on the computer
  // without a path (a command, an app's window); for the screen or page, anything without a path.
  let last = -1;
  rows.forEach((row, at) => {
    if (readsBack(row.action)) return;
    if (path ? affectsPath(row, path) : pathless(row)) last = at;
  });
  const after = rows
    .slice(last + 1)
    .filter(
      (row) =>
        readsBack(row.action) &&
        row.status === "done" &&
        (path ? samePath(row, path) : pathless(row)),
    );
  const target = path ?? "the screen or page";
  if (check.pausedAt !== undefined) {
    // The player's own record, read after the last change to the page: never the model's word.
    const media = after
      .filter((row) => row.action?.action === "media")
      .map((row) => row.result?.detail?.media)
      .filter(Boolean)
      .at(-1);
    if (!media || typeof media.currentTime !== "number") {
      return "the page's video was not read with media state after its last change. Read it, then finish.";
    }
    if (media.paused !== true || Math.abs(media.currentTime - check.pausedAt) > 0.5) {
      return `the page's video is ${media.paused === true ? "paused" : "playing"} at ${media.currentTime} s, not paused at ${check.pausedAt} s. Fix it, or finish as failed and say what differs.`;
    }
    return null;
  }
  if (check.cell !== undefined) {
    const cell = check.cell.toUpperCase();
    const shows = after
      .filter((row) => row.action?.action === "sheet_inspect")
      .map((row) => cellIn(row.result?.detail?.workbook, check.sheet, cell))
      .filter((found) => found !== undefined);
    const latest = shows[shows.length - 1];
    if (!latest) {
      return `${cell} of ${target}${check.sheet ? ` (${check.sheet})` : ""} was not read after its last change. Read it with sheet_inspect, then finish.`;
    }
    if (!sameValue(latest.value, check.equals) && !sameValue(latest.formula, check.equals)) {
      return `${cell} of ${target} shows ${JSON.stringify(latest.value ?? latest.formula ?? null)}, not ${JSON.stringify(check.equals)}. Fix it, or finish as failed and say what differs.`;
    }
    return null;
  }
  const sheet = check.sheet;
  if (sheet !== undefined) {
    // A sheet the person asked for, as the device last read the workbook: there, and not empty.
    const book = after
      .filter((row) => row.action?.action === "sheet_inspect")
      .map((row) => row.result?.detail?.workbook)
      .filter(Boolean)
      .at(-1);
    if (!book) {
      return `${target} was not read with sheet_inspect after its last change. Read it, then finish.`;
    }
    const found = book.sheets?.find((s) => normal(String(s.name ?? "")) === normal(sheet));
    if (!found) return `${target} has no sheet named ${sheet}. Add it, or finish as failed.`;
    return sheetDataGap(found, target);
  }
  if (path && (check.minWords ?? check.maxWords) !== undefined) {
    // The device's own count of the saved file, never the model's or its generator's.
    const read = after.filter((row) => READS_FILE.has(row.action?.action ?? "")).at(-1);
    const detail = read?.result?.detail;
    const counted =
      typeof detail?.bodyWords === "number"
        ? detail.bodyWords
        : detail?.truncated || /\.(docx|docm|dotx|odt)$/i.test(path)
          ? undefined
          : textOf(detail?.content).split(/\s+/).filter(Boolean).length;
    if (!read || counted === undefined) {
      return `${target} was not read for its word count after its last change. Read it with file_extract (on an up-to-date connected device), then finish.`;
    }
    if (counted < (check.minWords ?? 0) || counted > (check.maxWords ?? Infinity)) {
      return `${target} holds ${counted} body words, not ${check.maxWords === undefined ? `at least ${check.minWords}` : check.minWords === undefined ? `at most ${check.maxWords}` : `${check.minWords} to ${check.maxWords}`}. Fix it, or finish as failed and say what differs.`;
    }
    if (!check.contains?.length) return null;
  }
  // There but holding nothing (no bytes, a model with no triangles) is not a finished result,
  // whatever else is checked (CAD-22-01: an empty export was reported done).
  const shape = after
    .filter((row) => row.action?.action === "file_info")
    .map(
      (row) =>
        row.result?.detail?.info,
    )
    .filter(Boolean)
    .at(-1);
  if (path && shape && (shape.size === 0 || shape.properties?.triangles === 0)) {
    return `${target} is empty. Make it again, or finish as failed and say why.`;
  }
  // What the device measured in the saved file (length, frame size, loudness, true peak):
  // a requested property is checked in the result, never taken from the model's word.
  for (const { name, ...range } of check.measures ?? []) {
    const value = (shape?.properties)?.[name];
    if (typeof value !== "number") {
      return `${target} was not measured for ${name} after its last change. Read it with file_info${/loudness|peak/i.test(name) ? " (audio: true)" : ""}, then finish.`;
    }
    if (value < (range.min ?? -Infinity) || value > (range.max ?? Infinity)) {
      return `${target} measures ${name} ${value}, not ${range.min ?? "…"} to ${range.max ?? "…"}. Fix it, or finish as failed and say what differs.`;
    }
  }
  const reads =
    path && check.contains?.length
      ? after.filter((row) => READS_FILE.has(row.action?.action ?? ""))
      : after;
  if (!reads.length) {
    return `${target} was not read${path && check.contains?.length ? " for its content" : ""} after its last change. Read it again, then finish.`;
  }
  // The latest read can contradict an earlier one even without a task mutation
  // (the person may have edited the file, or the page may have refreshed).
  const seen = normal(contentOf(reads[reads.length - 1]));
  const missing = check.contains?.find((text) => !seen.includes(normal(text)));
  return missing === undefined
    ? null
    : `"${missing.slice(0, 80)}" is not in ${target} as the device read it after its last change. Fix it, or finish as failed and say what differs.`;
}

function cellIn(
  workbook, sheet, cell,
) {
  const book = workbook;
  const wanted = sheet ?? book?.sheets?.[0]?.name;
  if (!book || !wanted || normal(String(book.sheet ?? "")) !== normal(wanted)) return undefined;
  for (const row of book.cells ?? []) {
    const found = row.find((item) => String(item.cell ?? "").toUpperCase() === cell);
    if (found) return found;
  }
  return {}; // read, and empty
}

/** Numbers by value, anything else as words. */
function sameValue(actual, wanted) {
  if (actual === undefined || actual === null || typeof actual === "boolean") {
    return actual != null && normal(String(actual)) === normal(wanted);
  }
  const a = Number(actual);
  const w = Number(wanted);
  if (String(actual).trim() && wanted.trim() && Number.isFinite(a) && Number.isFinite(w)) {
    return Math.abs(a - w) <= 1e-9 * Math.max(1, Math.abs(w));
  }
  return normal(String(actual)) === normal(wanted);
}

function sheetDataGap(sheet, path) {
  const count = sheet.filledRows;
  if (!Number.isSafeInteger(count) || count < 0) {
    return `the ${sheet.name} sheet of ${path} did not report a valid filledRows count. Update the connected device and read it with sheet_inspect, then finish.`;
  }
  return count < 2
    ? `the ${sheet.name} sheet of ${path} has no rows below its header. Fill it, or finish as failed and say why it is empty.`
    : null;
}

function workbook(name, value=2, names=[name], coordinate="B2") {
 return {sheet:name,sheets:names.map(name=>({name,filledRows:2})),
         cells:[[{cell:coordinate,value}]]};
}
function row(book) {return {status:"done",action:{action:"sheet_inspect",path:"orders.xlsx"},
                            result:{detail:{workbook:book}}};}
const check={path:"orders.xlsx",sheet:"Orders 2026",cell:"B2",equals:"2"};
const cases=[
 ["wrong sheet with doubled spaces",[row(workbook("Orders  2026"))],check,false],
 ["exact doubled spaces",[row(workbook("Orders  2026"))],{...check,sheet:"Orders  2026"},true],
 ["case-only sheet names",[row(workbook("ORDERS 2026"))],check,true],
 ["leading-space sheet is distinct",[row(workbook(" Orders 2026"))],check,false],
 ["deleted requested sheet invalidates old proof",[row(workbook("Orders 2026")),row(workbook("Other",7))],check,false],
 ["renamed requested sheet invalidates old proof",[row(workbook("Orders 2026")),row(workbook("Renamed",7))],check,false],
 ["another sheet read does not contradict existing proof",[row(workbook("Orders 2026",2,["Orders 2026","Other"])),row(workbook("Other",7,["Orders 2026","Other"]))],check,true],
 ["empty latest inventory invalidates old proof",[row(workbook("Orders 2026")),row(workbook("Other",7,[]))],check,false],
 ["missing latest inventory is not a fresh oracle",[row(workbook("Orders 2026")),row({sheet:"Other",cells:[]})],check,false],
 ["default first sheet follows latest inventory",[row(workbook("Orders 2026")),row(workbook("Orders 2026",2,["Other","Orders 2026"]))],{path:"orders.xlsx",cell:"B2",equals:"2"},false],
 ["array is not a scalar value",[row(workbook("Orders 2026",[2]))],check,false],
 ["numeric strings compare by value",[row(workbook("Orders 2026","2.0"))],check,true],
 ["boolean scalar",[row(workbook("Orders 2026",true))],{...check,equals:"true"},true],
 ["missing value is not zero",[row(workbook("Orders 2026",null))],{...check,equals:"0"},false],
 ["value in wrong row",[row(workbook("Orders 2026",2,["Orders 2026"],"B3"))],check,false],
 ["latest contradictory value wins",[row(workbook("Orders 2026")),row(workbook("Orders 2026",9))],check,false],
 ["sheet-only whitespace identity",[row(workbook("Orders  2026"))],{path:"orders.xlsx",sheet:"Orders 2026"},false],
 ["sheet-only exact populated",[row(workbook("Orders 2026"))],{path:"orders.xlsx",sheet:"Orders 2026"},true],
 ["sheet-only case insensitive",[row(workbook("ORDERS 2026"))],{path:"orders.xlsx",sheet:"Orders 2026"},true],

 ["recreated name does not restore old proof",[row(workbook("Orders 2026",2,["Orders 2026","Other"])),row(workbook("Other",7,["Other"])),row(workbook("Other",7,["Orders 2026","Other"]))],check,false],
 ["fresh reread after recreation proves current cell",[row(workbook("Orders 2026",2,["Orders 2026","Other"])),row(workbook("Other",7,["Other"])),row(workbook("Other",7,["Orders 2026","Other"])),row(workbook("Orders 2026",2,["Orders 2026","Other"]))],check,true],
 ["malformed intermediate inventory invalidates old proof",[row(workbook("Orders 2026")),row({sheet:"Other",cells:[]}),row(workbook("Other",7,["Orders 2026","Other"]))],check,false],
 ["default first-sheet recreation needs fresh proof",[row(workbook("Orders 2026")),row(workbook("Other",7,["Other","Orders 2026"])),row(workbook("Other",7,["Orders 2026","Other"]))],{path:"orders.xlsx",cell:"B2",equals:"2"},false],

 ["malformed historical default name invalidates proof",[row(workbook("Orders 2026")),row(workbook("Other",7,[42])),row(workbook("Other",7,["Orders 2026","Other"]))],{path:"orders.xlsx",cell:"B2",equals:"2"},false],
 ["malformed cell grid is not proof",[row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:{value:2}})],check,false],
 ["malformed row is not proof",[row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:[{cell:"B2",value:2}]})],check,false],

 ["missing current target cells cannot revive old proof",[row(workbook("Orders 2026")),row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}]})],check,false],
 ["malformed current target row cannot revive old proof",[row(workbook("Orders 2026")),row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:[{cell:"B2",value:2}]})],check,false],
 ["ambiguous duplicate target coordinates cannot select first",[row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:[[{cell:"B2",value:2},{cell:"B2",value:9}]]})],check,false],
 ["unidentified selected sheet cannot revive old proof",[row(workbook("Orders 2026")),row({sheets:[{name:"Orders 2026"}],cells:[]})],check,false],
 ["empty selected name cannot revive old proof",[row(workbook("Orders 2026")),row({...workbook("Orders 2026"),sheet:""})],check,false],
 ["selected name absent from inventory cannot revive old proof",[row(workbook("Orders 2026")),row({...workbook("Orders 2026"),sheet:"Ghost"})],check,false],
 ["no workbook is no proof",[row(undefined)],check,false]
];

const evidence=(action,detail,op)=>({status:"done",action:{action,path:action==="media"?undefined:"orders.xlsx",...(op?{op}:{})},result:{detail}});
for(const value of [NaN,Infinity,-Infinity,-0.1]) cases.push(["invalid media time "+String(value),[evidence("media",{media:{paused:true,currentTime:value}},"state")],{pausedAt:0},false]);
for(const value of [0,0.5]) cases.push(["valid media time "+value,[evidence("media",{media:{paused:true,currentTime:value}},"state")],{pausedAt:0},true]);
for(const value of [NaN,Infinity,-Infinity,-1,1.5]) cases.push(["invalid body count "+String(value),[evidence("file_extract",{bodyWords:value})],{path:"orders.xlsx",maxWords:10},false]);
for(const value of [0,10]) cases.push(["valid body count "+value,[evidence("file_extract",{bodyWords:value})],{path:"orders.xlsx",maxWords:10},true]);
for(const value of [NaN,Infinity,-Infinity]) cases.push(["invalid measured property "+String(value),[evidence("file_info",{info:{size:10,properties:{pages:value}}})],{path:"orders.xlsx",measures:[{name:"pages",min:1}]},false]);
cases.push(["valid measured property",[evidence("file_info",{info:{size:10,properties:{pages:2}}})],{path:"orders.xlsx",measures:[{name:"pages",min:1}]},true]);


const video=(media)=>evidence("media",{media},"state");
const prop=(info)=>evidence("file_info",{info});
for(const value of [undefined,null]) {
 cases.push(["latest missing media "+String(value)+" invalidates old proof",[video({paused:true,currentTime:0}),video(value)],{pausedAt:0},false]);
 cases.push(["latest missing sheet inventory "+String(value)+" invalidates sheet-only proof",[row(workbook("Orders 2026")),row(value)],{path:"orders.xlsx",sheet:"Orders 2026"},false]);
 cases.push(["latest missing file info "+String(value)+" invalidates old measured proof",[prop({size:10,properties:{pages:2}}),prop(value)],{path:"orders.xlsx",measures:[{name:"pages",min:1}]},false]);
}
for(const detail of [{},{content:null},{content:"a",truncated:true}]) cases.push(["missing or truncated plaintext content "+JSON.stringify(detail),[evidence("file_extract",detail)],{path:"orders.xlsx",maxWords:10},false]);
cases.push(["actual empty plaintext content is a zero count",[evidence("file_extract",{content:""})],{path:"orders.xlsx",maxWords:10},true]);
cases.push(["actual plaintext content is counted",[evidence("file_extract",{content:"one two"})],{path:"orders.xlsx",minWords:2,maxWords:2},true]);


const infoCases=[["missing metadata is not existence proof",null,false],["null metadata is not existence proof",null,false],["array metadata is not existence proof",[],false],["negative file size is not existence proof",{"size":-1},false],["string file size is not existence proof",{"size":"10"},false],["fractional file size is not existence proof",{"size":1.5},false],["nonfinite file size is not existence proof",{"size":"__INFINITY__"},false],["valid metadata proves file exists",{"size":10},true],["empty folder metadata proves folder exists",{"size":0,"folder":true},true],["empty file is not a finished deliverable",{"size":0,"folder":false},false]];
for(const [name,raw,accepted]of infoCases){const info=raw&&raw.size==="__INFINITY__"?{size:Infinity}:raw;cases.push([name,[evidence("file_info",{info})],{path:"orders.xlsx"},accepted]);}

const rows=[];
for(const [name,actions,check,wanted] of cases) {
 try {const result=checkGap(actions,check);rows.push({name,pass:(result===null)===wanted,result});}
 catch(e){rows.push({name,pass:false,error:String(e)});}
}
return {passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,cases:rows};}
 function after(){const normal=text=>text.toLowerCase().replace(/\s+/g," ").trim();
const readsBack=action=>action?.action==="sheet_inspect"||action?.action==="file_extract"||action?.action==="file_info"||(action?.action==="media"&&action?.op==="state");
const affectsPath=()=>false;
const pathless=row=>typeof row.action?.path!=="string";
const samePath=(row,path)=>row.action?.path===path;
const READS_FILE=new Set(["file_read","file_extract","sheet_inspect"]);
const contentOf=()=>"";
const textOf=value=>typeof value==="string"?value:"";

function checkGap(rows, check) {
  const path = check.path ?? null;
  // What could have changed the target last: the file itself, or anything on the computer
  // without a path (a command, an app's window); for the screen or page, anything without a path.
  let last = -1;
  rows.forEach((row, at) => {
    if (readsBack(row.action)) return;
    if (path ? affectsPath(row, path) : pathless(row)) last = at;
  });
  const after = rows
    .slice(last + 1)
    .filter(
      (row) =>
        readsBack(row.action) &&
        row.status === "done" &&
        (path ? samePath(row, path) : pathless(row)),
    );
  const target = path ?? "the screen or page";
  if (check.pausedAt !== undefined) {
    // The player's own record, read after the last change to the page: never the model's word.
    const media = after
      .filter((row) => row.action?.action === "media")
      .map((row) => row.result?.detail?.media)
      .at(-1);
    if (
      !media ||
      typeof media.currentTime !== "number" ||
      !Number.isFinite(media.currentTime) ||
      media.currentTime < 0
    ) {
      return "the page's video was not read with media state after its last change. Read it, then finish.";
    }
    if (media.paused !== true || Math.abs(media.currentTime - check.pausedAt) > 0.5) {
      return `the page's video is ${media.paused === true ? "paused" : "playing"} at ${media.currentTime} s, not paused at ${check.pausedAt} s. Fix it, or finish as failed and say what differs.`;
    }
    return null;
  }
  if (check.cell !== undefined) {
    const cell = check.cell.toUpperCase();
    const inspections = after.filter((row) => row.action?.action === "sheet_inspect");
    const latestBook = inspections.at(-1)?.result?.detail?.workbook;
    if (!Array.isArray(latestBook?.sheets)) {
      return `${target} has no current sheet inventory. Read it with sheet_inspect, then finish.`;
    }
    const wanted = check.sheet ?? latestBook.sheets[0]?.name;
    if (
      typeof wanted !== "string" ||
      !wanted ||
      !latestBook.sheets.some((sheet) => typeof sheet?.name === "string" && sheet.name.toLowerCase() === wanted.toLowerCase())
    ) {
      return `${target} has no sheet named ${wanted ?? "(first sheet)"}. Read the correct workbook, or finish as failed.`;
    }
    // A name reappearing after deletion does not resurrect proof from its old sheet.
    // Preserve cross-sheet reads only while the inventory continuously retains this identity.
    const invalidated = inspections.reduce((lastInvalidated, row, index) => {
      const book = row.result?.detail?.workbook;
      const first = Array.isArray(book?.sheets) ? book.sheets[0]?.name : undefined;
      const stale =
        !Array.isArray(book?.sheets) ||
        !book.sheets.some(
          (sheet) =>
            typeof sheet?.name === "string" && sheet.name.toLowerCase() === wanted.toLowerCase(),
        ) ||
        (check.sheet === undefined &&
          (typeof first !== "string" || first.toLowerCase() !== wanted.toLowerCase()));
      return stale ? index : lastInvalidated;
    }, -1);
    const shows = inspections
      .slice(invalidated + 1)
      .map((row) => cellIn(row.result?.detail?.workbook, wanted, cell))
      .filter((found) => found !== undefined);
    const latest = shows[shows.length - 1];
    if (!latest) {
      return `${cell} of ${target}${check.sheet ? ` (${check.sheet})` : ""} was not read after its last change. Read it with sheet_inspect, then finish.`;
    }
    if (!sameValue(latest.value, check.equals) && !sameValue(latest.formula, check.equals)) {
      return `${cell} of ${target} shows ${JSON.stringify(latest.value ?? latest.formula ?? null)}, not ${JSON.stringify(check.equals)}. Fix it, or finish as failed and say what differs.`;
    }
    return null;
  }
  const sheet = check.sheet;
  if (sheet !== undefined) {
    // A sheet the person asked for, as the device last read the workbook: there, and not empty.
    const book = after
      .filter((row) => row.action?.action === "sheet_inspect")
      .map((row) => row.result?.detail?.workbook)
      .at(-1);
    if (!book || !Array.isArray(book.sheets)) {
      return `${target} was not read with sheet_inspect after its last change. Read it, then finish.`;
    }
    const found = book.sheets?.find(
      (s) => typeof s?.name === "string" && s.name.toLowerCase() === sheet.toLowerCase(),
    );
    if (!found) return `${target} has no sheet named ${sheet}. Add it, or finish as failed.`;
    return sheetDataGap(found, target);
  }
  if (path && (check.minWords ?? check.maxWords) !== undefined) {
    // The device's own count of the saved file, never the model's or its generator's.
    const read = after.filter((row) => READS_FILE.has(row.action?.action ?? "")).at(-1);
    const detail = read?.result?.detail;
    const counted =
      typeof detail?.bodyWords === "number"
        ? detail.bodyWords
        : detail?.truncated ||
            typeof detail?.content !== "string" ||
            /\.(docx|docm|dotx|odt)$/i.test(path)
          ? undefined
          : textOf(detail?.content).split(/\s+/).filter(Boolean).length;
    if (!read || !Number.isSafeInteger(counted) || counted < 0) {
      return `${target} was not read for its word count after its last change. Read it with file_extract (on an up-to-date connected device), then finish.`;
    }
    if (counted < (check.minWords ?? 0) || counted > (check.maxWords ?? Infinity)) {
      return `${target} holds ${counted} body words, not ${check.maxWords === undefined ? `at least ${check.minWords}` : check.minWords === undefined ? `at most ${check.maxWords}` : `${check.minWords} to ${check.maxWords}`}. Fix it, or finish as failed and say what differs.`;
    }
    if (!check.contains?.length) return null;
  }
  // There but holding nothing (no bytes, a model with no triangles) is not a finished result,
  // whatever else is checked (CAD-22-01: an empty export was reported done).
  const shape = after
    .filter((row) => row.action?.action === "file_info")
    .map(
      (row) =>
        row.result?.detail?.info,
    )
    .at(-1);
  if (
    path &&
    after.at(-1)?.action?.action === "file_info" &&
    (!shape ||
      typeof shape !== "object" ||
      Array.isArray(shape) ||
      typeof shape.size !== "number" ||
      !Number.isSafeInteger(shape.size) ||
      shape.size < 0)
  ) {
    return `${target} did not report valid file metadata. Read it with file_info, then finish.`;
  }
  if (path && shape && ((shape.folder !== true && shape.size === 0) || shape.properties?.triangles === 0)) {
    return `${target} is empty. Make it again, or finish as failed and say why.`;
  }
  // What the device measured in the saved file (length, frame size, loudness, true peak):
  // a requested property is checked in the result, never taken from the model's word.
  for (const { name, ...range } of check.measures ?? []) {
    const value = (shape?.properties)?.[name];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${target} was not measured for ${name} after its last change. Read it with file_info${/loudness|peak/i.test(name) ? " (audio: true)" : ""}, then finish.`;
    }
    if (value < (range.min ?? -Infinity) || value > (range.max ?? Infinity)) {
      return `${target} measures ${name} ${value}, not ${range.min ?? "…"} to ${range.max ?? "…"}. Fix it, or finish as failed and say what differs.`;
    }
  }
  const reads =
    path && check.contains?.length
      ? after.filter((row) => READS_FILE.has(row.action?.action ?? ""))
      : after;
  if (!reads.length) {
    return `${target} was not read${path && check.contains?.length ? " for its content" : ""} after its last change. Read it again, then finish.`;
  }
  // The latest read can contradict an earlier one even without a task mutation
  // (the person may have edited the file, or the page may have refreshed).
  const seen = normal(contentOf(reads[reads.length - 1]));
  const missing = check.contains?.find((text) => !seen.includes(normal(text)));
  return missing === undefined
    ? null
    : `"${missing.slice(0, 80)}" is not in ${target} as the device read it after its last change. Fix it, or finish as failed and say what differs.`;
}

function cellIn(
  workbook, sheet, cell,
) {
  const book = workbook;
  const wanted = sheet ?? book?.sheets?.[0]?.name;
  if (!book || !wanted || typeof book.sheet !== "string" || !book.sheet) return {};
  if (
    !Array.isArray(book.sheets) ||
    !book.sheets.some(
      (entry) => typeof entry?.name === "string" && entry.name.toLowerCase() === book.sheet.toLowerCase(),
    )
  ) return {};
  if (book.sheet.toLowerCase() !== wanted.toLowerCase()) return undefined;
  // Malformed evidence for the requested sheet invalidates older proof; only an
  // explicit different selected sheet is irrelevant to this cell.
  if (!Array.isArray(book.cells)) return {};
  let found;
  for (const row of book.cells) {
    if (!Array.isArray(row)) return {};
    for (const item of row) {
      if (!item || typeof item.cell !== "string") return {};
      if (item.cell.toUpperCase() !== cell) continue;
      if (found) return {}; // duplicate coordinates cannot select the first value
      found = item;
    }
  }
  return found ?? {}; // read, and empty
}

/** Numbers by value, anything else as words. */
function sameValue(actual, wanted) {
  if (typeof actual === "number" && !Number.isFinite(actual)) return false;
  if (actual != null && !["string", "number", "boolean"].includes(typeof actual)) return false;
  if (actual === undefined || actual === null || typeof actual === "boolean") {
    return actual != null && normal(String(actual)) === normal(wanted);
  }
  const a = Number(actual);
  const w = Number(wanted);
  if (String(actual).trim() && wanted.trim() && Number.isFinite(a) && Number.isFinite(w)) {
    return Math.abs(a - w) <= 1e-9 * Math.max(1, Math.abs(w));
  }
  return normal(String(actual)) === normal(wanted);
}

function sheetDataGap(sheet, path) {
  const count = sheet.filledRows;
  if (!Number.isSafeInteger(count) || count < 0) {
    return `the ${sheet.name} sheet of ${path} did not report a valid filledRows count. Update the connected device and read it with sheet_inspect, then finish.`;
  }
  return count < 2
    ? `the ${sheet.name} sheet of ${path} has no rows below its header. Fill it, or finish as failed and say why it is empty.`
    : null;
}
function workbook(name, value=2, names=[name], coordinate="B2") {
 return {sheet:name,sheets:names.map(name=>({name,filledRows:2})),
         cells:[[{cell:coordinate,value}]]};
}
function row(book) {return {status:"done",action:{action:"sheet_inspect",path:"orders.xlsx"},
                            result:{detail:{workbook:book}}};}
const check={path:"orders.xlsx",sheet:"Orders 2026",cell:"B2",equals:"2"};
const cases=[
 ["wrong sheet with doubled spaces",[row(workbook("Orders  2026"))],check,false],
 ["exact doubled spaces",[row(workbook("Orders  2026"))],{...check,sheet:"Orders  2026"},true],
 ["case-only sheet names",[row(workbook("ORDERS 2026"))],check,true],
 ["leading-space sheet is distinct",[row(workbook(" Orders 2026"))],check,false],
 ["deleted requested sheet invalidates old proof",[row(workbook("Orders 2026")),row(workbook("Other",7))],check,false],
 ["renamed requested sheet invalidates old proof",[row(workbook("Orders 2026")),row(workbook("Renamed",7))],check,false],
 ["another sheet read does not contradict existing proof",[row(workbook("Orders 2026",2,["Orders 2026","Other"])),row(workbook("Other",7,["Orders 2026","Other"]))],check,true],
 ["empty latest inventory invalidates old proof",[row(workbook("Orders 2026")),row(workbook("Other",7,[]))],check,false],
 ["missing latest inventory is not a fresh oracle",[row(workbook("Orders 2026")),row({sheet:"Other",cells:[]})],check,false],
 ["default first sheet follows latest inventory",[row(workbook("Orders 2026")),row(workbook("Orders 2026",2,["Other","Orders 2026"]))],{path:"orders.xlsx",cell:"B2",equals:"2"},false],
 ["array is not a scalar value",[row(workbook("Orders 2026",[2]))],check,false],
 ["numeric strings compare by value",[row(workbook("Orders 2026","2.0"))],check,true],
 ["boolean scalar",[row(workbook("Orders 2026",true))],{...check,equals:"true"},true],
 ["missing value is not zero",[row(workbook("Orders 2026",null))],{...check,equals:"0"},false],
 ["value in wrong row",[row(workbook("Orders 2026",2,["Orders 2026"],"B3"))],check,false],
 ["latest contradictory value wins",[row(workbook("Orders 2026")),row(workbook("Orders 2026",9))],check,false],
 ["sheet-only whitespace identity",[row(workbook("Orders  2026"))],{path:"orders.xlsx",sheet:"Orders 2026"},false],
 ["sheet-only exact populated",[row(workbook("Orders 2026"))],{path:"orders.xlsx",sheet:"Orders 2026"},true],
 ["sheet-only case insensitive",[row(workbook("ORDERS 2026"))],{path:"orders.xlsx",sheet:"Orders 2026"},true],

 ["recreated name does not restore old proof",[row(workbook("Orders 2026",2,["Orders 2026","Other"])),row(workbook("Other",7,["Other"])),row(workbook("Other",7,["Orders 2026","Other"]))],check,false],
 ["fresh reread after recreation proves current cell",[row(workbook("Orders 2026",2,["Orders 2026","Other"])),row(workbook("Other",7,["Other"])),row(workbook("Other",7,["Orders 2026","Other"])),row(workbook("Orders 2026",2,["Orders 2026","Other"]))],check,true],
 ["malformed intermediate inventory invalidates old proof",[row(workbook("Orders 2026")),row({sheet:"Other",cells:[]}),row(workbook("Other",7,["Orders 2026","Other"]))],check,false],
 ["default first-sheet recreation needs fresh proof",[row(workbook("Orders 2026")),row(workbook("Other",7,["Other","Orders 2026"])),row(workbook("Other",7,["Orders 2026","Other"]))],{path:"orders.xlsx",cell:"B2",equals:"2"},false],

 ["malformed historical default name invalidates proof",[row(workbook("Orders 2026")),row(workbook("Other",7,[42])),row(workbook("Other",7,["Orders 2026","Other"]))],{path:"orders.xlsx",cell:"B2",equals:"2"},false],
 ["malformed cell grid is not proof",[row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:{value:2}})],check,false],
 ["malformed row is not proof",[row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:[{cell:"B2",value:2}]})],check,false],

 ["missing current target cells cannot revive old proof",[row(workbook("Orders 2026")),row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}]})],check,false],
 ["malformed current target row cannot revive old proof",[row(workbook("Orders 2026")),row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:[{cell:"B2",value:2}]})],check,false],
 ["ambiguous duplicate target coordinates cannot select first",[row({sheet:"Orders 2026",sheets:[{name:"Orders 2026"}],cells:[[{cell:"B2",value:2},{cell:"B2",value:9}]]})],check,false],
 ["unidentified selected sheet cannot revive old proof",[row(workbook("Orders 2026")),row({sheets:[{name:"Orders 2026"}],cells:[]})],check,false],
 ["empty selected name cannot revive old proof",[row(workbook("Orders 2026")),row({...workbook("Orders 2026"),sheet:""})],check,false],
 ["selected name absent from inventory cannot revive old proof",[row(workbook("Orders 2026")),row({...workbook("Orders 2026"),sheet:"Ghost"})],check,false],
 ["no workbook is no proof",[row(undefined)],check,false]
];

const evidence=(action,detail,op)=>({status:"done",action:{action,path:action==="media"?undefined:"orders.xlsx",...(op?{op}:{})},result:{detail}});
for(const value of [NaN,Infinity,-Infinity,-0.1]) cases.push(["invalid media time "+String(value),[evidence("media",{media:{paused:true,currentTime:value}},"state")],{pausedAt:0},false]);
for(const value of [0,0.5]) cases.push(["valid media time "+value,[evidence("media",{media:{paused:true,currentTime:value}},"state")],{pausedAt:0},true]);
for(const value of [NaN,Infinity,-Infinity,-1,1.5]) cases.push(["invalid body count "+String(value),[evidence("file_extract",{bodyWords:value})],{path:"orders.xlsx",maxWords:10},false]);
for(const value of [0,10]) cases.push(["valid body count "+value,[evidence("file_extract",{bodyWords:value})],{path:"orders.xlsx",maxWords:10},true]);
for(const value of [NaN,Infinity,-Infinity]) cases.push(["invalid measured property "+String(value),[evidence("file_info",{info:{size:10,properties:{pages:value}}})],{path:"orders.xlsx",measures:[{name:"pages",min:1}]},false]);
cases.push(["valid measured property",[evidence("file_info",{info:{size:10,properties:{pages:2}}})],{path:"orders.xlsx",measures:[{name:"pages",min:1}]},true]);


const video=(media)=>evidence("media",{media},"state");
const prop=(info)=>evidence("file_info",{info});
for(const value of [undefined,null]) {
 cases.push(["latest missing media "+String(value)+" invalidates old proof",[video({paused:true,currentTime:0}),video(value)],{pausedAt:0},false]);
 cases.push(["latest missing sheet inventory "+String(value)+" invalidates sheet-only proof",[row(workbook("Orders 2026")),row(value)],{path:"orders.xlsx",sheet:"Orders 2026"},false]);
 cases.push(["latest missing file info "+String(value)+" invalidates old measured proof",[prop({size:10,properties:{pages:2}}),prop(value)],{path:"orders.xlsx",measures:[{name:"pages",min:1}]},false]);
}
for(const detail of [{},{content:null},{content:"a",truncated:true}]) cases.push(["missing or truncated plaintext content "+JSON.stringify(detail),[evidence("file_extract",detail)],{path:"orders.xlsx",maxWords:10},false]);
cases.push(["actual empty plaintext content is a zero count",[evidence("file_extract",{content:""})],{path:"orders.xlsx",maxWords:10},true]);
cases.push(["actual plaintext content is counted",[evidence("file_extract",{content:"one two"})],{path:"orders.xlsx",minWords:2,maxWords:2},true]);


const infoCases=[["missing metadata is not existence proof",null,false],["null metadata is not existence proof",null,false],["array metadata is not existence proof",[],false],["negative file size is not existence proof",{"size":-1},false],["string file size is not existence proof",{"size":"10"},false],["fractional file size is not existence proof",{"size":1.5},false],["nonfinite file size is not existence proof",{"size":"__INFINITY__"},false],["valid metadata proves file exists",{"size":10},true],["empty folder metadata proves folder exists",{"size":0,"folder":true},true],["empty file is not a finished deliverable",{"size":0,"folder":false},false]];
for(const [name,raw,accepted]of infoCases){const info=raw&&raw.size==="__INFINITY__"?{size:Infinity}:raw;cases.push([name,[evidence("file_info",{info})],{path:"orders.xlsx"},accepted]);}

const rows=[];
for(const [name,actions,check,wanted] of cases) {
 try {const result=checkGap(actions,check);rows.push({name,pass:(result===null)===wanted,result});}
 catch(e){rows.push({name,pass:false,error:String(e)});}
}
return {passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,cases:rows};}
 return {classification:"EXACT CHECKGAP AND SHEET HELPERS WITH TYPE-ONLY ERASURE; CONTROLLED READ-ONLY ACTION FIXTURES",before:before(),after:after(),nativeRecalculation:false,networkRequests:0,resourceMutations:0};
}

