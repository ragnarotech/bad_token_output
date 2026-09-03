# The incident
The Goodput Simulator is here to put you in my shoes for a day. It recreates a production incident pattern from the first week we were self-hosting the model in our air-gapped environment, whose simplest solution was to let fewer users in at a time.

When we started self-hosting the model, everything was great. It was performant and more intelligent than any other model we worked with. Then came more users, and users who tried to squeeze everything out of the system. Every day in the beginning was the same: everything was great until about 10am, then everything started to slow as demand began to surpass supply. By noon, nearly zero requests were resulting in successful tokens making it to the users, but our GPUs were spinning at 100%. We had near zero "Goodput".

What makes this simulator interesting, and what we experienced in our deployment, is that you can tune the distribution of prefill/decode servers to prevent the system from melting down, but it would only last for a day or two until our users' usage patterns changed. Ultimately we learned that, at the limited scale of our deployment, capping the number of concurrent requests into the system prevented it from overloading and got more tokens to the users. Failing early and cheaply keeps the overall system stable.

# Theme and approach
This is a Theme 1 submission, Exploration & Understanding: a simulation of emergent dynamics, built from the Systems & Reliability domain I operate in. The Goodput Simulator is here to give you a place to explore and understand how throughput doesn't mean goodput. When reviewing the requirements for the take-home assignment and my vision to share this counterintuitive simulation scenario, a React browser experience made the most sense. Though TypeScript and React are not a language or framework I use regularly, I've done work with them and understand the design principles of those systems, and knew I could guide Claude to create a tasteful solution. As a simulation in a browser there was no need to provide an API key for inference or install any software. It would produce the best user experience with the least amount of failure modes.

# What is non-obvious
There are three areas where this simulation explores non-obvious solutions. First and foremost, limiting how many requests get into the inference system can increase how many requests are successfully returned to a client who hasn't given up. Additionally, there are two red herrings to provide as educational events for the user. When the user attempts to add more prefill servers or increase client timeouts, the narrator at the bottom of the application points out that they have traded decode capacity to feed the same retry stampede, or given the zombies longer to pile up behind the clients, and challenges them to check whether that configuration survives "The Spike". Finally, there is the whole idea of throughput vs goodput. Throughput is measuring how many tokens we processed and produced; goodput is measuring how many of those tokens reached the client.

# Key decisions and tradeoffs
In working out the spec, tradeoffs were made in two dimensions: implementation time and user experience/system performance.

Implementation time tradeoffs included:
- Limiting the number of dials or parameters the engine accepted. Prefill and decode tokens per second are frozen constants because they belong to the model, vendor, and hardware, not the operator.
- An oblivious server: once admitted, a request runs full prefill and decode even after its client hangs up. There is no streaming toggle and no decode early-exit, so ghost waste is somewhat overstated compared to what we saw in production.
- Not accounting for prompt caching. Without it every retry costs full price, which sharpens the retry-storm lesson.

Decisions that make the simulation honest:
- A seeded RNG and a ghost run of the previous attempt, so a re-run is the same day and the same users with one dial different.
- The engine was built first with TDD, and the collapse had to emerge in headless integration tests before any UI was written.
- After my interactive testing found that a 9:1 prefill:decode split could win with almost no delivered tokens, and that thinking budgets were missing from the decode stage, the decode tokens per second were recalibrated and the win condition became three headline numbers: goodput %, useful TPM, and help tickets.

In the user experience and system performance decision space, the focus was on reasonable upper bounds for the dials and ensuring uniformity and human readability.

# How I used Claude
Claude was used throughout this assignment as a partner and worker. Claude and I started out brainstorming and refining the spec for our build. Given the spec, Claude created an initial plan. I then thoroughly reviewed the plan and further refined and iterated on it. Once the plan and spec were completed, I let Claude orchestrate subagents to execute the plan. Once built, I was able to test the application and identify several quality and user experience bugs: uniformly displaying tokens as TPM, using human-readable numbers, zooming/resizing the window causing graph component errors, an unexpected win condition, and not accounting for thinking tokens. I then used Claude to verify and correct these issues. Finally, I used Claude to help refine this written documentation.

# With more time
Given more time, my focus would be creating an actual server-side or thick-client simulator so more parameters can be used, and a more accurate simulation of the environment can be created. I'd focus on model/cache warming and cache eviction/thrashing under different traffic patterns, since this has always caused trouble in the self-hosted scenario. This is especially true in our air-gapped environment, where the law of large numbers does not smooth demand into an even distribution, making it hard to tune with such limited hardware. I'd also want to start tracking token fairness and how user behavior can cause high goodput but low user token fairness. For example, our initial basic user fairness was that every user could only have 1 concurrent request at a time, but under high load we had some users who would have multiple sessions running on infinite retries, saturating the concurrent user gate at the front door. That would need additional dials and algorithms to cheaply determine which requests get model access.

# Artifacts
- [Goodput Simulator Prototype](https://ragnarotech.github.io/goodput-simulator/)
- [GitHub repo](https://github.com/ragnarotech/goodput-simulator)
- [Spec](docs/superpowers/specs/2026-08-30-goodput-simulator-design.md)
- [Plan](docs/superpowers/plans/2026-08-30-goodput-simulator.md)
- Claude conversations: attached to the submission as a zip

# Time spent

| Activity | Time |
| ---- | ---- |
| Ideation/Planning  | 1.5h |
| Human Spec Review  | 0.5h |
| Agentic Build      | 2.0h |
| Testing (round 1)  | 0.5h |
| Debug/Refinement   | 0.5h |
| Testing (round 2)  | 0.5h |
| Deployment         | 0.5h |
| Write-up/Video     | 1.0h |
| **Total**          | 7.0h |
