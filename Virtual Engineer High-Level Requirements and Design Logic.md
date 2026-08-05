# Virtual Engineer: High-Level Requirements and Design Logic

## Purpose

The Virtual Engineer should assist field engineers during on-site troubleshooting of chiller units by bringing together exact operational data, relevant technical knowledge, and prior service context into a single guided experience. The goal is not to replace the engineer's judgment, but to improve the speed, consistency, and quality of troubleshooting by presenting the right information and recommendations at the right time.

In practical terms, the Virtual Engineer should help a human engineer move from symptom identification to informed action more efficiently. To do that well, the system must combine deterministic access to operational system data with probabilistic retrieval of supporting knowledge.

## Core Design Principle

The recommended design begins with a simple principle: an agent should first establish factual grounding in the exact asset and operating condition, and only then expand into broader contextual retrieval.

This matters because field troubleshooting requires both precision and interpretation. The Virtual Engineer must first know exactly which unit is being serviced, what alarms are active, what the recent telemetry shows, and what service history exists for that specific piece of equipment. Only after that foundation is established should the system retrieve manuals, troubleshooting procedures, similar prior cases, and likely root-cause patterns that may help interpret the facts.

This creates a two-layer retrieval approach:

1. A deterministic retrieval layer for exact system-of-record lookups  
2. A probabilistic retrieval layer for context, similarity, and interpretation

That sequence is intentional. It reduces ambiguity, improves trust in the recommendations, and gives the engineer a clear chain of reasoning from observed facts to suggested actions.

## High-Level Outcome

At a high level, the Virtual Engineer should be capable of:

- Identifying the exact chiller unit in question  
- Retrieving current and historical device state  
- Interpreting active alarms in the context of telemetry and asset configuration  
- Surfacing relevant technical documentation and troubleshooting guidance  
- Comparing the current situation to previous support cases or similar incidents  
- Recommending the most likely next diagnostic or corrective actions  
- Presenting supporting evidence so the human engineer can validate and act with confidence

## High-Level Process

```
Field engineer identifies the unit and issue
        ->
Virtual Engineer resolves exact asset context
        ->
System retrieves operational facts for that unit
        ->
System retrieves relevant knowledge and prior cases
        ->
Agent correlates facts with known patterns and procedures
        ->
Agent recommends next-best actions with supporting evidence
        ->
Field engineer validates, acts, and records outcome
```

## 

## Functional Requirements

### 1\. Asset and Context Resolution

The system must be able to identify the exact equipment instance being serviced. This may be initiated through a device ID, serial number, site reference, work order context, alarm identifier, or another trusted operational key.

This requirement exists because all downstream retrieval depends on first anchoring the agent to the correct business object. Without exact asset resolution, the system risks producing advice that is directionally relevant but operationally wrong.

The Virtual Engineer should therefore be able to retrieve:

- Device or unit identity  
- Model and configuration details  
- Site and installation context  
- Associated service contract or support entitlement where relevant  
- Current work order or service event context

### 2\. Deterministic Retrieval of Operational Facts

Once the unit is identified, the system should retrieve the core operational facts required for troubleshooting. These are records where accuracy and precision matter more than interpretation.

This should include:

- Active alarm codes and alarm history  
- Device status and recent operating state  
- Historical telemetry and IoT readings  
- Fault logs and event history  
- Maintenance and service records  
- Parts or component replacement history where available

The reason this layer is foundational is straightforward: the quality of the recommendation depends on the quality of the factual context. If the Virtual Engineer does not first retrieve the exact alarm, the exact telemetry window, and the exact device configuration, then any downstream reasoning becomes less trustworthy.

### 3\. Probabilistic Retrieval of Supporting Knowledge

After the exact operating context is established, the system should retrieve the supporting knowledge needed to interpret that context.

This should include:

- Product manuals  
- Service manuals  
- Troubleshooting guides  
- Technical bulletins  
- Diagnostic procedures  
- Previous support cases  
- Similar incidents and known resolutions

Unlike the operational layer, these sources are not always retrieved by exact key alone. In many cases, the system needs to retrieve the most relevant materials based on a combination of symptom, alarm pattern, model family, telemetry pattern, and prior repair outcomes.

