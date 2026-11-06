# Architecture Decision Records

An ADR records one significant technical decision: what we needed to decide, what we considered, what we chose and what follows from it. They are short, numbered and never rewritten after acceptance; a later decision supersedes an earlier one instead.

## Format

File name: `NNNN-short-title.md`, numbered in order. Each ADR has a status line (`Proposed`, `Accepted`, `Superseded by NNNN`) and these sections:

1. **Context**: the problem and the constraints.
2. **Options considered**: the realistic alternatives, including doing nothing where relevant.
3. **Evaluation**: how each option measures up, with evidence.
4. **Decision**: what we chose, stated plainly.
5. **Consequences**: what becomes easier, what becomes harder, what we must do next.
6. **Open questions**: what we could not verify, so a reader knows what is still a guess.

Every factual claim about an outside system links to its official source. Anything we could not verify belongs under Open questions, not in the body as fact.

## Index

| ADR                               | Title                                | Status   |
| --------------------------------- | ------------------------------------ | -------- |
| [0001](0001-chain-data-source.md) | How `osl-api` reads Stellar payments | Proposed |
