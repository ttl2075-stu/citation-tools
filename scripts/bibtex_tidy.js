const tidy = require("bibtex-tidy");

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function normalizeOptions(rawOptions) {
  const options = rawOptions && typeof rawOptions === "object" ? rawOptions : {};
  const duplicateRules = ["doi", "key", "abstract", "citation"];
  const mergeModes = ["first", "last", "combine", "overwrite"];

  return {
    curly: !!options.curly,
    numeric: options.numeric !== false,
    months: !!options.months,
    space: Number.isFinite(Number(options.space)) ? Number(options.space) : 2,
    align: options.align === false ? false : Number.isFinite(Number(options.align)) ? Number(options.align) : 14,
    blankLines: options.blankLines !== false,
    sort: options.sort ? ["key"] : false,
    duplicates: Array.isArray(options.duplicates)
      ? options.duplicates.filter((item) => duplicateRules.includes(item))
      : true,
    merge: mergeModes.includes(options.merge) ? options.merge : false,
    stripEnclosingBraces: !!options.stripEnclosingBraces,
    dropAllCaps: !!options.dropAllCaps,
    escape: options.escape !== false,
    sortFields: !!options.sortFields,
    stripComments: !!options.stripComments,
    trailingCommas: !!options.trailingCommas,
    encodeUrls: !!options.encodeUrls,
    tidyComments: true,
    removeEmptyFields: options.removeEmptyFields !== false,
    removeDuplicateFields: options.removeDuplicateFields !== false,
    lowercase: options.lowercase !== false,
    wrap: Number.isFinite(Number(options.wrap)) && Number(options.wrap) > 0 ? Number(options.wrap) : false,
  };
}

readStdin()
  .then((input) => {
    const payload = JSON.parse(input || "{}");
    const result = tidy.tidy(String(payload.bibtex || ""), normalizeOptions(payload.options));
    process.stdout.write(JSON.stringify(result));
  })
  .catch((error) => {
    process.stderr.write(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
