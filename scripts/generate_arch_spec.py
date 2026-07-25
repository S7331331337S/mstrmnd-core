#!/usr/bin/env python3

from __future__ import annotations

import argparse
from html import unescape
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


CONTENT = """
MSTRMND CORE
Technical Architecture Specification
Version 0.1 - Genesis Build

1. Vision

MSTRMND Core is a user-owned personal intelligence layer that persists independently from any specific AI model.
The goal is to create an interoperable memory, identity, and creative intelligence substrate that can connect to GPT, Claude, Gemini, Grok, local models, and future systems through MCP.

Core principle:

Models change. The user's intelligence layer persists.

2. System Overview

The system transforms personal data into structured intelligence:

Photos
Documents
Notes
Projects
Conversations
Creative references

        |
        v

Artifact ingestion

        |
        v

Multimodal analysis

        |
        v

Embeddings + Knowledge Graph

        |
        v

Identity Model

        |
        v

Hermes Agent Runtime

        |
        v

Creative Collaboration


3. Core Architecture

Repository:

mstrmnd-core

Primary layers:

apps/
- hermes: autonomous agent runtime
- mcp-server: model interoperability layer

packages/
- schemas: shared data models
- intelligence-core: memory, graph, identity engines
- agents: specialized cognition modules

connectors/
- filesystem
- photos
- obsidian
- github
- cloud sources

infrastructure/
- PostgreSQL
- pgvector
- Neo4j
- MinIO


4. Hermes Agent System

Hermes is the orchestration layer.

Lifecycle:

OBSERVE
  |
RETRIEVE MEMORY
  |
PLAN
  |
EXECUTE
  |
EVALUATE
  |
REFLECT
  |
UPDATE MEMORY


Responsibilities:

- task planning
- tool execution
- context retrieval
- reflection
- learning


5. Memory Architecture

Three memory systems:

Structured Memory:
PostgreSQL

Semantic Memory:
pgvector embeddings

Relationship Memory:
Neo4j knowledge graph


Memory objects:

Artifact
- image
- video
- audio
- document

Identity
- values
- interests
- creative patterns
- preferences

Relationship
- connections between concepts and experiences


6. Vision Intelligence Pipeline

Example:

86,000 personal photos

Processing:

Photo ingestion
 -> Metadata extraction
 -> Vision analysis
 -> Embeddings
 -> Concept extraction
 -> Knowledge graph
 -> Visual DNA


Output example:

Visual language:
- brutalist
- organic
- cinematic

Themes:
- technology
- nature
- transformation


7. MCP Interface

MCP provides model agnostic access.

Core tools:

search_memory()

get_identity()

get_visual_dna()

find_connections()

analyze_project()

create_memory()


Any compatible model can become an interface to the user's intelligence layer.


8. Creative Intelligence Layer

The system moves beyond prompting.

Instead of:

"Write me a prompt"

The user interacts with an agent:

"Help me create this."

The agent understands:

- taste
- history
- preferences
- references
- previous decisions
- evolution over time


9. Development Roadmap

Phase 1:
Repository foundation
- complete

Phase 2:
Memory substrate
- databases
- ingestion
- embeddings

Phase 3:
Vision cortex
- photo understanding
- style extraction

Phase 4:
Identity engine
- preference modeling
- evolution tracking

Phase 5:
Creative agents
- research
- design
- content generation

Phase 6:
Full personal intelligence platform


10. Design Philosophy

The intelligence layer belongs to the user.

AI models are interchangeable reasoning engines.

MSTRMND is the persistent identity, memory, and creative context layer.

The objective is not automation alone.

The objective is a true creative collaborator that evolves with the person.
"""


def build_pdf(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(str(output_path))
    styles = getSampleStyleSheet()
    story = []

    for line in CONTENT.splitlines():
        if not line.strip():
            continue
        normalized = escape(unescape(line))
        story.append(Paragraph(normalized, styles["BodyText"]))
        story.append(Spacer(1, 8))

    doc.build(story)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate the MSTRMND Core technical architecture specification PDF."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/tmp/MSTRMND_Core_Technical_Architecture_Specification.pdf"),
        help="Output PDF file path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_pdf(args.output)
    print(args.output)


if __name__ == "__main__":
    main()
