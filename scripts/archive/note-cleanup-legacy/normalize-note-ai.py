#!/usr/bin/env python3
"""
LangGraph Note Normalization Script

Normalizes perfume notes to match database standards using LangGraph.
This script is called from TypeScript import scripts to standardize notes.

Usage:
    python scripts/normalize-note-ai.py temp_note.json
"""

import os
import re
import sys
import json
import warnings
from pathlib import Path
from typing import List, TypedDict
from dotenv import load_dotenv

# Suppress LangChain/Pydantic v1 warning on Python 3.14 (upstream compatibility)
warnings.filterwarnings("ignore", message=".*Pydantic V1.*Python 3.14.*", category=UserWarning)

# Load environment variables
load_dotenv()

try:
    from langgraph.graph import StateGraph, END
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage
except ImportError:
    print("error", file=sys.stderr)
    sys.exit(1)

# Get project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class NormalizeState(TypedDict):
    note: str
    existing_notes: list
    normalized: str


def _build_normalize_prompt(note: str, existing_notes: List[str]) -> str:
    """Build the normalization prompt (same logic as original CrewAI tasks)."""
    existing_preview = ", ".join(existing_notes[:50]) if existing_notes else "(none)"
    return f"""You are a perfume note standardization expert. Normalize this perfume note to match database standards.

Note: "{note}"
Existing notes in database (for reference): {existing_preview}

Rules:
- Prefer matching to existing notes when appropriate
- Standardize common variations:
  * "vanilla bean", "vanilla extract" → "vanilla"
  * "rose petals", "rose flower" → "rose"
  * "jasmine flower", "jasmine sambac" → "jasmine" (unless sambac is distinct)
  * "coconut oil", "fractionated coconut oil" → "coconut"
  * "sandalwood oil" → "sandalwood"
  * "patchouli leaf" → "patchouli"
- Keep multi-word notes when they represent distinct scents: "black tea", "white birch wood", "motor oil", "ice cream"
- All notes should be lowercase, 1-5 words

Examples:
- "Vanilla Bean" → "vanilla"
- "Rose Petals" → "rose"
- "Black Tea" → "black tea"
- "Ice Cream" → "ice cream"
- "Jasmine Sambac" → "jasmine sambac"

Return ONLY a single JSON object with this key (no markdown, no extra text):
{{ "normalized_note": "standardized note name" }}
"""


def _parse_normalize_response(text: str, fallback: str) -> str:
    """Parse LLM response into normalized note string."""
    result_text = str(text).strip()
    json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            normalized = data.get("normalized_note", fallback)
            return normalized.lower().strip() if normalized else fallback
        except json.JSONDecodeError:
            pass
    result_text = re.sub(r'^normalized[_\s]*note[:\s]*', '', result_text, flags=re.IGNORECASE)
    result_text = re.sub(r'^note[:\s]*', '', result_text, flags=re.IGNORECASE)
    result_text = result_text.strip().strip('"').strip("'")
    if re.match(r'^[a-z\s\-\']+$', result_text, re.IGNORECASE):
        return result_text.lower().strip()
    return fallback


def _normalize_node(state: NormalizeState, llm: ChatOpenAI) -> dict:
    """LangGraph node: call LLM and parse normalized note."""
    note = state["note"]
    existing_notes = state.get("existing_notes") or []
    note_lower = note.strip().lower()
    if note_lower in [n.lower() for n in existing_notes]:
        for existing in existing_notes:
            if existing.lower() == note_lower:
                return {"normalized": existing.lower()}
    try:
        prompt = _build_normalize_prompt(note, existing_notes)
        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content if hasattr(response, "content") else str(response)
        normalized = _parse_normalize_response(content, note_lower)
    except Exception:
        normalized = note_lower
    return {"normalized": normalized}


class NoteNormalizationGraph:
    """LangGraph-based normalization: one node that runs the LLM and parses result."""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.llm = ChatOpenAI(model=model, temperature=0.1)
        graph = StateGraph(NormalizeState)
        graph.add_node("normalize", lambda s: _normalize_node(s, self.llm))
        graph.set_entry_point("normalize")
        graph.add_edge("normalize", END)
        self.app = graph.compile()

    def normalize_note(self, note: str, existing_notes: List[str]) -> str:
        """Normalize a note to match database standards. Returns lowercase standardized name."""
        if not note or not note.strip():
            return ""
        note_lower = note.strip().lower()
        if note_lower in [n.lower() for n in existing_notes]:
            for existing in existing_notes:
                if existing.lower() == note_lower:
                    return existing.lower()
        initial: NormalizeState = {
            "note": note,
            "existing_notes": list(existing_notes),
            "normalized": "",
        }
        final = self.app.invoke(initial)
        return (final.get("normalized") or note_lower).strip()


def main():
    if len(sys.argv) < 2:
        print("error", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]

    if not os.path.exists(input_file):
        print("error", file=sys.stderr)
        sys.exit(1)

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        note = data.get("note", "")
        existing_notes = data.get("existingNotes", [])

        if not note:
            print("error", file=sys.stderr)
            sys.exit(1)

        crew = NoteNormalizationGraph()
        normalized = crew.normalize_note(note, existing_notes)
        print(normalized)

    except Exception:
        print("error", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
