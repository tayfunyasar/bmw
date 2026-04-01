# Core AI Agent Rules

## 1. Architectural Integrity & DRY Principle
- **Absolute Prohibition of Duplication:** Code and logic must never be duplicated across multiple locations.
- **Mandatory Extraction:** Any element intended for multiple uses must be extracted into a shared module and imported accordingly.

## 2. Modification Rules
- **Structural Over Speed:** Prioritize modularity and long-term maintainability over short-term implementation.
- **Component Integrity:** Extracted components must be self-contained and independently functional.
