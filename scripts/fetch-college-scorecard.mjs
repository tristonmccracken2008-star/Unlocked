import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import readline from "node:readline";

const downloadUrl = "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_05192025.zip";
const sourceUrl = "https://collegescorecard.ed.gov/data/";
const output = new URL("../data/db/college-scorecard.json", import.meta.url);

const programLabels = {
  PCIP01: "Agriculture", PCIP03: "Natural Resources", PCIP04: "Architecture", PCIP05: "Area & Identity Studies",
  PCIP09: "Communication", PCIP10: "Communications Technology", PCIP11: "Computer Science & IT", PCIP12: "Culinary & Personal Services",
  PCIP13: "Education", PCIP14: "Engineering", PCIP15: "Engineering Technology", PCIP16: "Languages",
  PCIP19: "Family & Consumer Sciences", PCIP22: "Legal Studies", PCIP23: "English", PCIP24: "Liberal Arts & Humanities",
  PCIP25: "Library Science", PCIP26: "Biology", PCIP27: "Mathematics & Statistics", PCIP29: "Military Technologies",
  PCIP30: "Interdisciplinary Studies", PCIP31: "Recreation & Fitness", PCIP38: "Philosophy & Religion", PCIP39: "Theology",
  PCIP40: "Physical Sciences", PCIP41: "Science Technologies", PCIP42: "Psychology", PCIP43: "Criminal Justice",
  PCIP44: "Public Policy & Social Service", PCIP45: "Social Sciences", PCIP46: "Construction", PCIP47: "Mechanic & Repair Technologies",
  PCIP48: "Precision Production", PCIP49: "Transportation", PCIP50: "Visual & Performing Arts", PCIP51: "Health Professions",
  PCIP52: "Business", PCIP54: "History",
};
const localeLabels = { 11: "Urban", 12: "Urban", 13: "Urban", 21: "Suburban", 22: "Suburban", 23: "Suburban", 31: "Town", 32: "Town", 33: "Town", 41: "Rural", 42: "Rural", 43: "Rural" };
const regionLabels = { 0: "U.S. service schools", 1: "New England", 2: "Mid-Atlantic", 3: "Great Lakes", 4: "Plains", 5: "Southeast", 6: "Southwest", 7: "Rocky Mountains", 8: "Far West", 9: "U.S. territories" };

function parseCsvRow(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else value += character;
  }
  values.push(value);
  return values;
}

const number = (value) => {
  const parsed = Number(value);
  return value !== "" && value !== "NA" && Number.isFinite(parsed) ? parsed : null;
};
const url = (value) => {
  if (!value || value === "NA") return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    parsed.protocol = "https:";
    return parsed.toString();
  } catch { return null; }
};
const slugify = (name, id) => `${name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90)}-${id}`;

const working = await mkdtemp(join(tmpdir(), "unlocked-scorecard-"));
try {
  const archive = join(working, "scorecard.zip");
  console.log("Downloading the official College Scorecard institution file…");
  const response = await fetch(downloadUrl, { headers: { "User-Agent": "UnlockED College Explorer data refresh" } });
  if (!response.ok || !response.body) throw new Error(`College Scorecard download failed: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));

  const unzip = spawn("unzip", ["-p", archive], { stdio: ["ignore", "pipe", "inherit"] });
  const lines = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let headers;
  let columns;
  const colleges = [];
  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvRow(line.replace(/^\uFEFF/, ""));
      columns = Object.fromEntries(headers.map((header, index) => [header, index]));
      continue;
    }
    const row = parseCsvRow(line);
    const get = (key) => row[columns[key]];
    const operating = number(get("CURROPER"));
    const main = number(get("MAIN"));
    const predominantDegree = number(get("PREDDEG"));
    const enrollment = number(get("UGDS"));
    if (operating !== 1 || main !== 1 || ![2, 3].includes(predominantDegree) || !enrollment) continue;

    const id = get("UNITID");
    const name = get("INSTNM");
    const control = number(get("CONTROL"));
    const programs = Object.entries(programLabels).flatMap(([key, label]) => {
      const share = number(get(key));
      return share && share > 0 ? [{ id: key.slice(4), label, share }] : [];
    }).sort((a, b) => b.share - a.share);
    colleges.push({
      id, slug: slugify(name, id), name,
      aliases: get("ALIAS") && get("ALIAS") !== "NA" ? get("ALIAS").split("|").map((item) => item.trim()).filter(Boolean) : [],
      city: get("CITY"), state: get("STABBR"), zip: get("ZIP"), website: url(get("INSTURL")), priceCalculatorUrl: url(get("NPCURL")),
      ownership: control === 1 ? "Public" : control === 2 ? "Private nonprofit" : "Private for-profit",
      setting: localeLabels[number(get("LOCALE"))] || null, region: regionLabels[number(get("REGION"))] || null,
      carnegieBasic: number(get("CCBASIC")), degreeLevel: predominantDegree === 2 ? "Associate" : "Bachelor's",
      hbcu: number(get("HBCU")) === 1, hsi: number(get("HSI")) === 1, womensCollege: number(get("WOMENONLY")) === 1,
      openAdmissions: number(get("OPENADMP")) === 1, undergraduateEnrollment: enrollment,
      studentFacultyRatio: number(get("STUFACR")), retentionRate: number(get(predominantDegree === 2 ? "RET_FTL4" : "RET_FT4")),
      acceptanceRate: number(get("ADM_RATE")), testRequirementCode: number(get("ADMCON7")),
      satReadingRange: [number(get("SATVR25")), number(get("SATVR75"))], satMathRange: [number(get("SATMT25")), number(get("SATMT75"))],
      actRange: [number(get("ACTCM25")), number(get("ACTCM75"))], tuitionInState: number(get("TUITIONFEE_IN")),
      tuitionOutOfState: number(get("TUITIONFEE_OUT")), roomAndBoard: number(get("ROOMBOARD_ON")), publishedTotalCost: number(get("COSTT4_A")),
      averageNetPrice: number(get(control === 1 ? "NPT4_PUB" : "NPT4_PRIV")),
      graduationRate: number(get(predominantDegree === 2 ? "C150_L4_POOLED_SUPP" : "C150_4_POOLED_SUPP")),
      medianEarnings10Years: number(get("MD_EARN_WNE_P10")), programs,
    });
  }
  const exitCode = await new Promise((resolve) => unzip.on("close", resolve));
  if (exitCode !== 0) throw new Error(`Unable to extract College Scorecard file (${exitCode})`);
  colleges.sort((a, b) => a.name.localeCompare(b.name));
  const payload = {
    metadata: {
      source: "U.S. Department of Education College Scorecard", sourceUrl, downloadUrl, releaseDate: "2025-05-19",
      retrievedAt: new Date().toISOString(), latestMetricsMayUseDifferentYears: true, records: colleges.length,
    }, colleges,
  };
  await writeFile(output, `${JSON.stringify(payload)}\n`);
  console.log(`Wrote ${colleges.length} colleges to ${output.pathname}`);
} finally {
  await rm(working, { recursive: true, force: true });
}
