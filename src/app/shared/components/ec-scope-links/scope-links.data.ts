// src/app/shared/components/ec-scope-links/scope-links.data.ts
//
// Country-specific links shown above result #1 while a country scope is active
// (see ec-scope-links.component.ts). Replaces the large VE "msheader" banner.
//
// KEY   = ISO 3166-1 alpha-2 code, lowercase — the same code as the flag file
//         (assets/images/flags/<code>.svg) and the scope's `key`.
// VALUE = the links that exist for that country, in display order. A country
//         with no entry (or an empty list) simply shows no strip.
//   kind  'guide'  → EC Library LibGuide   (compass icon)
//         'report' → DG ECFIN Country Report (document icon) — EU Member States only
//         'oecd'   → OECD country page or OECD search (chart icon)
//
// SOURCE: msheaders.zip (VE header snippets, Oct 2026), converted 1:1 except:
//   - ee Estonia : the VE file was a copy of Egypt's. Guide slug taken from the
//                  VE homepage; OECD URL follows the member-country pattern
//                  (unverified — check it).
//   - md Moldova : "hhttps://" typo fixed.
//   - de Germany : "germany.htm" → "germany.html" (pattern of all other members).
//   - tn Tunisia : the VE file's OECD link pointed to DR Congo and the second file
//                  had an empty link → guide only; slug "tunisia" (VE homepage)
//                  instead of "tunesia".
//   - cd DR Congo: two VE files; the one with the OECD link is used.
//   - bi Burundi, tm Turkmenistan: no VE file → guide link from the VE homepage.
//   - at/be/bg still point to data.oecd.org (retired by OECD) — may redirect or
//     break; replace when the new URLs are known.
//
// COUNTRY REPORTS (added Oct 2026): DG ECFIN publishes them for the 27 EU
// Member States only, at one fixed URL pattern, taken from
//   https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports_en
//   → .../country-pages-including-country-reports/country-report-<country>_en
// They are listed here statically (not fetched at runtime): a browser fetch from
// the Primo host would need CORS permission from that site (not expected for a
// Drupal page; unverified), would add a request to every scoped search, and the
// list only changes on EU enlargement.
// When a new Member State joins, add its 'report' line using the same pattern.
//
// To add or fix a country: edit its entry here; no other file needs to change.

export type ScopeLinkKind = 'guide' | 'report' | 'oecd';

export interface ScopeLink {
  kind: ScopeLinkKind;
  /** Visible link text. */
  label: string;
  /** Absolute URL; always opened in a new tab. */
  url: string;
}

