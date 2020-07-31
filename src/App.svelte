<script lang="ts">
  import type { Vote as VoteType } from "./api";
  import { fetchVotes } from "./api";

  import Vote from "./Vote.svelte";

  let votes: VoteType[] = [];

  async function init() {
    votes = await fetchVotes();
  }

  init();
</script>

<main>
  <h1>Breaking Ranks</h1>
  {#each votes as vote}
    <Vote {vote} />
  {/each}
</main>
