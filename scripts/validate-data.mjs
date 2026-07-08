import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, "data/db", file), "utf8"));
const curated = read("schools.json");
const imported = read("institutions.json");
const opportunities = read("opportunities.json");
const failures = [];

function normalize(value) { return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/^.*@/, "").replace(/[/?#].*$/, "").replace(/[.,]/g, "").replace(/[-_\s]+/g, " "); }
function generatedAliases(school) { const words=school.name.replace(/[^A-Za-z0-9 ]/g," ").split(/\s+/).filter((word)=>word&&!['of','the','at','and'].includes(word.toLowerCase()));const acronym=words.map((word)=>word[0]).join("").toUpperCase();const candidates=[...(school.aliases??[]),school.domain.split(".")[0]];if(acronym.length>=2&&acronym.length<=8)candidates.push(acronym);return[...new Set(candidates.filter(Boolean))] }
function text(value){return typeof value==="string"&&value.trim().length>0}
function duplicateKey(item){return normalize(`${item.type} ${item.title} ${item.organization}`)}
function hasKnownValue(item){return typeof item.estimated_value==="number"||text(item.metadata?.valueLabel)||text(item.metadata?.awardAmountLabel)||text(item.metadata?.studentOffer)}
function hasHowToClaimOrApply(item){return Boolean(item.metadata?.claimSteps?.length||item.metadata?.applicationRequirements?.length||text(item.metadata?.claimUrl)||text(item.official_source))}
function hasWhyItMatters(item){return Boolean(item.description?.length>=60&&(item.tags?.length>0||item.majors?.length>0||text(item.category)))}
function qualityCheck(item){const checks=[["official_source",text(item.official_source)&&item.official_source.startsWith("https://")],["estimated_value_or_unknown",hasKnownValue(item)||item.estimated_value===null],["eligibility",text(item.eligibility)],["category",text(item.category)],["description",text(item.description)&&item.description.length>=40],["why_it_matters_inputs",hasWhyItMatters(item)],["how_to_claim_or_apply",hasHowToClaimOrApply(item)],["verification_status",text(item.verification_status)],["last_verified",/^\d{4}-\d{2}-\d{2}$/.test(item.last_verified??"")]];return{complete:checks.every(([,passed])=>passed),missing:checks.filter(([,passed])=>!passed).map(([field])=>field)}}

const curatedDomains=new Set(curated.map((school)=>school.domain));
const schools=[...curated,...imported.filter((school)=>!curatedDomains.has(school.domain))].map((school)=>({...school,aliases:generatedAliases(school)}));
const schoolIds=new Set(schools.map((school)=>school.slug));
const seenSlugs=new Set();const seenDomains=new Set();const termsBySchool=new Map();
for(const school of schools){if(seenSlugs.has(school.slug))failures.push(`Duplicate school slug: ${school.slug}`);if(seenDomains.has(school.domain))failures.push(`Duplicate school domain: ${school.domain}`);seenSlugs.add(school.slug);seenDomains.add(school.domain);termsBySchool.set(school.slug,[school.name,school.domain,school.slug,...school.aliases].map(normalize).filter(Boolean))}
function search(query){const normalized=normalize(query);const exact=schools.filter((school)=>termsBySchool.get(school.slug).some((term)=>term===normalized));return exact.length?exact:schools.filter((school)=>termsBySchool.get(school.slug).some((term)=>term.includes(normalized)))}
for(const school of schools)for(const term of [school.name,school.domain,school.slug,...school.aliases])if(!search(term).some((result)=>result.slug===school.slug))failures.push(`Search term did not find ${school.slug}: ${term}`);

const ids=new Set();const types=new Set(["Benefit","AI","Career","Research","Scholarship"]);const required=["id","title","type","category","description","organization","school_scope","eligibility","location","official_source","verification_status","last_verified","date_added","icon"];
const duplicateGroups=new Map();const incomplete=[];
for(const item of opportunities){
  if(ids.has(item.id))failures.push(`Duplicate opportunity id: ${item.id}`);ids.add(item.id);
  const key=duplicateKey(item);duplicateGroups.set(key,[...(duplicateGroups.get(key)??[]),item.id]);
  for(const field of required)if(!item[field])failures.push(`Opportunity ${item.id} is missing ${field}`);
  for(const field of ["schools","majors","academic_years","tags"])if(!Array.isArray(item[field]))failures.push(`Opportunity ${item.id} has invalid ${field}`);
  for(const field of ["recurring","featured","hidden_gem"])if(typeof item[field]!=="boolean")failures.push(`Opportunity ${item.id} has invalid ${field}`);
  if(!types.has(item.type))failures.push(`Invalid opportunity type: ${item.id}`);
  if(!item.official_source?.startsWith("https://"))failures.push(`Opportunity source is not HTTPS: ${item.id}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.last_verified))failures.push(`Invalid verification date: ${item.id}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date_added))failures.push(`Invalid date added: ${item.id}`);
  if(item.school_scope==="School Specific"&&!item.schools.length)failures.push(`School-specific opportunity has no schools: ${item.id}`);
  for(const school of item.schools)if(!schoolIds.has(school))failures.push(`Opportunity ${item.id} references unknown school: ${school}`);
  if(item.application_deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(item.application_deadline))failures.push(`Invalid deadline: ${item.id}`);
  const quality=qualityCheck(item);if(!quality.complete)incomplete.push(`${item.id}: ${quality.missing.join(", ")}`);
}
for(const [key,ids] of duplicateGroups)if(ids.length>1)failures.push(`Duplicate opportunity content: ${key} (${ids.join(", ")})`);

const byType=Object.groupBy(opportunities,(item)=>item.type);
if((byType.Benefit?.length??0)!==36)failures.push("Benefit migration count mismatch");
if((byType.AI?.length??0)!==32)failures.push("AI migration count mismatch");
if((byType.Career?.length??0)!==62)failures.push("Career migration count mismatch");
if((byType.Research?.length??0)!==25)failures.push("Research migration count mismatch");
if((byType.Scholarship?.length??0)!==33)failures.push("Scholarship migration count mismatch");
const careerCategories=new Set(["Internships","Freshman Programs","Hackathons","Competitions","Fellowships","Conferences","Leadership Programs"]);
for(const category of careerCategories)if(!byType.Career?.some((item)=>item.category===category))failures.push(`Career category is empty: ${category}`);
for(const item of byType.Research??[]){if(!item.metadata?.department)failures.push(`Research opportunity missing department: ${item.id}`);if(!item.metadata?.researchArea)failures.push(`Research opportunity missing area: ${item.id}`);if(!Array.isArray(item.metadata?.semesters)||!item.metadata.semesters.length)failures.push(`Research opportunity missing semesters: ${item.id}`);if(!Object.hasOwn(item.metadata,"professor"))failures.push(`Research opportunity missing professor field: ${item.id}`);if(!Object.hasOwn(item.metadata,"stipendAmount"))failures.push(`Research opportunity missing stipend field: ${item.id}`)}
for(const item of byType.Scholarship??[]){if(!item.metadata?.awardAmountLabel)failures.push(`Scholarship missing award label: ${item.id}`);if(!Object.hasOwn(item.metadata,"renewable"))failures.push(`Scholarship missing renewable field: ${item.id}`);if(!Array.isArray(item.metadata?.applicationRequirements)||!item.metadata.applicationRequirements.length)failures.push(`Scholarship missing application requirements: ${item.id}`)}
if(opportunities.some((item)=>item.type==="Benefit"&&item.school_scope==="School Specific"&&item.schools.includes("northeastern-university")))failures.push("Northeastern has unreviewed school-specific benefits");

if(failures.length){console.error(failures.join("\n"));process.exit(1)}
const searchTermCount=[...termsBySchool.values()].reduce((sum,terms)=>sum+terms.length,0);
console.log(`Validated ${schools.length} schools and ${searchTermCount} searchable terms.`);
console.log(`Validated ${opportunities.length} unified opportunities: ${byType.Benefit.length} benefits, ${byType.AI.length} AI tools, ${byType.Career.length} career programs, ${byType.Research.length} research programs, and ${byType.Scholarship.length} scholarships.`);
console.log(`Content complete opportunities: ${opportunities.length-incomplete.length}/${opportunities.length}.`);
if(incomplete.length)console.warn(`Incomplete opportunities flagged for development review:\n${incomplete.slice(0,20).join("\n")}${incomplete.length>20?`\n...and ${incomplete.length-20} more.`:""}`);
