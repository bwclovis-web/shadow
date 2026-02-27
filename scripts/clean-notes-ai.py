#!/usr/bin/env python3
"""
AI-Powered Note Extraction Script using LangGraph

This script handles complex phrase extraction that the rule-based JavaScript script
might miss. It uses LangGraph with an LLM to extract notes from ambiguous phrases.

Usage:
    python scripts/clean-notes-ai.py --dry-run                    # Preview changes
    python scripts/clean-notes-ai.py --input ambiguous-notes.json  # Process specific notes
    python scripts/clean-notes-ai.py --all                         # Process all ambiguous notes
"""

import os
import re
import sys
import json
import argparse
import warnings
from pathlib import Path
from typing import List, Dict, Optional, TypedDict
from dotenv import load_dotenv

# Suppress LangChain/Pydantic v1 warning on Python 3.14 (upstream compatibility)
warnings.filterwarnings("ignore", message=".*Pydantic V1.*Python 3.14.*", category=UserWarning)

# Set UTF-8 encoding for stdout on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Load environment variables
load_dotenv()

try:
    from langgraph.graph import StateGraph, END
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage
except ImportError:
    print("❌ LangGraph not installed. Install with: pip install -r scripts/requirements-ai.txt")
    sys.exit(1)

# Get project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class ExtractState(TypedDict, total=False):
    phrase: str
    existing_notes: list
    result: dict
    reason: str  # e.g. "Confirm valid scent note" → use confirmation prompt


def _build_extract_prompt(phrase: str, existing_notes: List[str]) -> str:
    """Build the combined analysis + extraction prompt (same logic as original CrewAI tasks)."""
    existing_preview = ", ".join(existing_notes[:50]) if existing_notes else "(none)"
    return f"""You are a perfume note expert. Analyze this perfume note phrase and extract valid notes or mark for deletion.

Phrase: "{phrase}"
Existing notes in database (for reference): {existing_preview}

Rules:
- Valid notes: 1-5 words, 2-50 characters, not stopwords
- Multi-word notes are valid (e.g., "vanilla bean", "black tea", "white birch wood", "motor oil", "coppery blood")
- Remove leading adjectives when appropriate (e.g., "fresh sugared ginger" → "sugared ginger")
- Remove prefixes like "base" (e.g., "base Bourbon Vetiver" → "Bourbon Vetiver")
- Remove suffixes like "& more" (e.g., "vanilla & more" → "vanilla")
- Extract notes from phrases like "soaked in black tea" → "black tea"
- Extract meaningful notes from descriptive phrases (e.g., "fallen leaves deep in the autumnal forest" → "autumnal forest")
- Split multiple notes when appropriate (e.g., "dragon's blood and a river of wine" → ["dragon's blood", "river of wine"])
- Phrases with no notes (e.g., "with every inhale") should be marked for deletion
- Marketing/placeholder/noise phrases should be deleted (e.g., "limited time only", "no name", "few")
- If a phrase contains exactly one obvious note noun, extract only that noun (e.g., "coffee in your hand" → ["coffee"])
- Do not invent notes that are not clearly present in the phrase
- Never output generic text fragments as notes ("time", "only", "difference", "name")

Examples:
- "petites madeleines soaked in black tea" → ["black tea"]
- "fresh sugared ginger" → ["sugared ginger"]
- "white birch wood" → ["white birch wood"]
- "base Bourbon Vetiver" → ["Bourbon Vetiver"]
- "vanilla & more" → ["vanilla"]
- "along with hints of musk" → ["musk"]
- "fallen leaves deep in the autumnal forest." → ["autumnal forest"]
- "dragon's blood and a river of wine" → ["dragon's blood", "river of wine"]
- "with every inhale" → null (delete)
- "he spritzes a touch of the 80s" → null (delete)
- "opoponax/resins" → ["opoponax", "resins"]
- "coffee in your hand" → ["coffee"]
- "limited time only" → null (delete)
- "no name" → null (delete)

Return ONLY a single JSON object with these exact keys (no markdown, no extra text):
{{
    "extracted_notes": ["note1", "note2"] or null,
    "should_delete": true or false,
    "reasoning": "brief explanation"
}}
"""


