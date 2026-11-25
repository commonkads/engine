# @commonkads/engine

A runtime for executing knowledge-intensive tasks by combining reusable CommonKADS
problem-solving method (PSM) templates with domain knowledge that lives entirely outside the
code, retrieved at runtime and handed to an LLM (or evaluated deterministically) to produce
an auditable result.

## The CommonKADS Foundation

The engine takes a structured approach to orchestrating LLM usage for knowledge-intensive
tasks, grounded in CommonKADS knowledge modeling methodology. Domain knowledge is
externalized from code, independently governed, and validated for consistency across all
layers. The engine is driven by inference and task knowledge layers.

## Goals

- Separate domain knowledge from code — rules, ontology, and domain model are maintained
  as text files, authored by domain experts without requiring developer involvement.
- LLM-powered reasoning — LLMs handle inference and role binding at runtime, eliminating
  the need to hardcode domain logic in application code.
- Provider independence — no tight coupling to any specific LLM provider; capability
  interfaces allow adapters to be swapped without affecting task logic.
- Incremental formalization — domain knowledge starts as plain text and is progressively
  formalized toward SBVR and OWL/RDF at a pace that suits a team, without a big-bang
  migration.
- Full auditability — every inference logs the exact rule version and ontology version
  used, providing a complete audit trail of why a decision was made at any point in time.
- Independent lifecycle — domain knowledge, ontology, and code evolve on separate cadences
  owned by different roles (domain experts, knowledge engineers, developers), reducing
  coordination overhead and deployment coupling.

## What the engine provides

- **A Task Execution Loop (`RuntimeEngine`)** that drives any PSM template:
  it asks the PSM for the next step, fetches the knowledge that step needs
  (from a file store and/or a vector knowledge store), either hands that
  knowledge straight to the PSM (deterministic steps) or sends it to an LLM
  (inference steps), and folds the result back into task state until the
  PSM reports there's nothing left to do.
- **Reusable CommonKADS PSM templates** — Assessment, Diagnosis, and
  Monitoring — each encoding a fixed reasoning sequence (e.g. Assessment's
  `obtain → specify → abstract → evaluate → conclude`). A new domain is
  onboarded by pointing a template at a new set of knowledge files, not by
  writing new orchestration code.
- **Swappable storage and inference providers** behind small interfaces
  (`IFileStore`, `IKnowledgeStore`, `IInferenceProvider`) — local filesystem or
  cloud storage for knowledge files, and any LLM for the inference calls.
- **An explain mode, an audit log, and step timings** on every run, so a
  result can always be traced back to the exact knowledge document versions
  and reasoning that produced it.
- **A worked example** — vital signs validity assessment — showing a full
  domain wired up end to end: ontology, norms, abstraction and evaluation
  knowledge, a small amount of domain-specific selection logic, and tests
  that exercise it without a live LLM.

## More information

- `docs/specs/requirements.md` / `docs/specs/design.md` — living system requirements and design.
- `docs/developer-guide.md` — setup, build, test, and CLI usage for working
  on this repo.