This is where semantic, vector, or hybrid retrieval becomes useful. The purpose of this layer is not to replace exact lookups, but to expand the system’s ability to find context that a rigid deterministic query may not surface on its own.

### 4\. Guided Reasoning and Recommendation Generation

The Virtual Engineer should not simply return raw records. It should organize the retrieved evidence into a useful troubleshooting recommendation.

At a minimum, the agent should be able to:

- Correlate active alarms with device state and telemetry patterns  
- Relate observed symptoms to documented troubleshooting procedures  
- Identify likely root-cause candidates  
- Prioritize recommended next diagnostic steps  
- Indicate when the confidence is high versus when escalation is appropriate  
- Show the evidence used to support the recommendation

This requirement is important because the value of the system is not only in retrieval, but in helping the engineer make use of what was retrieved. The recommendation should therefore be explainable, structured, and tied back to concrete evidence.

### 5\. Human-in-the-Loop Decision Support

The Virtual Engineer should function as a decision-support system for the field engineer, not as an autonomous repair authority.

That means the system should:

- Present recommendations clearly  
- Show supporting facts and sources  
- Distinguish between likely causes and confirmed facts  
- Allow the engineer to validate, reject, or override recommendations  
- Escalate when the evidence is insufficient or conflicting

This is a critical requirement for trust, adoption, and operational safety. In a field service setting, the engineer must remain in control of the decision and action.

### 6\. Outcome Capture and Learning Feedback

The system should capture what happened after the recommendation was made. That includes the engineer’s chosen action, the eventual diagnosis, and the final resolution if known.

This matters because over time, those outcomes become a valuable source of organizational memory. They can improve future retrieval, help identify successful troubleshooting patterns, and support more accurate recommendations for similar incidents.

## 

## Logical Breakdown of the Recommended Design

The recommended design follows from the nature of the troubleshooting workflow itself.

### Step 1: Resolve the exact unit and current issue

The first requirement is to know exactly what the engineer is working on. This leads directly to deterministic retrieval patterns because asset identity, alarm records, service history, and telemetry are system-of-record data.

### Step 2: Establish the factual operating context

Once the correct unit is resolved, the next requirement is to understand its condition. This means retrieving exact operational facts, including current alarms, historical events, and telemetry over an appropriate time window.

### Step 3: Expand into relevant technical context

After the facts are known, the system can retrieve broader supporting material. This is where probabilistic retrieval becomes appropriate, because the system is no longer asking only “what is this unit?” but also “what information is most relevant to understanding and fixing this issue?”

### Step 4: Convert evidence into an actionable recommendation

The final step is to turn the combined operational and knowledge context into a recommended course of action. This should include both the recommendation itself and the reasoning behind it, so the field engineer can assess whether it is appropriate in the moment.

## Retrieval Pattern Mapping

| Requirement | What the system needs to do | Retrieval pattern |
| :---- | :---- | :---- |
| Identify the exact chiller unit | Resolve device, site, and service context from trusted identifiers | Deterministic |
| Understand current fault state | Retrieve active alarms, recent events, and operating status | Deterministic |
| Understand historical behavior | Retrieve telemetry, event history, and service records for the unit | Deterministic |
| Find relevant technical guidance | Surface manuals, procedures, and bulletins relevant to the issue | Probabilistic, ideally hybrid |
| Compare with similar incidents | Retrieve prior support cases and similar fault patterns | Probabilistic, ideally hybrid |
| Recommend next steps | Correlate operational facts with retrieved knowledge | Reasoning over both layers |
| Improve future performance | Capture outcomes and resolutions for reuse | Deterministic write, later probabilistic reuse |

## Recommended Architectural Posture

From an architectural standpoint, the strongest pattern is to treat deterministic retrieval as the operational backbone and probabilistic retrieval as the contextual interpretation layer.

In other words:

- Exact data retrieval should answer: what unit is this, what is happening, and what has happened before?  
- Contextual retrieval should answer: what knowledge, procedures, or similar cases help explain it?  
- Agent reasoning should answer: given those facts and that context, what should the engineer do next?

This approach is well-suited to a Virtual Engineer because it mirrors how experienced engineers troubleshoot in practice. They begin by grounding themselves in the exact unit and observed condition, then draw on documentation, prior experience, and analogous cases to decide the next step.

