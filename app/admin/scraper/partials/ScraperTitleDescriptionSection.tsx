import type { ChangeEvent } from "react"

import { NOTES_PIPELINE_MODEL_ALLOWLIST } from "@/lib/scraper/notes-pipeline-models"
import type {
  NoteInferenceMode,
  NoteValidationMode,
  TitleDashSegment,
} from "@/types/scraper"

import { SECTION_CLASS } from "./constants"
import { Field, inputClass } from "./Field"

export type ScraperTitleDescriptionSectionProps = {
  titleDashSegment: TitleDashSegment
  setTitleDashSegment: (v: TitleDashSegment) => void
  titleColonSegment: TitleDashSegment
  setTitleColonSegment: (v: TitleDashSegment) => void
  titleTakeBeforeFirstComma: boolean
  setTitleTakeBeforeFirstComma: (v: boolean) => void
  titleTakeAfterFirstComma: boolean
  setTitleTakeAfterFirstComma: (v: boolean) => void
  titleStripNumbers: boolean
  setTitleStripNumbers: (v: boolean) => void
  titleOmitWordsRaw: string
  setTitleOmitWordsRaw: (v: string) => void
  noteInferenceMode: NoteInferenceMode
  setNoteInferenceMode: (v: NoteInferenceMode) => void
  minConfidentFlatNotes: string
  setMinConfidentFlatNotes: (v: string) => void
  notesPipelineModel: string
  setNotesPipelineModel: (v: string) => void
  noirPipelineModel: string
  setNoirPipelineModel: (v: string) => void
  noteValidationMode: NoteValidationMode
  setNoteValidationMode: (v: NoteValidationMode) => void
  externalNoteRescue: boolean
  setExternalNoteRescue: (v: boolean) => void
  generateNoirDescriptions: boolean
  setGenerateNoirDescriptions: (v: boolean) => void
}

