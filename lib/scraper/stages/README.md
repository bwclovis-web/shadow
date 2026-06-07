# Scraper pipeline stages

The note-extraction LangGraph pipeline lives in `../notes-graph.ts`. Stages are extracted incrementally so behavior and tests stay stable.

## Current layout

| Module | Contents |
|--------|----------|
| `pipeline-options.ts` | `ScraperPipelineOptions`, LangGraph `ScraperState` |
| `notes-graph.ts` | PDP bootstrap, title cleaning, LLM extraction, noir copy, graph node, public API |

## Planned extractions (no behavior change)

1. `pdp-bootstrap.ts` — URL/name resolution, HTTP PDP fetch, HTML note bootstrap (~lines 142–1477)
2. `title-cleaning.ts` — title transforms, note list parsing, description sanitization
3. `llm-extraction.ts` — note extraction / merge prompts
4. `noir-description.ts` — film noir description generation
5. `note-translation.ts` — non-English note translation
6. `note-validator.ts` — batch LLM note validator
7. `extract-notes-node.ts` — `extractNotes` graph node and `buildGraph`

See [docs/server-layers.md](../../../docs/server-layers.md) for how scraper code fits the server layer model.