## Summary

The Virtual Engineer use case is clear and technically well-founded. Its success depends less on a general-purpose chatbot experience and more on a disciplined retrieval and reasoning design.

The core recommendation is to design the system around a staged process:

1. Resolve the exact asset and issue  
2. Retrieve deterministic operational facts  
3. Retrieve probabilistic supporting context  
4. Generate explainable recommendations for the human engineer  
5. Capture outcomes to improve future performance

That design provides a practical path from concept to implementation. It also creates a clean framework for translating business requirements into concrete agent actions, data dependencies, retrieval patterns, and, eventually, tool calls and system components.

## 

## Implementation Blueprint

This section translates the requirements above into an initial implementation blueprint. Because not every data detail is fully defined yet, the blueprint intentionally uses named assumptions and illustrative tool-call patterns rather than pretending the final system contracts are already fixed.

The goal is to stay specific enough to guide design and delivery, while remaining honest about what is assumed versus what is already known.

## Working Assumptions

For this first blueprint, the following assumptions are in scope:

- The primary user experience is a mobile workflow with a chat-style interaction  
- The initial entry point is a known `chiller_id`  
- Recommendations remain read-only; the human engineer makes the final decision  
- The system should clearly separate confirmed facts from inferred conclusions  
- All source data used in the recommendation, along with inferred outputs and user feedback, should be stored for future learning  
- Prior support cases are useful advisory inputs, but not the single primary source of truth  
- The system will use a small multi-agent pattern with separate responsibilities  
- Once a user is authenticated, data access is assumed to be available for the relevant unit and supporting records  
- The blueprint should name likely components and tool-call patterns, even where the final system names are not yet known

## High-Level Agent Topology

A practical initial design is a small set of cooperating agents, each with a focused responsibility.

### 1\. Session Orchestrator Agent

This agent manages the user interaction, maintains the troubleshooting session state, and routes work to specialist agents.

Primary responsibilities:

- Accept engineer input in the mobile chat workflow  
- Validate that a `chiller_id` is present  
- Maintain session context  
- Sequence the downstream retrieval and reasoning steps  
- Assemble the final response for the engineer

### 2\. Asset Context Agent

This agent establishes the exact unit context through deterministic lookups.

Primary responsibilities:

- Resolve the exact asset record from `chiller_id`  
- Retrieve model, configuration, site, and installation context  
- Retrieve any key equipment metadata required to scope downstream searches

### 3\. Operational Diagnostics Agent

This agent retrieves the exact operational evidence required for troubleshooting.

Primary responsibilities:

- Retrieve active alarms and recent alarm history  
- Retrieve alarm details and descriptions  
- Retrieve current operating state  
- Retrieve historical telemetry and event data for relevant time windows  
- Retrieve service history and parts history

### 4\. Knowledge Retrieval Agent

This agent retrieves formal technical guidance using hybrid or semantic retrieval patterns.

Primary responsibilities:

- Search manuals, bulletins, procedures, and troubleshooting guides  
- Filter by model family, subsystem, alarm pattern, or symptom where possible  
- Return the most relevant passages for downstream reasoning

### 5\. Case Advisory Agent

This agent retrieves prior support cases as advisory context.

Primary responsibilities:

- Retrieve prior cases using deterministic filters such as product family, alarm category, or issue type  
- Use semantic retrieval over case notes to find similar incidents  
- Return similar cases and resolution patterns as supporting context only

### 6\. Recommendation Synthesis Agent

This agent combines the evidence and produces the response shown to the engineer.

Primary responsibilities:

- Separate facts from inferences  
- Rank likely root causes  
- Recommend next diagnostic steps  
- Provide a probable resolution path where appropriate  
- Show supporting evidence and confidence qualifiers  
- Identify when the evidence is weak, conflicting, or incomplete

### 7\. Feedback Capture Agent

This agent records the outcome of the session for future learning and retrieval.

Primary responsibilities:

- Store the source data references used in the recommendation  
- Store the inferred diagnosis and recommended actions generated by the system  
- Capture the engineer’s positive or negative reaction  
- Capture any final diagnosis, repair notes, or resolution details entered later

