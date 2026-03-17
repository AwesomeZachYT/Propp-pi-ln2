# Propp π / ln 2 Coin Simulator
A website that visualizes a recently discovered Monte Carlo method of estimating pi and ln 2.

Propp, J., first publicized this phenomenon in February of 2026 in a preprint on arXiv titled _[Estimating π with a Coin](https://arxiv.org/abs/2602.14487)_, though he links to [an earlier article](https://arxiv.org/abs/2504.06817) by Gerhold, S., and Hubalek, F., where they derive the same proof. Unfortunately, I'm not knowledgable enough to give a detailed and sophisticated explanation of the proof described by Propp, and it's too complicated to cram into a single paragraph regardless. You can check out Propp's preprint for information about the proof, as well as [Matt Parker's](https://youtu.be/kahGSss6SsU?si=EtxEL-FBeKwoEgiV) video on the matter, though neither gives a full and in-depth explanation on the context needed to truly understand the proof, so I do advise doing your own research on certain parts.

# The Algorithm
Despite its complicated proof, this method of estimating pi is much simpler than most, as the only material necessary is a single coin. I know, shocker. It's not like that was hinted at in the site's name. A pen and paper are still very helpful, though, just to keep track of the results.

1. Flip the coin.
2. Keep flipping the coin until the number of heads flipped exceeds the number of tails flipped, e.g., 6 heads and 5 tails. Record the ratio of Heads/Total Flips, even if the ratio is 1/1.
3. That is one trial. Repeat steps one and two for as long as you feel like. You may restart a trial if you decide the trial has taken too long.
4. When you are done, average all the ratios and multiply by four. This will give you a decent approximation for pi.

Another detail that I've noticed is often skipped is how this same algorithm can be used to estimate _ln 2_. The only differences are that you terminate a sequence/trial when you have a surplus of 2 heads (2 more heads than tails), and that there is no multiplication needed after finding the average ratio. People don't care about it as much since pi is so much more recognizable, but I still find this phenomenon just as interesting, especially since the average itself converges to _ln 2_ without any multiplication necessary.

# Proof?
The proof takes aspects of many different, seemingly unrelated subjects of math, and I'm not knowledgeable enough to sincerely describe it in its entirety. However, if you are interested, I would advise watching [Matt Parker's video](https://youtu.be/kahGSss6SsU?si=EtxEL-FBeKwoEgiV), where he breaks it down in a more digestible manner, as well as [Propp's article](https://arxiv.org/abs/2602.14487) on the matter. They both skim over certain details, though, but they leave enough information for a truly dedicated person to know where to start.

# The Website
It's pretty much a glorified coin flipper. It provides certain statistics as well as a cool-looking graph that updates in real-time. The user can set the total number of trials that are run, as well as the maximum number of flips before a trial resets to prevent a sequence from continuing forever. The surplus input represents how many more heads than tails are needed for a sequence to terminate, as well as a multiplier input that is applied to each recorded ratio. There is also a toggle that allows the user to view the location of the two relevant constants, pi and _ln 2_, on the graph.

There is an import section where the user can give a `TXT` file, and the Hs, Ts, 0s, and 1s in the file are automatically read and put into the graph using the algorithm, ignoring all other characters. Text can also be input directly into the website without a file. Finally, the user can export certain statistics onto a `CSV`, `JSON`, `XML`, or `XLSX` file.
