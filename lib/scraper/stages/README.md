# Scraper pipeline stages

The note-extraction LangGraph pipeline is split across `../notes-graph.ts` (facade) and the modules below. Stages were extracted incrementally with no intended behavior change.

## Current layout

| Module | Contents |
|--------|----------|
| `pipeline-options.ts` | `ScraperPipelineOptions`, LangGraph `ScraperState` |
| `notes-layers.ts` | Shared `NotesLayers` type |
| `notes-layers-utils.ts` | `noteLayerCount`, `hasLayeredMerchantPyramid` |
| `pdp-bootstrap.ts` | URL/name resolution, HTTP PDP fetch, HTML note bootstrap |
| `title-cleaning.ts` | Title transforms, note list parsing, description sanitization, structured extraction |
| `llm-extraction.ts` | Note extraction / merge prompts |
| `noir-description.ts` | Film noir description generation |
| `note-translation.ts` | Non-English note translation |
| `note-validator.ts` | Batch LLM note validator |
| `extract-notes-node.ts` | `extractNotes` graph node, `buildGraph`, `extractNotesForItems` |
| `notes-graph.ts` | Public API re-exports only |

See [docs/architecture.md](../../../docs/architecture.md) for how scraper code fits the server layer model.
