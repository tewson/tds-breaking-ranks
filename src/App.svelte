<script lang="ts">
  import { fetchMembers, fetchVotes } from "./api";

  let members: any[] = [];
  let votes: string[] = [];

  async function init() {
    members = await fetchMembers();
    votes = await fetchVotes();
  }

  init();
</script>

<main>
  <h1>Breaking Ranks</h1>
  <ul>
    {#each members as member}
      <li>{member.fullName}</li>
    {/each}
  </ul>
  <ul>
    {#each votes as vote}
      <li>{vote}</li>
    {/each}
  </ul>
</main>