def _build_confirm_prompt(phrase: str) -> str:
    """Build prompt for confirming whether a phrase is a valid perfume note (e.g. hot leather, old makeup)."""
    return f"""You are a perfume note expert. Is the following a valid perfume/scent note?

Phrase: "{phrase}"

Valid perfume notes are typically 1-5 words describing a scent (e.g. "hot leather", "old books", "grey iris", "cut grass", "cold steel", "vanilla bean"). 
Invalid examples: standalone stopwords ("cut" alone, "hot" alone), placeholders ("null", "test"), or non-scent phrases.

Reply with ONLY a single JSON object (no markdown, no extra text):
- If it IS a valid scent note: {{ "valid": true, "reasoning": "brief reason" }}
- If it is NOT valid and you can extract real notes from it: {{ "valid": false, "extracted_notes": ["note1"], "reasoning": "brief reason" }}
- If it is NOT valid and should be deleted: {{ "valid": false, "should_delete": true, "reasoning": "brief reason" }}
"""


def _parse_confirm_response(text: str) -> dict:
    """Parse confirm response into same shape as extraction: extracted_notes, should_delete, reasoning."""
    result_text = str(text).strip()
    json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            if data.get("valid") is True:
                return {
                    "extracted_notes": None,
                    "should_delete": False,
                    "reasoning": data.get("reasoning", "Confirmed valid scent note"),
                }
            # valid: false
            return {
                "extracted_notes": data.get("extracted_notes"),
                "should_delete": data.get("should_delete", True),
                "reasoning": data.get("reasoning", "Not a valid scent note"),
            }
        except json.JSONDecodeError:
            pass
    return {
        "extracted_notes": None,
        "should_delete": True,
        "reasoning": "Could not parse confirmation response",
    }


def _parse_extraction_response(text: str) -> dict:
    """Parse LLM response into result dict; same logic as original CrewAI parsing."""
    result_text = str(text).strip()
    json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            return {
                "extracted_notes": data.get("extracted_notes"),
                "should_delete": data.get("should_delete", True),
                "reasoning": data.get("reasoning", ""),
            }
        except json.JSONDecodeError:
            pass
    try:
        data = json.loads(result_text)
        return {
            "extracted_notes": data.get("extracted_notes"),
            "should_delete": data.get("should_delete", True),
            "reasoning": data.get("reasoning", ""),
        }
    except json.JSONDecodeError:
        pass
    return {
        "extracted_notes": None,
        "should_delete": True,
        "reasoning": "Could not parse LLM response",
    }


def _extract_node(state: ExtractState, llm: ChatOpenAI) -> dict:
    """LangGraph node: call LLM and parse result into state.result."""
    phrase = state["phrase"]
    existing_notes = state.get("existing_notes") or []
    reason = state.get("reason") or ""
    use_confirm = "Confirm" in reason
    if use_confirm:
        prompt = _build_confirm_prompt(phrase)
    else:
        prompt = _build_extract_prompt(phrase, existing_notes)
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content if hasattr(response, "content") else str(response)
        result = _parse_confirm_response(content) if use_confirm else _parse_extraction_response(content)
    except Exception as e:
        print(f"❌ Error: {e}")
        result = {
            "extracted_notes": None,
            "should_delete": True,
            "reasoning": f"Error: {str(e)}",
        }
    return {"result": result}


class NoteExtractionGraph:
    """LangGraph-based extraction: one node that runs the LLM and parses JSON."""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.llm = ChatOpenAI(model=model, temperature=0.1)
        graph = StateGraph(ExtractState)
        graph.add_node("extract", lambda s: _extract_node(s, self.llm))
        graph.set_entry_point("extract")
        graph.add_edge("extract", END)
        self.app = graph.compile()

    def extract_notes(self, phrase: str, existing_notes: List[str], reason: Optional[str] = None) -> Dict:
        """
        Extract or confirm notes from a phrase using LangGraph + LLM.
        If reason contains "Confirm", uses a confirmation prompt (valid scent note?).

        Returns:
            {"extracted_notes": [...], "should_delete": bool, "reasoning": str}
        """
        initial: ExtractState = {
            "phrase": phrase,
            "existing_notes": list(existing_notes),
            "result": {},
        }
        if reason:
            initial["reason"] = reason
        final = self.app.invoke(initial)
        return final.get("result") or {
            "extracted_notes": None,
            "should_delete": True,
            "reasoning": "No result from graph",
        }


