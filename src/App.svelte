<script lang="ts">
  import type { Vote as VoteType } from "./api";
  import { fetchVotes } from "./api";

  import Vote from "./Vote.svelte";

  let votes: VoteType[] = [];
  const termOptions = ["33", "32", "31"];
  let selectedTerm = termOptions[0];

  async function init() {
    votes = [];
    const allVotes = await fetchVotes(selectedTerm);
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
  <section class="section">
    <div class="container">
      <h1 class="title">Breaking Ranks</h1>
      <!-- svelte-ignore a11y-no-onchange -->
      <select bind:value={selectedTerm} on:change={init}>
        {#each termOptions as termOption}
          <option value={termOption}>{termOption}</option>
        {/each}
      </select>
      {#each votes as vote}
        <Vote {vote} />
      {:else}Loading...{/each}
    </div>
  </section>
</main>