export const SCOPE_LINKS: Readonly<Record<string, readonly ScopeLink[]>> = {
  al: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-albania" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/albania.html" },
  ],
  am: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-armenia" },
  ],
  at: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-austria" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-austria_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://data.oecd.org/austria.htm" },
  ],
  au: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-australia" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/australia.html" },
  ],
  az: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-azerbaijan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/azerbaijan.html" },
  ],
  ba: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-bosnia-and-herzegovina" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/bosnia-and-herzegovina.html" },
  ],
  be: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-belgium" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-belgium_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://data.oecd.org/belgium.htm" },
  ],
  bg: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-bulgaria" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-bulgaria_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://data.oecd.org/bulgaria.htm" },
  ],
  bi: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-burundi" },
  ],
  br: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-brazil" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/brazil.html" },
  ],
  ca: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-canada" },
    { kind: 'oecd', label: "OECD", url: "https://www.oecd.org/en/countries/canada.html" },
  ],
  cd: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-democratic-republic-of-congo" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/democratic-republic-of-congo.html" },
  ],
  ch: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-switzerland" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/switzerland.html" },
  ],
  ci: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-cote-d-ivoire" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Aciv%2Coecd-languages%3Aen" },
  ],
  cl: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-chile" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/chile.html" },
  ],
  cm: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-cameroon" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/cameroon.html" },
  ],
  cn: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-china" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/china-people-s-republic-of.html" },
  ],
  cy: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-cyprus" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-cyprus_en" },
  ],
  cz: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-czechia" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-czechia_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/czechia.html" },
  ],
  de: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-germany" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-germany_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/germany.html" },
  ],
  dk: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-denmark" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-denmark_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/denmark.html" },
  ],
  dz: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-algeria" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/algeria.html" },
  ],
  ee: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-estonia" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-estonia_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/estonia.html" },
  ],
  eg: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-egypt" },
    { kind: 'oecd', label: "OECD", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Aegy" },
  ],
  es: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-spain" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-spain_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/spain.html" },
  ],
  fi: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-finland" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-finland_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/finland.html" },
  ],
  fr: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-france" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-france_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/france.html" },
  ],
  gb: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-united-kingdom" },
    { kind: 'oecd', label: "OECD", url: "https://www.oecd.org/en/countries/united-kingdom.html" },
  ],
  ge: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-georgia" },
  ],
  gh: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-ghana" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Agha%2Coecd-languages%3Aen" },
  ],
  gl: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-greenland" },
    { kind: 'oecd', label: "OECD", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&q=greenland" },
  ],
  gr: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-greece" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-greece_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/greece.html" },
  ],
  hr: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-croatia" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-croatia_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/croatia.html" },
  ],
  hu: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-hungary" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-hungary_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/hungary.html" },
  ],
  id: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-indonesia/" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/indonesia.html" },
  ],
  ie: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-ireland" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-ireland_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/ireland.html" },
  ],
  in: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-india" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/india.html" },
  ],
  ir: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-iran" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Airn%2Coecd-languages%3Aen" },
  ],
  is: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-iceland" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/iceland.html" },
  ],
  it: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-italy" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-italy_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/italy.html" },
  ],
  jo: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-jordan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Ajor" },
  ],
  jp: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-japan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/japan.html" },
  ],
  ke: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-kenya" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Aken%2Coecd-languages%3Aen" },
  ],
  kg: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-kyrgyzstan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Akgz%2Coecd-languages%3Aen" },
  ],
  kr: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-rok" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/korea.html" },
  ],
  kz: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-kazakhstan" },
  ],
  lb: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-lebanon" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Albn%2Coecd-languages%3Aen" },
  ],
  lt: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-lithuania" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-lithuania_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/lithuania.html" },
  ],
  lu: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-luxembourg" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-luxembourg_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/luxembourg.html" },
  ],
  lv: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-latvia" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-latvia_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/latvia.html" },
  ],
  ly: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-libya" },
    { kind: 'oecd', label: "OECD", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Alby" },
  ],
  ma: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-morocco" },
  ],
  md: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-moldova" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/moldova.html" },
  ],
  me: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-montenegro" },
  ],
  mk: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-north-macedonia" },
  ],
  mt: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-malta" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-malta_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/malta.html" },
  ],
  mw: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-malawi" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Amwi%2Coecd-languages%3Aen" },
  ],
  mx: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-mexico" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/mexico.html" },
  ],
  na: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-namibia" },
  ],
  nl: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-netherlands" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-netherlands_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/netherlands.html" },
  ],
  no: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-norway" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/norway.html" },
  ],
  pk: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-pakistan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Apak%2Coecd-languages%3Aen" },
  ],
  pl: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-poland" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-poland_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/poland.html" },
  ],
  pt: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-portugal" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-portugal_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/portugal.html" },
  ],
  ro: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-romania" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-romania_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/romania.html" },
  ],
  rs: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-serbia" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Asrb%2Coecd-languages%3Aen" },
  ],
  ru: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-russia" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Arus%2Coecd-languages%3Aen" },
  ],
  se: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-sweden" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-sweden_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/sweden.html" },
  ],
  si: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-slovenia" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-slovenia_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/slovenia.html" },
  ],
  sk: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-slovakia" },
    { kind: 'report', label: "EC Country Report", url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/country-report-slovakia_en" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/slovakia.html" },
  ],
  sy: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-syria" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Asyr" },
  ],
  tj: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-tajikistan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Atjk%2Coecd-languages%3Aen" },
  ],
  tm: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-turkmenistan" },
  ],
  tn: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-tunisia" },
  ],
  tr: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-turkiye" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/turkiye.html" },
  ],
  ua: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-ukraine" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/ukraine.html" },
  ],
  ug: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-uganda" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Auga%2Coecd-languages%3Aen" },
  ],
  us: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-united-states" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/united-states.html" },
  ],
  uz: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-uzbekistan" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Auzb%2Coecd-languages%3Aen" },
  ],
  xk: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-kosovo" },
  ],
  za: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-south-africa" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/countries/south-africa.html" },
  ],
  zm: [
    { kind: 'guide', label: "EC Library guide", url: "https://ec-europa-eu.libguides.com/country-knowledge-zambia" },
    { kind: 'oecd', label: "OECD statistics", url: "https://www.oecd.org/en/search.html?orderBy=mostRelevant&page=0&facetTags=oecd-countries%3Azmb%2Coecd-languages%3Aen" },
  ],
};