def load_ambiguous_notes(input_file: Optional[str] = None) -> List[Dict]:
    """Load notes that need AI extraction"""
    if input_file:
        with open(input_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_results(results: List[Dict], output_file: str, format: str = "json"):
    """Save extraction results to JSON or Markdown file"""
    output_path = project_root / "reports" / output_file
    output_path.parent.mkdir(exist_ok=True)

    if format == "md":
        md_content = generate_markdown_report(results)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
    else:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Results saved to: {output_path}")


def generate_markdown_report(results: List[Dict]) -> str:
    """Generate a markdown report from extraction results"""
    from datetime import datetime

    timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    extracted_count = sum(1 for r in results if r.get("extracted_notes"))
    deleted_count = sum(1 for r in results if r.get("should_delete") and not r.get("extracted_notes"))
    confirmed_count = sum(1 for r in results if not r.get("extracted_notes") and not r.get("should_delete") and "valid" in (r.get("reasoning") or "").lower())
    no_action_count = len(results) - extracted_count - deleted_count - confirmed_count

    md = f"""# AI-Powered Note Extraction - Dry Run Report

**Generated:** {timestamp}

⚠️ **DRY RUN MODE** - No changes have been made to the database

---

## Summary

- **Total Notes Processed:** {len(results)}
- **Notes with Extracted Notes:** {extracted_count}
- **Notes Marked for Deletion:** {deleted_count}
- **Confirmed Valid (no change):** {confirmed_count}
- **Notes Requiring Review:** {no_action_count}

---

## Notes with Extracted Notes

"""
    extracted_notes = [r for r in results if r.get("extracted_notes")]
    deleted_notes = [r for r in results if r.get("should_delete") and not r.get("extracted_notes")]
    confirmed_notes = [r for r in results if not r.get("extracted_notes") and not r.get("should_delete") and "valid" in (r.get("reasoning") or "").lower()]
    review_notes = [r for r in results if not r.get("extracted_notes") and not r.get("should_delete") and r not in confirmed_notes]

    if extracted_notes:
        md += "### Extracted Notes\n\n"
        md += "| Original Phrase | Extracted Note(s) | Reasoning |\n"
        md += "|-----------------|-------------------|----------|\n"
        for result in extracted_notes:
            phrase = result.get("original_phrase", "")
            notes = result.get("extracted_notes", [])
            reasoning = result.get("reasoning", "N/A")
            notes_str = ", ".join([f'"{n}"' for n in notes]) if notes else "None"
            md += f'| "{phrase}" | {notes_str} | {reasoning[:100]}... |\n'
        md += "\n"

    if deleted_notes:
        md += "### Notes Marked for Deletion\n\n"
        md += "| Original Phrase | Reasoning |\n"
        md += "|-----------------|----------|\n"
        for result in deleted_notes:
            phrase = result.get("original_phrase", "")
            reasoning = result.get("reasoning", "No extractable notes")
            md += f'| "{phrase}" | {reasoning[:100]}... |\n'
        md += "\n"

    if confirmed_notes:
        md += "### Confirmed Valid Scent Notes (no change)\n\n"
        md += "| Original Phrase | Reasoning |\n"
        md += "|-----------------|----------|\n"
        for result in confirmed_notes:
            phrase = result.get("original_phrase", "")
            reasoning = result.get("reasoning", "Confirmed valid")
            md += f'| "{phrase}" | {reasoning[:100]} |\n'
        md += "\n"

    if review_notes:
        md += "### Notes Requiring Manual Review\n\n"
        md += "| Original Phrase | Status | Reasoning |\n"
        md += "|-----------------|--------|----------|\n"
        for result in review_notes:
            phrase = result.get("original_phrase", "")
            reasoning = result.get("reasoning", "No action determined")
            md += f'| "{phrase}" | Review Needed | {reasoning[:100]}... |\n'
        md += "\n"

    md += """---

## Next Steps

1. Review the extracted notes above
2. Verify the notes marked for deletion
3. Manually review notes requiring attention
4. Run without `--dry-run` to apply changes (after backup)

**⚠️ Remember to backup first:**
```bash
npm run db:backup
```
"""
    return md


def main():
    parser = argparse.ArgumentParser(description="AI-powered note extraction using LangGraph")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--input", type=str, help="Input JSON file with ambiguous notes")
    parser.add_argument("--all", action="store_true", help="Process all ambiguous notes from database")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model to use")

    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not found in environment variables")
        print("   Add it to your .env file or export it")
        sys.exit(1)

    print("=" * 60)
    print("AI-Powered Note Extraction")
    print("=" * 60)

    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made\n")

    crew = NoteExtractionGraph(model=args.model)

    if args.input:
        notes = load_ambiguous_notes(args.input)
        print(f"📋 Loaded {len(notes)} notes from {args.input}\n")
    elif args.all:
        print("⚠️  --all flag not yet implemented. Use --input to provide a JSON file.")
        sys.exit(1)
    else:
        print("❌ Please provide --input file or use --all flag")
        sys.exit(1)

    results = []
    existing_notes = []

    for i, note_data in enumerate(notes, 1):
        phrase = note_data.get("name", note_data.get("phrase", note_data.get("original_phrase", "")))
        note_id = note_data.get("id", f"note_{i}")

        print(f"\n[{i}/{len(notes)}] Processing: {phrase}", flush=True)
        print("   ⏳ Calling LLM...", end="", flush=True)

        reason = note_data.get("reason", "")
        try:
            result = crew.extract_notes(phrase, existing_notes, reason=reason)
            print("\r   ", end="", flush=True)  # clear "Calling LLM..." line
            result["original_phrase"] = phrase
            result["note_id"] = note_id
            results.append(result)

            if result.get("extracted_notes"):
                print(f"   ✅ Extracted: {result['extracted_notes']}", flush=True)
            elif result.get("should_delete"):
                print(f"   🗑️  Marked for deletion", flush=True)
            elif "Confirm" in reason and not result.get("should_delete"):
                print(f"   ✓ Confirmed valid scent note", flush=True)
            else:
                print(f"   ⚠️  No notes extracted", flush=True)
        except TimeoutError:
            print("\r   ", end="", flush=True)
            print(f"   ⏱️  Timeout - Skipping this phrase", flush=True)
            results.append({
                "original_phrase": phrase,
                "note_id": note_id,
                "extracted_notes": None,
                "should_delete": True,
                "reasoning": "Processing timed out - marked for deletion",
            })
        except Exception as e:
            print("\r   ", end="", flush=True)
            print(f"   ❌ Error: {e} - Skipping", flush=True)
            results.append({
                "original_phrase": phrase,
                "note_id": note_id,
                "extracted_notes": None,
                "should_delete": True,
                "reasoning": f"Error during processing: {str(e)}",
            })

    timestamp = __import__("datetime").datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    json_file = f"ai-note-extraction-{timestamp}.json"
    md_file = f"ai-note-extraction-{timestamp}.md"

    save_results(results, json_file, format="json")
    save_results(results, md_file, format="md")

    extracted_count = sum(1 for r in results if r.get("extracted_notes"))
    deleted_count = sum(1 for r in results if r.get("should_delete"))

    print(f"\n📊 Summary:")
    print(f"   • Notes processed: {len(results)}")
    print(f"   • Notes extracted: {extracted_count}")
    print(f"   • Notes to delete: {deleted_count}")
    print(f"\n📄 Reports saved:")
    print(f"   • JSON: reports/{json_file}")
    print(f"   • Markdown: reports/{md_file}")

    if args.dry_run:
        print("\n✅ Dry run complete. Review the markdown report before applying changes.")


if __name__ == "__main__":
    main()