## High-Level Execution Flow

The following flow shows how the system should operate in a Phase 1 implementation.

### Step 1: Session initiation

The engineer opens the mobile Virtual Engineer experience and provides a `chiller_id`, along with optional free-text problem context.

Illustrative tool-call pattern:

- `startTroubleshootingSession(chiller_id, user_id)`

### Step 2: Deterministic asset resolution

The Session Orchestrator calls the Asset Context Agent to retrieve the exact unit record.

Illustrative tool-call pattern:

- `getChillerById(chiller_id)`  
- `getChillerConfiguration(chiller_id)`  
- `getSiteContext(chiller_id)`

Expected result:

- exact unit identity  
- model and subsystem context  
- installation or site metadata used to scope later retrieval

### Step 3: Deterministic operational retrieval

The Session Orchestrator calls the Operational Diagnostics Agent to gather the factual operating context. These calls should generally execute in parallel.

Illustrative tool-call pattern:

- `getActiveAlarms(chiller_id)`  
- `getAlarmHistory(chiller_id, lookback_window)`  
- `getAlarmDetails(alarm_code)`  
- `getCurrentDeviceState(chiller_id)`  
- `getTelemetry(chiller_id, time_window)`  
- `getFaultEvents(chiller_id, time_window)`  
- `getServiceHistory(chiller_id)`  
- `getPartsHistory(chiller_id)`

Expected result:

- active fault condition  
- recent pattern of alarms and events  
- telemetry context around the fault  
- maintenance and repair history relevant to interpretation

### Step 4: Retrieval query construction

Once deterministic evidence is collected, the system should construct a structured retrieval query for unstructured knowledge sources.

The query should be based on factual context such as:

- model family  
- active alarm codes  
- affected subsystem  
- observed symptoms  
- recent telemetry anomalies  
- prior repair history where relevant

This is an important design step because the quality of downstream probabilistic retrieval will depend on how well the factual context is turned into search inputs.

### Step 5: Probabilistic knowledge retrieval

The Knowledge Retrieval Agent searches technical documents using hybrid retrieval. This should combine semantic similarity with deterministic filters wherever available.

Illustrative tool-call pattern:

- `searchManuals(query, filters)`  
- `searchTroubleshootingGuides(query, filters)`  
- `searchTechnicalBulletins(query, filters)`  
- `rerankKnowledgeResults(results, context)`

Expected result:

- model-relevant troubleshooting passages  
- alarm-specific procedures  
- known technical advisories  
- ranked technical evidence for synthesis

### Step 6: Advisory case retrieval

The Case Advisory Agent retrieves similar prior support cases. Because cases are assumed to be mostly text-heavy, this should rely on a combination of light deterministic filtering and semantic retrieval over notes.

Illustrative tool-call pattern:

- `filterCases(product_family, alarm_category, status)`  
- `searchCaseNotes(query, filters)`  
- `rerankSimilarCases(results, context)`

Expected result:

- similar prior incidents  
- advisory resolution patterns  
- supporting cautionary evidence where a recommendation worked or failed previously

### Step 7: Recommendation synthesis

The Recommendation Synthesis Agent combines the deterministic and probabilistic evidence into a structured response.

Recommended response structure:

- Confirmed facts  
- Likely root causes  
- Recommended next diagnostic steps  
- Probable resolution path  
- Supporting evidence  
- Assumptions and inferences  
- Confidence and escalation note

This structure matters because the engineer should be able to distinguish what the system knows from what it is inferring.

### Step 8: Feedback and outcome capture

After the engineer reviews the recommendation, the system should store both the decision context and the user reaction.

Illustrative tool-call pattern:

- `storeRecommendationTrace(session_id, source_data_refs, inferred_outputs)`  
- `captureEngineerReaction(session_id, positive_negative_signal)`  
- `captureResolutionOutcome(session_id, resolution_payload)`

Expected result:

- complete audit trail of retrieved evidence  
- reusable recommendation trace for future evaluation  
- structured feedback loop for improving future case retrieval and reasoning

## Requirements-to-Tooling Matrix

The matrix below translates the high-level requirements into concrete implementation patterns. Tool names are illustrative and intended to represent logical service calls or MCP tools.

