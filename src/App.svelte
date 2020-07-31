<script lang="ts">
  import type { Vote as VoteType } from "./api";
  import { fetchVotes } from "./api";

  import Vote from "./Vote.svelte";

  let votes: VoteType[] = [];
  let term = 33;

  async function init() {
    const allVotes = await fetchVotes(term);
    votes = allVotes.filter(vote => {
      return (
        vote.breakingRanksPartyCodes.length > 0 &&
        !(
          vote.breakingRanksPartyCodes.length === 1 &&
          vote.breakingRanksPartyCodes[0] === "Independent"
        )
      );
    });
  }

  init();
</script>

<main>
  <h1>Breaking Ranks</h1>
  {#each votes as vote}
    <Vote {vote} />
  {/each}
</main>