export const ScraperTitleDescriptionSection = ({
  titleDashSegment,
  setTitleDashSegment,
  titleColonSegment,
  setTitleColonSegment,
  titleTakeBeforeFirstComma,
  setTitleTakeBeforeFirstComma,
  titleTakeAfterFirstComma,
  setTitleTakeAfterFirstComma,
  titleStripNumbers,
  setTitleStripNumbers,
  titleOmitWordsRaw,
  setTitleOmitWordsRaw,
  noteInferenceMode,
  setNoteInferenceMode,
  minConfidentFlatNotes,
  setMinConfidentFlatNotes,
  notesPipelineModel,
  setNotesPipelineModel,
  noirPipelineModel,
  setNoirPipelineModel,
  noteValidationMode,
  setNoteValidationMode,
  externalNoteRescue,
  setExternalNoteRescue,
  generateNoirDescriptions,
  setGenerateNoirDescriptions,
}: ScraperTitleDescriptionSectionProps) => (
  <section className={SECTION_CLASS}>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      Title & description
    </h2>
    <p className="text-xs text-muted-foreground">
      Clean product names and choose how descriptions are generated. Notes are always extracted;
      you can strip them from the source text and have LangGraph write new film noir themed copy.
    </p>
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium">
        First title separator (<code className="text-xs"> - </code>, <code className="text-xs">–</code>
        , <code className="text-xs">—</code>, <code className="text-xs">~</code>,{" "}
        <code className="text-xs">.</code>, <code className="text-xs">|</code>)
      </legend>
      <p className="text-xs text-muted-foreground">
        Many shops use <code className="text-xs">Title - subtitle or size</code> (or an en/em dash
        instead of hyphen) or <code className="text-xs">Title | variant</code>. Choose which side to
        keep for the imported perfume name.
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          className="mt-0.5"
          name="titleDashSegment"
          checked={titleDashSegment === "none"}
          onChange={() => setTitleDashSegment("none")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Keep full title</span>
          <span className="text-xs text-muted-foreground">No split on the first separator.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          className="mt-0.5"
          name="titleDashSegment"
          checked={titleDashSegment === "before"}
          onChange={() => setTitleDashSegment("before")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Use text before first separator</span>
          <span className="text-xs text-muted-foreground">
            e.g. &quot;Velvet Vanilla - 50ml&quot; → &quot;Velvet Vanilla&quot;
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          className="mt-0.5"
          name="titleDashSegment"
          checked={titleDashSegment === "after"}
          onChange={() => setTitleDashSegment("after")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Use text after first separator</span>
          <span className="text-xs text-muted-foreground">
            e.g. &quot;House - Night Rose&quot; → &quot;Night Rose&quot;
          </span>
        </span>
      </label>
    </fieldset>
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium">
        First colon in product name (<code className="text-xs">:</code>)
      </legend>
      <p className="text-xs text-muted-foreground">
        Use this independently from the separator rule above for formats like{" "}
        <code className="text-xs">Title: Subtitle</code>.
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          className="mt-0.5"
          name="titleColonSegment"
          checked={titleColonSegment === "none"}
          onChange={() => setTitleColonSegment("none")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Keep full title</span>
          <span className="text-xs text-muted-foreground">No split on the first colon.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          className="mt-0.5"
          name="titleColonSegment"
          checked={titleColonSegment === "before"}
          onChange={() => setTitleColonSegment("before")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Use text before first colon</span>
          <span className="text-xs text-muted-foreground">
            e.g. &quot;Velvet Vanilla: extrait&quot; → &quot;Velvet Vanilla&quot;
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          className="mt-0.5"
          name="titleColonSegment"
          checked={titleColonSegment === "after"}
          onChange={() => setTitleColonSegment("after")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Use text after first colon</span>
          <span className="text-xs text-muted-foreground">
            e.g. &quot;House: Night Rose&quot; → &quot;Night Rose&quot;
          </span>
        </span>
      </label>
    </fieldset>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={titleTakeBeforeFirstComma}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const checked = e.target.checked
          setTitleTakeBeforeFirstComma(checked)
          if (checked) setTitleTakeAfterFirstComma(false)
        }}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Use text before first comma</span>
        <span className="text-xs text-muted-foreground">
          Independent control. e.g. &quot;Brand, Night Rose&quot; → &quot;Brand&quot;.
        </span>
      </span>
    </label>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={titleTakeAfterFirstComma}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const checked = e.target.checked
          setTitleTakeAfterFirstComma(checked)
          if (checked) setTitleTakeBeforeFirstComma(false)
        }}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Use text after first comma</span>
        <span className="text-xs text-muted-foreground">
          Independent control. e.g. &quot;Brand, Night Rose&quot; → &quot;Night Rose&quot;.
        </span>
      </span>
    </label>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={titleStripNumbers}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTitleStripNumbers(e.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Strip numbers and sizes from name</span>
        <span className="text-xs text-muted-foreground">
          Remove 30ml, 1.7 fl oz, etc. from product names.
        </span>
      </span>
    </label>
    <Field
      label="Words to omit from title"
      hint="Comma-separated. These words/phrases are stripped from product names (case-insensitive). Size patterns are already stripped by the option above."
    >
      <input
        className={inputClass()}
        value={titleOmitWordsRaw}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTitleOmitWordsRaw(e.target.value)}
      />
    </Field>
    <Field
      label="Note inference mode"
      hint="Standard may infer notes from name/theme when the page has no list. Strict keeps only merchant-listed notes (regex + optional PDP fetch); some rows may have empty notes."
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="noteInferenceMode"
            checked={noteInferenceMode === "standard"}
            onChange={() => setNoteInferenceMode("standard")}
          />
          <span className="text-sm">Standard</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="noteInferenceMode"
            checked={noteInferenceMode === "strict"}
            onChange={() => setNoteInferenceMode("strict")}
          />
          <span className="text-sm">Strict</span>
        </label>
      </div>
    </Field>
    <Field
      label="Min flat note list size (optional)"
      hint="1–50. Merchant flat lists with at least this many items skip merge LLM. Leave blank for default (2)."
    >
      <input
        className={inputClass()}
        inputMode="numeric"
        value={minConfidentFlatNotes}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setMinConfidentFlatNotes(e.target.value.replace(/\D/g, ""))
        }
        placeholder="2"
      />
    </Field>
    <Field
      label="Extraction / merge / translate model"
      hint="Blank uses OPENAI_NOTES_PIPELINE_MODEL from env, then gpt-4o-mini."
    >
      <select
        className={inputClass()}
        value={notesPipelineModel}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setNotesPipelineModel(e.target.value)}
      >
        <option value="">Env default</option>
        {NOTES_PIPELINE_MODEL_ALLOWLIST.map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </Field>
    <Field
      label="Noir description model"
      hint="Blank uses OPENAI_NOTES_PIPELINE_NOIR_MODEL or the extraction model."
    >
      <select
        className={inputClass()}
        value={noirPipelineModel}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setNoirPipelineModel(e.target.value)}
      >
        <option value="">Env / extraction default</option>
        {NOTES_PIPELINE_MODEL_ALLOWLIST.map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </Field>
    <Field
      label="Bulk LLM note validator"
      hint="On (default) runs a single classification call over the union of extracted notes and drops prose / sensory fragments (e.g. 'a sweet', 'glowing amber warmth', 'sunlit burst of melon'). Off disables it."
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="noteValidationMode"
            checked={noteValidationMode === "llm"}
            onChange={() => setNoteValidationMode("llm")}
          />
          <span className="text-sm">On (LLM validator)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="noteValidationMode"
            checked={noteValidationMode === "off"}
            onChange={() => setNoteValidationMode("off")}
          />
          <span className="text-sm">Off</span>
        </label>
      </div>
    </Field>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={externalNoteRescue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setExternalNoteRescue(e.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">External note rescue (reviewed candidates)</span>
        <span className="text-xs text-muted-foreground">
          When merchant notes are missing, search Fragrantica, Basenotes, and Parfumo for preview
          candidates. Never overwrites high-confidence merchant notes.
        </span>
      </span>
    </label>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={generateNoirDescriptions}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setGenerateNoirDescriptions(e.target.checked)
        }
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Generate film noir themed descriptions</span>
        <span className="text-xs text-muted-foreground">
          Use notes + original copy to write unique, sexy, mysterious descriptions. Uncheck to keep
          original text with note phrases removed.
        </span>
      </span>
    </label>
  </section>
)
