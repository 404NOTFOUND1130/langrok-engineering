// scripts/evalArticle.mjs (excerpt) — eval harness for the article extractor.
//
// The extractor is a hand-rolled heuristic and its failures are silent: the
// person just sees a mangled preview. This pins its behaviour on fixture pages
// so a regression fails loudly, and gives a quality report for any live URL.
//
//   node scripts/evalArticle.mjs                 # fixture suite (offline, CI-safe)
//   node scripts/evalArticle.mjs --live <url>…   # quality report for real pages

import { extractArticle } from '../server/articleProxy.js'

function report(article) {
  const paras = article.text ? article.text.split(/\n{2,}/) : []
  const lens = paras.map(p => p.length).sort((a, b) => a - b)
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0
  return {
    title: article.title || '(none)',
    chars: article.text?.length ?? 0,
    paras: paras.length,
    medianParaLen: median,
    // Many paragraphs, almost all short: the shape of a live-blog ticker,
    // not of an article worth importing. Same heuristic a UI hint would use.
    liveBlogSuspect: paras.length >= 8 && median < 90,
  }
}
// … fixtures: synthetic pages with known boilerplate, nav, comments and
// live-blog shapes; each asserts on title, char count and paragraph count.