| Requirement | Agent responsibility | Data required | Retrieval pattern | Illustrative tool or service pattern | Output to engineer |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Identify the exact chiller unit | Asset Context Agent | Asset master record, model, configuration, site context | Deterministic | `getChillerById()` `getChillerConfiguration()` `getSiteContext()` | Confirmed unit identity and scoped equipment context |
| Retrieve current fault state | Operational Diagnostics Agent | Active alarms, current state, recent fault events | Deterministic | `getActiveAlarms()` `getCurrentDeviceState()` `getFaultEvents()` | Active issue summary with exact alarm and device condition |
| Retrieve alarm meaning and details | Operational Diagnostics Agent | Alarm metadata, severity, subsystem, definitions | Deterministic | `getAlarmDetails(alarm_code)` | Alarm explanation tied to the exact unit context |
| Retrieve historical operating behavior | Operational Diagnostics Agent | Telemetry, historical alarms, event history | Deterministic | `getTelemetry()` `getAlarmHistory()` | Historical pattern around the incident |
| Retrieve maintenance context | Operational Diagnostics Agent | Service history, parts history, prior repairs | Deterministic | `getServiceHistory()` `getPartsHistory()` | Relevant maintenance and repair context |
| Retrieve formal troubleshooting guidance | Knowledge Retrieval Agent | Manuals, troubleshooting guides, technical bulletins | Probabilistic, ideally hybrid | `searchManuals()` `searchTroubleshootingGuides()` `searchTechnicalBulletins()` `rerankKnowledgeResults()` | Ranked technical guidance relevant to the exact issue |
| Retrieve similar prior cases | Case Advisory Agent | Case notes, case status, categorization fields, prior resolutions | Probabilistic with light deterministic filters | `filterCases()` `searchCaseNotes()` `rerankSimilarCases()` | Advisory examples of similar incidents and outcomes |
| Generate recommendation | Recommendation Synthesis Agent | Combined deterministic and probabilistic evidence | Reasoning over both layers | `synthesizeRecommendation()` | Facts, inferences, ranked next steps, probable resolution path, evidence |
| Capture user reaction and learning signal | Feedback Capture Agent | User reaction, recommendation trace, inferred outputs | Deterministic write | `captureEngineerReaction()` `storeRecommendationTrace()` | No direct field output; improves future retrieval and evaluation |
| Capture final outcome for reuse | Feedback Capture Agent | Final diagnosis, repair action, outcome notes | Deterministic write | `captureResolutionOutcome()` | No direct field output; becomes reusable advisory memory |

## Why the Blueprint Uses This Structure

The logic behind this design is straightforward.

First, the system must ground itself in exact operational truth. That is why unit identity, alarm state, telemetry, and service context are all treated as deterministic lookups.

Second, the system must interpret those facts using broader technical and experiential context. That is why manuals, bulletins, and prior cases are handled through probabilistic retrieval patterns.

Third, prior cases are intentionally advisory rather than primary. This reduces the risk of the system overfitting to anecdotal historical notes when stronger model-specific or alarm-specific evidence is available elsewhere.

Finally, the recommendation itself must be explainable. A field engineer should see not just what the system suggests, but also what it knows, what it assumes, and why the recommendation was produced.

## Recommended Response Contract

A practical response contract for the mobile chat experience would include the following sections in each answer:

- Unit confirmed  
- Current fault summary  
- Relevant history  
- Likely root causes  
- Recommended next actions  
- Evidence used  
- Assumptions and inferences  
- Confidence / caution note

This response contract helps keep the experience operationally useful. It also provides a clean structure for trace storage, later evaluation, and future refinement of the recommendation logic.

## Blueprint Summary

The implementation blueprint for the Virtual Engineer should therefore be built around:

1. deterministic grounding on the exact chiller and its operating state  
2. probabilistic retrieval of manuals, technical guidance, and advisory prior cases  
3. a small multi-agent pattern with focused responsibilities  
4. a structured recommendation that clearly separates facts from inferences  
5. feedback capture that stores both source evidence and the engineer’s reaction for future learning

This provides a practical and credible path to move from concept into design without needing every underlying collection or contract to be finalized on day one.