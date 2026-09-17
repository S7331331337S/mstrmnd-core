-- ============================================================
-- MASTERBRAIN — Seed: The 15 Archetypes
-- ============================================================
-- 12 council seats + Orchestrator + Elder + Adversary
-- ============================================================

insert into archetypes (id, name, agent_codename, layer, responsibility) values

-- ----- CAPITAL -----
('allocator',    'The Allocator',    'LEDGER',   'capital',
 'Capital decisions, budget allocation, runway, ROI analysis, unit economics.'),
('strategist',   'The Strategist',   'AXIOM',    'capital',
 'Org direction, market positioning, competitive strategy, where to point.'),

-- ----- BUILDING -----
('architect',    'The Architect',    'FORGE',    'building',
 'Systems engineering, infrastructure, technical architecture, what gets shipped.'),
('artisan',      'The Artisan',      'CANVAS',   'building',
 'Design, brand, visual taste, product form, the look and feel.'),
('researcher',   'The Researcher',   'SCOUT',    'building',
 'Frontier research, market scanning, competitive intelligence, what is knowable.'),

-- ----- OPERATING -----
('steward',      'The Steward',      'CIPHER',   'operating',
 'Day-to-day ops, security, compliance, the trains running on time.'),
('closer',       'The Closer',       'ENVOY',    'operating',
 'Deal mechanics, negotiation, pricing, conversion. Turns intent into closed business.'),
('grower',       'The Grower',       'VECTOR',   'operating',
 'Distribution, channel strategy, content compounding, funnel ownership.'),

-- ----- NETWORK -----
('herald',       'The Herald',       'HERALD',   'network',
 'Outbound communications, announcements, public comms, status updates.'),
('connector',    'The Connector',    'WEAVER',   'network',
 'Relationship graph, intro routing, who-knows-who, the human network.'),
('storyteller',  'The Storyteller',  'BARD',     'network',
 'Mission shaping, longform narrative, brand voice arbitration, the meaning.'),

-- ----- VISION (synthesizer) -----
('oracle',       'The Oracle',       'ORACLE',   'vision',
 'Pattern recognition across all layers, forecasting, synthesis of weak signals.'),

-- ----- META (outside the council) -----
('orchestrator', 'The Orchestrator', 'NEXUS',    'meta',
 'Convenes, routes, synthesizes. The chair. Does not deliberate, only orchestrates.'),
('elder',        'The Elder',        'CANON',    'meta',
 'Institutional memory. Surfaces priors. Knows what was tried, what worked, what did not.'),
('adversary',    'The Adversary',    'HEX',      'meta',
 'Red-teams every consequential decision. Produces the strongest argument against. The forced no.');
