# Recall — companion project

Recall turns your own material (photographed pages, PDFs, Word files, pasted text) into the few spaced-repetition cards you should review today. Same stack as Langrok (React, Vite, Hono, Supabase), separate codebase, started September 2026.

## The import pipeline

The first version was serial: read the whole file, OCR page by page, then clean, verify and generate questions step by step, all with thinking mode on, behind a single "processing" spinner. The rewrite:

- **Photos go straight to a vision model.** No OCR-then-generate round trip; two-column vocabulary tables stop collapsing into one line.
- **Resize before upload.** A 4–5 MB phone photo becomes a few hundred KB JPEG at 1,800 px on the long edge, orientation corrected.
- **Stream, three pages in parallel.** A page enters the queue as soon as it is read; the first page's cards appear while page nine is still rendering. Consecutive text pages are batched into one request.
- **JSON mode server-side,** so a model that prefixes "Sure, here are the cards:" cannot break a batch; providers without the parameter fall back to plain mode automatically.
- **Resilient UI.** Selected cards are checkpointed to `sessionStorage`; a mobile tab reload loses nothing. Cards are editable in the preview, not just deletable.

## Grounding check

Every generated answer must appear in the extracted source text. Matching ignores case and accents and allows inflections and splitting of multi-option lines. Anything not found is dropped, and the user is told how many were removed. This is the single biggest lever against hallucinated cards.

## Second reading

Each sentence is read once more by the model with the answer in place; a faulted sentence is rewritten and a doubted answer is flagged. Cards created before this existed are re-checked in batches, once, and marked with a check version so they are never sent twice.

## Golden-set benchmark

`npm run bench` runs the **production** import pipeline (`src/lib/importJob.js`, bypassing only the HTTP layer) over samples in `bench/`, compares against hand-written golden files, and reports misses, extras, whether each answer is typeable and whether it has an example sentence. `--runs 3` measures stability. Every new book layout (two-column lists, running text, handwritten notes, tables with examples) gets a sample and a golden file; writing the golden once is the asset, because every later prompt change is then measured instead of eyeballed.

## Scheduling

SM-2 with three outcomes instead of a six-point self-rating, because the grade is already decided by a model reading what the learner typed: **right** (interval grows), **close** (knew the word, missed an accent — tomorrow, not in three weeks, and not a lapse), **wrong** (back to the start, back in today's queue). Daily new-card limits, queue caps, and a "known" threshold at 30 days.
