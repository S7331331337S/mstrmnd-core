import type { AgentId } from "@/agents/roster";
import type { Provider, ProviderRequest, StreamChunk } from "@/lib/types";

/**
 * Offline board. No network, no key.
 *
 * This is a scripted stand-in, not a model: it composes an in-character line from
 * templates so the whole app — the room, the pacing, the ruling, history — can be
 * used and demoed before anyone signs in to MSTRMND OS. Every line is deliberately about
 * *how* that member thinks, since it cannot actually reason about the topic.
 */
export function createDemoProvider(): Provider {
  return {
    kind: "demo",
    async *stream(request: ProviderRequest): AsyncGenerator<StreamChunk> {
      const text = compose(request);

      // Stream in word groups so the room animates the same way it does live.
      const words = text.split(" ");
      let cursor = 0;

      while (cursor < words.length) {
        if (request.signal?.aborted) return;

        const take = 1 + Math.floor(Math.random() * 3);
        const slice = words.slice(cursor, cursor + take).join(" ");
        cursor += take;

        yield { type: "delta", text: cursor === take ? slice : ` ${slice}` };
        await pause(28 + Math.random() * 55);
      }

      yield { type: "done" };
    },
  };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Trim the topic to something that reads naturally mid-sentence. */
function subject(topic: string): string {
  const clean = topic.trim().replace(/[.?!]+$/, "");
  if (!clean) return "this";
  const short = clean.length > 68 ? `${clean.slice(0, 65).trimEnd()}…` : clean;
  return short.charAt(0).toLowerCase() + short.slice(1);
}

const OPENING: Record<AgentId, (s: string) => string[]> = {
  architect: (s) => [
    `On ${s} — my first question is which part of this is a one-way door. Everything reversible we can decide fast and badly; the irreversible pieces deserve a week of real design. My instinct is that the integration surface is where this gets expensive, not the feature itself. Name the system this has to talk to and I'll tell you whether the timeline is honest.`,
    `I can build ${s}. What I can't do is build it and the three things underneath it that nobody has scoped. The failure mode here is not technical difficulty, it's the quiet dependency that shows up in week six. Give me the smallest version that still exercises the risky path, and we'll learn more in ten days than in a month of planning.`,
  ],
  operator: (s) => [
    `Let's make ${s} concrete. What ships in the next fourteen days, and whose name is on it? If the first checkpoint is further out than that, the plan is a wish. I'd cut this to one owner, one deliverable, one date, and let the second step be decided by what we learn from the first.`,
    `My problem with ${s} as stated is that it has no Monday. I want a scope small enough that one person can finish it this week without asking anyone's permission. Everything else gets parked in writing so it doesn't leak back in. Momentum is the resource we're actually short on.`,
  ],
  closer: (s) => [
    `Before anyone builds anything for ${s} — who pays, and what are they paying for today instead? If there's an existing budget line we're displacing, this is easy. If we're creating a new one, it's a two-year sale and we should know that now. Go get three people to say yes to a description of it before we write code.`,
    `I'd sell ${s} before it exists. Not a survey — an actual ask for money, from someone who has the problem this week. The answer tells you more than the whole rest of this conversation. And if you can't find the three people to ask, that itself is the finding.`,
  ],
  contrarian: (s) => [
    `Here's how ${s} fails. The plan assumes attention that nobody in this room has actually committed, and in twelve months the honest post-mortem says we were busy with something else. The load-bearing assumption is demand, and it hasn't been tested — it's been asserted. Convince me with one person outside this conversation who wants it.`,
    `Everyone is arguing about how to do ${s} and nobody has argued about whether. The strongest case against is opportunity cost: this consumes the exact capacity that the thing already working needs to grow. I'm not saying no. I'm saying the yes has to be worth what it kills.`,
  ],
  visionary: (s) => [
    `We're optimizing a small version of ${s}. The interesting question is what this looks like if it works completely — and I suspect the 10x version costs roughly what the 1x version costs, because the hard part is the same. Aim there, take the first step that keeps the bigger option open, and don't foreclose it for a quarter of convenience.`,
    `${s.charAt(0).toUpperCase() + s.slice(1)} is being framed as a project. It's more useful as a wedge. The first move should be the one that earns the right to do the much larger second move, even if it's slower. Solving the symptom well is how good teams stay small.`,
  ],
  quant: (s) => [
    `Numbers on ${s}: assuming a loaded cost around $75 an hour and a four-week build, that's roughly $12,000 committed before a single user touches it. For that to clear, it needs to return about $1,000 a month for a year. Ask whether the realistic version of this clears that bar — and if the answer is "probably", it doesn't.`,
    `The decision on ${s} is dominated by one variable nobody has named: how long until it pays back. Under ninety days, do it now and stop debating. Past a year, it's a bet, not an investment, and it should be sized like one. Everything in between deserves the cheap experiment first.`,
  ],
  storyteller: (s) => [
    `If we can't say ${s} in one line, we don't have it yet. Right now the pitch is a category, not a promise — and categories don't get remembered. Try this: "the fastest way to know if this is worth doing." If that sentence is wrong, the product is probably wrong too.`,
    `Positioning on ${s} is a product decision, not a launch task. The version I can explain in eight words is a different product from the one described here, and it's a better one. Write the sentence first, then build the thing that earns it.`,
  ],
  chair: () => [""],
};

const CROSSFIRE: Record<AgentId, (s: string, other: string) => string[]> = {
  architect: (_s, other) => [
    `${other} is describing a timeline that assumes nothing surprising happens, which has never once been true here. I'll support the aggressive version on one condition: we build the risky integration first, not last. If it holds, everything after it is scheduling. If it doesn't, we've saved a month.`,
  ],
  operator: (_s, other) => [
    `I'm with ${other} on direction and against them on sequencing. All of this becomes real or doesn't in the first two weeks, so I want the smallest slice that produces a decision, not a demo. Let's put a date on it in this conversation rather than after it.`,
  ],
  closer: (_s, other) => [
    `${other} is solving for correctness and I'm solving for whether anyone wants it — and those give different first steps. Mine is cheaper. Give me a week to find three buyers; if I can't, the engineering debate was moot and we've spent almost nothing finding out.`,
  ],
  contrarian: (_s, other) => [
    `${other} just moved from "we should" to "we will" without anyone testing the assumption underneath. That's the moment plans go wrong, and it happened about a minute ago. I'll withdraw the objection the day someone shows me evidence from outside this room.`,
  ],
  visionary: (_s, other) => [
    `${other} is right about the constraint and wrong about what it implies. Constraints should shape the first move, not the destination — and we're about to let a scheduling problem pick our strategy. Keep the small first step, but stop pretending it's the whole plan.`,
  ],
  quant: (_s, other) => [
    `${other}'s version changes the math more than they realize. Cutting scope roughly halves the cost and barely touches the upside, which is the best trade anyone has proposed. That alone should decide the sequencing argument.`,
  ],
  storyteller: (_s, other) => [
    `Listening to ${other}, I notice we still can't describe this to someone outside the room in a sentence. That's not a communication gap, it's an unfinished decision. Whichever path we take, it has to survive being said out loud to a stranger.`,
  ],
  chair: () => [""],
};

function composeRuling(topic: string, priorSpeakers: string[]): string {
  const cited = priorSpeakers.slice(0, 2).join(" and ") || "the board";
  return [
    "THE CALL",
    `Run the cheapest test of ${subject(topic)} that produces a real decision, and give it two weeks — not a full build.`,
    "",
    "WHY",
    `${cited} converged on the same thing from opposite directions: the expensive part of this is committing before the core assumption is tested. A two-week slice costs little and settles the argument with evidence instead of conviction.`,
    "",
    "THE REAL DISAGREEMENT",
    "Whether demand is proven or merely assumed. Everything else in this room follows from that answer, and nobody has it yet.",
    "",
    "DO THIS WEEK",
    "1. Write the one-sentence version and send it to three people outside this conversation.",
    "2. Build only the riskiest slice — the part that would kill this if it doesn't work.",
    "3. Set the kill criteria now, in writing, before you're attached to the outcome.",
    "",
    "— Offline board. Sign in to MSTRMND OS in Settings for a live deliberation.",
  ].join("\n");
}

function compose(request: ProviderRequest): string {
  const { agentId, topic, round, priorSpeakers } = request.meta;
  const s = subject(topic);

  if (round === "ruling") return composeRuling(topic, priorSpeakers);
  if (round === "crossfire") {
    const other = priorSpeakers.length
      ? pick(priorSpeakers)
      : "the room";
    return pick(CROSSFIRE[agentId](s, other));
  }
  return pick(OPENING[agentId](s));
}
