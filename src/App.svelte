<script lang="ts">
  import { fetchVotes } from "./api";

  let votes: string[] = [];

  async function init() {
    votes = await fetchVotes();
  }

  init();
</script>

<main>
  <h1>Breaking Rank</h1>
  <ul>
    {#each votes as vote}
      <li>{vote}</li>
    {/each}
  </ul>
</main>
