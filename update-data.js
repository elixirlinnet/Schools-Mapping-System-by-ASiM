const fs = require("fs");
const path = require("path");

const root = __dirname;
const csvPath = path.join(root, "schools.csv");
const fallbackPath = path.join(root, "schools-data.js");
const parseCsv = require("./csv-parser.js");

const VALID_TEHSILS = new Set([
  "KHUSHAB",
  "NOORPUR THAL",
  "QUAIDABAD",
  "NAUSHEHRA"
]);

const VALID_CATEGORIES = new Set([
  "SED",
  "PSRP-I",
  "PSRP-II"
]);

function addIssue(issues, type, line, message){
  issues.push({ type, line, message });
}

function validateCsv(text){
  const issues = [];
  const rows = parseCsv(text);
  const schoolKeys = new Map();
  const fullRows = new Map();

  text.split(/\r?\n/).forEach((line, index) => {
    if(line.startsWith("<<<<<<<") || line.startsWith("=======") || line.startsWith(">>>>>>>")){
      addIssue(issues, "conflict-marker", index + 1, "Git conflict marker found.");
    }
  });

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const c = row.map(value => value.trim());

    if(c.every(value => value === "")){
      return;
    }

    if(c.length < 8){
      addIssue(issues, "invalid-row", line, "Row has fewer than 8 columns.");
      return;
    }

    const [tehsil, markaz, name, gender, level, category, latText, lngText] = c;
    const lat = Number.parseFloat(latText);
    const lng = Number.parseFloat(lngText);

    if(!tehsil || !markaz || !name || !gender || !level || !category){
      addIssue(issues, "missing-field", line, "Required school field is blank.");
    }

    if(!Number.isFinite(lat) || !Number.isFinite(lng)){
      addIssue(issues, "missing-coordinates", line, "Latitude or longitude is missing or invalid.");
    }
    else if(lat < -90 || lat > 90 || lng < -180 || lng > 180){
      addIssue(issues, "invalid-coordinates", line, "Latitude or longitude is outside valid range.");
    }

    if(tehsil && !VALID_TEHSILS.has(tehsil)){
      addIssue(issues, "invalid-tehsil", line, `Unknown tehsil "${tehsil}".`);
    }

    if(category && !VALID_CATEGORIES.has(category)){
      addIssue(issues, "invalid-category", line, `Unknown category "${category}".`);
    }

    const fullRowKey = c.join("|").toLowerCase();
    const schoolKey = [tehsil, markaz, name].join("|").toLowerCase();

    if(fullRows.has(fullRowKey)){
      addIssue(issues, "duplicate-row", line, `Duplicate full row also appears on line ${fullRows.get(fullRowKey)}.`);
    }
    else{
      fullRows.set(fullRowKey, line);
    }

    if(schoolKeys.has(schoolKey)){
      addIssue(issues, "duplicate-school", line, `Duplicate school identity also appears on line ${schoolKeys.get(schoolKey)}.`);
    }
    else{
      schoolKeys.set(schoolKey, line);
    }
  });

  return issues;
}

function printIssues(issues){
  const byType = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  console.error("CSV validation failed.");
  Object.keys(byType).sort().forEach(type => {
    console.error(`- ${type}: ${byType[type]}`);
  });

  console.error("");
  issues.slice(0, 30).forEach(issue => {
    console.error(`Line ${issue.line}: ${issue.message}`);
  });

  if(issues.length > 30){
    console.error(`...and ${issues.length - 30} more issue(s).`);
  }
}

const csv = fs.readFileSync(csvPath, "utf8");
const issues = validateCsv(csv);

if(issues.length > 0){
  printIssues(issues);
  process.exit(1);
}

fs.writeFileSync(
  fallbackPath,
  `// Generated from schools.csv for direct file-open fallback.\nwindow.SCHOOLS_CSV = ${JSON.stringify(csv)};\n`
);

console.log("CSV validation passed.");
console.log("schools-data.js regenerated from schools.csv.");
